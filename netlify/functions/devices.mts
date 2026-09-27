import type { Config } from "@netlify/functions";
import { asc } from "drizzle-orm";
import { db } from "../../db/index.js";
import { devices } from "../../db/schema.js";
import { ok, handler, readJson, requireFields, methodNotAllowed } from "../lib/http.mjs";
import { requireReadAccess, requireWriteAccess } from "../lib/auth.mjs";

export default handler(async (req) => {
  if (req.method === "GET") {
    await requireReadAccess(req);
    const rows = await db.select().from(devices).orderBy(asc(devices.id));
    return ok({
      devices: rows,
      summary: {
        total: rows.length,
        online: rows.filter((d) => d.status === "online").length,
        offline: rows.filter((d) => d.status !== "online").length,
      },
    });
  }

  if (req.method === "POST") {
    await requireWriteAccess(req);
    const body = await readJson(req);
    requireFields(body, ["name", "type", "identifier"]);
    const [row] = await db
      .insert(devices)
      .values({
        name: String(body.name),
        type: String(body.type),
        identifier: String(body.identifier),
        reading: (body.reading as string) ?? "",
        status: (body.status as string) ?? "online",
      })
      .returning();
    return ok({ device: row }, 201);
  }

  return methodNotAllowed(["GET", "POST"]);
});

export const config: Config = { path: ["/api/devices", "/api/v1/devices"] };
