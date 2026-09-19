export const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

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
  const raw = await req.text();
  if (!raw.trim()) return {} as T;
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new HttpError("Request body must be valid JSON", 400);
  }
}

export class HttpError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/** Wraps a handler so thrown HttpErrors become clean JSON and anything else becomes a 500. */
export function handler(fn: (req: Request, ctx: any) => Promise<Response>) {
  return async (req: Request, ctx: any) => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      if (err instanceof HttpError) return fail(err.message, err.status);
      console.error("unhandled error", err instanceof Error ? err.message : err);
      return fail("Internal error", 500);
    }
  };
}

export function requireFields<T extends Record<string, unknown>>(body: T, fields: string[]) {
  const missing = fields.filter((f) => {
    const v = body[f];
    return v === undefined || v === null || (typeof v === "string" && !v.trim());
  });
  if (missing.length) throw new HttpError(`Missing required field(s): ${missing.join(", ")}`, 422);
}
