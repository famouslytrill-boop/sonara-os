"use strict";

// `getUserRoles` read `user_roles` and did `for (const row of rows)` on whatever
// came back. PostgREST answers 200 with an *object* in some failure modes — an
// error body rather than a row list — and `for...of` on an object throws.
//
// This is the workspace authorization path. `resolveWorkspaceAccess` calls it
// on every page behind `requireAppAccess`. Before the route safety net landed,
// that throw hung the request forever; after it, the same throw is a 500 on
// every workspace page at once, from a database that is answering.
//
// It probed /admin until 1 October 2026, when the operator console was removed.
// The function under test did not go with it -- `resolveWorkspaceAccess` is the
// one remaining caller of getUserRoles -- so this now opens /dashboard, which
// reaches it by the path a customer actually takes.
//
// The fix has to fail closed, and does: an unreadable role list grants nothing,
// so a malformed answer denies rather than admits.

const assert = require("node:assert/strict");
const request = require("supertest");

const app = require("../server");
const { CUSTOMER_SESSION_COOKIE } = require("../lib/sonara-customer-auth.cjs");

const SIGNED_IN = { id: "99999999-9999-4999-8999-999999999999", email: "roles@example.com" };
// The customer session cookie, not the admin one. This read ADMIN_SESSION_COOKIE
// with a "sonara_admin_session" fallback; that cookie was only ever read by
// verifyAdminRequest, which is gone, so the fallback silently produced a request
// with no session at all and /dashboard answered 303 to the login page.
const COOKIE = `${CUSTOMER_SESSION_COOKIE}=stub`;
const SUPABASE_ENV = Object.freeze({
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.stub-anon-for-roles",
  SUPABASE_SERVICE_ROLE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.stub-service-for-roles",
  ADMIN_EMAILS: "roles@example.com"
});
const original = Object.fromEntries(Object.keys(SUPABASE_ENV).map((key) => [key, process.env[key]]));

const json = (body) => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => body });

// `userRoles` is what the role table answers. An object is the shape that used
// to throw; an array is an ordinary answer.
function stubFetch(userRoles) {
  return async (url) => {
    const target = String(url);
    if (target.includes("/auth/v1/user")) return json(SIGNED_IN);
    if (target.includes("/rest/v1/user_roles")) return json(userRoles);
    if (!target.includes("/rest/v1/")) return undefined;
    return json([]);
  };
}

function open(userRoles) {
  global.fetch = stubFetch(userRoles);
  return request(app).get("/dashboard").set("Accept", "text/html").set("Cookie", COOKIE).redirects(0);
}

describe("a malformed role read does not break every workspace page", () => {
  let originalFetch;
  before(() => { Object.assign(process.env, SUPABASE_ENV); });
  beforeEach(() => { originalFetch = global.fetch; });
  afterEach(() => { global.fetch = originalFetch; });
  after(() => {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  // The ordinary answer, asserted first: without it the case below would pass
  // against an admin area that is broken for everybody.
  it("still lets a workspace owner in when the role list is a list", async () => {
    const response = await open([{ role: "owner" }]);
    assert.equal(response.status, 200);
  });

  it("does not throw when the role list is an error object", async () => {
    const response = await open({ code: "PGRST100", message: "parse error" });
    assert.notEqual(response.status, 500, "a malformed role read took out the workspace");
    assert.ok([200, 302, 303, 403].includes(response.status), `unexpected ${response.status}`);
  });

  it("does not throw when the role list is null", async () => {
    const response = await open(null);
    assert.notEqual(response.status, 500);
  });

  it("grants nothing from a row that is not an object", async () => {
    // `row?.role` rather than `row.role`: a sparse or ragged array should deny,
    // not throw, and denying is the safe direction on an authorization read.
    const response = await open([null, "owner", { role: "owner" }]);
    assert.equal(response.status, 200, "a valid row after a bad one was dropped");
  });
});
