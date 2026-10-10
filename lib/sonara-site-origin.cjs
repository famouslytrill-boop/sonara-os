// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
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
 *   1. Use an explicitly configured HTTPS origin with no credentials, path,
 *      query or fragment. Redirect targets sent to Stripe and the identity
 *      provider, emailed invitations and shared links all need one authority.
 *   2. In production, missing or malformed configuration means no origin.
 *      Host and X-Forwarded-Host headers are not trusted for external links.
 *   3. Outside hosted or production environments only, allow a syntactically valid request Host with
 *      an HTTP(S) request protocol for local development and tests. Do not
 *      read X-Forwarded-Host or X-Forwarded-Proto.
 *
 * The empty-string case is intentional: an invented share link looks sendable
 * but may be false; an invented payment or OAuth return URL is worse. Each
 * caller must fail closed when no production origin is configured.
 */
function siteOrigin(req, getEnv) {
  const read = typeof getEnv === "function" ? getEnv : (name) => process.env[name];
  const configured = String(read("NEXT_PUBLIC_SITE_URL") || "").trim();

  // URLs sent to Stripe, identity providers, employees, or customers must not
  // inherit a forged Host / X-Forwarded-Host header when deployment configuration
  // is missing. A configured canonical origin must be HTTPS and origin-only.
  try {
    const url = new URL(configured);
    if (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      url.pathname === "/" &&
      !url.search &&
      !url.hash
    ) return url.origin;
  } catch {
    // Missing/malformed configuration is not authority to guess in production.
  }

  // Vercel runs preview and production behind the same public edge. Treat
  // either hosted environment as untrusted for header-derived origins even
  // when NODE_ENV was accidentally left unset by a deployment configuration.
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV || process.env.VERCEL) return "";

  // Keep local development and its preview tests usable without inventing a
  // public origin in production. Never honor forwarded host/protocol headers.
  const host = typeof req?.get === "function" ? String(req.get("host") || "").trim() : "";
  const protocol = String(req?.protocol || "").trim().toLowerCase();
  if (!host || !["http", "https"].includes(protocol) || /[\\/@?#,\s]/.test(host)) return "";
  try {
    const url = new URL(`${protocol}://${host}`);
    if (!url.hostname || url.username || url.password || url.pathname !== "/") return "";
    return url.origin;
  } catch {
    return "";
  }
}

module.exports = { siteOrigin };
