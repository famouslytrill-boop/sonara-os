"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const {
  createCustomerAuth,
  GOOGLE_OAUTH_VERIFIER_COOKIE,
  GOOGLE_OAUTH_NEXT_COOKIE,
  GOOGLE_OAUTH_MAX_AGE_SECONDS
} = require("../lib/sonara-customer-auth.cjs");

function deps(overrides = {}) {
  const values = {
    SUPABASE_URL: "https://project.supabase.co",
    SUPABASE_ANON_KEY: "anon-key",
    NEXT_PUBLIC_SITE_URL: "https://sonaraindustries.com"
  };
  return {
    acceptsHtml: () => true,
    createRateLimiter: (options) => options,
    getBearerToken: () => "",
    getEnv: (names) => {
      for (const name of Array.isArray(names) ? names : [names]) {
        if (values[name]) return values[name];
      }
      return "";
    },
    getSupabaseServerClient: () => undefined,
    getSupabaseServerConfig: () => ({ ok: false }),
    isProductionEnvironment: () => true,
    isSupabaseAdminUser: async () => ({ ok: false }),
    siteOrigin: () => "https://sonaraindustries.com",
    renderRateLimitPage: () => undefined,
    reportDegradedRateLimit: () => undefined,
    responsePage: (title) => title,
    ...overrides
  };
}

function responseCookies() {
  const set = [];
  const cleared = [];
  return {
    set,
    cleared,
    res: {
      cookie: (name, value, options) => set.push({ name, value, options }),
      clearCookie: (name, options) => cleared.push({ name, options })
    }
  };
}

describe("Google sign-in is a real Supabase PKCE flow", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("reports configured only when Supabase says Google is enabled", async () => {
    global.fetch = async () => new Response(JSON.stringify({ external: { google: true } }), { status: 200 });
    const ready = await createCustomerAuth(deps()).getGoogleOAuthProviderStatus();
    assert.deepEqual(ready, { ok: true, status: "configured", code: "google_provider_ready" });

    global.fetch = async () => new Response(JSON.stringify({ external: { google: false } }), { status: 200 });
    const disabled = await createCustomerAuth(deps()).getGoogleOAuthProviderStatus();
    assert.equal(disabled.ok, false);
    assert.equal(disabled.status, "setup_required");
    assert.equal(disabled.code, "google_provider_disabled");
  });

  it("starts Google with PKCE and keeps the verifier out of the URL", async () => {
    global.fetch = async () => new Response(JSON.stringify({ external: { google: true } }), { status: 200 });
    const cookies = responseCookies();
    const auth = createCustomerAuth(deps());

    const started = await auth.beginGoogleOAuth(
      { get: () => "sonaraindustries.com", protocol: "https" },
      cookies.res,
      "/creator-studio/dashboard?tab=release"
    );

    assert.equal(started.ok, true);
    const url = new URL(started.url);
    assert.equal(url.origin, "https://project.supabase.co");
    assert.equal(url.pathname, "/auth/v1/authorize");
    assert.equal(url.searchParams.get("provider"), "google");
    assert.equal(url.searchParams.get("redirect_to"), "https://sonaraindustries.com/auth/callback");
    assert.equal(url.searchParams.get("code_challenge_method"), "s256");
    assert.equal(url.searchParams.get("scopes"), "openid email profile");

    const verifier = cookies.set.find((cookie) => cookie.name === GOOGLE_OAUTH_VERIFIER_COOKIE);
    const next = cookies.set.find((cookie) => cookie.name === GOOGLE_OAUTH_NEXT_COOKIE);
    assert.ok(verifier?.value.length >= 43);
    assert.equal(verifier.options.httpOnly, true);
    assert.equal(verifier.options.sameSite, "lax");
    assert.equal(verifier.options.secure, true);
    assert.equal(verifier.options.maxAge, GOOGLE_OAUTH_MAX_AGE_SECONDS * 1000);
    assert.equal(next.value, "/creator-studio/dashboard?tab=release");

    const expectedChallenge = crypto.createHash("sha256").update(verifier.value).digest("base64url");
    assert.equal(url.searchParams.get("code_challenge"), expectedChallenge);
    assert.equal(started.url.includes(verifier.value), false, "PKCE verifier leaked into the redirect URL");
  });

  it("refuses an external next URL rather than creating an open redirect", async () => {
    global.fetch = async () => new Response(JSON.stringify({ external: { google: true } }), { status: 200 });
    const cookies = responseCookies();
    const started = await createCustomerAuth(deps()).beginGoogleOAuth(
      { get: () => "sonaraindustries.com", protocol: "https" },
      cookies.res,
      "https://evil.example/steal"
    );
    assert.equal(started.ok, true);
    assert.equal(cookies.set.find((cookie) => cookie.name === GOOGLE_OAUTH_NEXT_COOKIE).value, "/dashboard");
  });

  it("exchanges the callback code for the same SONARA session shape email login uses", async () => {
    let tokenBody;
    global.fetch = async (input, init = {}) => {
      const url = String(input);
      if (url.endsWith("/auth/v1/settings")) {
        return new Response(JSON.stringify({ external: { google: true } }), { status: 200 });
      }
      if (url.includes("/auth/v1/token?grant_type=pkce")) {
        tokenBody = JSON.parse(String(init.body));
        return new Response(JSON.stringify({
          access_token: "access-token",
          refresh_token: "refresh-token",
          expires_in: 3600
        }), { status: 200 });
      }
      throw new Error(`unexpected URL ${url}`);
    };

    const cookies = responseCookies();
    const cookieHeader = [
      `${GOOGLE_OAUTH_VERIFIER_COOKIE}=${encodeURIComponent("verifier-value")}`,
      `${GOOGLE_OAUTH_NEXT_COOKIE}=${encodeURIComponent("/dashboard")}`
    ].join("; ");

    const result = await createCustomerAuth(deps()).completeGoogleOAuth(
      { query: { code: "auth-code" }, get: (name) => String(name).toLowerCase() === "cookie" ? cookieHeader : "" },
      cookies.res
    );

    assert.equal(result.ok, true);
    assert.equal(result.nextPath, "/dashboard");
    assert.equal(result.body.sessionStored, true);
    assert.deepEqual(result.session, {
      accessToken: "access-token",
      refreshToken: "refresh-token",
      maxAgeSeconds: 3600
    });
    assert.deepEqual(tokenBody, { auth_code: "auth-code", code_verifier: "verifier-value" });
    assert.deepEqual(
      cookies.cleared.map((cookie) => cookie.name).sort(),
      [GOOGLE_OAUTH_NEXT_COOKIE, GOOGLE_OAUTH_VERIFIER_COOKIE].sort()
    );
  });

  it("fails closed when callback proof is absent", async () => {
    const cookies = responseCookies();
    const result = await createCustomerAuth(deps()).completeGoogleOAuth(
      { query: { code: "code-without-verifier" }, get: () => "" },
      cookies.res
    );
    assert.equal(result.ok, false);
    assert.equal(result.code, "oauth_callback_invalid");
    assert.equal(result.status, 400);
  });

  it("the Express callback still sends Google sessions through SONARA two-factor", () => {
    const server = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
    assert.match(server, /app\.get\("\/auth\/google", googleOAuthStartRateLimiter, async/);
    assert.match(server, /app\.get\("\/auth\/callback", googleOAuthCallbackRateLimiter, async/);
    assert.match(server, /completeGoogleOAuth\(req, res\)/);
    assert.match(server, /twoFactor\.holdForSecondFactor\(result, req, res\)/);
    assert.doesNotMatch(server, /Google OAuth is deferred|OAuth deferred/);
  });

  it("deployment verification requires the application callback in Supabase redirect URLs", () => {
    const verifier = fs.readFileSync(path.join(__dirname, "..", "scripts", "verify-google-oauth-provider.mjs"), "utf8");
    assert.match(verifier, /uri_allow_list/);
    assert.match(verifier, /redirect allowlist does not permit/);
    assert.match(verifier, /allowListPatternMatches/);
  });
});
