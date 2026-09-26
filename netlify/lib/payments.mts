import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { orders, paymentEvents, vendTokens, meters } from "../../db/schema.js";
import { HttpError } from "./http.mjs";
import { SERVICE_CHARGE_KOBO, DEFAULT_TARIFF_KOBO_PER_KWH, unitsForAmount } from "./money.mjs";

const PAYSTACK_BASE = "https://api.paystack.co";

/**
 * Live mode needs PAYSTACK_SECRET_KEY. Without it the backend runs in simulation mode:
 * the whole order -> payment -> vend chain works end to end, no money moves, and every
 * order is tagged `provider = "simulation"` so real and simulated traffic never mix.
 */
export function provider(): "paystack" | "simulation" {
  return process.env.PAYSTACK_SECRET_KEY ? "paystack" : "simulation";
}

function secretKey() {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new HttpError("Payment provider is not configured", 503);
  return key;
}

export function newReference() {
  return `ENA-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

function vendToken() {
  // STS-style 20-digit token, grouped in fours for readability.
  const digits = Array.from({ length: 20 }, () => Math.floor(Math.random() * 10)).join("");
  return digits.replace(/(\d{4})(?=\d)/g, "$1-");
}

export async function quote(amountKobo: number, meterNumber?: string) {
  let tariff = DEFAULT_TARIFF_KOBO_PER_KWH;
  if (meterNumber) {
    const [meter] = await db
      .select()
      .from(meters)
      .where(eq(meters.meterNumber, meterNumber.replace(/[\s-]/g, "")))
      .limit(1);
    if (meter) tariff = meter.tariffKoboPerKwh;
  }
  return {
    amountKobo,
    serviceChargeKobo: SERVICE_CHARGE_KOBO,
    tariffKoboPerKwh: tariff,
    unitsKwhMilli: unitsForAmount(amountKobo, tariff),
  };
}

/** Asks the provider for a checkout URL. Simulation mode returns a local confirmation page. */
export async function createCheckout(input: {
  reference: string;
  amountKobo: number;
  email: string;
  metadata: Record<string, unknown>;
  callbackUrl: string;
}) {
  if (provider() === "simulation") {
    return {
      provider: "simulation" as const,
      providerRef: input.reference,
      authorizationUrl: `/pay/confirm.html?reference=${encodeURIComponent(input.reference)}`,
    };
  }

  const res = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
    method: "POST",
    headers: { authorization: `Bearer ${secretKey()}`, "content-type": "application/json" },
    body: JSON.stringify({
      email: input.email,
      amount: input.amountKobo,
      reference: input.reference,
      callback_url: input.callbackUrl,
      metadata: input.metadata,
    }),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok || !payload?.status) {
    // Deliberately does not echo the provider payload — it can carry key material.
    throw new HttpError("Payment provider rejected the transaction", 502);
  }
  return {
    provider: "paystack" as const,
    providerRef: payload.data?.reference ?? input.reference,
    authorizationUrl: payload.data?.authorization_url as string,
  };
}

export async function verifyWithProvider(reference: string) {
  if (provider() === "simulation") return { paid: false, raw: { simulated: true } };
  const res = await fetch(`${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { authorization: `Bearer ${secretKey()}` },
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok || !payload?.status) throw new HttpError("Could not verify the transaction", 502);
  return { paid: payload.data?.status === "success", raw: payload.data ?? {} };
}

/** Paystack signs webhooks as HMAC SHA512 of the raw body using the secret key. */
export function verifyWebhookSignature(rawBody: string, signature: string | null) {
  if (provider() === "simulation") return true;
  if (!signature) return false;
  const expected = createHmac("sha512", secretKey()).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function recordEvent(reference: string, event: string, payload: unknown, orderId?: number | null) {
  await db.insert(paymentEvents).values({
    orderId: orderId ?? null,
    reference,
    provider: provider(),
    event,
    payload: (payload as Record<string, unknown>) ?? {},
  });
}

/**
 * Marks an order paid and issues the units. Idempotent: replaying a webhook or
 * re-verifying an already-settled reference returns the existing result untouched.
 */
export async function settleOrder(reference: string, rawPayload: unknown = {}) {
  const [order] = await db.select().from(orders).where(eq(orders.reference, reference)).limit(1);
  if (!order) throw new HttpError("Unknown payment reference", 404);

  if (order.status === "paid") {
    const [existingToken] = await db.select().from(vendTokens).where(eq(vendTokens.orderId, order.id)).limit(1);
    return { order, token: existingToken ?? null, alreadySettled: true };
  }

  const [paid] = await db
    .update(orders)
    .set({ status: "paid", paidAt: new Date() })
    .where(eq(orders.id, order.id))
    .returning();

  let token: typeof vendTokens.$inferSelect | null = null;

  if (paid.meterNumber) {
    const [meter] = await db.select().from(meters).where(eq(meters.meterNumber, paid.meterNumber)).limit(1);
    const delivered = Boolean(meter) && meter.status === "linked";

    [token] = await db
      .insert(vendTokens)
      .values({
        orderId: paid.id,
        meterNumber: paid.meterNumber,
        token: vendToken(),
        unitsKwhMilli: paid.unitsKwhMilli,
        // An offline meter keeps the purchase queued; the token is issued as a backup either way.
        status: delivered ? "delivered" : "queued",
        deliveredAt: delivered ? new Date() : null,
      })
      .returning();

    if (meter && delivered) {
      await db
        .update(meters)
        .set({ balanceKwhMilli: meter.balanceKwhMilli + paid.unitsKwhMilli })
        .where(eq(meters.id, meter.id));
    }
  }

  await recordEvent(reference, "order.settled", rawPayload, paid.id);
  return { order: paid, token, alreadySettled: false };
}
