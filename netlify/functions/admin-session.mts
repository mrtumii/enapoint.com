import type { Config } from "@netlify/functions";
import { ok, fail, handler, readJson, methodNotAllowed } from "../lib/http.mjs";
import {
  checkAdminPassword,
  issueSessionCookie,
  clearSessionCookie,
  hasAdminSession,
  isConsoleConfigured,
} from "../lib/auth.mjs";
import { throttle } from "../lib/guard.mjs";

export default handler(async (req, ctx) => {
  if (req.method === "GET") {
    return ok({ authenticated: hasAdminSession(req), configured: isConsoleConfigured() });
  }

  if (req.method === "POST") {
    // Distinct from a wrong password: there is no password at all, so no credential
    // could ever work and the operator needs to set one rather than guess again.
    if (!isConsoleConfigured()) {
      return fail("The console is closed until ENA_ADMIN_PASSWORD is configured", 503);
    }
    // Every sign-in attempt counts, right or wrong, so the password cannot be guessed
    // faster than ten tries per quarter hour from any one address.
    await throttle(req, ctx, "admin-login", 10, 15 * 60);
    const body = await readJson(req);
    if (!checkAdminPassword(body.password)) {
      return fail("Incorrect password", 401);
    }
    const session = issueSessionCookie();
    return ok(
      { authenticated: true, expires: session.expires, configured: true },
      200,
      { "set-cookie": session.cookie },
    );
  }

  if (req.method === "DELETE") {
    return ok({ authenticated: false }, 200, { "set-cookie": clearSessionCookie() });
  }

  return methodNotAllowed(["GET", "POST", "DELETE"]);
});

export const config: Config = {
  path: "/api/admin/session",
  rateLimit: { windowLimit: 30, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
