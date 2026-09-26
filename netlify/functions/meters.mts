import type { Config } from "@netlify/functions";
import { eq, or, desc } from "drizzle-orm";
import { db } from "../../db/index.js";
import { meters, vendTokens } from "../../db/schema.js";
import { ok, fail, handler, readJson, requireFields, methodNotAllowed, HttpError } from "../lib/http.mjs";
import { hasAdminSession, resolveApiKey, requireReadAccess, requireWriteAccess } from "../lib/auth.mjs";
import { DEFAULT_TARIFF_KOBO_PER_KWH } from "../lib/money.mjs";

export const DISCOS = ["AEDC", "BEDC", "EKEDC", "EEDC", "IBEDC", "IKEDC", "JED", "KAEDCO", "KEDCO", "PHED", "YEDC", "Aba Power", "Mini-grid / private"];
const BANDS = ["A", "B", "C", "D", "E"];
const METER_TYPES = ["single-phase", "three-phase"];
const STATUSES = ["pending-verification", "verified", "linked", "rejected", "suspended"];
const EMAIL = /^[^@\s]+@[^@\s.]+\.[^@\s]+$/;

/** Meter numbers are stored as digits only, so "4512 8890 231" and "45128890231" are the same meter. */
export function normaliseMeterNumber(value: unknown) {
  return String(value ?? "").replace(/[\s-]/g, "");
}

const str = (v: unknown, max = 200) => String(v ?? "").trim().slice(0, max);

/** What anyone holding a meter number may see — no names, phones, emails or addresses. */
function publicView(m: typeof meters.$inferSelect) {
  return {
    meterNumber: m.meterNumber,
    disco: m.disco,
    tariffBand: m.tariffBand,
    tariffKoboPerKwh: m.tariffKoboPerKwh,
    meterType: m.meterType,
    status: m.status,
  };
}

/** Validates a registration body and returns the row to insert. Throws a 422 naming the problem. */
function registrationFrom(body: Record<string, unknown>) {
  requireFields(body, ["meterNumber", "holderName", "email", "phone", "address", "disco"]);
  const meterNumber = normaliseMeterNumber(body.meterNumber);
  if (!/^\d{6,20}$/.test(meterNumber)) throw new HttpError("The meter number should be 6 to 20 digits", 422);
  const email = str(body.email).toLowerCase();
  if (!EMAIL.test(email)) throw new HttpError("Please enter a valid email address", 422);
  const phone = str(body.phone, 40);
  if (phone.replace(/\D/g, "").length < 7) throw new HttpError("Please enter a valid phone number", 422);
  const disco = str(body.disco, 60);
  if (!DISCOS.includes(disco)) throw new HttpError("Please choose your electricity distribution company", 422);
  const tariffBand = str(body.tariffBand || "C", 2).toUpperCase();
  if (!BANDS.includes(tariffBand)) throw new HttpError("Tariff band must be A, B, C, D or E", 422);
  const meterType = str(body.meterType || "single-phase", 20);
  if (!METER_TYPES.includes(meterType)) throw new HttpError("Meter type must be single-phase or three-phase", 422);
  const floor = Number(body.autoTopupFloorKwh ?? 20);

  return {
    meterNumber,
    imei: str(body.imei, 40) || null,
    rfid: str(body.rfid, 40) || null,
    holderName: str(body.holderName, 120),
    email,
    phone,
    address: str(body.address, 300),
    state: str(body.state, 60),
    disco,
    tariffBand,
    meterType,
    tariffKoboPerKwh: Number.isFinite(Number(body.tariffKoboPerKwh)) && Number(body.tariffKoboPerKwh) > 0
      ? Math.round(Number(body.tariffKoboPerKwh))
      : DEFAULT_TARIFF_KOBO_PER_KWH,
    autoTopupFloorKwh: Number.isFinite(floor) && floor >= 0 ? Math.min(Math.round(floor), 1000) : 20,
  };
}

async function findMeter(number: string) {
  const [row] = await db.select().from(meters).where(eq(meters.meterNumber, normaliseMeterNumber(number))).limit(1);
  return row;
}

export default handler(async (req, ctx) => {
  const path = new URL(req.url).pathname;

  /* ------------------------------------------- is this meter already signed up? */
  if (path.endsWith("/verify")) {
    if (req.method !== "POST") return methodNotAllowed(["POST"]);
    const body = await readJson(req);
    const identifier = str(body.meterNumber ?? body.imei ?? body.rfid ?? body.identifier, 40);
    if (!identifier) throw new HttpError("Provide a meter number, IMEI or RFID", 422);
    const [existing] = await db
      .select()
      .from(meters)
      .where(or(eq(meters.meterNumber, normaliseMeterNumber(identifier)), eq(meters.imei, identifier), eq(meters.rfid, identifier)))
      .limit(1);
    if (!existing) return ok({ found: false });
    return ok({ found: true, meter: publicView(existing) });
  }

  /* ------------------------------------------------------------- sign a meter up */
  if (path.endsWith("/register")) {
    if (req.method !== "POST") return methodNotAllowed(["POST"]);
    const body = await readJson(req);
    const values = registrationFrom(body);

    // Website signups wait for an operator to confirm them. A partner calling with a
    // write-scoped key (a DisCo, bank or agency that has already KYC'd the customer)
    // can register a meter as verified straight away.
    const key = await resolveApiKey(req);
    const partner = key && ((key.scopes as string[]) ?? []).includes("write") ? key : null;

    const existing = await findMeter(values.meterNumber);
    if (existing) {
      throw new HttpError(
        "This meter number is already registered. If you believe this is a mistake, email signup@enapoint.com and we will sort it out.",
        409,
      );
    }

    const [row] = await db
      .insert(meters)
      .values({
        ...values,
        source: partner ? `api:${partner.id}` : "website",
        status: partner ? "verified" : "pending-verification",
        verifiedAt: partner ? new Date() : null,
      })
      .returning();
    return ok(
      {
        registered: true,
        meter: publicView(row),
        reference: `ENA-M${String(row.id).padStart(6, "0")}`,
        reply: partner
          ? "Meter registered and verified."
          : "Thank you — your meter registration has been received. Our team verifies the details with your distribution company and confirms by email, usually within one working day.",
      },
      201,
    );
  }

  const number = ctx.params?.number as string | undefined;

  /* ---------------------------------------------------- operator / partner update */
  if (req.method === "PATCH" && number) {
    await requireWriteAccess(req);
    const body = await readJson(req);
    const meter = await findMeter(number);
    if (!meter) return fail("Meter not found", 404);
    const patch: Partial<typeof meters.$inferInsert> = {};
    if (body.status !== undefined) {
      const status = str(body.status, 40);
      if (!STATUSES.includes(status)) throw new HttpError(`Status must be one of: ${STATUSES.join(", ")}`, 422);
      patch.status = status;
      if (status === "verified" && !meter.verifiedAt) patch.verifiedAt = new Date();
    }
    if (body.tariffBand !== undefined) {
      const band = str(body.tariffBand, 2).toUpperCase();
      if (!BANDS.includes(band)) throw new HttpError("Tariff band must be A, B, C, D or E", 422);
      patch.tariffBand = band;
    }
    if (body.tariffKoboPerKwh !== undefined) patch.tariffKoboPerKwh = Math.max(1, Math.round(Number(body.tariffKoboPerKwh) || 0));
    if (body.disco !== undefined) patch.disco = str(body.disco, 60);
    if (!Object.keys(patch).length) throw new HttpError("Nothing to update", 422);
    const [row] = await db.update(meters).set(patch).where(eq(meters.id, meter.id)).returning();
    return ok({ meter: row });
  }

  /* ------------------------------------------------------------------ read */
  if (req.method === "GET") {
    if (!number) {
      await requireReadAccess(req);
      const status = new URL(req.url).searchParams.get("status");
      const query = db.select().from(meters);
      const rows = await (status ? query.where(eq(meters.status, status)) : query)
        .orderBy(desc(meters.registeredAt))
        .limit(200);
      return ok({ meters: rows });
    }
    const row = await findMeter(number);
    if (!row) return fail("Meter not found", 404);
    // Full record, including holder details, only for operators and API-key holders.
    const privileged = hasAdminSession(req) || Boolean(await resolveApiKey(req));
    if (!privileged) return ok({ meter: publicView(row) });
    const tokens = await db
      .select()
      .from(vendTokens)
      .where(eq(vendTokens.meterNumber, row.meterNumber))
      .orderBy(desc(vendTokens.createdAt))
      .limit(10);
    return ok({ meter: row, tokens });
  }

  return methodNotAllowed(["GET", "POST", "PATCH"]);
});

export const config: Config = {
  // All four land in this function; the handler dispatches on the pathname, so the
  // literal routes are checked before the :number catch-all.
  path: ["/api/meters", "/api/meters/verify", "/api/meters/register", "/api/meters/:number", "/api/v1/meters", "/api/v1/meters/verify", "/api/v1/meters/register", "/api/v1/meters/:number"],
};
