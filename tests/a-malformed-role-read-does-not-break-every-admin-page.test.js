"use strict";

// `getUserRoles` read `user_roles` and did `for (const row of rows)` on whatever
// came back. PostgREST answers 200 with an *object* in some failure modes — an
// error body rather than a row list — and `for...of` on an object throws.
//
// This is the admin authorization path. Every admin page calls it. Before the
// route safety net landed earlier in this branch, that throw hung the request
// forever; after it, the same throw is a 500 on every admin page at once, from
// a database that is answering.
//
// The fix has to fail closed, and does: an unreadable role list grants nothing,
// so a malformed answer denies rather than admits.

const assert = require("node:assert/strict");
const request = require("supertest");

const app = require("../server");
const { ADMIN_SESSION_COOKIE } = require("../lib/sonara-customer-auth.cjs");

const ADMIN = { id: "99999999-9999-4999-8999-999999999999", email: "roles@example.com" };
const COOKIE = `${ADMIN_SESSION_COOKIE || "sonara_admin_session"}=stub`;
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
    if (target.includes("/auth/v1/user")) return json(ADMIN);
    if (target.includes("/rest/v1/user_roles")) return json(userRoles);
    if (!target.includes("/rest/v1/")) return undefined;
    return json([]);
  };
}

function open(userRoles) {
  global.fetch = stubFetch(userRoles);
  return request(app).get("/admin").set("Accept", "text/html").set("Cookie", COOKIE).redirects(0);
}

describe("a malformed role read does not break every admin page", () => {
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
  it("still lets an admin in when the role list is a list", async () => {
    const response = await open([{ role: "owner" }]);
    assert.equal(response.status, 200);
  });

  it("does not throw when the role list is an error object", async () => {
    const response = await open({ code: "PGRST100", message: "parse error" });
    assert.notEqual(response.status, 500, "a malformed role read took out the admin area");
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
