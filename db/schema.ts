import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ catalogue */

export const products = pgTable(
  "products",
  {
    id: serial().primaryKey(),
    slug: text().notNull().unique(),
    name: text().notNull(),
    category: text().notNull(),
    tagline: text().notNull().default(""),
    description: text().notNull().default(""),
    priceKobo: integer("price_kobo"),
    priceNote: text("price_note").notNull().default(""),
    status: text().notNull().default("available"),
    specs: jsonb().notNull().default([]),
    sortOrder: integer("sort_order").notNull().default(100),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => [index("products_category_idx").on(t.category)],
);

export const productUpdates = pgTable(
  "product_updates",
  {
    id: serial().primaryKey(),
    productId: integer("product_id").references(() => products.id, { onDelete: "cascade" }),
    title: text().notNull(),
    body: text().notNull().default(""),
    kind: text().notNull().default("release"),
    published: boolean().notNull().default(true),
    publishedAt: timestamp("published_at").defaultNow(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [index("product_updates_product_idx").on(t.productId)],
);

/* ---------------------------------------------------------------------- stock */

export const stockItems = pgTable(
  "stock_items",
  {
    id: serial().primaryKey(),
    sku: text().notNull().unique(),
    productId: integer("product_id").references(() => products.id, { onDelete: "set null" }),
    name: text().notNull(),
    warehouse: text().notNull().default("abuja-hq"),
    quantity: integer().notNull().default(0),
    reorderLevel: integer("reorder_level").notNull().default(0),
    unitCostKobo: integer("unit_cost_kobo"),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => [index("stock_items_warehouse_idx").on(t.warehouse)],
);

export const stockUploads = pgTable("stock_uploads", {
  id: serial().primaryKey(),
  filename: text().notNull(),
  blobKey: text("blob_key").notNull(),
  rowsTotal: integer("rows_total").notNull().default(0),
  rowsApplied: integer("rows_applied").notNull().default(0),
  rowsFailed: integer("rows_failed").notNull().default(0),
  status: text().notNull().default("processed"),
  errors: jsonb().notNull().default([]),
  uploadedBy: text("uploaded_by").notNull().default("console"),
  createdAt: timestamp("created_at").defaultNow(),
});

/* ------------------------------------------------------------------- metering */

export const meters = pgTable(
  "meters",
  {
    id: serial().primaryKey(),
    meterNumber: text("meter_number").notNull().unique(),
    imei: text(),
    rfid: text(),
    holderName: text("holder_name").notNull().default(""),
    address: text().notNull().default(""),
    disco: text().notNull().default(""),
    tariffBand: text("tariff_band").notNull().default("C"),
    tariffKoboPerKwh: integer("tariff_kobo_per_kwh").notNull().default(28500),
    phone: text().notNull().default(""),
    email: text().notNull().default(""),
    meterType: text("meter_type").notNull().default("single-phase"),
    state: text().notNull().default(""),
    // "website" for self-service signups, "api:<key id>" for partner submissions.
    source: text().notNull().default("website"),
    verifiedAt: timestamp("verified_at"),
    autoTopupFloorKwh: integer("auto_topup_floor_kwh").notNull().default(20),
    status: text().notNull().default("linked"),
    balanceKwhMilli: integer("balance_kwh_milli").notNull().default(0),
    registeredAt: timestamp("registered_at").defaultNow(),
  },
  (t) => [
    index("meters_imei_idx").on(t.imei),
    index("meters_rfid_idx").on(t.rfid),
    index("meters_status_idx").on(t.status),
  ],
);

export const devices = pgTable("devices", {
  id: serial().primaryKey(),
  name: text().notNull(),
  type: text().notNull(),
  identifier: text().notNull(),
  reading: text().notNull().default(""),
  status: text().notNull().default("online"),
  accountRef: text("account_ref").notNull().default("ena-demo"),
  createdAt: timestamp("created_at").defaultNow(),
});

/* ------------------------------------------------------------------- payments */

export const orders = pgTable(
  "orders",
  {
    id: serial().primaryKey(),
    reference: text().notNull().unique(),
    email: text().notNull().default(""),
    phone: text().notNull().default(""),
    meterNumber: text("meter_number").notNull().default(""),
    purpose: text().notNull().default("meter-topup"),
    amountKobo: integer("amount_kobo").notNull(),
    serviceChargeKobo: integer("service_charge_kobo").notNull().default(0),
    unitsKwhMilli: integer("units_kwh_milli").notNull().default(0),
    provider: text().notNull().default("simulation"),
    providerRef: text("provider_ref"),
    authorizationUrl: text("authorization_url"),
    status: text().notNull().default("pending"),
    metadata: jsonb().notNull().default({}),
    createdAt: timestamp("created_at").defaultNow(),
    paidAt: timestamp("paid_at"),
  },
  (t) => [index("orders_status_idx").on(t.status), index("orders_meter_idx").on(t.meterNumber)],
);

export const paymentEvents = pgTable(
  "payment_events",
  {
    id: serial().primaryKey(),
    orderId: integer("order_id").references(() => orders.id, { onDelete: "cascade" }),
    reference: text().notNull().default(""),
    provider: text().notNull().default("simulation"),
    event: text().notNull(),
    payload: jsonb().notNull().default({}),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [index("payment_events_reference_idx").on(t.reference)],
);

export const vendTokens = pgTable(
  "vend_tokens",
  {
    id: serial().primaryKey(),
    orderId: integer("order_id").references(() => orders.id, { onDelete: "cascade" }),
    meterNumber: text("meter_number").notNull(),
    token: text().notNull(),
    unitsKwhMilli: integer("units_kwh_milli").notNull().default(0),
    status: text().notNull().default("queued"),
    createdAt: timestamp("created_at").defaultNow(),
    deliveredAt: timestamp("delivered_at"),
  },
  (t) => [index("vend_tokens_meter_idx").on(t.meterNumber)],
);

/* ----------------------------------------------------------------- API access */

export const apiKeys = pgTable(
  "api_keys",
  {
    id: serial().primaryKey(),
    label: text().notNull(),
    mode: text().notNull().default("test"),
    keyPrefix: text("key_prefix").notNull(),
    keyHash: text("key_hash").notNull(),
    scopes: jsonb().notNull().default(["read"]),
    lastUsedAt: timestamp("last_used_at"),
    revokedAt: timestamp("revoked_at"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [uniqueIndex("api_keys_hash_idx").on(t.keyHash)],
);

export const webhookEndpoints = pgTable("webhook_endpoints", {
  id: serial().primaryKey(),
  url: text().notNull(),
  events: jsonb().notNull().default([]),
  active: boolean().notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

/* -------------------------------------------------------------------- inbound */

export const contactMessages = pgTable("contact_messages", {
  id: serial().primaryKey(),
  topic: text().notNull().default("general"),
  name: text().notNull(),
  company: text().notNull().default(""),
  email: text().notNull(),
  phone: text().notNull().default(""),
  message: text().notNull().default(""),
  createdAt: timestamp("created_at").defaultNow(),
});

export const gridRequests = pgTable("grid_requests", {
  id: serial().primaryKey(),
  systemType: text("system_type").notNull().default("mini-grid"),
  sector: text().notNull().default("estate"),
  peakLoadKw: integer("peak_load_kw").notNull().default(100),
  storageKwh: integer("storage_kwh").notNull().default(0),
  meterCount: integer("meter_count").notNull().default(0),
  buildWindow: text("build_window").notNull().default(""),
  contactName: text("contact_name").notNull(),
  contactEmail: text("contact_email").notNull(),
  location: text().notNull().default(""),
  notes: text().notNull().default(""),
  createdAt: timestamp("created_at").defaultNow(),
});
