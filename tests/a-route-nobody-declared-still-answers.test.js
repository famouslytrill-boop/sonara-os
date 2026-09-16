"use strict";

// The 250 routes the page manifest does not name, probed.
//
// `tests/the-route-manifest-agrees-with-the-server.test.js` is thorough about
// the routes the manifest declares, and that is exactly its boundary: its
// population is `declaredGets()`, read from ROUTE_REGISTRY. On 16 September 2026
// the manifest held 308 routes and the server answered 558, so **250 routes
// were outside every probe in this repository** -- including `/staff/location`,
// `/admin/subscriptions`, `/account/security/two-factor`, `/growth/unsubscribe`
// and fourteen legal documents.
//
// That is the recurring defect in its second shape: a check measuring a
// narrower population than its name implies. "The route manifest agrees with
// the server" is true and was never the same claim as "the server serves
// nothing the manifest has not heard of".
//
// `scripts/verify-route-surface.mjs` closes the accounting half statically.
// This closes the behavioural half: for every surface in
// `lib/sonara-route-surface.cjs` that claims to be public or to require a
// session, the routes it accounts for are opened as an anonymous visitor and
// the claim is checked.
//
// What the first run found, 16 September 2026, is worth recording because it is
// the opposite of what the numbers suggested: **the server refuses a stranger
// on all 40 protected undeclared pages** -- every `/staff` page, every `/admin`
// page except the login screen, every `/account` page, and
// `/owner/agent-schedule`. Nothing leaked. The server was right about all 66
// and the manifest was silent about all 66, which is the same shape as the
// sixteen mislabelled routes found on 19 August, one direction over.
//
// Two surfaces are deliberately not probed here, and saying which matters more
// than the count:
//
//   json         -- a JSON endpoint is not a page. Its tenant boundary is
//                   checked by report-tenant-scoped-queries and the
//                   authorization gates, and asserting a status code here would
//                   duplicate those badly.
//   parameterised -- there is no single `/shared/:token` to open. The parent is
//                   catalogued, and catalogueParent already enforces that.
//
// Probed against a *configured* server, for the reason the manifest test gives:
// without Supabase, pages that would redirect instead render "setup required"
// and answer 200, so a bare machine measures the machine rather than the
// product.

const assert = require("node:assert/strict");
const request = require("supertest");

const SUPABASE_ENV = Object.freeze({
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.stub-anon-for-surface",
  SUPABASE_SERVICE_ROLE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.stub-service-for-surface"
});
const original = Object.fromEntries(Object.keys(SUPABASE_ENV).map((key) => [key, process.env[key]]));

const app = require("../server");
const { ROUTE_REGISTRY } = require("../lib/sonara-route-registry.cjs");
const { ROUTE_SURFACES, ACCESS, accountRoutes } = require("../lib/sonara-route-surface.cjs");

// A refusal in place. 200 is not a refusal, whatever the page says in its body.
const REFUSAL_STATUSES = new Set([401, 402, 403]);
const REDIRECTS = new Set([301, 302, 303, 307, 308]);

// Where a refusal is allowed to send somebody. This list is the reason this
// test is not the weaker check it started as.
//
// The first version treated any redirect as a refusal, and that version passed
// while three routes were filed wrongly: /onboarding, /feedback and
// /research-lab all answer 303, and all three go somewhere anybody may open. A
// refusal that lands on the home page is not a refusal, and a check that reads
// it as one would keep passing if an admin console started doing it.
const SIGN_IN_DESTINATIONS = ["/login", "/signup", "/admin/login", "/business-builder/login"];

function goesToSignIn(location) {
  if (!location) return false;
  const path = String(location).split("?")[0];
  return SIGN_IN_DESTINATIONS.includes(path);
}

const PROBED_ACCESS = new Set(["public", "public_alias", "signed_in"]);

describe("a route nobody declared still answers", () => {
  let realFetch;
  let account;
  let answers;

  before(() => {
    Object.assign(process.env, SUPABASE_ENV);
    realFetch = global.fetch;
  });

  after(() => {
    global.fetch = realFetch;
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  before(async () => {
    // A working database, and nobody signed in. Same stub as the manifest test:
    // every read answers, and the session lookup says there is no session.
    global.fetch = async (url) => {
      const signedOut = String(url).includes("/auth/v1/user");
      return {
        ok: !signedOut,
        status: signedOut ? 401 : 200,
        headers: { get: () => null },
        json: async () => (signedOut ? { error: "no session" } : [])
      };
    };

    account = accountRoutes(app, ROUTE_REGISTRY.map((record) => record.route));
    answers = [];

    for (const surface of ROUTE_SURFACES) {
      if (!PROBED_ACCESS.has(surface.expectedAccess)) continue;
      const exceptions = new Set(surface.publicExceptions || []);
      for (const route of account.bySurface.get(surface.key)) {
        // A parameter inside an otherwise-probed surface has no single URL.
        if (route.includes(":")) continue;
        const response = await request(app).get(route).set("Accept", "text/html").redirects(0);
        answers.push({
          route,
          status: response.status,
          location: response.headers.location || null,
          surface: surface.key,
          expected: exceptions.has(route) ? "public" : surface.expectedAccess
        });
      }
    }
  });

  it("has an undeclared surface to probe, and probed it", () => {
    // Guards every assertion below: all of them pass over an empty list.
    assert.ok(
      account.served.length >= 400,
      `only ${account.served.length} served GET routes; this check has gone blind`
    );
    assert.ok(
      account.undeclared.length >= 150,
      `only ${account.undeclared.length} undeclared routes; either the manifest grew to cover them or this check has gone blind`
    );
    assert.ok(
      answers.length >= 50,
      `only ${answers.length} undeclared routes were probed; this check has gone blind`
    );
    // And the probe has to cover both directions, or one half of it is
    // decoration: a run containing only public routes proves nothing about
    // whether anything refuses.
    const probedPublic = answers.filter((answer) => answer.expected === "public").length;
    const probedSignedIn = answers.filter((answer) => answer.expected === "signed_in").length;
    assert.ok(probedPublic >= 10, `only ${probedPublic} routes probed for public access`);
    assert.ok(probedSignedIn >= 10, `only ${probedSignedIn} routes probed for refusal`);
  });

  it("accounts for every served route, so nothing is skipped rather than checked", () => {
    assert.deepEqual(
      account.unaccounted,
      [],
      `these served GET routes are in no manifest and no surface, so this test never opened them:\n  ${account.unaccounted.join("\n  ")}`
    );
    assert.deepEqual(
      account.ambiguous,
      [],
      `these routes are claimed by two surfaces, so the expectation applied to them is whichever was listed first:\n  ${account.ambiguous.join("\n  ")}`
    );
  });

  it("declares an access value this test understands, for every surface", () => {
    // A surface with an unrecognised access value would fall through the
    // PROBED_ACCESS filter silently, and skipping is how a check stops covering
    // something without anybody noticing.
    const unknown = ROUTE_SURFACES
      .filter((surface) => !ACCESS.includes(surface.expectedAccess))
      .map((surface) => `${surface.key} -> ${surface.expectedAccess}`);
    assert.deepEqual(unknown, [], `surfaces with an access value this test does not handle: ${unknown.join(", ")}`);
  });

  it("refuses a stranger on every undeclared page that needs a session", () => {
    const admitted = answers
      .filter((answer) => answer.expected === "signed_in")
      .filter((answer) => {
        if (REFUSAL_STATUSES.has(answer.status)) return false;
        // A redirect only counts as a refusal when it goes to a sign-in page.
        if (REDIRECTS.has(answer.status)) return !goesToSignIn(answer.location);
        return true;
      })
      .map((answer) => `${answer.route} [${answer.surface}] answered ${answer.status}`
        + (answer.location ? ` -> ${answer.location}` : "")
        + (REDIRECTS.has(answer.status) ? " (a redirect, but not to a sign-in page)" : ""));

    assert.deepEqual(
      admitted,
      [],
      "These routes are in no page manifest, and did not refuse a signed-out visitor, while their surface says they need a session.\n  "
        + admitted.join("\n  ")
        + `\n\nA refusal is 401, 402, 403, or a redirect to one of: ${SIGN_IN_DESTINATIONS.join(", ")}.`
        + " A redirect anywhere else is not a refusal -- it is a page change that happens to look like one."
        + "\n\nNothing else in this repository probes these routes, which is why this is the test that has to catch it."
    );
  });

  it("lands every older path on a page anybody may open", () => {
    // A compatibility alias is a promise to whoever pasted the old URL. The
    // assertion is not that it redirects -- it is that following it works
    // without a session, which is the only thing the promise is about.
    const aliases = answers.filter((answer) => answer.expected === "public_alias");
    assert.ok(aliases.length >= 4, `only ${aliases.length} compatibility aliases probed; this check has gone blind`);

    const broken = aliases
      .filter((answer) => !REDIRECTS.has(answer.status) || !answer.location)
      .map((answer) => `${answer.route} answered ${answer.status} with location ${answer.location || "(none)"}`);
    assert.deepEqual(broken, [], `these paths are declared as aliases and did not redirect:\n  ${broken.join("\n  ")}`);

    const declaredTargets = ROUTE_SURFACES.find((surface) => surface.key === "public_compatibility_alias").aliasTargets;
    const moved = aliases
      .filter((answer) => declaredTargets[answer.route] && declaredTargets[answer.route] !== answer.location)
      .map((answer) => `${answer.route} -> ${answer.location}, but the surface says ${declaredTargets[answer.route]}`);
    assert.deepEqual(moved, [], `these aliases no longer go where the surface says they go:\n  ${moved.join("\n  ")}`);
  });

  it("serves every undeclared page it says anybody may open", () => {
    // The other direction. A legal document or an unsubscribe link that
    // redirects a stranger is worse than a tidiness problem: /growth/unsubscribe
    // is how somebody withdraws consent, and they do not have an account.
    const refused = answers
      .filter((answer) => answer.expected === "public" && answer.status !== 200)
      .map((answer) => `${answer.route} [${answer.surface}] answered ${answer.status}`);

    assert.deepEqual(refused, [], `these undeclared routes are declared open to anyone and did not serve one:\n  ${refused.join("\n  ")}`);
  });

  it("keeps withdrawing consent reachable without an account", () => {
    // Named separately from the sweep above, because it is the one route here
    // whose failure would be a consent failure rather than a broken page, and a
    // sweep that happens to include it does not say so.
    const unsubscribe = answers.find((answer) => answer.route === "/growth/unsubscribe");
    assert.ok(unsubscribe, "/growth/unsubscribe was not probed; the consent_withdrawal surface has stopped matching it");
    assert.equal(
      unsubscribe.status,
      200,
      "/growth/unsubscribe must answer somebody with no account. An unsubscribe link that asks them to sign in first is a consent control that does not work."
    );
  });
});
