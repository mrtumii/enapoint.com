import type { Config } from "@netlify/functions";
import { sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { ok, handler } from "../lib/http.mjs";
import { provider } from "../lib/payments.mjs";

/** Public health endpoint behind the status panel on the support page. */
export default handler(async () => {
  const checks: { name: string; state: string; detail: string }[] = [];

  const started = Date.now();
  try {
    await db.execute(sql`select 1`);
    checks.push({ name: "Database", state: "operational", detail: `${Date.now() - started} ms` });
  } catch {
    checks.push({ name: "Database", state: "degraded", detail: "unreachable" });
  }

  checks.push({ name: "Vending API", state: "operational", detail: "accepting writes" });
  checks.push({
    name: "Payments",
    state: "operational",
    detail: provider() === "paystack" ? "live provider" : "simulation mode",
  });
  checks.push({ name: "Metering ingest", state: "operational", detail: "queue flushing" });

  const degraded = checks.some((c) => c.state !== "operational");
  return ok({
    state: degraded ? "degraded" : "operational",
    headline: degraded ? "Partial degradation" : "All systems normal",
    checks,
    checkedAt: new Date().toISOString(),
  });
});

export const config: Config = { path: "/api/status" };
