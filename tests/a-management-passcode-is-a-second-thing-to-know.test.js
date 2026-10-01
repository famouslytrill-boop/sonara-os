"use strict";

// `requireBusinessManager` proves a valid session plus an active owner or
// manager membership. Both live in the browser: the session cookie lasts an
// hour and the refresh cookie renews it for thirty days. So for up to a month,
// holding the browser is holding every employee record, wage rate, pay
// statement and the time clock.
//
// lib/sonara-business-passcode.cjs adds something that is not in the browser.
// This file is the proof that it is worth having, and most of these cases are
// ways it could appear to work while not working.
//
// Two defects in the first version of the module were found by running it
// rather than reading it, and both have a case here:
//
//   * `if (isPasswordLeaked(value))` on an async function tested a Promise,
//     which is always truthy, so **every** passcode was rejected as breached.
//   * a "counting" rule compared the digits against the literal `"0123456789"`
//     while also requiring twelve digits, so it could never fire on any input.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const request = require("supertest");

const passcode = require("../lib/sonara-business-passcode.cjs");
const registerSecurityRoutes = require("../routes/sonara-business-security-routes.cjs");

const KEY = { material: Buffer.from("a".repeat(64), "utf8") };
const OTHER_KEY = { material: Buffer.from("b".repeat(64), "utf8") };
const GOOD = "Harbour-Lantern-Quiet-2026";
const ORGANIZATION_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_ORGANIZATION = "99999999-9999-4999-8999-999999999999";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const SECURITY = "/business-builder/owner/security";

describe("a management passcode is a second thing to know", () => {
  describe("what is stored, and what cannot be got back out of it", () => {
    const stored = passcode.hashPasscode(GOOD, KEY);

    it("verifies the passcode it was made from", () => {
      assert.deepEqual(passcode.verifyPasscode(GOOD, stored, KEY), { ok: true, matches: true });
    });

    it("does not verify a different passcode", () => {
      assert.deepEqual(passcode.verifyPasscode(`${GOOD}x`, stored, KEY), { ok: true, matches: false });
    });

    // The pepper is the half that lives in the environment. Without it a
    // database disclosure would be enough on its own.
    it("does not verify under a different pepper, so the table alone is not enough", () => {
      assert.deepEqual(passcode.verifyPasscode(GOOD, stored, OTHER_KEY), { ok: true, matches: false });
    });

    it("holds no part of the passcode anywhere in the stored value", () => {
      for (const fragment of ["Harbour", "Lantern", "Quiet", "2026", GOOD]) {
        assert.equal(stored.includes(fragment), false, `the stored hash leaks "${fragment}"`);
      }
      assert.equal(stored.startsWith("v1.scrypt."), true, "the format is versioned so a change is a readable failure");
    });

    it("hashes the same passcode to different values, so two businesses sharing one are not visibly the same", () => {
      assert.notEqual(stored, passcode.hashPasscode(GOOD, KEY), "a salt per row");
    });

    // The distinction that stops an owner being locked out by a damaged row.
    it("reports a hash it cannot parse as unreadable, never as a wrong passcode", () => {
      for (const broken of ["", "nonsense", "v1.scrypt.32768.8.1", "v2.scrypt.32768.8.1.AAAA.BBBB", null]) {
        const result = passcode.verifyPasscode(GOOD, broken, KEY);
        assert.equal(result.ok, false, `"${broken}" should be unreadable`);
        assert.equal(result.code, "unreadable_hash");
        assert.equal(result.matches, undefined, "there is no matches to read when ok is false");
      }
    });

    // A cost field is attacker-supplied once a row can be edited. 2^30 at r=8
    // asks for 1 TiB.
    it("refuses a stored cost higher than the one it writes", () => {
      const inflated = ["v1", "scrypt", String(2 ** 30), "8", "1", "AAAAAAAAAAA", "A".repeat(43)].join(".");
      assert.equal(passcode.verifyPasscode(GOOD, inflated, KEY).code, "unreadable_hash");
    });
  });

  describe("which passcodes are allowed", () => {
    it("accepts an ordinary phrase", () => {
      assert.deepEqual(passcode.checkPasscode(GOOD), { ok: true });
    });

    // The regression for the Promise bug. Before it was fixed this assertion
    // failed on every input, including this one.
    it("does not reject a good passcode out of hand", () => {
      for (const candidate of [GOOD, "Twelve plus a bit", "zq!Wm4vTnP8sLd"]) {
        assert.equal(passcode.checkPasscode(candidate).ok, true, `${candidate} was rejected`);
      }
    });

    it("refuses one shorter than the floor the account password uses", () => {
      assert.equal(passcode.checkPasscode("a".repeat(passcode.MINIMUM_LENGTH - 1)).code, "too_short");
      assert.equal(passcode.MINIMUM_LENGTH, 12);
    });

    it("refuses one repeated character", () => {
      assert.equal(passcode.checkPasscode("aaaaaaaaaaaaaa").code, "one_character");
    });

    // The regression for the rule that could never fire. The first version
    // tested `"0123456789".includes(digits)` on a value of at least twelve
    // digits, which no twelve-character string can satisfy.
    it("refuses counting up or down, at a length a ten-character run cannot reach", () => {
      assert.equal(passcode.checkPasscode("abcdefghijkl").code, "counting");
      assert.equal(passcode.checkPasscode("lkjihgfedcba").code, "counting");
      assert.equal(passcode.isStepSequence("abcdefghijkl"), true);
      assert.equal(passcode.isStepSequence("abcdefghijkm"), false);
      assert.equal(passcode.isStepSequence(GOOD), false);
    });

    it("refuses a leading or trailing space", () => {
      assert.equal(passcode.checkPasscode(` ${GOOD}`).code, "padded");
      assert.equal(passcode.checkPasscode(`${GOOD} `).code, "padded");
    });

    it("refuses nothing at all", () => {
      assert.equal(passcode.checkPasscode("").code, "missing");
    });
  });

  describe("the breach list, and the difference between clear and not checked", () => {
    it("rejects a passcode the corpus returns a hit for", async () => {
      const digest = require("node:crypto").createHash("sha1").update(GOOD).digest("hex").toUpperCase();
      const hit = async () => ({ ok: true, status: 200, text: async () => `${digest.slice(5)}:4211` });
      const result = await passcode.checkPasscodeAgainstBreaches(GOOD, { fetch: hit });
      assert.equal(result.ok, false);
      assert.equal(result.code, "leaked");
    });

    it("accepts one the corpus does not list, and says the check happened", async () => {
      const miss = async () => ({ ok: true, status: 200, text: async () => "0000000000000000000000000000000000000:3" });
      assert.deepEqual(await passcode.checkPasscodeAgainstBreaches(GOOD, { fetch: miss }), { ok: true, breachCheck: "clear" });
    });

    // A lookup that did not happen is not evidence of anything. Reporting it
    // as "clear" would be a tick standing for nothing.
    it("says unavailable when the corpus could not be reached, rather than clear", async () => {
      const down = async () => { throw new Error("unreachable"); };
      assert.deepEqual(await passcode.checkPasscodeAgainstBreaches(GOOD, { fetch: down }), { ok: true, breachCheck: "unavailable" });
      const failing = async () => ({ ok: false, status: 503 });
      assert.deepEqual(await passcode.checkPasscodeAgainstBreaches(GOOD, { fetch: failing }), { ok: true, breachCheck: "unavailable" });
    });

    it("still applies the shape rules before spending a request", async () => {
      let called = false;
      const counted = async () => { called = true; throw new Error("should not run"); };
      assert.equal((await passcode.checkPasscodeAgainstBreaches("short", { fetch: counted })).code, "too_short");
      assert.equal(called, false, "a passcode that fails the shape rules never reaches the network");
    });
  });

  describe("counting wrong answers", () => {
    const now = 1_700_000_000_000;

    it("counts up and says how many are left", () => {
      assert.deepEqual(passcode.failureState(0, now), { failures: 1, lockedUntilMs: null, remaining: 4 });
      assert.deepEqual(passcode.failureState(3, now), { failures: 4, lockedUntilMs: null, remaining: 1 });
    });

    it("locks on the fifth", () => {
      const fifth = passcode.failureState(4, now);
      assert.equal(fifth.failures, passcode.MAXIMUM_FAILURES);
      assert.equal(fifth.lockedUntilMs, now + passcode.LOCKOUT_SECONDS * 1000);
      assert.equal(fifth.remaining, 0);
    });

    it("treats an absent count as the first failure rather than as four", () => {
      assert.equal(passcode.failureState(null, now).failures, 1);
      assert.equal(passcode.failureState(undefined, now).failures, 1);
    });

    it("is open when there is no lock, and when the lock has passed", () => {
      assert.deepEqual(passcode.lockState(null, now), { locked: false });
      assert.deepEqual(passcode.lockState(new Date(now - 1000).toISOString(), now), { locked: false });
    });

    it("is locked while the lock stands", () => {
      const state = passcode.lockState(new Date(now + 60_000).toISOString(), now);
      assert.equal(state.locked, true);
      assert.equal(state.secondsRemaining, 60);
    });

    // Reading a value nobody can parse as "no lock" is how a lockout is
    // defeated by writing rubbish into the column.
    it("counts a lock it cannot read as locked, not as open", () => {
      const state = passcode.lockState("banana", now);
      assert.equal(state.locked, true);
      assert.equal(state.code, "unreadable_lock");
    });
  });

  describe("the unlock token", () => {
    const now = 1_700_000_000_000;
    const base = { organizationId: ORGANIZATION_ID, userId: USER_ID, credentialVersion: "2026-10-01T00:00:00Z", key: KEY };
    const minted = passcode.issueUnlock({ ...base, nowMs: now });

    it("opens the business and person it was made for", () => {
      assert.equal(passcode.verifyUnlock(minted.token, { ...base, nowMs: now + 1000 }).ok, true);
    });

    it("does not open a different business", () => {
      const result = passcode.verifyUnlock(minted.token, { ...base, organizationId: OTHER_ORGANIZATION, nowMs: now + 1000 });
      assert.deepEqual(result, { ok: false, code: "unlock_invalid" });
    });

    it("does not open for a different person on the same browser", () => {
      assert.equal(passcode.verifyUnlock(minted.token, { ...base, userId: "33333333-3333-4333-8333-333333333333", nowMs: now + 1000 }).ok, false);
    });

    // This is what makes changing the passcode a way to remove access rather
    // than a note that takes effect next time somebody signs in.
    it("stops working the moment the passcode changes", () => {
      const result = passcode.verifyUnlock(minted.token, { ...base, credentialVersion: "2026-10-02T00:00:00Z", nowMs: now + 1000 });
      assert.deepEqual(result, { ok: false, code: "unlock_invalid" });
    });

    it("expires on its own, however long the sign-in lasts", () => {
      assert.deepEqual(
        passcode.verifyUnlock(minted.token, { ...base, nowMs: now + passcode.UNLOCK_SECONDS * 1000 + 1 }),
        { ok: false, code: "unlock_expired" }
      );
      assert.equal(passcode.UNLOCK_SECONDS, 1800, "thirty minutes, against a sign-in that can last thirty days");
    });

    it("refuses a token that is absent or malformed, and never throws on one", () => {
      for (const bad of ["", "x", "v1.notanumber.sig", "v2.1.sig", null, undefined]) {
        assert.equal(passcode.verifyUnlock(bad, { ...base, nowMs: now }).ok, false);
      }
    });

    // Without a separator between the fields, org "ab" + user "c" and org "a" +
    // user "bc" sign the same bytes, and one unlock opens the other business.
    it("cannot be made ambiguous by moving a character between two fields", () => {
      const left = passcode.issueUnlock({ organizationId: "ab", userId: "c", credentialVersion: "v", nowMs: now, key: KEY });
      const right = passcode.issueUnlock({ organizationId: "a", userId: "bc", credentialVersion: "v", nowMs: now, key: KEY });
      assert.notEqual(left.token, right.token);
    });
  });

  describe("where the unlock takes effect", () => {
    it("rejects a redirect target that leaves this site", () => {
      for (const hostile of ["//evil.example/x", "https://evil.example", "javascript:alert(1)", "evil", "/\\evil.example"]) {
        assert.equal(registerSecurityRoutes.safeNext(hostile), "", `${hostile} was accepted as a return path`);
      }
      assert.equal(registerSecurityRoutes.safeNext("/business-builder/owner/pay-periods"), "/business-builder/owner/pay-periods");
    });

    // The list on the page says what the passcode covers. If a path can be
    // named there without actually being gated, the page tells the owner they
    // are protected when they are not.
    it("names only surfaces server.js actually puts the gate in front of", () => {
      const server = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
      assert.match(server, /requireUnlockedBusinessManager\s*=\s*chainMiddleware\(requireBusinessManager, requireManagementUnlock\)/);
      const gated = server.match(/requireBusinessManager:\s*requireUnlockedBusinessManager/g) || [];
      assert.equal(gated.length, registerSecurityRoutes.PROTECTED_SURFACES.length,
        `${registerSecurityRoutes.PROTECTED_SURFACES.length} surfaces are advertised as covered and ${gated.length} registrations carry the gate`);
      assert.ok(registerSecurityRoutes.PROTECTED_SURFACES.length > 0, "an empty list would pass every assertion above by measuring nothing");
    });
  });

  describe("the pages, with a database behind them", () => {
    function buildApp({ credential = null, readOk = true, key = "k".repeat(64), cookie = "", writes = [] } = {}) {
      const app = express();
      app.use(express.urlencoded({ extended: false }));
      app.use(express.json());
      const authenticate = (req, res, next) => { req.sonaraUser = { id: USER_ID }; return next(); };
      const registered = registerSecurityRoutes(app, {
        layout: ({ title, heading, sections = [] }) => `<html><title>${title}</title><h1>${heading}</h1>${sections.join("")}</html>`,
        brandCard: (t, b) => `<article><h2>${t}</h2><p>${b}</p></article>`,
        linkAction: (href, label) => `<a href="${href}">${label}</a>`,
        escapeHtml: (v) => String(v === 0 ? 0 : v || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])),
        requireBusinessManager: authenticate,
        getCustomerPrimaryOrganization: async () => ({ ok: true, organizationId: ORGANIZATION_ID }),
        getSupabaseServerConfig: () => ({ ok: true, url: "https://project.supabase.co", serviceRoleKey: "server-only" }),
        getEnv: () => key,
        getCookie: () => cookie,
        isProductionEnvironment: () => false
      });
      // One route behind the gate, standing in for the pay-period pages.
      app.get("/guarded", authenticate, registered.requireManagementUnlock, (req, res) =>
        res.status(200).json({ ok: true, state: req.sonaraManagementUnlock?.state }));

      global.fetch = async (url, options = {}) => {
        const method = options.method || "GET";
        if (method !== "GET") {
          writes.push({ method, url: String(url), body: options.body ? JSON.parse(options.body) : null });
          return { ok: true, status: 200, json: async () => [] };
        }
        if (!readOk) return { ok: false, status: 500, json: async () => ({}) };
        return { ok: true, status: 200, json: async () => (credential ? [credential] : []) };
      };
      return app;
    }

    function credentialRow(overrides = {}) {
      return {
        id: "44444444-4444-4444-8444-444444444444",
        passcode_hash: passcode.hashPasscode(GOOD, { material: Buffer.from("k".repeat(64), "utf8") }),
        failed_attempts: 0,
        locked_until: null,
        last_verified_at: null,
        updated_at: "2026-10-01T00:00:00Z",
        ...overrides
      };
    }

    const originalFetch = global.fetch;
    after(() => { global.fetch = originalFetch; });

    it("says plainly that nothing is protected when no passcode is set", async () => {
      const response = await request(buildApp()).get(SECURITY).set("accept", "text/html");
      assert.equal(response.status, 200);
      assert.match(response.text, /No management passcode set/);
      assert.match(response.text, /protected by your sign-in alone/);
    });

    // The gate is permissive before a passcode exists on purpose -- refusing
    // would lock an owner out of their own payroll over a feature nobody has
    // told them about. What it must not do is be permissive quietly, which is
    // why the case above exists beside this one.
    it("lets a manager through when no passcode is set, and reports that it did", async () => {
      const response = await request(buildApp()).get("/guarded").set("accept", "application/json");
      assert.deepEqual(response.body, { ok: true, state: "not_set" });
    });

    it("refuses once a passcode exists and this device has no unlock", async () => {
      const response = await request(buildApp({ credential: credentialRow() })).get("/guarded").set("accept", "application/json");
      assert.equal(response.status, 403);
      assert.equal(response.body.ok, false);
    });

    it("lets through a device carrying a valid unlock", async () => {
      const token = passcode.issueUnlock({
        organizationId: ORGANIZATION_ID,
        userId: USER_ID,
        credentialVersion: "2026-10-01T00:00:00Z",
        nowMs: Date.now(),
        key: { material: Buffer.from("k".repeat(64), "utf8") }
      }).token;
      const response = await request(buildApp({ credential: credentialRow(), cookie: token })).get("/guarded").set("accept", "application/json");
      assert.deepEqual(response.body, { ok: true, state: "unlocked" });
    });

    // Reading a failed database call as "this business has no passcode" is a
    // way to walk through the gate by breaking something.
    // A deployment with no database has nothing to protect: every read the
    // protected page would make fails too. Refusing here only replaced each
    // page's own honest "not connected yet" message with a redirect to a
    // security page that cannot explain itself either.
    it("lets a request through when there is no database at all, and names that state", async () => {
      const app = express();
      app.use(express.json());
      const authenticate = (req, res, next) => { req.sonaraUser = { id: USER_ID }; return next(); };
      const registered = registerSecurityRoutes(app, {
        requireBusinessManager: authenticate,
        getCustomerPrimaryOrganization: async () => ({ ok: true, organizationId: ORGANIZATION_ID }),
        getSupabaseServerConfig: () => ({ ok: false }),
        getEnv: () => "k".repeat(64),
        getCookie: () => ""
      });
      app.get("/guarded", authenticate, registered.requireManagementUnlock, (req, res) =>
        res.status(200).json({ ok: true, state: req.sonaraManagementUnlock?.state }));
      const response = await request(app).get("/guarded").set("accept", "application/json");
      assert.deepEqual(response.body, { ok: true, state: "no_database" });
    });

    // Not knowing which business is asking is different: there is then no
    // credential to look up, so there is no basis on which to let it past.
    it("refuses when it cannot tell which business is asking", async () => {
      const app = express();
      app.use(express.json());
      const authenticate = (req, res, next) => { req.sonaraUser = { id: USER_ID }; return next(); };
      const registered = registerSecurityRoutes(app, {
        requireBusinessManager: authenticate,
        getCustomerPrimaryOrganization: async () => ({ ok: false }),
        getSupabaseServerConfig: () => ({ ok: true, url: "https://project.supabase.co", serviceRoleKey: "server-only" }),
        getEnv: () => "k".repeat(64),
        getCookie: () => ""
      });
      app.get("/guarded", authenticate, registered.requireManagementUnlock, (req, res) => res.status(200).json({ ok: true }));
      const response = await request(app).get("/guarded").set("accept", "application/json");
      assert.equal(response.status, 503);
      assert.equal(response.body.code, "no_organization");
    });

    it("refuses when the credential cannot be read, rather than reading the failure as no passcode", async () => {
      const response = await request(buildApp({ readOk: false })).get("/guarded").set("accept", "application/json");
      assert.equal(response.status, 503);
      assert.equal(response.body.code, "credential_unreadable");
    });

    // The business asked for a passcode. A missing deployment variable is not
    // the owner withdrawing that request.
    it("refuses when a passcode exists but the key that checks it is gone", async () => {
      const response = await request(buildApp({ credential: credentialRow(), key: "" })).get("/guarded").set("accept", "application/json");
      assert.equal(response.status, 403);
      assert.equal(response.body.code, "setup_required");
    });

    it("unlocks on the right passcode and records nothing of what was typed", async () => {
      const writes = [];
      const response = await request(buildApp({ credential: credentialRow(), writes }))
        .post(`${SECURITY}/unlock`).set("accept", "application/json").send({ passcode: GOOD });
      assert.equal(response.status, 200);
      assert.equal(response.body.ok, true);
      const cookies = String(response.headers["set-cookie"] || "");
      assert.match(cookies, new RegExp(passcode.UNLOCK_COOKIE));
      assert.match(cookies, /HttpOnly/i);
      assert.match(cookies, /SameSite=Strict/i);
      assert.equal(cookies.includes(GOOD), false, "the passcode is not in the cookie");
      assert.equal(JSON.stringify(writes).includes(GOOD), false, "the passcode is not written to the database");
    });

    it("counts a wrong passcode and does not unlock", async () => {
      const writes = [];
      const response = await request(buildApp({ credential: credentialRow({ failed_attempts: 1 }), writes }))
        .post(`${SECURITY}/unlock`).set("accept", "application/json").send({ passcode: "not the passcode at all" });
      assert.equal(response.status, 403);
      assert.equal(response.body.code, "passcode_wrong");
      assert.equal(response.body.remaining, 3);
      assert.equal(String(response.headers["set-cookie"] || "").includes(passcode.UNLOCK_COOKIE), false);
      assert.equal(writes.at(-1).body.failed_attempts, 2);
      assert.equal(writes.at(-1).body.locked_until, null);
    });

    it("locks after the fifth wrong passcode", async () => {
      const writes = [];
      const response = await request(buildApp({ credential: credentialRow({ failed_attempts: 4 }), writes }))
        .post(`${SECURITY}/unlock`).set("accept", "application/json").send({ passcode: "still not it, sorry" });
      assert.equal(response.body.code, "locked_out");
      assert.equal(typeof writes.at(-1).body.locked_until, "string");
    });

    it("refuses to unlock while locked, without spending a hash on the attempt", async () => {
      const locked = credentialRow({ failed_attempts: 5, locked_until: new Date(Date.now() + 600_000).toISOString() });
      const response = await request(buildApp({ credential: locked }))
        .post(`${SECURITY}/unlock`).set("accept", "application/json").send({ passcode: GOOD });
      assert.equal(response.status, 429);
      assert.equal(response.body.code, "locked_out");
    });

    // Without this, a borrowed browser does not have to guess the passcode. It
    // replaces it.
    it("will not change an existing passcode without the current one", async () => {
      const writes = [];
      const response = await request(buildApp({ credential: credentialRow(), writes }))
        .post(`${SECURITY}/passcode`).set("accept", "application/json")
        .send({ currentPasscode: "wrong one entirely", passcode: "New-Harbour-Phrase-77", confirmPasscode: "New-Harbour-Phrase-77" });
      assert.equal(response.status, 403);
      assert.equal(response.body.code, "current_passcode_wrong");
      assert.equal(writes.some((write) => write.body?.passcode_hash), false, "nothing was stored");
    });

    it("refuses two new passcodes that do not match", async () => {
      const response = await request(buildApp())
        .post(`${SECURITY}/passcode`).set("accept", "application/json")
        .send({ passcode: "Harbour-Phrase-One-77", confirmPasscode: "Harbour-Phrase-Two-77" });
      assert.equal(response.body.code, "passcode_mismatch");
    });

    it("sets a first passcode and stores a hash rather than the passcode", async () => {
      const writes = [];
      const response = await request(buildApp({ writes }))
        .post(`${SECURITY}/passcode`).set("accept", "application/json")
        .send({ passcode: "Harbour-Phrase-One-77", confirmPasscode: "Harbour-Phrase-One-77" });
      assert.equal(response.status, 200);
      const written = writes.find((write) => write.body?.[0]?.passcode_hash)?.body[0];
      assert.ok(written, "a row was written");
      assert.match(written.passcode_hash, /^v1\.scrypt\./);
      assert.equal(JSON.stringify(writes).includes("Harbour-Phrase-One-77"), false, "the passcode itself is never sent to the database");
      assert.equal(written.organization_id, ORGANIZATION_ID);
    });

    it("refuses to store a passcode when the pepper is not configured", async () => {
      const writes = [];
      const response = await request(buildApp({ key: "", writes }))
        .post(`${SECURITY}/passcode`).set("accept", "application/json")
        .send({ passcode: "Harbour-Phrase-One-77", confirmPasscode: "Harbour-Phrase-One-77" });
      assert.equal(response.status, 503);
      assert.equal(response.body.code, "passcode_key_missing");
      assert.equal(writes.length, 0, "nothing weaker is stored in its place");
    });

    it("lets an owner close the pages again on this device", async () => {
      const response = await request(buildApp({ credential: credentialRow() }))
        .post(`${SECURITY}/lock`).set("accept", "application/json").send({});
      assert.equal(response.body.ok, true);
      assert.match(String(response.headers["set-cookie"] || ""), new RegExp(`${passcode.UNLOCK_COOKIE}=;`));
    });
  });

  // The gate composed with a real module it is actually put in front of, rather
  // than with the stand-in above. server.js wires the pay-period pages through
  // `chainMiddleware(requireBusinessManager, requireManagementUnlock)`, and the
  // two have to agree about what a request carries: the gate sets
  // `req.sonaraManagementUnlock` and the page module reads `req.sonaraUser`.
  // A stand-in route proves the gate; it does not prove the pair.
  describe("composed with the pay-period pages it guards", () => {
    const registerPayPeriodRoutes = require("../routes/sonara-pay-period-routes.cjs");
    const PERIOD_ID = "55555555-5555-4555-8555-555555555555";
    const originalFetch = global.fetch;
    after(() => { global.fetch = originalFetch; });

    function buildApp({ credential = null, cookie = "", rows = {} } = {}) {
      const app = express();
      app.use(express.urlencoded({ extended: false }));
      app.use(express.json());
      const authenticate = (req, res, next) => { req.sonaraUser = { id: USER_ID }; return next(); };
      const shared = {
        layout: ({ title, heading, eyebrow, body, sections = [] }) =>
          `<html><title>${title}</title><p>${eyebrow}</p><h1>${heading}</h1><p>${body}</p>${sections.join("")}</html>`,
        brandCard: (t, b) => `<article><h2>${t}</h2><p>${b}</p></article>`,
        linkAction: (href, label) => `<a href="${href}">${label}</a>`,
        escapeHtml: (v) => String(v === 0 ? 0 : v || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])),
        requireBusinessManager: authenticate,
        getCustomerPrimaryOrganization: async () => ({ ok: true, organizationId: ORGANIZATION_ID }),
        getSupabaseServerConfig: () => ({ ok: true, url: "https://project.supabase.co", serviceRoleKey: "server-only" })
      };
      const security = registerSecurityRoutes(app, { ...shared, getEnv: () => "k".repeat(64), getCookie: () => cookie, isProductionEnvironment: () => false });
      // The same composition server.js uses, kept here so the two cannot drift
      // apart silently.
      const chained = (req, res, next) => shared.requireBusinessManager(req, res, (error) =>
        error ? next(error) : security.requireManagementUnlock(req, res, next));
      registerPayPeriodRoutes(app, { ...shared, requireBusinessManager: chained });

      global.fetch = async (url, options = {}) => {
        const target = String(url);
        const table = (target.split("/rest/v1/")[1] || "").split("?")[0];
        if ((options.method || "GET") !== "GET") return { ok: true, status: 200, json: async () => [] };
        if (table === registerSecurityRoutes.CREDENTIAL_TABLE) {
          return { ok: true, status: 200, json: async () => (credential ? [credential] : []) };
        }
        return { ok: true, status: 200, json: async () => (rows[table] || []) };
      };
      return app;
    }

    function credentialRow() {
      return {
        id: "66666666-6666-4666-8666-666666666666",
        passcode_hash: passcode.hashPasscode(GOOD, { material: Buffer.from("k".repeat(64), "utf8") }),
        failed_attempts: 0,
        locked_until: null,
        updated_at: "2026-10-01T00:00:00Z"
      };
    }

    it("renders the pay-period list when the business has set no passcode", async () => {
      const response = await request(buildApp()).get("/business-builder/owner/pay-periods").set("accept", "text/html");
      assert.equal(response.status, 200);
      assert.match(response.text, /<h1>/, "the page rendered rather than redirecting");
      assert.doesNotMatch(response.text, /undefined/, "a placeholder reached the customer");
    });

    it("renders one period's detail when no passcode is set", async () => {
      const app = buildApp({
        rows: {
          employee_pay_periods: [{ id: PERIOD_ID, period_start: "2026-09-01", period_end: "2026-09-15", status: "open" }],
          business_employee_profiles: [{ id: "77777777-7777-4777-8777-777777777777", display_name: "Ada", pay_type: "hourly" }]
        }
      });
      const response = await request(app).get(`/business-builder/owner/pay-periods/${PERIOD_ID}`).set("accept", "text/html");
      assert.equal(response.status, 200);
      assert.doesNotMatch(response.text, /undefined/);
    });

    // The point of the whole exercise, stated against the real page.
    it("sends a signed-in manager to the security page once a passcode exists", async () => {
      const response = await request(buildApp({ credential: credentialRow() }))
        .get("/business-builder/owner/pay-periods").set("accept", "text/html");
      assert.equal(response.status, 303);
      assert.match(String(response.headers.location), /^\/business-builder\/owner\/security\?/);
      assert.match(String(response.headers.location), /next=%2Fbusiness-builder%2Fowner%2Fpay-periods/);
    });

    it("opens the same page for a device carrying the unlock", async () => {
      const token = passcode.issueUnlock({
        organizationId: ORGANIZATION_ID,
        userId: USER_ID,
        credentialVersion: "2026-10-01T00:00:00Z",
        nowMs: Date.now(),
        key: { material: Buffer.from("k".repeat(64), "utf8") }
      }).token;
      const response = await request(buildApp({ credential: credentialRow(), cookie: token }))
        .get("/business-builder/owner/pay-periods").set("accept", "text/html");
      assert.equal(response.status, 200);
      assert.match(response.text, /<h1>/);
    });

    // A write is the case where passing the gate matters most, and a redirect
    // that looked like a success would be the worst outcome here.
    it("refuses to create a pay period on a locked device", async () => {
      const response = await request(buildApp({ credential: credentialRow() }))
        .post("/business-builder/owner/pay-periods")
        .set("accept", "application/json")
        .send({ period_start: "2026-10-01", period_end: "2026-10-15" });
      assert.equal(response.status, 403);
      assert.equal(response.body.ok, false);
    });
  });
});
