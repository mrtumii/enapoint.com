import type { Config } from "@netlify/functions";
import { eq, desc, and } from "drizzle-orm";
import { db } from "../../db/index.js";
import { products, productUpdates } from "../../db/schema.js";
import { ok, fail, handler, readJson, requireFields, methodNotAllowed, HttpError } from "../lib/http.mjs";
import { requireWriteAccess } from "../lib/auth.mjs";

export default handler(async (req, ctx) => {
  const id = ctx.params?.id as string | undefined;

  if (req.method === "GET") {
    const url = new URL(req.url);
    const slug = url.searchParams.get("product");
    const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 200);
    const rows = await db
      .select({
        id: productUpdates.id,
        title: productUpdates.title,
        body: productUpdates.body,
        kind: productUpdates.kind,
        published: productUpdates.published,
        publishedAt: productUpdates.publishedAt,
        productSlug: products.slug,
        productName: products.name,
      })
      .from(productUpdates)
      .leftJoin(products, eq(productUpdates.productId, products.id))
      .orderBy(desc(productUpdates.publishedAt))
      .limit(limit);
    return ok({ updates: slug ? rows.filter((r) => r.productSlug === slug) : rows });
  }

  if (req.method === "POST") {
    await requireWriteAccess(req);
    const body = await readJson(req);
    requireFields(body, ["title"]);
    let productId: number | null = null;
    if (body.product) {
      const [p] = await db.select().from(products).where(eq(products.slug, String(body.product))).limit(1);
      if (!p) return fail(`Unknown product: ${body.product}`, 422);
      productId = p.id;
    }
    const [row] = await db
      .insert(productUpdates)
      .values({
        productId,
        title: body.title as string,
        body: (body.body as string) ?? "",
        kind: (body.kind as string) ?? "release",
        published: body.published === undefined ? true : Boolean(body.published),
        publishedAt: new Date(),
      })
      .returning();
    return ok({ update: row }, 201);
  }

  if (req.method === "PATCH") {
    await requireWriteAccess(req);
    if (!id) throw new HttpError("An update id is required", 400);
    const body = await readJson(req);
    const patch: Record<string, unknown> = {};
    for (const field of ["title", "body", "kind"]) if (body[field] !== undefined) patch[field] = body[field];
    if (body.published !== undefined) patch.published = Boolean(body.published);
    if (!Object.keys(patch).length) throw new HttpError("Nothing to update", 422);
    const [row] = await db.update(productUpdates).set(patch).where(eq(productUpdates.id, Number(id))).returning();
    if (!row) return fail("Update not found", 404);
    return ok({ update: row });
  }

  if (req.method === "DELETE") {
    await requireWriteAccess(req);
    if (!id) throw new HttpError("An update id is required", 400);
    const [row] = await db.delete(productUpdates).where(eq(productUpdates.id, Number(id))).returning();
    if (!row) return fail("Update not found", 404);
    return ok({ deleted: row.id });
  }

  return methodNotAllowed(["GET", "POST", "PATCH", "DELETE"]);
});

export const config: Config = {
  path: ["/api/updates", "/api/updates/:id"],
};
