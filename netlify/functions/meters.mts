import type { Config } from "@netlify/functions";
import { eq, or, desc } from "drizzle-orm";
import { db } from "../../db/index.js";
import { meters, vendTokens } from "../../db/schema.js";
import { ok, fail, handler, readJson, requireFields, methodNotAllowed, HttpError } from "../lib/http.mjs";
import { requireReadAccess } from "../lib/auth.mjs";
import { DEFAULT_TARIFF_KOBO_PER_KWH } from "../lib/money.mjs";

const DISCOS = ["EKEDC", "IKEDC", "AEDC", "PHED", "KEDCO", "IBEDC", "JED", "BEDC", "EEDC", "KAEDCO", "YEDC"];

/** Deterministic stand-in for the disco lookup a real registration would perform. */
function lookupOnGrid(identifier: string) {
  const digits = identifier.replace(/\D/g, "");
  if (digits.length < 6) return null;
  let hash = 0;
  for (const ch of digits) hash = (hash * 31 + Number(ch)) % 100000;
  const meterNumber = `${digits.slice(0, 4)} ${digits.slice(4, 8).padEnd(4, "0")} ${String(hash).padStart(3, "0").slice(0, 3)}`;
  return {
    meterNumber,
    disco: DISCOS[hash % DISCOS.length],
    tariffBand: ["A", "B", "C", "D"][hash % 4],
    tariffKoboPerKwh: DEFAULT_TARIFF_KOBO_PER_KWH + (hash % 9) * 1500,
  };
}

export default handler(async (req, ctx) => {
  const path = new URL(req.url).pathname;

  /* ------------------------------------------------ step 1: find on the grid */
  if (path.endsWith("/verify")) {
    if (req.method !== "POST") return methodNotAllowed(["POST"]);
    const body = await readJson(req);
    const identifier = String(body.imei ?? body.rfid ?? body.identifier ?? "").trim();
    if (!identifier) throw new HttpError("Provide an IMEI, RFID or meter number", 422);

    const [existing] = await db
      .select()
      .from(meters)
      .where(or(eq(meters.imei, identifier), eq(meters.rfid, identifier), eq(meters.meterNumber, identifier)))
      .limit(1);
    if (existing) return ok({ found: true, alreadyLinked: true, meter: existing });

    const found = lookupOnGrid(identifier);
    if (!found) return fail("No device found for that identifier", 404, { found: false });
    return ok({ found: true, alreadyLinked: false, device: found });
  }

  /* ------------------------------------------------ step 2: link to account */
  if (path.endsWith("/register")) {
    if (req.method !== "POST") return methodNotAllowed(["POST"]);
    const body = await readJson(req);
    requireFields(body, ["meterNumber", "holderName"]);
    const meterNumber = String(body.meterNumber).trim();

    const [existing] = await db.select().from(meters).where(eq(meters.meterNumber, meterNumber)).limit(1);
    if (existing) return ok({ meter: existing, alreadyLinked: true });

    const [row] = await db
      .insert(meters)
      .values({
        meterNumber,
        imei: body.imei ? String(body.imei) : null,
        rfid: body.rfid ? String(body.rfid) : null,
        holderName: String(body.holderName),
        address: (body.address as string) ?? "",
        disco: (body.disco as string) ?? "",
        tariffBand: (body.tariffBand as string) ?? "C",
        tariffKoboPerKwh: Number(body.tariffKoboPerKwh ?? DEFAULT_TARIFF_KOBO_PER_KWH),
        phone: (body.phone as string) ?? "",
        autoTopupFloorKwh: Number(body.autoTopupFloorKwh ?? 20),
        status: "linked",
      })
      .returning();
    return ok({ meter: row, alreadyLinked: false }, 201);
  }

  /* ---------------------------------------------------------- read a meter */
  if (req.method === "GET") {
    const number = ctx.params?.number as string | undefined;
    if (!number) {
      await requireReadAccess(req);
      const rows = await db.select().from(meters).orderBy(desc(meters.registeredAt)).limit(100);
      return ok({ meters: rows });
    }
    const [row] = await db.select().from(meters).where(eq(meters.meterNumber, number)).limit(1);
    if (!row) return fail("Meter not found", 404);
    const tokens = await db
      .select()
      .from(vendTokens)
      .where(eq(vendTokens.meterNumber, row.meterNumber))
      .orderBy(desc(vendTokens.createdAt))
      .limit(10);
    return ok({ meter: row, tokens });
  }

  return methodNotAllowed(["GET", "POST"]);
});

export const config: Config = {
  // All four land in this function; the handler dispatches on the pathname, so the
  // literal routes are checked before the :number catch-all.
  path: ["/api/meters", "/api/meters/verify", "/api/meters/register", "/api/meters/:number"],
};
