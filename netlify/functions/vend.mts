import type { Config } from "@netlify/functions";
import { eq, desc, and } from "drizzle-orm";
import { db } from "../../db/index.js";
import { vendTokens, meters } from "../../db/schema.js";
import { ok, fail, handler, readJson, requireFields, methodNotAllowed } from "../lib/http.mjs";
import { requireReadAccess, requireWriteAccess } from "../lib/auth.mjs";

/**
 * Vending log and queue flush. A purchase against an offline meter is parked here;
 * when the device reconnects this endpoint delivers the parked units.
 */
export default handler(async (req) => {
  const path = new URL(req.url).pathname;

  if (path.endsWith("/flush")) {
    if (req.method !== "POST") return methodNotAllowed(["POST"]);
    await requireWriteAccess(req);
    const body = await readJson(req);
    requireFields(body, ["meterNumber"]);
    const meterNumber = String(body.meterNumber).trim();

    const [meter] = await db.select().from(meters).where(eq(meters.meterNumber, meterNumber)).limit(1);
    if (!meter) return fail("Meter not found", 404);

    const queued = await db
      .select()
      .from(vendTokens)
      .where(and(eq(vendTokens.meterNumber, meterNumber), eq(vendTokens.status, "queued")));
    if (!queued.length) return ok({ delivered: 0, unitsKwhMilli: 0 });

    const units = queued.reduce((n, t) => n + t.unitsKwhMilli, 0);
    for (const token of queued) {
      await db
        .update(vendTokens)
        .set({ status: "delivered", deliveredAt: new Date() })
        .where(eq(vendTokens.id, token.id));
    }
    await db
      .update(meters)
      .set({ balanceKwhMilli: meter.balanceKwhMilli + units, status: "linked" })
      .where(eq(meters.id, meter.id));

    return ok({ delivered: queued.length, unitsKwhMilli: units });
  }

  if (req.method !== "GET") return methodNotAllowed(["GET", "POST"]);
  await requireReadAccess(req);
  const rows = await db.select().from(vendTokens).orderBy(desc(vendTokens.createdAt)).limit(100);
  return ok({
    events: rows,
    summary: {
      total: rows.length,
      queued: rows.filter((r) => r.status === "queued").length,
      unitsKwhMilli: rows.reduce((n, r) => n + r.unitsKwhMilli, 0),
    },
  });
});

export const config: Config = {
  path: ["/api/vend", "/api/vend/flush"],
};
