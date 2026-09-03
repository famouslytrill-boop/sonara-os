"use strict";

/**
 * The address this site is reachable at, for the few places that need to print
 * or send one.
 *
 * There were two copies of this rule. `baseUrl()` in
 * routes/sonara-connected-payment-routes.cjs built the return address Stripe
 * sends an owner back to; server.js needed the same thing to print a sendable
 * link beside a shared result. Two definitions of "where does this site live"
 * is one more than a deployment can have consistent, so there is one here.
 *
 * The rule, in order:
 *
 *   1. `NEXT_PUBLIC_SITE_URL`, and **only over https**. The value is used to
 *      build addresses that leave this application -- one goes to Stripe, one
 *      is copied into a message -- and an http origin in either is a downgrade
 *      somebody else acts on.
 *   2. Otherwise the request's own scheme and host. Behind a proxy that sets
 *      `x-forwarded-proto`, Express's `req.protocol` already reflects it when
 *      `trust proxy` is set; this deliberately does not second-guess that.
 *   3. Otherwise **the empty string**, and callers must handle it.
 *
 * That third case is the point. There is no default host here, because the two
 * things this is for are both worse with a guess than without one: an invented
 * return address sends an owner somewhere that is not their site, and an
 * invented share link *looks sendable and is not*. A caller with no origin
 * should show less, not something plausible.
 */
function siteOrigin(req, getEnv) {
  const read = typeof getEnv === "function" ? getEnv : (name) => process.env[name];
  const configured = String(read("NEXT_PUBLIC_SITE_URL") || "").trim();
  if (/^https:\/\//.test(configured)) return configured.replace(/\/+$/, "");

  const host = typeof req?.get === "function" ? String(req.get("host") || "").trim() : "";
  if (!host) return "";
  const protocol = String(req?.protocol || "").trim() || "https";
  return `${protocol}://${host}`;
}

module.exports = { siteOrigin };
