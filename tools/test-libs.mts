/* Assertions over the pure backend libraries — money arithmetic, CSV parsing,
   session signing, API-key hashing and webhook signature verification.

   Run with `npm test`. NETLIFY_DB_URL only has to be syntactically valid: the
   db module builds its client at import time but nothing here touches it. */

import { unitsForAmount, nairaToKobo, formatNaira, formatKwh, SERVICE_CHARGE_KOBO, DEFAULT_TARIFF_KOBO_PER_KWH } from "../netlify/lib/money.mts";
import { createHmac } from "node:crypto";
import { parseCsv, parseCsvRecords } from "../netlify/lib/csv.mts";
import { generateApiKey, checkAdminPassword, issueSessionCookie, hasAdminSession, isConsoleConfigured } from "../netlify/lib/auth.mts";
import { newReference, verifyWebhookSignature, provider } from "../netlify/lib/payments.mts";

let fails = 0;
const t = (name: string, cond: boolean, extra = "") => { console.log((cond ? "PASS " : "FAIL ") + name + (extra ? "  " + extra : "")); if (!cond) fails++; };

// money: ₦5,000 at ₦285/kWh, minus ₦50 service charge -> 17.368 kWh
const u = unitsForAmount(nairaToKobo(5000), DEFAULT_TARIFF_KOBO_PER_KWH);
t("units for ₦5,000", u === Math.round(((500000 - SERVICE_CHARGE_KOBO) / 28500) * 1000), formatKwh(u));
t("naira formatting", formatNaira(500000).includes("5,000"), formatNaira(500000));
t("amount below service charge yields 0", unitsForAmount(4000, DEFAULT_TARIFF_KOBO_PER_KWH) === 0);

// csv: quotes, escaped quotes, CRLF
const rows = parseCsv('sku,name,qty\r\n"MTR-1P","Meter, 1-phase",5\r\n"TILE","He said ""hi""",2\r\n');
t("csv row count", rows.length === 3, JSON.stringify(rows[1]));
t("csv embedded comma", rows[1][1] === "Meter, 1-phase");
t("csv escaped quote", rows[2][1] === 'He said "hi"');
const recs = parseCsvRecords("SKU,Unit Cost Naira\nA-1,1200\n");
t("csv header normalisation", recs[0].sku === "A-1" && recs[0].unit_cost_naira === "1200", JSON.stringify(recs[0]));

// auth
const k = generateApiKey("test");
t("key prefix shape", k.key.startsWith("ena_test_") && k.prefix === k.key.slice(0, 16) && k.hash.length === 64);
t("key hash is not the key", !k.hash.includes(k.key.slice(9)));
// With no ENA_ADMIN_PASSWORD there is no console credential at all: nothing is
// accepted, least of all the default this used to fall back to.
t("unconfigured console reports itself closed", isConsoleConfigured() === false);
t("unconfigured console rejects the old default", checkAdminPassword("ena-console") === false);
t("unconfigured console rejects an empty password", checkAdminPassword("") === false);
process.env.ENA_ADMIN_PASSWORD = "   ";
t("whitespace-only password counts as unconfigured", isConsoleConfigured() === false);
process.env.ENA_ADMIN_PASSWORD = "test-console-password";
t("console opens once the variable is set", isConsoleConfigured() === true);
t("configured password accepted", checkAdminPassword("test-console-password") === true);
t("wrong password rejected", checkAdminPassword("nope") === false);
const session = issueSessionCookie();
t("cookie is HttpOnly+Secure+SameSite", /HttpOnly/.test(session.cookie) && /SameSite=Lax/.test(session.cookie) && /Secure/.test(session.cookie));
t("cookie expires in 12h", Math.round((session.expires - Date.now()) / 3600000) === 12);
t("signed session verifies", hasAdminSession(new Request("https://x/", { headers: { cookie: "ena_session=" + session.token } })) === true);
t("tampered session rejected", hasAdminSession(new Request("https://x/", { headers: { cookie: "ena_session=" + session.token.slice(0, -4) + "aaaa" } })) === false);
t("unsigned payload rejected", hasAdminSession(new Request("https://x/", { headers: { cookie: "ena_session=" + session.token.split(".")[0] } })) === false);
t("expired session rejected", hasAdminSession(new Request("https://x/", { headers: { cookie: "ena_session=" + (() => { const p = Buffer.from(JSON.stringify({ sub: "console", exp: Date.now() - 1000 })).toString("base64url"); return p + "." + session.token.split(".")[1]; })() } })) === false);
t("absent session rejected", hasAdminSession(new Request("https://x/")) === false);
// Unsetting the password closes the console behind any session already issued.
delete process.env.ENA_ADMIN_PASSWORD;
t("session stops verifying once the console is unconfigured", hasAdminSession(new Request("https://x/", { headers: { cookie: "ena_session=" + session.token } })) === false);
process.env.ENA_ADMIN_PASSWORD = "test-console-password";

// payments
t("reference shape", /^ENA-[a-z0-9]+-[a-f0-9]+$/i.test(newReference()), newReference());
t("provider defaults to simulation without a key", provider() === "simulation", provider());
// Simulation mode has no provider secret, so there is nothing to verify against;
// with a key configured, an unsigned or wrongly-signed body must be refused.
t("simulation accepts unsigned webhook", verifyWebhookSignature("{}", null) === true);
process.env.PAYSTACK_SECRET_KEY = "sk_test_localonly_notreal";
t("live mode switches provider", provider() === "paystack");
t("live rejects missing signature", verifyWebhookSignature('{"event":"charge.success"}', null) === false);
t("live rejects wrong signature", verifyWebhookSignature('{"event":"charge.success"}', "deadbeef") === false);
const good = createHmac("sha512", "sk_test_localonly_notreal").update('{"event":"charge.success"}').digest("hex");
t("live accepts correct signature", verifyWebhookSignature('{"event":"charge.success"}', good) === true);
t("live rejects signature over a different body", verifyWebhookSignature('{"event":"charge.failed"}', good) === false);
delete process.env.PAYSTACK_SECRET_KEY;
delete process.env.ENA_ADMIN_PASSWORD;

console.log(fails === 0 ? "\nALL PASS" : `\n${fails} FAILED`);
process.exit(fails === 0 ? 0 : 1);
