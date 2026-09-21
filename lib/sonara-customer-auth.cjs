// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Customer sessions: signing in, holding the session in a cookie, refreshing it,
// and proving who a request belongs to.
//
// This is the security-sensitive half of what was step 6. It moved as a pure
// relocation -- no behaviour changed, and the tests that exercise it go through
// the real HTTP routes rather than through this module, so they would notice.
//
// Two functions stayed in server.js and had no choice.
// apply-customer-ready-production-experience.cjs runs
//
//   replaceBetween(server, "async function verifyAdminRequest(req) {",
//                          "function getBearerToken(req) {", ...)
//
// so both declaration lines are boundaries of a region that generator rewrites.
// Delete either line and the generator fails. getBearerToken is injected back in
// here; verifyAdminRequest is only called from server.js.
//
// The cookie names and lifetimes moved in rather than being injected, because
// this module is what decides them. server.js takes CUSTOMER_SESSION_COOKIE back
// out for the one place it still needs it -- verifyAdminRequest reads the
// customer cookie when deciding whether a request is a founder or a customer.

const crypto = require("node:crypto");
const { linkAction } = require("./sonara-shell.cjs");
const { isPasswordLeaked, LEAKED_PASSWORD_MESSAGE } = require("./sonara-leaked-password.cjs");

// Session cookie: one hour, matching the Supabase access-token lifetime we cap
// to. Refresh cookie: thirty days, which is what lets somebody return without
// signing in again.
const CUSTOMER_SESSION_COOKIE = "sonara_customer_session";
const CUSTOMER_REFRESH_COOKIE = "sonara_customer_refresh";
const GOOGLE_OAUTH_VERIFIER_COOKIE = "sonara_google_oauth_verifier"; // retired fixed-name flow cookie; exported for compatibility only
const GOOGLE_OAUTH_NEXT_COOKIE = "sonara_google_oauth_next"; // retired fixed-name flow cookie; exported for compatibility only
const GOOGLE_OAUTH_FLOW_COOKIE_PREFIX = "sonara_google_oauth_flow_";
const GOOGLE_OAUTH_MAX_AGE_SECONDS = 10 * 60;
// The floor for a password being chosen, matching the reset flow in
// routes/sonara-route-registry-routes.cjs. Both places a password can be set
// now agree; before, signup accepted 8 and reset demanded 12, so the stricter
// rule was avoidable by taking the other route.
const NEW_PASSWORD_MIN_LENGTH = 12;

// The floor for a password already in use. Deliberately lower: raising it would
// refuse the existing password of anybody who set one before the floor moved,
// which locks them out rather than making them safer.
const EXISTING_PASSWORD_MIN_LENGTH = 8;

const CUSTOMER_SESSION_MAX_AGE_SECONDS = 60 * 60;
const CUSTOMER_REFRESH_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

const REQUIRED = [
  "acceptsHtml",
  "createRateLimiter",
  "getBearerToken",
  "getEnv",
  "getSupabaseServerClient",
  "getSupabaseServerConfig",
  "isProductionEnvironment",
  "isSupabaseAdminUser",
  "siteOrigin",
  "renderRateLimitPage",
  "reportDegradedRateLimit",
  "responsePage"
];

function createCustomerAuth(deps = {}) {
  for (const name of REQUIRED) {
    if (typeof deps[name] !== "function") throw new TypeError(`createCustomerAuth requires ${name}`);
  }
  const {
    acceptsHtml,
    createRateLimiter,
    getBearerToken,
    getEnv,
    getSupabaseServerClient,
    getSupabaseServerConfig,
    isProductionEnvironment,
    isSupabaseAdminUser,
    siteOrigin,
    renderRateLimitPage,
    reportDegradedRateLimit,
    responsePage
  } = deps;

  function createAuthRateLimiter(name, { windowSeconds, maxAttempts, scopes, subjectFrom }) {
    return createRateLimiter({
      name,
      windowSeconds,
      maxAttempts,
      scopes,
      subjectFrom,
      getSupabaseServerConfig,
      onDegraded: reportDegradedRateLimit,
      renderDenied: renderRateLimitPage
    });
  }

  // OAuth start is intentionally IP-scoped: there is no account identity yet.
  // Callback adds a verifier-derived subject bucket as well; identifiers are
  // hashed by sonara-rate-limit before they reach storage, so the PKCE secret
  // itself is never persisted in a rate-limit row.
  const googleOAuthStartRateLimiter = createAuthRateLimiter("auth.google_start", {
    windowSeconds: 15 * 60,
    maxAttempts: 60,
    scopes: ["ip"]
  });
  const googleOAuthCallbackRateLimiter = createAuthRateLimiter("auth.google_callback", {
    windowSeconds: 15 * 60,
    maxAttempts: 120,
    scopes: ["ip", "subject"],
    subjectFrom: (req) => normalizeOAuthState(req.query?.state)
  });

  async function createEmployeeAuthUser(email, password) {
    const config = getSupabaseServerClient();
    const anonKey = getEnv(["SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]);
    if (!config.ok || !anonKey) return { ok: false, status: 503, code: "setup_required" };
    const response = await fetch(`${config.url}/auth/v1/signup`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email, password })
    }).catch(() => undefined);
    if (!response?.ok) return { ok: false, status: 401, code: "auth_not_completed" };
    const payload = await response.json().catch(() => ({}));
    const userId = payload.user?.id || payload.id;
    return { ok: Boolean(userId), userId };
  }

  function hashInviteToken(token) {
    return crypto.createHash("sha256").update(String(token)).digest("hex");
  }

  function isSupabaseAuthConfigured() {
    return Boolean(getEnv(["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"]) && getEnv(["SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]));
  }

  function getSupabaseAuthConfig() {
    const url = getEnv(["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"]);
    const anonKey = getEnv(["SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]);
    if (!url || !anonKey) return { ok: false };
    return { ok: true, url: url.replace(/\/$/, ""), anonKey };
  }

  async function getGoogleOAuthProviderStatus() {
    const config = getSupabaseAuthConfig();
    if (!config.ok) {
      return { ok: false, status: "setup_required", code: "supabase_auth_not_configured" };
    }

    const response = await fetch(`${config.url}/auth/v1/settings`, {
      headers: { apikey: config.anonKey, Authorization: `Bearer ${config.anonKey}` },
      signal: globalThis.AbortSignal.timeout(1500)
    }).catch(() => undefined);

    if (!response?.ok) {
      return { ok: false, status: "setup_required", code: "google_provider_not_verifiable" };
    }

    const settings = await response.json().catch(() => ({}));
    if (settings?.external?.google !== true) {
      return { ok: false, status: "setup_required", code: "google_provider_disabled" };
    }

    return { ok: true, status: "configured", code: "google_provider_ready" };
  }

  function normalizeOAuthNextPath(value) {
    const next = String(value || "").trim();
    if (!next) return "/dashboard";
    if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return "/dashboard";
    try {
      const parsed = new URL(next, "https://sonara.invalid");
      if (parsed.origin !== "https://sonara.invalid") return "/dashboard";
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
      return "/dashboard";
    }
  }

  function normalizeOAuthState(value) {
    const state = String(value || "").trim();
    return /^[A-Za-z0-9_-]{32,128}$/.test(state) ? state : "";
  }

  function googleOAuthFlowCookieName(state) {
    const normalized = normalizeOAuthState(state);
    return normalized ? `${GOOGLE_OAUTH_FLOW_COOKIE_PREFIX}${normalized}` : "";
  }

  function encodeGoogleOAuthFlow(verifier, nextPath) {
    return Buffer.from(JSON.stringify({
      verifier: String(verifier || ""),
      nextPath: normalizeOAuthNextPath(nextPath)
    }), "utf8").toString("base64url");
  }

  function decodeGoogleOAuthFlow(value) {
    try {
      const parsed = JSON.parse(Buffer.from(String(value || ""), "base64url").toString("utf8"));
      const verifier = String(parsed?.verifier || "");
      if (!/^[A-Za-z0-9_-]{43,128}$/.test(verifier)) return null;
      return { verifier, nextPath: normalizeOAuthNextPath(parsed?.nextPath) };
    } catch {
      return null;
    }
  }

  function clearGoogleOAuthFlowCookie(res, state) {
    const name = googleOAuthFlowCookieName(state);
    if (name) res.clearCookie(name, customerCookieOptions());
    // Remove the retired fixed-name cookies if a browser still carries them
    // from a deployment immediately before the state-correlated flow.
    res.clearCookie(GOOGLE_OAUTH_VERIFIER_COOKIE, customerCookieOptions());
    res.clearCookie(GOOGLE_OAUTH_NEXT_COOKIE, customerCookieOptions());
  }

  async function beginGoogleOAuth(req, res, nextPath = "/dashboard") {
    const config = getSupabaseAuthConfig();
    const provider = await getGoogleOAuthProviderStatus();
    if (!config.ok || !provider.ok) {
      return {
        ok: false,
        status: 503,
        code: provider.code || "supabase_auth_not_configured",
        message: "Google sign-in is not configured on the identity provider."
      };
    }

    const origin = siteOrigin(req, getEnv);
    if (!origin) {
      return { ok: false, status: 503, code: "site_origin_not_configured", message: "The public site URL is not configured." };
    }

    const verifier = crypto.randomBytes(48).toString("base64url");
    const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
    const state = crypto.randomBytes(24).toString("base64url");
    const callbackUrl = `${origin}/auth/callback`;
    const authorizeUrl = new URL(`${config.url}/auth/v1/authorize`);
    authorizeUrl.searchParams.set("provider", "google");
    authorizeUrl.searchParams.set("scopes", "openid email profile");
    authorizeUrl.searchParams.set("redirect_to", callbackUrl);
    authorizeUrl.searchParams.set("code_challenge", challenge);
    authorizeUrl.searchParams.set("code_challenge_method", "s256");
    authorizeUrl.searchParams.set("state", state);

    res.cookie(
      googleOAuthFlowCookieName(state),
      encodeGoogleOAuthFlow(verifier, nextPath),
      {
        httpOnly: true,
        sameSite: "lax",
        secure: isProductionEnvironment(),
        path: "/",
        maxAge: GOOGLE_OAUTH_MAX_AGE_SECONDS * 1000
      }
    );

    return { ok: true, status: 303, url: authorizeUrl.toString(), state };
  }

  async function completeGoogleOAuth(req, res) {
    const config = getSupabaseAuthConfig();
    const code = String(req.query?.code || "").trim();
    const providerError = String(req.query?.error || "").trim();
    const state = normalizeOAuthState(req.query?.state);
    const flowCookieName = googleOAuthFlowCookieName(state);
    const flow = flowCookieName ? decodeGoogleOAuthFlow(getCookie(req, flowCookieName)) : null;

    clearGoogleOAuthFlowCookie(res, state);

    if (!state || !flow) {
      return { ok: false, status: 400, code: "oauth_callback_invalid", message: "The Google sign-in callback is incomplete or expired. Start sign-in again." };
    }
    if (providerError) {
      return { ok: false, status: 401, code: "google_signin_cancelled", message: "Google sign-in was not completed." };
    }
    if (!config.ok) {
      return { ok: false, status: 503, code: "supabase_auth_not_configured", message: "Sign-in is not configured." };
    }
    if (!code) {
      return { ok: false, status: 400, code: "oauth_callback_invalid", message: "The Google sign-in callback is incomplete. Start sign-in again." };
    }

    const verifier = flow.verifier;
    const nextPath = flow.nextPath;

    const response = await fetch(`${config.url}/auth/v1/token?grant_type=pkce`, {
      method: "POST",
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ auth_code: code, code_verifier: verifier })
    }).catch(() => undefined);

    if (!response?.ok) {
      return { ok: false, status: 401, code: "oauth_exchange_failed", message: "Google sign-in could not be verified. Start sign-in again." };
    }

    const data = await response.json().catch(() => ({}));
    const accessToken = typeof data.access_token === "string" ? data.access_token : "";
    const refreshToken = typeof data.refresh_token === "string" ? data.refresh_token : "";
    if (!accessToken) {
      return { ok: false, status: 401, code: "oauth_session_missing", message: "Google sign-in did not return a usable session." };
    }

    const reportedExpiresIn = Number(data.expires_in);
    const maxAgeSeconds = Number.isFinite(reportedExpiresIn)
      ? Math.max(60, Math.min(reportedExpiresIn, CUSTOMER_SESSION_MAX_AGE_SECONDS))
      : CUSTOMER_SESSION_MAX_AGE_SECONDS;

    return {
      ok: true,
      status: 200,
      code: "google_login_ready",
      nextPath,
      session: { accessToken, refreshToken, maxAgeSeconds },
      body: { ok: true, code: "google_login_ready", sessionStored: true }
    };
  }

  async function handleEmailAuth(mode, body) {
    if (!isSupabaseAuthConfigured()) {
      return { status: 503, body: { ok: false, code: "setup_required", service: "supabase_auth" } };
    }
    const email = String(body.email || "").trim();
    const password = String(body.password || "");
    // Two different floors, and the difference is the point.
    //
    // Choosing a password required 8 characters here while the reset flow in
    // routes/sonara-route-registry-routes.cjs required 12, so the stricter rule
    // was avoidable by signing up instead of resetting. Signup now matches
    // reset at 12.
    //
    // Login keeps the lower floor, and must. This function serves both modes,
    // so raising it here for everyone would refuse the existing password of
    // anybody who set one between 8 and 11 characters -- locking them out of
    // their own account at the sign-in screen, with no way to reach the reset
    // flow that would let them fix it. A password already in use is not made
    // safer by refusing to accept it.
    const minimumLength = mode === "signup" ? NEW_PASSWORD_MIN_LENGTH : EXISTING_PASSWORD_MIN_LENGTH;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < minimumLength) {
      return {
        status: 400,
        body: {
          ok: false,
          code: "validation_failed",
          message: `Enter a valid email and a password with at least ${minimumLength} characters.`
        }
      };
    }
    if (mode === "signup" && password !== String(body.confirmPassword || body.confirm_password || "")) {
      return { status: 400, body: { ok: false, code: "password_mismatch", message: "The password confirmation does not match." } };
    }

    // Signup only, deliberately. Checking on login would lock out people whose
    // existing password later appears in a breach corpus, at the moment they
    // are trying to get in and change it -- and it would put a third-party
    // round trip in front of every sign-in. This refuses a bad password at the
    // point it is being chosen, which is the only point it can be changed for
    // free. The reset flow does the same, in routes/sonara-route-registry-routes.cjs.
    if (mode === "signup") {
      const breach = await isPasswordLeaked(password);
      if (breach.leaked) {
        return { status: 400, body: { ok: false, code: "password_leaked", message: LEAKED_PASSWORD_MESSAGE } };
      }
    }

    const endpoint = mode === "signup" ? "/auth/v1/signup" : "/auth/v1/token?grant_type=password";
    const config = getSupabaseAuthConfig();
    const response = await fetch(`${config.url}${endpoint}`, {
      method: "POST",
      headers: {
        apikey: getEnv(["SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]),
        Authorization: `Bearer ${getEnv(["SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"])}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email, password })
    }).catch(() => undefined);

    // One response for every failure Supabase reports, on purpose: a wrong
    // password and an email with no account must be indistinguishable, or the
    // login form becomes a way to find out which addresses are registered.
    // Supabase's own error is discarded rather than passed through for the
    // same reason.
    //
    // The sentence is deliberately about the pair rather than either half. It
    // used to have no message at all, so the page fell back to "Email/password
    // access was not completed." -- which is engineering phrasing on the screen
    // customers see most, and does not tell somebody who mistyped their
    // password what to do next.
    if (!response?.ok) {
      return {
        status: 401,
        body: {
          ok: false,
          code: "auth_not_completed",
          message: "That email and password do not match an account. Check both and try again."
        }
      };
    }
    const data = await response.json().catch(() => ({}));
    const accessToken = typeof data.access_token === "string" ? data.access_token : "";
    const refreshToken = typeof data.refresh_token === "string" ? data.refresh_token : "";
    const reportedExpiresIn = Number(data.expires_in);
    const expiresIn = Number.isFinite(reportedExpiresIn) ? Math.max(60, Math.min(reportedExpiresIn, CUSTOMER_SESSION_MAX_AGE_SECONDS)) : CUSTOMER_SESSION_MAX_AGE_SECONDS;
    const code = mode === "signup"
      ? accessToken ? "signup_ready" : "signup_confirmation_required"
      : "login_ready";
    return {
      status: 200,
      body: {
        ok: true,
        code,
        sessionStored: Boolean(accessToken),
        message: code === "signup_confirmation_required" ? "Confirm your email address before logging in." : undefined
      },
      session: accessToken ? { accessToken, refreshToken, maxAgeSeconds: expiresIn } : undefined
    };
  }

  // `renderFailurePage` is optional and comes from server.js, which owns the
  // page layout and the sign-in form. When it is supplied, a rejected sign-in
  // returns the form again with the email still in it rather than a dead-end
  // page with a link back to an empty one. This module does not build the page
  // itself because it has no layout dependency and giving it one to solve a
  // wording problem would be the wrong trade.
  function sendEmailAuthResult(req, res, result, sessionRedirect, fallbackRedirect, renderFailurePage) {
    if (result.session?.accessToken) setCustomerSessionCookies(res, result.session);

    if (acceptsHtml(req)) {
      if (result.status >= 200 && result.status < 300) {
        return res.redirect(303, result.session?.accessToken ? sessionRedirect : fallbackRedirect);
      }

      const message = result.body?.message || (result.body?.code === "setup_required"
        ? "Sign-in is not connected yet. Nothing you can do from here — we are setting it up."
        : "That did not go through. Check the details and try again.");
      if (typeof renderFailurePage === "function") {
        return res.status(result.status).type("html").send(renderFailurePage({ message, code: result.body?.code }));
      }
      return res.status(result.status).type("html").send(responsePage("Access not completed", message, [linkAction("/login", "Login"), linkAction("/signup", "Create account")]));
    }

    return res.status(result.status).json(result.body);
  }

  function setCustomerSessionCookies(res, session) {
    setCustomerSessionCookie(res, session.accessToken, session.maxAgeSeconds);
    if (session.refreshToken) setCustomerRefreshCookie(res, session.refreshToken);
    else clearCustomerRefreshCookie(res);
  }

  function setCustomerSessionCookie(res, accessToken, maxAgeSeconds = CUSTOMER_SESSION_MAX_AGE_SECONDS) {
    res.cookie(CUSTOMER_SESSION_COOKIE, accessToken, {
      ...customerCookieOptions(),
      maxAge: Math.max(60, Math.min(Number(maxAgeSeconds) || CUSTOMER_SESSION_MAX_AGE_SECONDS, CUSTOMER_SESSION_MAX_AGE_SECONDS)) * 1000
    });
  }

  function setCustomerRefreshCookie(res, refreshToken) {
    res.cookie(CUSTOMER_REFRESH_COOKIE, refreshToken, {
      ...customerCookieOptions(),
      maxAge: CUSTOMER_REFRESH_MAX_AGE_SECONDS * 1000
    });
  }

  function customerCookieOptions() {
    return {
      httpOnly: true,
      sameSite: "lax",
      secure: isProductionEnvironment(),
      path: "/"
    };
  }

  function clearCustomerRefreshCookie(res) {
    res.clearCookie(CUSTOMER_REFRESH_COOKIE, customerCookieOptions());
  }

  function clearCustomerSessionCookie(res) {
    res.clearCookie(CUSTOMER_SESSION_COOKIE, customerCookieOptions());
    clearCustomerRefreshCookie(res);
  }

  async function resolveCustomerSession(req, res) {
    if (!isSupabaseAuthConfigured()) {
      return { ok: false, status: 503, body: { ok: false, code: "setup_required", service: "supabase_auth" } };
    }

    const sessionToken = getCustomerSessionToken(req);
    if (sessionToken) {
      const verification = await verifySupabaseAccessToken(sessionToken);
      if (verification.ok) return { ok: true, user: verification.user };
    }

    if (!getBearerToken(req) && res) {
      const refreshed = await refreshCustomerSession(req, res);
      if (refreshed.ok) {
        const verification = await verifySupabaseAccessToken(refreshed.accessToken);
        if (verification.ok) return { ok: true, user: verification.user, refreshed: true };
      }
    }

    return { ok: false, status: 401, body: { ok: false, code: "customer_auth_required" } };
  }

  async function refreshCustomerSession(req, res) {
    const refreshToken = getCustomerRefreshToken(req);
    const config = getSupabaseAuthConfig();
    if (!refreshToken || !config.ok) return { ok: false };

    const response = await fetch(`${config.url}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ refresh_token: refreshToken })
    }).catch(() => undefined);
    if (!response?.ok) return { ok: false };

    const data = await response.json().catch(() => ({}));
    const accessToken = typeof data.access_token === "string" ? data.access_token : "";
    const rotatedRefreshToken = typeof data.refresh_token === "string" ? data.refresh_token : refreshToken;
    if (!accessToken) return { ok: false };

    const reportedExpiresIn = Number(data.expires_in);
    const maxAgeSeconds = Number.isFinite(reportedExpiresIn)
      ? Math.max(60, Math.min(reportedExpiresIn, CUSTOMER_SESSION_MAX_AGE_SECONDS))
      : CUSTOMER_SESSION_MAX_AGE_SECONDS;
    setCustomerSessionCookies(res, { accessToken, refreshToken: rotatedRefreshToken, maxAgeSeconds });
    return { ok: true, accessToken };
  }

  async function verifySupabaseAccessToken(accessToken) {
    const config = getSupabaseAuthConfig();
    if (!config.ok) return { ok: false };
    const response = await fetch(`${config.url}/auth/v1/user`, {
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${accessToken}`
      }
    }).catch(() => undefined);
    if (!response?.ok) return { ok: false };
    return { ok: true, user: await response.json().catch(() => undefined) };
  }

  async function rejectCustomerBearerFromAdminLogin(req, res, next) {
    const bearerToken = getBearerToken(req);
    if (!bearerToken) return next();

    const verification = await verifySupabaseAccessToken(bearerToken);
    if (!verification.ok) return next();
    const admin = await isSupabaseAdminUser(verification.user);
    if (admin.ok) return next();

    if (acceptsHtml(req)) return res.status(403).type("html").send(responsePage("Admin access denied", "Customer sessions cannot open founder operations.", [linkAction("/", "Home")]));
    return res.status(403).json({ ok: false, code: "admin_forbidden" });
  }

  function getCustomerSessionToken(req) {
    return getBearerToken(req) || getCookie(req, CUSTOMER_SESSION_COOKIE);
  }

  function getCustomerRefreshToken(req) {
    return getCookie(req, CUSTOMER_REFRESH_COOKIE);
  }

  function wantsAuthReadinessJson(req) {
    const format = String(req.query?.format || "").trim().toLowerCase();
    const explicitApiClient = String(req.get("x-sonara-api-client") || "").trim().toLowerCase();
    return format === "json" || explicitApiClient === "true";
  }

  function getCookie(req, name) {
    const cookieHeader = String(req.get("cookie") || "");
    const cookies = cookieHeader.split(";").map((part) => part.trim()).filter(Boolean);
    for (const cookie of cookies) {
      const separator = cookie.indexOf("=");
      if (separator === -1) continue;
      let key;
      let value;
      try {
        key = decodeURIComponent(cookie.slice(0, separator));
        value = decodeURIComponent(cookie.slice(separator + 1));
      } catch {
        continue;
      }
      if (key === name) return value;
    }
    return "";
  }

  return {
    clearCustomerRefreshCookie,
    clearCustomerSessionCookie,
    createAuthRateLimiter,
    createEmployeeAuthUser,
    customerCookieOptions,
    getCookie,
    getCustomerRefreshToken,
    getCustomerSessionToken,
    getSupabaseAuthConfig,
    getGoogleOAuthProviderStatus,
    googleOAuthStartRateLimiter,
    googleOAuthCallbackRateLimiter,
    beginGoogleOAuth,
    completeGoogleOAuth,
    handleEmailAuth,
    hashInviteToken,
    isSupabaseAuthConfigured,
    refreshCustomerSession,
    rejectCustomerBearerFromAdminLogin,
    resolveCustomerSession,
    sendEmailAuthResult,
    setCustomerRefreshCookie,
    setCustomerSessionCookie,
    setCustomerSessionCookies,
    verifySupabaseAccessToken,
    wantsAuthReadinessJson
  };
}

module.exports = {
  createCustomerAuth,
  REQUIRED,
  CUSTOMER_SESSION_COOKIE,
  CUSTOMER_REFRESH_COOKIE,
  GOOGLE_OAUTH_VERIFIER_COOKIE,
  GOOGLE_OAUTH_NEXT_COOKIE,
  GOOGLE_OAUTH_FLOW_COOKIE_PREFIX,
  GOOGLE_OAUTH_MAX_AGE_SECONDS,
  CUSTOMER_SESSION_MAX_AGE_SECONDS,
  CUSTOMER_REFRESH_MAX_AGE_SECONDS
};
