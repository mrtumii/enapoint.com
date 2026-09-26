import type { Config } from "@netlify/functions";
import { eq, asc } from "drizzle-orm";
import { db } from "../../db/index.js";
import { products, productUpdates } from "../../db/schema.js";
import { ok, fail, handler, readJson, requireFields, methodNotAllowed, HttpError } from "../lib/http.mjs";
import { requireWriteAccess } from "../lib/auth.mjs";

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

export default handler(async (req, ctx) => {
  const slug = ctx.params?.slug as string | undefined;

  if (req.method === "GET") {
    if (slug) {
      const [row] = await db.select().from(products).where(eq(products.slug, slug)).limit(1);
      if (!row) return fail("Product not found", 404);
      const updates = await db
        .select()
        .from(productUpdates)
        .where(eq(productUpdates.productId, row.id))
        .orderBy(asc(productUpdates.publishedAt));
      return ok({ product: row, updates });
    }
    const rows = await db.select().from(products).orderBy(asc(products.sortOrder));
    const category = new URL(req.url).searchParams.get("category");
    return ok({ products: category ? rows.filter((r) => r.category === category) : rows });
  }

  if (req.method === "POST") {
    await requireWriteAccess(req);
    const body = await readJson(req);
    requireFields(body, ["name", "category"]);
    const [row] = await db
      .insert(products)
      .values({
        slug: (body.slug as string) || slugify(body.name as string),
        name: body.name as string,
        category: body.category as string,
        tagline: (body.tagline as string) ?? "",
        description: (body.description as string) ?? "",
        priceKobo: body.priceKobo === undefined ? null : Number(body.priceKobo),
        priceNote: (body.priceNote as string) ?? "",
        status: (body.status as string) ?? "available",
        specs: (body.specs as unknown) ?? [],
        sortOrder: body.sortOrder === undefined ? 100 : Number(body.sortOrder),
      })
      .returning();
    return ok({ product: row }, 201);
  }

  if (req.method === "PATCH") {
    await requireWriteAccess(req);
    if (!slug) throw new HttpError("A product slug is required to update", 400);
    const body = await readJson(req);
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    for (const field of ["name", "category", "tagline", "description", "priceNote", "status", "specs"]) {
      if (body[field] !== undefined) patch[field] = body[field];
    }
    if (body.priceKobo !== undefined) patch.priceKobo = body.priceKobo === null ? null : Number(body.priceKobo);
    if (body.sortOrder !== undefined) patch.sortOrder = Number(body.sortOrder);
    const [row] = await db.update(products).set(patch).where(eq(products.slug, slug)).returning();
    if (!row) return fail("Product not found", 404);
    return ok({ product: row });
  }

  if (req.method === "DELETE") {
    await requireWriteAccess(req);
    if (!slug) throw new HttpError("A product slug is required to delete", 400);
    const [row] = await db.delete(products).where(eq(products.slug, slug)).returning();
    if (!row) return fail("Product not found", 404);
    return ok({ deleted: row.slug });
  }

  return methodNotAllowed(["GET", "POST", "PATCH", "DELETE"]);
});

export const config: Config = {
  path: ["/api/products", "/api/products/:slug", "/api/v1/products", "/api/v1/products/:slug"],
};
