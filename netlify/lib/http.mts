export const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
};

/** JSON bodies are small forms and records; anything larger is refused before parsing. */
const MAX_JSON_BYTES = 64 * 1024;

export function ok(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...headers } });
}

export function fail(message: string, status = 400, extra: Record<string, unknown> = {}) {
  return ok({ error: message, ...extra }, status);
}

export function methodNotAllowed(allowed: string[]) {
  return ok({ error: "Method not allowed", allowed }, 405, { allow: allowed.join(", ") });
}

/** Parses a JSON body, tolerating an empty one. */
export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  const declared = Number(req.headers.get("content-length") || 0);
  if (declared > MAX_JSON_BYTES) throw new HttpError("Request body is too large", 413);
  const raw = await req.text();
  if (raw.length > MAX_JSON_BYTES) throw new HttpError("Request body is too large", 413);
  if (!raw.trim()) return {} as T;
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new HttpError("Request body must be valid JSON", 400);
  }
}

export class HttpError extends Error {
  status: number;
  retryAfter?: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/**
 * Partners (banks, DisCos, agencies) call the API from their own servers and, for
 * dashboards, from their own origins. Access is by Bearer key, never by cookie, so a
 * wildcard origin is safe: browsers do not attach credentials to wildcard CORS.
 */
const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "access-control-allow-headers": "authorization, content-type, idempotency-key, x-request-id",
  "access-control-expose-headers": "x-request-id",
  "access-control-max-age": "86400",
};

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * The console signs in with a cookie, so a state-changing request that carries that
 * cookie must come from this site. Browsers always send Origin on cross-site POST,
 * PATCH and DELETE; when it names another host the request is refused before any
 * handler runs. Server-to-server partner calls authenticate with a Bearer key, send
 * no cookie, and are unaffected.
 */
function isCrossSiteCookieRequest(req: Request) {
  if (SAFE_METHODS.has(req.method)) return false;
  if (!/(?:^|;\s*)ena_session=/.test(req.headers.get("cookie") || "")) return false;
  const origin = req.headers.get("origin");
  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") return true;
  if (!origin) return false;
  try {
    return new URL(origin).host !== new URL(req.url).host;
  } catch {
    return true;
  }
}

/**
 * Wraps a handler so thrown HttpErrors become clean JSON and anything else becomes a
 * generic 500 — internal detail goes to the function log, never to the caller. Every
 * response carries an x-request-id a partner can quote when reporting a problem.
 */
export function handler(fn: (req: Request, ctx: any) => Promise<Response>) {
  return async (req: Request, ctx: any) => {
    const requestId = req.headers.get("x-request-id")?.slice(0, 64) || crypto.randomUUID();
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: { ...CORS_HEADERS, "x-request-id": requestId } });
    }
    let res: Response;
    try {
      if (isCrossSiteCookieRequest(req)) throw new HttpError("Cross-site request refused", 403);
      res = await fn(req, ctx);
    } catch (err) {
      if (err instanceof HttpError) {
        res = fail(err.message, err.status);
        if (err.retryAfter) res.headers.set("retry-after", String(err.retryAfter));
      } else {
        const cause = err instanceof Error && err.cause ? ` (${String((err.cause as Error).message ?? err.cause)})` : "";
        console.error(`[${requestId}] unhandled error`, err instanceof Error ? err.message + cause : err);
        res = fail("Something went wrong on our side. Please try again shortly.", 500, { requestId });
      }
    }
    for (const [k, v] of Object.entries(CORS_HEADERS)) res.headers.set(k, v);
    res.headers.set("x-request-id", requestId);
    return res;
  };
}

export function requireFields<T extends Record<string, unknown>>(body: T, fields: string[]) {
  const missing = fields.filter((f) => {
    const v = body[f];
    return v === undefined || v === null || (typeof v === "string" && !v.trim());
  });
  if (missing.length) throw new HttpError(`Missing required field(s): ${missing.join(", ")}`, 422);
}
