import type { Config } from "@netlify/functions";
import { eq, desc } from "drizzle-orm";
import { db } from "../../db/index.js";
import { orders, vendTokens } from "../../db/schema.js";
import { ok, fail, handler, readJson, requireFields, methodNotAllowed, HttpError } from "../lib/http.mjs";
import { requireReadAccess, requireWriteAccess } from "../lib/auth.mjs";
import {
  provider,
  newReference,
  quote,
  createCheckout,
  verifyWithProvider,
  settleOrder,
  recordEvent,
} from "../lib/payments.mjs";

const AMOUNT_MIN_KOBO = 10000; // N100
const AMOUNT_MAX_KOBO = 50000000; // N500,000

function amountFrom(body: Record<string, unknown>) {
  const kobo =
    body.amountKobo !== undefined ? Number(body.amountKobo) : Math.round(Number(body.amountNaira ?? NaN) * 100);
  if (!Number.isFinite(kobo)) throw new HttpError("Provide amountNaira or amountKobo", 422);
  if (kobo < AMOUNT_MIN_KOBO) throw new HttpError("Minimum top-up is N100", 422);
  if (kobo > AMOUNT_MAX_KOBO) throw new HttpError("Maximum single top-up is N500,000", 422);
  return Math.round(kobo);
}

export default handler(async (req, ctx) => {
  const path = new URL(req.url).pathname;

  /* ---------------------------------------------------------------- quote only */
  if (path.endsWith("/quote")) {
    if (req.method !== "POST") return methodNotAllowed(["POST"]);
    const body = await readJson(req);
    return ok(await quote(amountFrom(body), body.meterNumber ? String(body.meterNumber) : undefined));
  }

  /* --------------------------------------------------------------- initialize */
  if (path.endsWith("/initialize")) {
    if (req.method !== "POST") return methodNotAllowed(["POST"]);
    const body = await readJson(req);
    requireFields(body, ["email"]);
    const amountKobo = amountFrom(body);
    // Stored digits-only, the same way meters.mts keys the meters table.
    const meterNumber = body.meterNumber ? String(body.meterNumber).replace(/[\s-]/g, "") : "";
    const priced = await quote(amountKobo, meterNumber || undefined);
    const reference = newReference();
    const origin = new URL(req.url).origin;

    const checkout = await createCheckout({
      reference,
      amountKobo,
      email: String(body.email),
      metadata: { meterNumber, purpose: body.purpose ?? "meter-topup" },
      callbackUrl: `${origin}/pay/return.html?reference=${encodeURIComponent(reference)}`,
    });

    const [order] = await db
      .insert(orders)
      .values({
        reference,
        email: String(body.email),
        phone: body.phone ? String(body.phone) : "",
        meterNumber,
        purpose: (body.purpose as string) ?? "meter-topup",
        amountKobo,
        serviceChargeKobo: priced.serviceChargeKobo,
        unitsKwhMilli: priced.unitsKwhMilli,
        provider: checkout.provider,
        providerRef: checkout.providerRef,
        authorizationUrl: checkout.authorizationUrl,
        status: "pending",
        metadata: { tariffKoboPerKwh: priced.tariffKoboPerKwh },
      })
      .returning();

    await recordEvent(reference, "order.created", { amountKobo, meterNumber }, order.id);

    return ok(
      {
        reference,
        provider: checkout.provider,
        authorizationUrl: checkout.authorizationUrl,
        simulated: checkout.provider === "simulation",
        order: { ...order, metadata: undefined },
        quote: priced,
      },
      201,
    );
  }

  /* ------------------------------------------------------------------- verify */
  if (path.includes("/verify")) {
    if (req.method !== "GET" && req.method !== "POST") return methodNotAllowed(["GET", "POST"]);
    const reference = (ctx.params?.reference as string) || new URL(req.url).searchParams.get("reference") || "";
    if (!reference) throw new HttpError("A payment reference is required", 400);

    const [order] = await db.select().from(orders).where(eq(orders.reference, reference)).limit(1);
    if (!order) return fail("Unknown payment reference", 404);
    if (order.status === "paid") {
      const [token] = await db.select().from(vendTokens).where(eq(vendTokens.orderId, order.id)).limit(1);
      return ok({ status: "paid", order, token: token ?? null });
    }

    const result = await verifyWithProvider(reference);
    await recordEvent(reference, "order.verified", { paid: result.paid }, order.id);
    if (!result.paid) return ok({ status: order.status, order, token: null, pending: true });

    const settled = await settleOrder(reference, result.raw);
    return ok({ status: "paid", order: settled.order, token: settled.token });
  }

  /* --------------------------------------------- simulation-only confirmation */
  if (path.endsWith("/simulate")) {
    if (req.method !== "POST") return methodNotAllowed(["POST"]);
    if (provider() !== "simulation") {
      return fail("Simulation is disabled because a live payment provider is configured", 409);
    }
    // Settling an order here mints real vending units without any money moving, so
    // this stays an operator tool: open to the public it would be a free-credit tap.
    // Simulation remains usable for testing via the console or a write-scoped key.
    await requireWriteAccess(req);
    const body = await readJson(req);
    requireFields(body, ["reference"]);
    const settled = await settleOrder(String(body.reference), { simulated: true });
    return ok({ status: "paid", simulated: true, order: settled.order, token: settled.token });
  }

  /* ------------------------------------------------------------------ listing */
  if (req.method === "GET") {
    await requireReadAccess(req);
    const rows = await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(100);
    return ok({
      provider: provider(),
      orders: rows,
      summary: {
        count: rows.length,
        paid: rows.filter((r) => r.status === "paid").length,
        grossKobo: rows.filter((r) => r.status === "paid").reduce((n, r) => n + r.amountKobo, 0),
        unitsKwhMilli: rows.filter((r) => r.status === "paid").reduce((n, r) => n + r.unitsKwhMilli, 0),
      },
    });
  }

  return methodNotAllowed(["GET", "POST"]);
});

export const config: Config = {
  path: [
    "/api/payments",
    "/api/payments/quote",
    "/api/payments/initialize",
    "/api/payments/simulate",
    "/api/payments/verify",
    "/api/payments/verify/:reference",
    "/api/v1/payments",
    "/api/v1/payments/quote",
    "/api/v1/payments/initialize",
    "/api/v1/payments/simulate",
    "/api/v1/payments/verify",
    "/api/v1/payments/verify/:reference",
  ],
};
