import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { eq, desc } from "drizzle-orm";
import { db } from "../../db/index.js";
import { stockItems, stockUploads, products } from "../../db/schema.js";
import { ok, handler, methodNotAllowed, HttpError } from "../lib/http.mjs";
import { requireWriteAccess } from "../lib/auth.mjs";
import { parseCsvRecords } from "../lib/csv.mjs";

const TEMPLATE_COLUMNS = ["sku", "name", "quantity", "warehouse", "reorder_level", "unit_cost_naira", "product"];

/** Pulls the CSV text out of either a multipart upload or a raw text/csv body. */
async function extractCsv(req: Request): Promise<{ text: string; filename: string }> {
  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new HttpError("Attach the CSV as a form field named 'file'", 422);
    return { text: await file.text(), filename: file.name || "upload.csv" };
  }
  const text = await req.text();
  if (!text.trim()) throw new HttpError("Request body was empty — send a CSV", 422);
  const name = new URL(req.url).searchParams.get("filename") || "upload.csv";
  return { text, filename: name };
}

function toInt(value: string | undefined, fallback: number | null = null) {
  if (value === undefined || value.trim() === "") return fallback;
  const n = Number(value.replace(/[,\s]/g, ""));
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

export default handler(async (req) => {
  const path = new URL(req.url).pathname;

  if (path.endsWith("/uploads") && req.method === "GET") {
    await requireWriteAccess(req);
    const rows = await db.select().from(stockUploads).orderBy(desc(stockUploads.createdAt)).limit(25);
    return ok({ uploads: rows, template: { columns: TEMPLATE_COLUMNS } });
  }

  if (req.method === "GET") {
    // Serve the expected CSV shape so the console can offer a template download.
    const sample = [
      TEMPLATE_COLUMNS.join(","),
      "LITLI-WM,ENA LIT LI - wall-mounted,175,abuja-hq,40,,ena-lit-li",
      "PNL-MONO,ENA Solar Panel - monocrystalline,1240,abuja-hq,300,,ena-solar-panel",
    ].join("\n");
    return new Response(sample, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": 'attachment; filename="ena-stock-template.csv"',
      },
    });
  }

  if (req.method !== "POST") return methodNotAllowed(["GET", "POST"]);

  const access = await requireWriteAccess(req);
  const { text, filename } = await extractCsv(req);
  const records = parseCsvRecords(text);
  if (!records.length) throw new HttpError("No data rows found in the CSV", 422);

  // Keep the raw file — an object store is the right place for it, the rows go to Postgres.
  const blobKey = `stock/${new Date().toISOString().replace(/[:.]/g, "-")}-${filename}`;
  try {
    const store = getStore("stock-uploads");
    await store.set(blobKey, text, {
      metadata: { filename, rows: records.length, uploadedBy: access.via },
    });
  } catch (err) {
    console.warn("blob store unavailable, continuing without raw file retention");
  }

  const mode = new URL(req.url).searchParams.get("mode") === "add" ? "add" : "set";
  const catalogue = await db.select({ id: products.id, slug: products.slug }).from(products);
  const bySlug = new Map(catalogue.map((p) => [p.slug, p.id]));

  const errors: { row: number; sku: string; reason: string }[] = [];
  let applied = 0;

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const sku = (r.sku || r.code || "").toUpperCase().trim();
    const lineNumber = i + 2; // +1 for the header, +1 for 1-based counting
    if (!sku) {
      errors.push({ row: lineNumber, sku: "", reason: "Missing sku" });
      continue;
    }
    const quantity = toInt(r.quantity ?? r.qty ?? r.units, null);
    if (quantity === null) {
      errors.push({ row: lineNumber, sku, reason: "Missing or non-numeric quantity" });
      continue;
    }

    const unitCostKobo =
      toInt(r.unit_cost_kobo) ?? (toInt(r.unit_cost_naira) !== null ? toInt(r.unit_cost_naira)! * 100 : null);
    const productId = r.product ? bySlug.get(r.product.trim()) ?? null : null;
    if (r.product && productId === null) {
      errors.push({ row: lineNumber, sku, reason: `Unknown product slug: ${r.product}` });
      continue;
    }

    try {
      const [existing] = await db.select().from(stockItems).where(eq(stockItems.sku, sku)).limit(1);
      const nextQuantity =
        mode === "add" && existing ? Math.max(0, existing.quantity + quantity) : Math.max(0, quantity);

      if (existing) {
        await db
          .update(stockItems)
          .set({
            name: r.name?.trim() || existing.name,
            warehouse: r.warehouse?.trim() || existing.warehouse,
            quantity: nextQuantity,
            reorderLevel: toInt(r.reorder_level) ?? existing.reorderLevel,
            unitCostKobo: unitCostKobo ?? existing.unitCostKobo,
            productId: productId ?? existing.productId,
            updatedAt: new Date(),
          })
          .where(eq(stockItems.id, existing.id));
      } else {
        if (!r.name?.trim()) {
          errors.push({ row: lineNumber, sku, reason: "New SKU needs a name column" });
          continue;
        }
        await db.insert(stockItems).values({
          sku,
          productId,
          name: r.name.trim(),
          warehouse: r.warehouse?.trim() || "abuja-hq",
          quantity: nextQuantity,
          reorderLevel: toInt(r.reorder_level) ?? 0,
          unitCostKobo,
          updatedAt: new Date(),
        });
      }
      applied++;
    } catch (err) {
      errors.push({ row: lineNumber, sku, reason: "Database rejected the row" });
    }
  }

  const [record] = await db
    .insert(stockUploads)
    .values({
      filename,
      blobKey,
      rowsTotal: records.length,
      rowsApplied: applied,
      rowsFailed: errors.length,
      status: errors.length === 0 ? "processed" : applied ? "partial" : "failed",
      errors,
      uploadedBy: access.via,
    })
    .returning();

  return ok({ upload: record, mode, applied, failed: errors.length, errors: errors.slice(0, 50) }, 201);
});

export const config: Config = {
  path: ["/api/stock/upload", "/api/stock/uploads", "/api/v1/stock/upload", "/api/v1/stock/uploads"],
};
