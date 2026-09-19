import type { Config } from "@netlify/functions";
import { eq, desc } from "drizzle-orm";
import { db } from "../../db/index.js";
import { apiKeys } from "../../db/schema.js";
import { ok, fail, handler, readJson, requireFields, methodNotAllowed, HttpError } from "../lib/http.mjs";
import { requireConsole, generateApiKey } from "../lib/auth.mjs";

export default handler(async (req, ctx) => {
  await requireConsole(req);
  const id = ctx.params?.id as string | undefined;

  if (req.method === "GET") {
    const rows = await db.select().from(apiKeys).orderBy(desc(apiKeys.createdAt));
    // The full key is never stored, so it can never be listed — only its prefix.
    return ok({
      keys: rows.map(({ keyHash, ...rest }) => ({ ...rest, revoked: Boolean(rest.revokedAt) })),
    });
  }

  if (req.method === "POST") {
    const body = await readJson(req);
    requireFields(body, ["label"]);
    const mode = body.mode === "live" ? "live" : "test";
    const scopes = Array.isArray(body.scopes) && body.scopes.length ? body.scopes : ["read"];
    const { key, prefix, hash } = generateApiKey(mode);
    const [row] = await db
      .insert(apiKeys)
      .values({ label: String(body.label), mode, keyPrefix: prefix, keyHash: hash, scopes })
      .returning();
    const { keyHash, ...safe } = row;
    // Shown exactly once, at creation.
    return ok({ key, secretShownOnce: true, apiKey: safe }, 201);
  }

  if (req.method === "DELETE") {
    if (!id) throw new HttpError("A key id is required", 400);
    const [row] = await db
      .update(apiKeys)
      .set({ revokedAt: new Date() })
      .where(eq(apiKeys.id, Number(id)))
      .returning();
    if (!row) return fail("Key not found", 404);
    return ok({ revoked: row.id, label: row.label });
  }

  return methodNotAllowed(["GET", "POST", "DELETE"]);
});

export const config: Config = { path: ["/api/keys", "/api/keys/:id"] };
