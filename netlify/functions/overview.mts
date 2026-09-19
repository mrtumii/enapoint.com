import type { Config } from "@netlify/functions";
import { desc, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
  orders,
  products,
  productUpdates,
  stockItems,
  devices,
  vendTokens,
  meters,
  apiKeys,
  contactMessages,
} from "../../db/schema.js";
import { ok, handler, methodNotAllowed } from "../lib/http.mjs";
import { requireConsole } from "../lib/auth.mjs";
import { provider } from "../lib/payments.mjs";

export default handler(async (req) => {
  if (req.method !== "GET") return methodNotAllowed(["GET"]);
  await requireConsole(req);

  const [orderRows, productRows, updateRows, stockRows, deviceRows, tokenRows, meterRows, keyRows, messageRows] =
    await Promise.all([
      db.select().from(orders).orderBy(desc(orders.createdAt)).limit(200),
      db.select().from(products),
      db.select().from(productUpdates).orderBy(desc(productUpdates.publishedAt)).limit(10),
      db.select().from(stockItems),
      db.select().from(devices),
      db.select().from(vendTokens).orderBy(desc(vendTokens.createdAt)).limit(20),
      db.select().from(meters),
      db.select().from(apiKeys),
      db.select().from(contactMessages).orderBy(desc(contactMessages.createdAt)).limit(10),
    ]);

  const paid = orderRows.filter((o) => o.status === "paid");
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;

  // Requests-per-hour shape for the console traffic chart, from real vend timestamps.
  const buckets = new Array(12).fill(0);
  for (const token of tokenRows) {
    const created = token.createdAt ? new Date(token.createdAt).getTime() : 0;
    if (created < dayAgo) continue;
    const hoursAgo = Math.floor((Date.now() - created) / (2 * 60 * 60 * 1000));
    if (hoursAgo >= 0 && hoursAgo < 12) buckets[11 - hoursAgo]++;
  }

  return ok({
    provider: provider(),
    stats: {
      grossKobo: paid.reduce((n, o) => n + o.amountKobo, 0),
      grossKobo24h: paid.filter((o) => new Date(o.paidAt ?? 0).getTime() > dayAgo).reduce((n, o) => n + o.amountKobo, 0),
      unitsKwhMilli: paid.reduce((n, o) => n + o.unitsKwhMilli, 0),
      ordersPending: orderRows.filter((o) => o.status === "pending").length,
      ordersPaid: paid.length,
      products: productRows.length,
      productsPublished: productRows.filter((p) => p.status === "available").length,
      stockSkus: stockRows.length,
      stockUnits: stockRows.reduce((n, s) => n + s.quantity, 0),
      stockBelowReorder: stockRows.filter((s) => s.quantity <= s.reorderLevel).length,
      devicesOnline: deviceRows.filter((d) => d.status === "online").length,
      devicesTotal: deviceRows.length,
      metersLinked: meterRows.length,
      tokensQueued: tokenRows.filter((t) => t.status === "queued").length,
      keysActive: keyRows.filter((k) => !k.revokedAt).length,
      messagesOpen: messageRows.length,
    },
    traffic: buckets,
    recentOrders: orderRows.slice(0, 8),
    recentVends: tokenRows.slice(0, 8),
    recentUpdates: updateRows,
    lowStock: stockRows.filter((s) => s.quantity <= s.reorderLevel).slice(0, 8),
  });
});

export const config: Config = { path: "/api/overview" };
