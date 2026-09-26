import type { Config } from "@netlify/functions";
import { ok, fail, handler, methodNotAllowed } from "../lib/http.mjs";
import { verifyWebhookSignature, settleOrder, recordEvent } from "../lib/payments.mjs";

/**
 * Provider callback. The signature is checked against the raw body before anything
 * is trusted, and settlement is idempotent so repeated deliveries are harmless.
 */
export default handler(async (req) => {
  if (req.method !== "POST") return methodNotAllowed(["POST"]);

  const raw = await req.text();
  const signature = req.headers.get("x-paystack-signature");
  if (!verifyWebhookSignature(raw, signature)) return fail("Invalid signature", 401);

  let payload: any = {};
  try {
    payload = JSON.parse(raw);
  } catch {
    return fail("Body was not valid JSON", 400);
  }

  const event = String(payload?.event ?? "unknown");
  const reference = String(payload?.data?.reference ?? "");
  if (!reference) return fail("Webhook carried no reference", 422);

  await recordEvent(reference, `webhook.${event}`, payload?.data ?? {});

  if (event === "charge.success") {
    const settled = await settleOrder(reference, payload.data);
    return ok({ received: true, settled: !settled.alreadySettled, reference });
  }

  // Everything else is stored for the audit trail and acknowledged.
  return ok({ received: true, ignored: event, reference });
});

export const config: Config = {
  path: ["/api/payments/webhook", "/api/v1/payments/webhook"],
};
