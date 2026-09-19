import type { Config } from "@netlify/functions";
import { desc } from "drizzle-orm";
import { db } from "../../db/index.js";
import { contactMessages, gridRequests } from "../../db/schema.js";
import { ok, handler, readJson, requireFields, methodNotAllowed } from "../lib/http.mjs";
import { requireConsole } from "../lib/auth.mjs";

const EMAIL = /^[^@\s]+@[^@\s.]+\.[^@\s]+$/;

export default handler(async (req) => {
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
  const body = await readJson(req);

  if (isGrid) {
    requireFields(body, ["contactName", "contactEmail"]);
    if (!EMAIL.test(String(body.contactEmail))) return ok({ error: "That email address looks wrong" }, 422);
    const [row] = await db
      .insert(gridRequests)
      .values({
        systemType: (body.systemType as string) ?? "mini-grid",
        sector: (body.sector as string) ?? "estate",
        peakLoadKw: Number(body.peakLoadKw ?? 100),
        storageKwh: Number(body.storageKwh ?? 0),
        meterCount: Number(body.meterCount ?? 0),
        buildWindow: (body.buildWindow as string) ?? "",
        contactName: String(body.contactName),
        contactEmail: String(body.contactEmail),
        location: (body.location as string) ?? "",
        notes: (body.notes as string) ?? "",
      })
      .returning();
    return ok({ received: true, id: row.id, reply: "We reply to grid requests within two working days." }, 201);
  }

  requireFields(body, ["name", "email"]);
  if (!EMAIL.test(String(body.email))) return ok({ error: "That email address looks wrong" }, 422);
  const [row] = await db
    .insert(contactMessages)
    .values({
      topic: (body.topic as string) ?? "general",
      name: String(body.name),
      company: (body.company as string) ?? "",
      email: String(body.email),
      phone: (body.phone as string) ?? "",
      message: (body.message as string) ?? "",
    })
    .returning();
  return ok({ received: true, id: row.id, reply: "We reply within one working day." }, 201);
});

export const config: Config = { path: ["/api/contact", "/api/grid-requests"] };
