"use strict";

// A customer who asks for help can see what they asked.
//
// Submitting a support request returned a reference number and then there was
// nowhere to look it up. support_requests was read in exactly one place --
// /admin/support, an operator surface that lists every tenant's requests. "I
// asked for help, what happened?" had no answer anywhere in the product.
//
// /support is a public page, which is what makes this worth testing rather than
// eyeballing: it has no auth middleware, so the session has to be resolved
// without being required, and a signed-out visitor must see the page exactly as
// before.

const assert = require("node:assert/strict");
const request = require("supertest");

const ORG = "11111111-1111-4111-8111-111111111111";
const SUBJECT = "Cannot open my invoice";

function stubDatabase({ requests = [] } = {}) {
  const seen = [];
  const original = global.fetch;
  global.fetch = async (url) => {
    const target = String(url);
    seen.push(target);
    if (target.includes("/auth/v1/user")) {
      return { ok: true, json: async () => ({ id: "00000000-0000-0000-0000-000000000001", email: "c@example.com" }) };
    }
    if (target.includes("organization_memberships")) {
      return { ok: true, headers: { get: () => null }, json: async () => [{ organization_id: ORG }] };
    }
    if (target.includes("support_requests")) {
      return { ok: true, headers: { get: () => null }, json: async () => requests };
    }
    return { ok: true, headers: { get: () => null }, json: async () => [] };
  };
  return { seen, restore: () => { global.fetch = original; } };
}

const SAVED = [{ reference_id: "abcdef12-0000-0000-0000-000000000000", subject: SUBJECT, status: "open", created_at: "2026-07-02T00:00:00Z" }];

describe("a customer can see the support requests they filed", () => {
  let app;
  let savedEnv;

  before(() => {
    savedEnv = {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY
    };
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
    app = require("../server");
  });

  after(() => {
    for (const [key, value] of Object.entries(savedEnv || {})) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("lists them with a reference and a status", async function listsThem() {
    this.timeout(20000);
    const db = stubDatabase({ requests: SAVED });
    try {
      const response = await request(app).get("/support").set("accept", "text/html").set({ Authorization: "Bearer session" });
      assert.equal(response.status, 200);
      const text = response.text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
      assert.match(text, new RegExp(SUBJECT));
      assert.match(text, /abcdef12/, "the reference number is what a customer quotes back");
      assert.match(text, /open/);
    } finally {
      db.restore();
    }
  });

  it("reads only the caller's organization", async function scoped() {
    this.timeout(20000);
    const db = stubDatabase({ requests: SAVED });
    try {
      await request(app).get("/support").set("accept", "text/html").set({ Authorization: "Bearer session" });
      const query = db.seen.find((url) => url.includes("support_requests"));
      assert.ok(query, "the page must actually query for the requests");
      assert.match(query, new RegExp(`organization_id=eq\\.${ORG}`), "an unscoped read here lists every tenant's support requests");
    } finally {
      db.restore();
    }
  });

  it("shows a signed-out visitor nothing, and asks the database nothing", async function anonymous() {
    this.timeout(20000);
    const db = stubDatabase({ requests: SAVED });
    try {
      const response = await request(app).get("/support").set("accept", "text/html");
      assert.equal(response.status, 200, "/support is public and must keep rendering");
      assert.doesNotMatch(response.text, new RegExp(SUBJECT));
      assert.ok(!db.seen.some((url) => url.includes("support_requests")), "no session means no query at all");
    } finally {
      db.restore();
    }
  });

  it("still renders when the request list cannot be read", async function degraded() {
    this.timeout(20000);
    const original = global.fetch;
    global.fetch = async (url) => {
      const target = String(url);
      if (target.includes("/auth/v1/user")) return { ok: true, json: async () => ({ id: "00000000-0000-0000-0000-000000000001" }) };
      if (target.includes("support_requests")) return { ok: false, status: 500, headers: { get: () => null }, json: async () => [] };
      return { ok: true, headers: { get: () => null }, json: async () => [{ organization_id: ORG }] };
    };
    try {
      // A support page is where somebody goes when something is already broken.
      // It must not be the next thing that breaks.
      const response = await request(app).get("/support").set("accept", "text/html").set({ Authorization: "Bearer session" });
      assert.equal(response.status, 200);
      assert.match(response.text, /Support/);
    } finally {
      global.fetch = original;
    }
  });
});
