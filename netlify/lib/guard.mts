import { createHash } from "node:crypto";
import { getStore } from "@netlify/blobs";
import { HttpError } from "./http.mjs";

/**
 * Abuse controls shared by the public endpoints: a per-visitor throttle and a bot
 * filter for the website forms. The platform-level rate limits in each function's
 * config stop floods at the edge; these catch the slower, targeted attempts
 * (password guessing, meter-number enumeration, form spam) that stay under them.
 */

/** Visitors are keyed by a salted hash of their IP, so no raw address is ever stored. */
function visitorKey(req: Request, ctx: any) {
  const ip =
    ctx?.ip ||
    req.headers.get("x-nf-client-connection-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  return createHash("sha256").update(`${process.env.SITE_ID || "local"}:${ip}`).digest("hex").slice(0, 32);
}

/**
 * Fixed-window counter in Netlify Blobs. Throws a 429 once a visitor passes `limit`
 * requests to `bucket` within `windowSeconds`. If the store itself is unreachable the
 * request is let through — an outage in the throttle must not take the site down.
 */
export async function throttle(req: Request, ctx: any, bucket: string, limit: number, windowSeconds: number) {
  const window = Math.floor(Date.now() / (windowSeconds * 1000));
  const key = `${bucket}/${visitorKey(req, ctx)}/${window}`;
  let count = 0;
  try {
    const store = getStore({ name: "rate-limits", consistency: "strong" });
    const current = (await store.get(key, { type: "json" })) as { n: number } | null;
    count = (current?.n ?? 0) + 1;
    await store.setJSON(key, { n: count, until: (window + 1) * windowSeconds * 1000 });
  } catch (err) {
    console.error(`throttle(${bucket}) unavailable`, err instanceof Error ? err.message : err);
    return;
  }
  if (count > limit) {
    const retryAfter = Math.max(1, Math.ceil(((window + 1) * windowSeconds * 1000 - Date.now()) / 1000));
    const err = new HttpError("Too many attempts. Please wait a few minutes and try again.", 429);
    err.retryAfter = retryAfter;
    throw err;
  }
}

/**
 * Website forms carry a hidden honeypot (`_hp`) that people never see or fill, and
 * the time in ms the page was open before submitting (`_t`). Scripts that fill every
 * field, or submit faster than a person can type, are treated as bots. Partner API
 * calls send neither field and are unaffected.
 */
export function looksLikeBot(body: Record<string, unknown>) {
  const honeypot = body._hp;
  if (typeof honeypot === "string" && honeypot.trim()) return true;
  const elapsed = Number(body._t);
  if (body._t !== undefined && (!Number.isFinite(elapsed) || elapsed < 2500)) return true;
  return false;
}

/** Removes the anti-bot fields so they never reach the database. */
export function stripBotFields<T extends Record<string, unknown>>(body: T): T {
  const { _hp, _t, ...rest } = body;
  return rest as T;
}
