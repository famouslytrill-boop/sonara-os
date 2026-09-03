"use strict";

// A second factor is not the arithmetic. `tests/a-one-time-password-matches-the-rfc.test.js`
// checks the arithmetic against the specifications' own vectors, and every one
// of those assertions can pass while the feature does nothing at all.
//
// What makes it a second factor is where it sits. Signing in here exchanges an
// email and password with Supabase for an access token, and the token is set as
// a session cookie in the same breath. A code prompt shown after that point is a
// page somebody can close: they already hold a working session.
//
// So this file is about the hold. The enrolment tests are here too, but the ones
// that matter are the two at the end: an account with a factor must not be given
// a session cookie by its password, and a failed read must not be treated as
// "this account has no second factor".

const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");
const registerTwoFactorRoutes = require("../routes/sonara-two-factor-routes.cjs");
const twoFactorFlow = require("../lib/sonara-two-factor.cjs");
const secretBox = require("../lib/sonara-secret-box.cjs");
const otp = require("../lib/sonara-otp.cjs");
const base32 = require("../lib/sonara-base32.cjs");

const USER = { id: "11111111-1111-4111-8111-111111111111", email: "ada@example.com" };
const KEY_VALUE = "0123456789abcdef0123456789abcdef0123456789abcdef";
const KEY = secretBox.keyFrom(() => KEY_VALUE);

// A store standing in for PostgREST, with just enough filter handling for the
// four queries lib/sonara-two-factor.cjs makes.
function fakeTables() {
  const tables = { user_auth_factors: [], user_recovery_codes: [], pending_auth_challenges: [] };
  let counter = 0;
  const matches = (rows, query) =>
    rows.filter((row) =>
      [...String(query).matchAll(/[?&]([a-z_]+)=(eq|is)\.([^&]*)/g)]
        .filter(([, column]) => !["select", "order", "limit"].includes(column))
        .every(([, column, operator, raw]) => {
          const value = decodeURIComponent(raw);
          if (operator === "is") return value !== "null" || row[column] === null || row[column] === undefined;
          return String(row[column]) === value;
        })
    );
  return {
    tables,
    store: {
      list: async (table, query) => ({ ok: true, rows: matches(tables[table], query) }),
      insert: async (table, body) => {
        const made = (Array.isArray(body) ? body : [body]).map((row) => ({
          id: `id-${(counter += 1)}`,
          created_at: new Date().toISOString(),
          disabled_at: null, confirmed_at: null, last_used_step: null,
          used_at: null, consumed_at: null, attempts: 0, ...row
        }));
        tables[table].push(...made);
        return { ok: true, rows: made };
      },
      patch: async (table, filter, body) => {
        const rows = matches(tables[table], `?${filter}`);
        rows.forEach((row) => Object.assign(row, body));
        return { ok: true, rows };
      },
      remove: async (table, filter) => {
        const rows = matches(tables[table], `?${filter}`);
        tables[table] = tables[table].filter((row) => !rows.includes(row));
        return { ok: true };
      }
    }
  };
}

// The whole sign-in path, wired the way server.js wires it: a password check
// that always succeeds, the hold in between, and the session setter.
function buildApp({ tables, envKey = KEY_VALUE, factorReadFails = false, sessionCookies = [] } = {}) {
  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());

  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const requireCustomer = (req, res, next) => { req.sonaraUser = USER; return next(); };

  // The real PostgREST shapes, answered from the fake tables.
  const rest = tables.store;
  global.fetch = async (url, options = {}) => {
    const target = String(url);
    if (target.includes("/auth/v1/user")) {
      return { ok: true, status: 200, headers: { get: () => null }, json: async () => USER };
    }
    const table = (target.split("/rest/v1/")[1] || "").split("?")[0];
    const query = target.includes("?") ? `?${target.split("?").slice(1).join("?")}` : "";
    const method = options.method || "GET";
    if (factorReadFails && table === "user_auth_factors" && method === "GET") {
      return { ok: false, status: 500, headers: { get: () => null }, json: async () => ({}) };
    }
    if (method === "GET") {
      const answer = await rest.list(table, query);
      return { ok: answer.ok, status: answer.ok ? 200 : 500, headers: { get: () => null }, json: async () => answer.rows };
    }
    if (method === "POST") {
      const answer = await rest.insert(table, JSON.parse(options.body));
      return { ok: true, status: 201, headers: { get: () => null }, json: async () => answer.rows };
    }
    if (method === "PATCH") {
      const answer = await rest.patch(table, query.slice(1), JSON.parse(options.body));
      return { ok: true, status: 200, headers: { get: () => null }, json: async () => answer.rows };
    }
    if (method === "DELETE") {
      await rest.remove(table, query.slice(1));
      return { ok: true, status: 204, headers: { get: () => null }, json: async () => [] };
    }
    return { ok: false, status: 405, headers: { get: () => null }, json: async () => ({}) };
  };

  const sendEmailAuthResult = (req, res, result, sessionRedirect, fallbackRedirect) => {
    if (result.session?.accessToken) {
      sessionCookies.push(result.session.accessToken);
      res.cookie("sonara_session", result.session.accessToken, { httpOnly: true });
    }
    if (String(req.headers.accept || "").includes("text/html")) {
      return res.redirect(303, result.session?.accessToken ? sessionRedirect : fallbackRedirect);
    }
    return res.status(result.status).json(result.body);
  };

  const registered = registerTwoFactorRoutes(app, {
    layout: ({ title, heading, body, sections = [], actions = [] }) => `<html><title>${title}</title><h1>${heading}</h1><p>${body}</p>${sections.join("")}<nav>${actions.join("")}</nav></html>`,
    brandCard: (t, b) => `<article><h2>${t}</h2><p>${b}</p></article>`,
    linkAction: (href, label) => `<a href="${href}">${label}</a>`,
    escapeHtml,
    requireCustomer,
    getSupabaseServerConfig: () => ({ ok: true, url: "https://project.supabase.co", serviceRoleKey: "server-only" }),
    supabaseHeaders: (config) => ({ apikey: config.serviceRoleKey, Authorization: `Bearer ${config.serviceRoleKey}` }),
    getEnv: (names) => (names.includes("SONARA_TOTP_KEY") ? envKey : undefined),
    verifySupabaseAccessToken: async () => ({ ok: true, user: USER }),
    sendEmailAuthResult
  });

  // server.js: password first, hold second, session third.
  app.post("/auth/login", async (req, res) => {
    const result = { status: 200, body: { ok: true, code: "login_ready", sessionStored: true }, session: { accessToken: "REAL-ACCESS-TOKEN", refreshToken: "REAL-REFRESH-TOKEN", maxAgeSeconds: 3600 } };
    const held = registered.ok ? await registered.holdForSecondFactor(result, req, res) : null;
    if (held) return held;
    return sendEmailAuthResult(req, res, result, "/dashboard", "/login");
  });

  return { app, registered };
}

// Enrol a confirmed factor and hand back the secret, so a test can produce
// codes the server will accept.
async function enrol(tables) {
  const begun = await twoFactorFlow.beginEnrolment(tables.store, KEY, { userId: USER.id, account: USER.email });
  const secret = base32.decode(/secret=([A-Z2-7]+)/.exec(begun.uri)[1]).bytes;
  // Confirmed one step in the past, deliberately. The routes read their own
  // clock -- a request cannot hand them one -- so confirming at "now" would
  // spend the current step and every code the tests below produce would come
  // back `reused`, which is correct behaviour reported as a broken test.
  const at = Math.floor(Date.now() / 1000) - otp.DEFAULT_STEP_SECONDS;
  await twoFactorFlow.confirmEnrolment(tables.store, KEY, { userId: USER.id, code: otp.totp(secret, { at }), at });
  return { secret, recoveryCodes: begun.recoveryCodes };
}

// The code the server, reading its own clock, will accept right now.
const codeNow = (secret) => otp.totp(secret, { at: Math.floor(Date.now() / 1000) });

const cookieFor = (response, name) =>
  (response.headers["set-cookie"] || []).find((line) => line.startsWith(`${name}=`)) || "";
const valueOf = (line) => (line ? line.split(";")[0].split("=").slice(1).join("=") : "");

describe("a password alone is not enough", () => {
  let originalFetch;
  beforeEach(() => { originalFetch = global.fetch; });
  afterEach(() => { global.fetch = originalFetch; });

  describe("setting it up", () => {
    it("says it is off, and offers to turn it on", async () => {
      const tables = fakeTables();
      const { app } = buildApp({ tables });
      const result = await request(app).get("/account/security/two-factor").set("accept", "text/html");
      assert.equal(result.status, 200);
      assert.match(result.text, /Two-step sign-in is off/);
      assert.match(result.text, /action="\/account\/security\/two-factor\/start"/);
    });

    it("shows a scannable code, the typed secret, and the recovery codes once", async () => {
      const tables = fakeTables();
      const { app } = buildApp({ tables });
      const result = await request(app).post("/account/security/two-factor/start").set("accept", "text/html");
      assert.equal(result.status, 200);
      assert.match(result.text, /<svg/, "no QR was rendered");
      assert.match(result.text, /action="\/account\/security\/two-factor\/confirm"/);
      // Ten codes, shown here and nowhere else ever again.
      assert.equal((result.text.match(/<li><code>/g) || []).length, 10);
      // And it is explicit that nothing is protecting the account yet.
      assert.match(result.text, /not on yet/i);
    });

    it("does not treat an unconfirmed factor as protection", async () => {
      const tables = fakeTables();
      const { app } = buildApp({ tables });
      await request(app).post("/account/security/two-factor/start").set("accept", "text/html");
      // A factor exists in the table at this point. Somebody who closed the tab
      // before confirming must still be able to sign in with their password --
      // being locked out by a factor you never proved works is a support
      // incident, not a security feature.
      const needed = await twoFactorFlow.challengeRequired(tables.store, USER.id);
      assert.deepEqual(needed, { ok: true, required: false });
      const login = await request(app).post("/auth/login").set("accept", "text/html").send({});
      assert.equal(login.headers.location, "/dashboard");
    });

    it("stores the secret sealed, never in the clear", async () => {
      const tables = fakeTables();
      buildApp({ tables });
      const { secret } = await enrol(tables);
      const written = JSON.stringify(tables.tables.user_auth_factors);
      for (const encoding of ["base64url", "base64", "hex"]) {
        assert.ok(!written.includes(secret.toString(encoding)), `the row holds the secret as ${encoding}`);
      }
      assert.ok(!written.includes(base32.encode(secret).replace(/=+$/, "")), "the row holds the secret as base32");
    });

    it("stores no recovery code in the form it was shown", async () => {
      const tables = fakeTables();
      buildApp({ tables });
      const { recoveryCodes } = await enrol(tables);
      const written = JSON.stringify(tables.tables.user_recovery_codes);
      for (const code of recoveryCodes) {
        assert.ok(!written.includes(code), "a recovery code is stored as shown");
        assert.ok(!written.includes(code.replace(/-/g, "")), "a recovery code is stored unhyphenated");
      }
    });

    it("will not turn off without a code, because a signed-in browser is not proof", async () => {
      const tables = fakeTables();
      const { app } = buildApp({ tables });
      const { secret } = await enrol(tables);

      const refused = await request(app).post("/account/security/two-factor/disable").set("accept", "text/html").send({ code: "000000" });
      assert.match(refused.headers.location, /problem=/);
      assert.equal((await twoFactorFlow.challengeRequired(tables.store, USER.id)).required, true, "a wrong code turned it off");

      const accepted = await request(app).post("/account/security/two-factor/disable").set("accept", "text/html").send({ code: codeNow(secret) });
      assert.equal(accepted.headers.location, "/account/security/two-factor");
      assert.equal((await twoFactorFlow.challengeRequired(tables.store, USER.id)).required, false);
      assert.equal(tables.tables.user_recovery_codes.length, 0, "the recovery codes outlived the factor");
    });

    it("refuses to run at all when the sealing key is not configured", async () => {
      // Storing a shared secret in the clear because a variable was missing is
      // worse than not offering the feature: the first tells everybody they are
      // protected.
      const tables = fakeTables();
      const { app } = buildApp({ tables, envKey: "" });
      const result = await request(app).get("/account/security/two-factor").set("accept", "text/html");
      assert.equal(result.status, 503);
      assert.match(result.text, /not switched on for this deployment/i);
      assert.match(result.text, /Nothing is wrong with your account/i);
    });
  });

  describe("the hold between a password and a session", () => {
    it("gives no session cookie to an account that has a second factor", async () => {
      const sessionCookies = [];
      const tables = fakeTables();
      const { app } = buildApp({ tables, sessionCookies });
      await enrol(tables);

      const login = await request(app).post("/auth/login").set("accept", "text/html").send({});

      // This is the whole feature. Everything else is enrolment.
      assert.equal(login.headers.location, "/login/verify", "the password signed them straight in");
      assert.deepEqual(sessionCookies, [], "a session was granted before the second factor");
      assert.equal(valueOf(cookieFor(login, "sonara_session")), "", "a session cookie was set anyway");
      const challenge = valueOf(cookieFor(login, registerTwoFactorRoutes.CHALLENGE_COOKIE));
      assert.ok(challenge, "no challenge cookie was set");
      assert.notEqual(challenge, "REAL-ACCESS-TOKEN", "the access token was handed to the browser as the challenge");
    });

    it("keeps the real tokens out of the browser and out of the row's plaintext", async () => {
      const tables = fakeTables();
      const { app } = buildApp({ tables });
      await enrol(tables);
      const login = await request(app).post("/auth/login").set("accept", "text/html").send({});
      const everySetCookie = (login.headers["set-cookie"] || []).join(" ");
      assert.ok(!everySetCookie.includes("REAL-ACCESS-TOKEN"), "the access token reached the browser");
      assert.ok(!everySetCookie.includes("REAL-REFRESH-TOKEN"), "the refresh token reached the browser");
      const row = JSON.stringify(tables.tables.pending_auth_challenges);
      assert.ok(!row.includes("REAL-ACCESS-TOKEN"), "the parked session is stored in the clear");
      const challenge = valueOf(cookieFor(login, registerTwoFactorRoutes.CHALLENGE_COOKIE));
      assert.ok(!row.includes(challenge), "the challenge id itself is stored, so the row is a way to continue a sign-in");
    });

    it("marks the challenge cookie HttpOnly, because script has no use for it", async () => {
      const tables = fakeTables();
      const { app } = buildApp({ tables });
      await enrol(tables);
      const login = await request(app).post("/auth/login").set("accept", "text/html").send({});
      assert.match(cookieFor(login, registerTwoFactorRoutes.CHALLENGE_COOKIE), /HttpOnly/i);
    });

    it("signs in normally when the account has no factor", async () => {
      const sessionCookies = [];
      const tables = fakeTables();
      const { app } = buildApp({ tables, sessionCookies });
      const login = await request(app).post("/auth/login").set("accept", "text/html").send({});
      assert.equal(login.headers.location, "/dashboard");
      assert.deepEqual(sessionCookies, ["REAL-ACCESS-TOKEN"]);
    });

    it("refuses the sign-in when it cannot tell whether a factor exists", async () => {
      // The deliberate direction. Signing somebody in without their second
      // factor because a table could not be read is the failure this whole
      // feature exists to prevent, so an unreadable check refuses rather than
      // waves through.
      const sessionCookies = [];
      const tables = fakeTables();
      const { app } = buildApp({ tables, factorReadFails: true, sessionCookies });
      const login = await request(app).post("/auth/login").set("accept", "text/html").send({});
      assert.equal(login.status, 503);
      assert.deepEqual(sessionCookies, [], "a session was granted on a failed check");
      assert.match(login.text, /not signed you in/i);
    });
  });

  describe("finishing the sign-in", () => {
    async function loginAndChallenge() {
      const sessionCookies = [];
      const tables = fakeTables();
      const { app } = buildApp({ tables, sessionCookies });
      const { secret, recoveryCodes } = await enrol(tables);
      const login = await request(app).post("/auth/login").set("accept", "text/html").send({});
      const cookie = cookieFor(login, registerTwoFactorRoutes.CHALLENGE_COOKIE).split(";")[0];
      return { app, tables, secret, recoveryCodes, cookie, sessionCookies };
    }

    it("asks for the code, and says the password was already accepted", async () => {
      const { app, cookie } = await loginAndChallenge();
      const shown = await request(app).get("/login/verify").set("accept", "text/html").set("Cookie", cookie);
      assert.equal(shown.status, 200);
      assert.match(shown.text, /action="\/login\/verify"/);
      assert.match(shown.text, /recovery code/i);
    });

    it("sends somebody with no challenge back to the start", async () => {
      const tables = fakeTables();
      const { app } = buildApp({ tables });
      const shown = await request(app).get("/login/verify").set("accept", "text/html");
      assert.equal(shown.headers.location, "/login");
    });

    it("hands over the session only once the code is right", async () => {
      const { app, secret, cookie, sessionCookies } = await loginAndChallenge();

      const wrong = await request(app).post("/login/verify").set("accept", "text/html").set("Cookie", cookie).send({ code: "000000" });
      assert.match(wrong.headers.location, /^\/login\/verify\?problem=/, "a wrong code did not return to the prompt");
      assert.deepEqual(sessionCookies, [], "a wrong code granted the session");

      const right = await request(app).post("/login/verify").set("accept", "text/html").set("Cookie", cookie).send({ code: codeNow(secret) });
      assert.equal(right.headers.location, "/dashboard");
      assert.deepEqual(sessionCookies, ["REAL-ACCESS-TOKEN"], "the held session was not the one handed over");
    });

    it("refuses the same challenge twice", async () => {
      const { app, secret, cookie, sessionCookies } = await loginAndChallenge();
      await request(app).post("/login/verify").set("accept", "text/html").set("Cookie", cookie).send({ code: codeNow(secret) });
      const again = await request(app).post("/login/verify").set("accept", "text/html").set("Cookie", cookie).send({ code: codeNow(secret) });
      assert.match(again.headers.location, /^\/login\?problem=/, "a spent challenge was reusable");
      assert.deepEqual(sessionCookies, ["REAL-ACCESS-TOKEN"], "a spent challenge granted a second session");
    });

    it("refuses the same code twice, as RFC 6238 requires", async () => {
      const { app, secret, tables, sessionCookies } = await loginAndChallenge();
      const code = codeNow(secret);
      // Spend it on one challenge...
      const first = cookieFor(await request(app).post("/auth/login").set("accept", "text/html").send({}), registerTwoFactorRoutes.CHALLENGE_COOKIE).split(";")[0];
      await request(app).post("/login/verify").set("accept", "text/html").set("Cookie", first).send({ code });
      assert.equal(sessionCookies.length, 1);
      // ...then try the same six digits on a fresh one, inside its window.
      const second = cookieFor(await request(app).post("/auth/login").set("accept", "text/html").send({}), registerTwoFactorRoutes.CHALLENGE_COOKIE).split(";")[0];
      const replayed = await request(app).post("/login/verify").set("accept", "text/html").set("Cookie", second).send({ code });
      assert.match(replayed.headers.location, /problem=/);
      assert.equal(sessionCookies.length, 1, "a code read over somebody's shoulder opened a second session");
      assert.ok(tables.tables.user_auth_factors[0].last_used_step, "no step was recorded, so nothing stops a replay");
    });

    it("accepts a recovery code, once", async () => {
      const { app, recoveryCodes, sessionCookies } = await loginAndChallenge();
      const first = cookieFor(await request(app).post("/auth/login").set("accept", "text/html").send({}), registerTwoFactorRoutes.CHALLENGE_COOKIE).split(";")[0];
      const used = await request(app).post("/login/verify").set("accept", "text/html").set("Cookie", first).send({ code: recoveryCodes[2] });
      assert.equal(used.headers.location, "/dashboard");
      assert.equal(sessionCookies.length, 1);

      const second = cookieFor(await request(app).post("/auth/login").set("accept", "text/html").send({}), registerTwoFactorRoutes.CHALLENGE_COOKIE).split(";")[0];
      const again = await request(app).post("/login/verify").set("accept", "text/html").set("Cookie", second).send({ code: recoveryCodes[2] });
      assert.match(again.headers.location, /problem=/);
      assert.equal(sessionCookies.length, 1, "a recovery code worked twice");
    });

    it("stops after five wrong codes rather than leaving the window open", async () => {
      const { app, tables, secret, cookie, sessionCookies } = await loginAndChallenge();
      for (let attempt = 0; attempt < twoFactorFlow.MAX_ATTEMPTS; attempt += 1) {
        await request(app).post("/login/verify").set("accept", "text/html").set("Cookie", cookie).send({ code: "000000" });
      }
      const correct = await request(app).post("/login/verify").set("accept", "text/html").set("Cookie", cookie).send({ code: codeNow(secret) });
      assert.match(correct.headers.location, /^\/login\?problem=/, "the challenge survived the attempt cap");
      assert.deepEqual(sessionCookies, [], "a session was granted after the cap");

      // Killed outright, not merely refused.
      //
      // Two things enforce the cap: a guard that refuses once `attempts` has
      // reached it, and consuming the row at the fifth failure. Either alone
      // makes the assertions above pass, so removing one is invisible to them.
      // This asserts the stronger of the two directly -- the remaining minutes
      // of a capped challenge are not five more minutes of guessing.
      assert.ok(
        tables.tables.pending_auth_challenges[0].consumed_at,
        "the capped challenge was left alive to expire on its own"
      );
    });

    it("answers JSON callers without a redirect", async () => {
      const tables = fakeTables();
      const { app } = buildApp({ tables });
      await enrol(tables);
      const login = await request(app).post("/auth/login").set("accept", "application/json").send({});
      assert.equal(login.status, 200);
      assert.equal(login.body.code, "second_factor_required");
      assert.equal(login.body.sessionStored, false, "a JSON caller was told a session was stored");
    });
  });

  describe("what a person is told", () => {
    it("keeps a spent code apart from a wrong one", () => {
      // A correct code reported as wrong sends somebody to check their phone's
      // clock, reinstall the app, and give up on a feature that is working.
      assert.match(registerTwoFactorRoutes.sayWhy("reused"), /already been used/i);
      assert.match(registerTwoFactorRoutes.sayWhy("no_match"), /does not match/i);
      assert.notEqual(registerTwoFactorRoutes.sayWhy("reused"), registerTwoFactorRoutes.sayWhy("no_match"));
      assert.match(registerTwoFactorRoutes.sayWhy("already_used"), /recovery code/i);
      assert.match(registerTwoFactorRoutes.sayWhy("no_match", 3), /3 attempts left/);
    });

    it("never says nothing changed when something did", () => {
      for (const code of ["unreadable", "unwritable", "cannot_open"]) {
        assert.match(registerTwoFactorRoutes.sayWhy(code), /Nothing has been changed/i);
      }
    });
  });

  describe("registering the routes", () => {
    it("refuses to register without the helpers it depends on", () => {
      // A settings page that renders while the thing behind it cannot write is
      // a page that tells somebody their account is protected when it is not.
      assert.ok(registerTwoFactorRoutes.REQUIRED.length >= 8);
      const answer = registerTwoFactorRoutes(express(), {});
      assert.equal(answer.ok, false);
      assert.deepEqual(answer.missing.sort(), [...registerTwoFactorRoutes.REQUIRED].sort());
    });
  });
});
