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

// Session cookie: one hour, matching the Supabase access-token lifetime we cap
// to. Refresh cookie: thirty days, which is what lets somebody return without
// signing in again.
const CUSTOMER_SESSION_COOKIE = "sonara_customer_session";
const CUSTOMER_REFRESH_COOKIE = "sonara_customer_refresh";
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

  async function handleEmailAuth(mode, body) {
    if (!isSupabaseAuthConfigured()) {
      return { status: 503, body: { ok: false, code: "setup_required", service: "supabase_auth" } };
    }
    const email = String(body.email || "").trim();
    const password = String(body.password || "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8) {
      return { status: 400, body: { ok: false, code: "validation_failed", message: "Enter a valid email and a password with at least 8 characters." } };
    }
    if (mode === "signup" && password !== String(body.confirmPassword || body.confirm_password || "")) {
      return { status: 400, body: { ok: false, code: "password_mismatch", message: "The password confirmation does not match." } };
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

    if (!response?.ok) return { status: 401, body: { ok: false, code: "auth_not_completed" } };
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

  function sendEmailAuthResult(req, res, result, sessionRedirect, fallbackRedirect) {
    if (result.session?.accessToken) setCustomerSessionCookies(res, result.session);

    if (acceptsHtml(req)) {
      if (result.status >= 200 && result.status < 300) {
        return res.redirect(303, result.session?.accessToken ? sessionRedirect : fallbackRedirect);
      }

      const message = result.body?.message || (result.body?.code === "setup_required"
        ? "Account login setup is required before email/password access can complete."
        : "Email/password access was not completed.");
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
      const key = decodeURIComponent(cookie.slice(0, separator));
      if (key === name) return decodeURIComponent(cookie.slice(separator + 1));
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
  CUSTOMER_SESSION_MAX_AGE_SECONDS,
  CUSTOMER_REFRESH_MAX_AGE_SECONDS
};
