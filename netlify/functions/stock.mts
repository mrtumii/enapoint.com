import type { Config } from "@netlify/functions";
import { eq, asc } from "drizzle-orm";
import { db } from "../../db/index.js";
import { stockItems, products } from "../../db/schema.js";
import { ok, fail, handler, readJson, requireFields, methodNotAllowed, HttpError } from "../lib/http.mjs";
import { requireWriteAccess } from "../lib/auth.mjs";

export default handler(async (req, ctx) => {
  const sku = ctx.params?.sku as string | undefined;

  if (req.method === "GET") {
    const rows = await db
      .select({
        id: stockItems.id,
        sku: stockItems.sku,
        name: stockItems.name,
        warehouse: stockItems.warehouse,
        quantity: stockItems.quantity,
        reorderLevel: stockItems.reorderLevel,
        unitCostKobo: stockItems.unitCostKobo,
        updatedAt: stockItems.updatedAt,
        productSlug: products.slug,
      })
      .from(stockItems)
      .leftJoin(products, eq(stockItems.productId, products.id))
      .orderBy(asc(stockItems.sku));
    const warehouse = new URL(req.url).searchParams.get("warehouse");
    const filtered = warehouse ? rows.filter((r) => r.warehouse === warehouse) : rows;
    return ok({
      stock: filtered,
      summary: {
        skus: filtered.length,
        units: filtered.reduce((n, r) => n + r.quantity, 0),
        belowReorder: filtered.filter((r) => r.quantity <= r.reorderLevel).length,
      },
    });
  }

  if (req.method === "POST") {
    await requireWriteAccess(req);
    const body = await readJson(req);
    requireFields(body, ["sku", "name"]);
    let productId: number | null = null;
    if (body.product) {
      const [p] = await db.select().from(products).where(eq(products.slug, String(body.product))).limit(1);
      if (!p) return fail(`Unknown product: ${body.product}`, 422);
      productId = p.id;
    }
    const [row] = await db
      .insert(stockItems)
      .values({
        sku: String(body.sku).toUpperCase(),
        productId,
        name: body.name as string,
        warehouse: (body.warehouse as string) ?? "abuja-hq",
        quantity: Number(body.quantity ?? 0),
        reorderLevel: Number(body.reorderLevel ?? 0),
        unitCostKobo: body.unitCostKobo === undefined ? null : Number(body.unitCostKobo),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: stockItems.sku,
        set: {
          name: body.name as string,
          quantity: Number(body.quantity ?? 0),
          updatedAt: new Date(),
        },
      })
      .returning();
    return ok({ item: row }, 201);
  }

  if (req.method === "PATCH") {
    await requireWriteAccess(req);
    if (!sku) throw new HttpError("A SKU is required", 400);
    const body = await readJson(req);
    const [current] = await db.select().from(stockItems).where(eq(stockItems.sku, sku.toUpperCase())).limit(1);
    if (!current) return fail("SKU not found", 404);

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (body.delta !== undefined) patch.quantity = Math.max(0, current.quantity + Number(body.delta));
    if (body.quantity !== undefined) patch.quantity = Math.max(0, Number(body.quantity));
    if (body.reorderLevel !== undefined) patch.reorderLevel = Number(body.reorderLevel);
    if (body.unitCostKobo !== undefined) patch.unitCostKobo = Number(body.unitCostKobo);
    if (body.warehouse !== undefined) patch.warehouse = String(body.warehouse);
    if (body.name !== undefined) patch.name = String(body.name);

    const [row] = await db.update(stockItems).set(patch).where(eq(stockItems.id, current.id)).returning();
    return ok({ item: row });
  }

  if (req.method === "DELETE") {
    await requireWriteAccess(req);
    if (!sku) throw new HttpError("A SKU is required", 400);
    const [row] = await db.delete(stockItems).where(eq(stockItems.sku, sku.toUpperCase())).returning();
    if (!row) return fail("SKU not found", 404);
    return ok({ deleted: row.sku });
  }

  return methodNotAllowed(["GET", "POST", "PATCH", "DELETE"]);
});

export const config: Config = {
  path: ["/api/stock", "/api/stock/:sku"],
  // /api/stock/upload and /api/stock/uploads belong to stock-upload.mts.
  excludedPath: ["/api/stock/upload", "/api/stock/uploads"],
};
