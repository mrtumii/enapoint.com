import type { Config } from "@netlify/functions";
import { desc } from "drizzle-orm";
import { db } from "../../db/index.js";
import { contactMessages, gridRequests } from "../../db/schema.js";
import { ok, handler, readJson, requireFields, methodNotAllowed } from "../lib/http.mjs";
import { requireConsole } from "../lib/auth.mjs";
import { throttle, looksLikeBot, stripBotFields } from "../lib/guard.mjs";

const EMAIL = /^[^@\s]+@[^@\s.]+\.[^@\s]+$/;
const str = (v: unknown, max = 200) => String(v ?? "").trim().slice(0, max);
const num = (v: unknown, fallback: number) => {
  const n = Number(v ?? fallback);
  return Number.isFinite(n) && n >= 0 ? Math.min(Math.round(n), 1_000_000) : fallback;
};

export default handler(async (req, ctx) => {
  const path = new URL(req.url).pathname;
  const isGrid = path.includes("grid-request");

  if (req.method === "GET") {
    await requireConsole(req);
    if (isGrid) {
      return ok({ requests: await db.select().from(gridRequests).orderBy(desc(gridRequests.createdAt)).limit(100) });
    }
    return ok({ messages: await db.select().from(contactMessages).orderBy(desc(contactMessages.createdAt)).limit(100) });
  }

  if (req.method !== "POST") return methodNotAllowed(["GET", "POST"]);
  await throttle(req, ctx, isGrid ? "grid-request" : "contact", 5, 10 * 60);
  const raw = await readJson(req);
  // Bots get the same success reply a person would, so they learn nothing, but
  // nothing is stored.
  if (looksLikeBot(raw)) {
    return ok({ received: true, reply: isGrid ? "We reply to grid requests within two working days." : "We reply within one working day." }, 201);
  }
  const body = stripBotFields(raw);

  if (isGrid) {
    requireFields(body, ["contactName", "contactEmail"]);
    if (!EMAIL.test(String(body.contactEmail))) return ok({ error: "That email address looks wrong" }, 422);
    const [row] = await db
      .insert(gridRequests)
      .values({
        systemType: str(body.systemType ?? "mini-grid", 60),
        sector: str(body.sector ?? "estate", 60),
        peakLoadKw: num(body.peakLoadKw, 100),
        storageKwh: num(body.storageKwh, 0),
        meterCount: num(body.meterCount, 0),
        buildWindow: str(body.buildWindow, 60),
        contactName: str(body.contactName, 120),
        contactEmail: str(body.contactEmail, 200),
        location: str(body.location, 200),
        notes: str(body.notes, 5000),
      })
      .returning();
    return ok({ received: true, id: row.id, reply: "We reply to grid requests within two working days." }, 201);
  }

  requireFields(body, ["name", "email"]);
  if (!EMAIL.test(String(body.email))) return ok({ error: "That email address looks wrong" }, 422);
  const [row] = await db
    .insert(contactMessages)
    .values({
      topic: str(body.topic ?? "general", 60),
      name: str(body.name, 120),
      company: str(body.company, 160),
      email: str(body.email, 200),
      phone: str(body.phone, 40),
      message: str(body.message, 5000),
    })
    .returning();
  return ok({ received: true, id: row.id, reply: "We reply within one working day." }, 201);
});

export const config: Config = { path: ["/api/contact", "/api/grid-requests", "/api/v1/contact", "/api/v1/grid-requests"] };
