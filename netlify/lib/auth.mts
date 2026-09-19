import { createHmac, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "../../db/index.js";
import { apiKeys } from "../../db/schema.js";
import { HttpError } from "./http.mjs";

const SESSION_COOKIE = "ena_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

/**
 * The console has no password of its own — it is whatever ENA_ADMIN_PASSWORD says.
 * There is deliberately no fallback: a shared default compiled into the source is a
 * published credential, so with the variable unset there is simply nothing to match
 * and every sign-in is refused. Set it (locally too, via the environment) to open the
 * console.
 */
function adminPassword() {
  const configured = process.env.ENA_ADMIN_PASSWORD?.trim();
  return configured ? configured : null;
}

/** True once a password is configured and the console can be signed into at all. */
export function isConsoleConfigured() {
  return adminPassword() !== null;
}

function sessionSecret() {
  const configured = process.env.ENA_SESSION_SECRET?.trim();
  if (configured) return configured;
  // Derived from the admin password, which is why nothing signs or verifies a session
  // until the console is configured. Callers below guard on that first.
  return `ena:${process.env.SITE_ID || "local"}:${adminPassword()}`;
}

function sign(value: string) {
  return createHmac("sha256", sessionSecret()).update(value).digest("base64url");
}

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function checkAdminPassword(candidate: unknown) {
  const expected = adminPassword();
  if (expected === null) return false;
  return typeof candidate === "string" && safeEqual(candidate, expected);
}

export function issueSessionCookie() {
  const expires = Date.now() + SESSION_TTL_MS;
  const payload = Buffer.from(JSON.stringify({ sub: "console", exp: expires })).toString("base64url");
  const token = `${payload}.${sign(payload)}`;
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  return {
    token,
    expires,
    cookie: `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`,
  };
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

function readCookie(req: Request, name: string) {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return rest.join("=");
  }
  return null;
}

export function hasAdminSession(req: Request) {
  if (!isConsoleConfigured()) return false;
  const token = readCookie(req, SESSION_COOKIE);
  if (!token) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  if (!safeEqual(signature, sign(payload))) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
    return typeof exp === "number" && exp > Date.now();
  } catch {
    return false;
  }
}

/* --------------------------------------------------------------------- API keys */

export function generateApiKey(mode: "live" | "test") {
  const secret = randomBytes(24).toString("base64url");
  const key = `ena_${mode}_${secret}`;
  return { key, prefix: key.slice(0, 16), hash: hashApiKey(key) };
}

export function hashApiKey(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

/** Resolves a Bearer token to a stored, unrevoked key. Returns null when absent or invalid. */
export async function resolveApiKey(req: Request) {
  const header = req.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const [row] = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.keyHash, hashApiKey(match[1].trim())), isNull(apiKeys.revokedAt)))
    .limit(1);
  if (!row) return null;
  await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, row.id));
  return row;
}

/** Console session or a valid API key with a write scope. */
export async function requireWriteAccess(req: Request) {
  if (hasAdminSession(req)) return { via: "console" as const };
  const key = await resolveApiKey(req);
  const scopes = (key?.scopes as string[] | undefined) ?? [];
  if (key && scopes.includes("write")) return { via: "api-key" as const, keyId: key.id, mode: key.mode };
  throw new HttpError("Authentication required", 401);
}

export async function requireReadAccess(req: Request) {
  if (hasAdminSession(req)) return { via: "console" as const };
  const key = await resolveApiKey(req);
  if (key) return { via: "api-key" as const, keyId: key.id, mode: key.mode };
  throw new HttpError("Authentication required", 401);
}

export async function requireConsole(req: Request) {
  if (!hasAdminSession(req)) throw new HttpError("Console session required", 401);
  return { via: "console" as const };
}
