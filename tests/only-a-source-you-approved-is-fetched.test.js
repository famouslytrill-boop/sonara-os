"use strict";

// Which sites this server will go and fetch on a customer's behalf.
//
// research_sources has carried `permission_status text not null default
// 'needs_review'` since the platform redesign, with `crawl_status` beside it.
// Neither column had a check constraint, so both accepted any string, and
// nothing in the application ever read either one: the table appeared in the
// generated tenant-scope inventory and one subsystem listing, and nowhere else.
// A permission gate was designed into the schema and never built.
//
// /api/market-intelligence/fetch-source meanwhile took any HTTPS URL from a
// request body and had this server fetch it. Crawl4AI refuses loopback,
// link-local, cloud-metadata and private addresses, so it was not a request
// forwarder -- but nothing anywhere asked whether the business had established
// it may look at the site at all.
//
// The three-way answer is the point of this file. "Nobody has ruled on it" is
// not "we decided not to", and neither of those is "we could not check". A gate
// that collapses the third into either of the first two is the defect this
// codebase keeps producing: a signal that reports an answer it does not have.

const assert = require("node:assert/strict");
const request = require("supertest");

const SUPABASE_ENV = Object.freeze({
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.stub-anon-key-for-sources",
  SUPABASE_SERVICE_ROLE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.stub-service-role-for-sources"
});
const original = Object.fromEntries(Object.keys(SUPABASE_ENV).map((key) => [key, process.env[key]]));

const app = require("../server");
const { CUSTOMER_SESSION_COOKIE } = require("../lib/sonara-customer-auth.cjs");
const marketIntelligence = require("../routes/market-intelligence-routes.cjs");
const { ALL_OWNER_PAGES } = require("../lib/sonara-owner-record-pages.cjs");

const { sourcePermission, hostOf } = marketIntelligence;

const USER = { id: "31313131-3131-4131-8131-313131313131", email: "owner@example.com" };
const OURS = "32323232-3232-4232-8232-323232323232";
const CONTEXT = Object.freeze({ ok: true, organizationId: OURS, userId: USER.id });
const CONFIG = Object.freeze({ ok: true, url: "https://project.supabase.co", serviceRoleKey: "stub" });

const MY_SOURCE = "34343434-3434-4434-8434-343434343434";
const THEIR_SOURCE = "35353535-3535-4535-8535-353535353535";
const ADDRESSLESS_SOURCE = "36363636-3636-4636-8636-363636363636";

function json(body, status = 200) {
  return { ok: status < 400, status, headers: { get: () => null }, json: async () => body };
}

// A stub standing in for PostgREST, returning whatever `sourceRows` holds. It
// deliberately does NOT apply the permission_status filter in the query string:
// the query narrows what travels, and the rule is asserted in the route file
// where a test can reach it. Honouring the filter here would mean this file
// could never prove that a needs_review row is refused, because the fake
// database would have removed it first.
let sourceRows;
let readable;

function restStub() {
  return async (url) => {
    const target = String(url);
    if (!target.includes("/rest/v1/research_sources")) return undefined;
    if (!readable) return json({ message: "no" }, 500);
    return json(sourceRows);
  };
}

describe("only a source you approved is fetched", () => {
  let realFetch;

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

  beforeEach(() => {
    readable = true;
    sourceRows = [];
    global.fetch = restStub();
  });

  it("exports the rule so it can be asked directly", () => {
    assert.equal(typeof sourcePermission, "function", "the permission rule is unreachable from a test");
    assert.equal(typeof hostOf, "function");
  });

  describe("the rule itself", () => {
    it("approves a host an approved row names", async () => {
      sourceRows = [{ source_url: "https://competitor.example/pricing", permission_status: "approved" }];
      const answer = await sourcePermission(CONFIG, CONTEXT, "https://competitor.example/features");
      assert.equal(answer.decision, "approved", answer.detail);
    });

    // The distinction the schema was built around and no code read. A source
    // nobody has ruled on is work somebody has to do, not a decision they made.
    it("does not treat needs_review as approved", async () => {
      sourceRows = [{ source_url: "https://competitor.example/pricing", permission_status: "needs_review" }];
      const answer = await sourcePermission(CONFIG, CONTEXT, "https://competitor.example/pricing");
      assert.equal(answer.decision, "not_approved");
      assert.equal(answer.code, "source_not_approved");
    });

    it("does not treat declined as approved", async () => {
      sourceRows = [{ source_url: "https://competitor.example/pricing", permission_status: "declined" }];
      const answer = await sourcePermission(CONFIG, CONTEXT, "https://competitor.example/pricing");
      assert.equal(answer.decision, "not_approved");
    });

    // A read that failed is not a source nobody approved. Both refuse -- but one
    // tells the customer to go and approve something they may already have
    // approved, and the other says the check did not run.
    it("says it could not check, rather than saying you did not approve it", async () => {
      readable = false;
      const answer = await sourcePermission(CONFIG, CONTEXT, "https://competitor.example/pricing");
      assert.equal(answer.decision, "unreadable");
      assert.equal(answer.code, "source_permission_unreadable");
      assert.match(answer.detail, /does not mean you have not approved it/);
    });

    it("refuses rather than fetching when there is no database to ask", async () => {
      const answer = await sourcePermission({ ok: false }, CONTEXT, "https://competitor.example/pricing");
      assert.equal(answer.decision, "unreadable");
      assert.notEqual(answer.decision, "approved", "an unconfigured database approved a fetch");
    });

    // Approving a parent domain must not approve its children: github.io,
    // vercel.app and pages.dev hand subdomains out per user, so a rule that
    // walked up the domain would approve strangers.
    it("does not let an approved domain cover a subdomain", async () => {
      sourceRows = [{ source_url: "https://example.com/", permission_status: "approved" }];
      const answer = await sourcePermission(CONFIG, CONTEXT, "https://blog.example.com/post");
      assert.equal(answer.decision, "not_approved");
    });

    it("does not let an approved subdomain cover its parent", async () => {
      sourceRows = [{ source_url: "https://blog.example.com/", permission_status: "approved" }];
      const answer = await sourcePermission(CONFIG, CONTEXT, "https://example.com/");
      assert.equal(answer.decision, "not_approved");
    });

    it("matches a host whatever case and trailing dot it was written with", async () => {
      sourceRows = [{ source_url: "https://Competitor.Example./pricing", permission_status: "approved" }];
      const answer = await sourcePermission(CONFIG, CONTEXT, "https://competitor.example/features");
      assert.equal(answer.decision, "approved", answer.detail);
    });

    it("ignores a recorded source with no address rather than matching everything", async () => {
      sourceRows = [{ source_url: null, permission_status: "approved" }];
      const answer = await sourcePermission(CONFIG, CONTEXT, "https://competitor.example/");
      assert.equal(answer.decision, "not_approved");
    });

    // A full page of approved rows means the match could have been on the next
    // one. Answering "not approved" there would be a guess, and this function
    // exists so that nothing guesses.
    it("says it could not check when the answer might be past the row limit", async () => {
      sourceRows = Array.from({ length: 1000 }, (unused, index) => ({
        source_url: `https://site-${index}.example/`,
        permission_status: "approved"
      }));
      const answer = await sourcePermission(CONFIG, CONTEXT, "https://competitor.example/");
      assert.equal(answer.decision, "unreadable");
      assert.equal(answer.code, "source_permission_list_truncated");
    });

    it("still approves a match found inside a full page", async () => {
      sourceRows = Array.from({ length: 1000 }, (unused, index) => ({
        source_url: `https://site-${index}.example/`,
        permission_status: "approved"
      }));
      sourceRows[500] = { source_url: "https://competitor.example/", permission_status: "approved" };
      const answer = await sourcePermission(CONFIG, CONTEXT, "https://competitor.example/");
      assert.equal(answer.decision, "approved", answer.detail);
    });

    it("scopes the question to one business", async () => {
      let asked = null;
      global.fetch = async (url) => {
        asked = String(url);
        return json([]);
      };
      await sourcePermission(CONFIG, CONTEXT, "https://competitor.example/");
      assert.ok(asked, "the database was never asked");
      assert.ok(asked.includes(`organization_id=eq.${OURS}`), `unscoped read: ${asked}`);
    });
  });

  describe("the endpoint", () => {
    function fetchSource(sourceUrl) {
      return request(app)
        .post("/api/market-intelligence/fetch-source")
        .set("Cookie", `${CUSTOMER_SESSION_COOKIE}=stub`)
        .set("Accept", "application/json")
        .send({ source_url: sourceUrl })
        .redirects(0);
    }

    // The customer session and organization lookups go through the same stub as
    // the source read, so this widens it for the endpoint tests only.
    function appStub() {
      return async (url) => {
        const target = String(url);
        if (target.includes("/auth/v1/user")) return json(USER);
        if (target.includes("/rest/v1/rpc/")) return json({});
        if (!target.includes("/rest/v1/")) return undefined;
        const table = (target.split("/rest/v1/")[1] || "").split("?")[0];
        if (table === "organization_memberships") {
          return json([{ organization_id: OURS, user_id: USER.id, role: "owner", status: "active" }]);
        }
        if (table === "business_memberships") {
          return json([{ id: "m", organization_id: OURS, workspace_id: "w", role: "owner", status: "active" }]);
        }
        if (table === "research_sources") {
          if (!readable) return json({ message: "no" }, 500);
          return json(sourceRows);
        }
        return json([]);
      };
    }

    beforeEach(() => {
      global.fetch = appStub();
    });

    it("refuses a site the business has not approved, and says how to fix it", async () => {
      sourceRows = [];
      const result = await fetchSource("https://competitor.example/pricing");
      assert.equal(result.status, 200, JSON.stringify(result.body));
      assert.equal(result.body.fetched, false);
      assert.equal(result.body.code, "source_not_approved");
      assert.match(result.body.detail, /Sources you may research/);
    });

    // Proves the gate is consulted before anything else rather than beside it.
    // Crawl4AI is off in a test run, so a request that gets past the gate is
    // answered with the readiness status -- a different refusal, from further
    // down the handler.
    it("lets an approved site through to the fetcher", async () => {
      sourceRows = [{ source_url: "https://competitor.example/", permission_status: "approved" }];
      const result = await fetchSource("https://competitor.example/pricing");
      assert.equal(result.status, 200);
      assert.equal(result.body.fetched, false, "Crawl4AI should be off in a test run");
      assert.notEqual(result.body.code, "source_not_approved", "the gate refused a source the business approved");
      assert.equal(result.body.code, "disabled");
    });

    it("still refuses a URL that is not https before asking about permission", async () => {
      const result = await fetchSource("http://competitor.example/pricing");
      assert.equal(result.status, 400);
      assert.equal(result.body.code, "https_source_url_required");
    });
  });

  describe("approving a source you recorded", () => {
    let patched;

    function appStub() {
      return async (url, options = {}) => {
        const target = String(url);
        if (target.includes("/auth/v1/user")) return json(USER);
        if (target.includes("/rest/v1/rpc/")) return json({});
        if (!target.includes("/rest/v1/")) return undefined;
        const table = (target.split("/rest/v1/")[1] || "").split("?")[0];
        if (table === "organization_memberships") {
          return json([{ organization_id: OURS, user_id: USER.id, role: "owner", status: "active" }]);
        }
        if (table === "business_memberships") {
          return json([{ id: "m", organization_id: OURS, workspace_id: "w", role: "owner", status: "active" }]);
        }
        if (table !== "research_sources") return json([]);
        if ((options.method || "GET").toUpperCase() === "PATCH") {
          patched = { url: target, body: JSON.parse(options.body || "{}") };
          return json([{ id: MY_SOURCE, permission_status: "approved" }]);
        }
        if (!readable) return json({ message: "no" }, 500);
        const scoped = target.includes(`organization_id=eq.${OURS}`);
        if (target.includes(`id=eq.${MY_SOURCE}`)) {
          return json(scoped ? [{ id: MY_SOURCE, source_url: "https://competitor.example/", permission_status: "needs_review" }] : []);
        }
        if (target.includes(`id=eq.${ADDRESSLESS_SOURCE}`)) {
          return json(scoped ? [{ id: ADDRESSLESS_SOURCE, source_url: null, permission_status: "needs_review" }] : []);
        }
        return json([]);
      };
    }

    function approve(id) {
      patched = null;
      return request(app)
        .post(`/api/business/research-sources/${id}/approve`)
        .set("Cookie", `${CUSTOMER_SESSION_COOKIE}=stub`)
        .set("Accept", "application/json")
        .send({})
        .redirects(0);
    }

    beforeEach(() => {
      patched = null;
      global.fetch = appStub();
    });

    // Record pages create rows and never edit them. Without this endpoint a
    // source recorded before anybody had ruled on it would sit at needs_review
    // for good, and the gate above would refuse it for good.
    it("is reachable from the page, as a row action", () => {
      const page = ALL_OWNER_PAGES.find((entry) => entry.path === "/business-builder/owner/research-sources");
      assert.ok(page, "the research sources page is gone");
      assert.ok(page.rowAction, "no way to approve a source that was recorded as needs_review");
      assert.equal(page.rowAction.api, "/api/business/research-sources/:id/approve");
      assert.equal(page.rowAction.reasonUnavailable({ permission_status: "approved" }), "Approved");
      assert.equal(page.rowAction.reasonUnavailable({ permission_status: "needs_review", source_url: "https://x.example/" }), null);
      assert.ok(page.rowAction.reasonUnavailable({ permission_status: "needs_review", source_url: null }));
    });

    it("approves a source belonging to this business", async () => {
      const result = await approve(MY_SOURCE);
      assert.equal(result.status, 200, JSON.stringify(result.body));
      assert.ok(patched, "nothing was written");
      assert.equal(patched.body.permission_status, "approved");
    });

    // The service key bypasses row level security, and this row decides what
    // this server will go and fetch.
    it("will not approve a source in another business", async () => {
      const result = await approve(THEIR_SOURCE);
      assert.equal(result.status, 404);
      assert.equal(result.body.code, "source_not_yours");
      assert.equal(patched, null, "another business's source was written to");
    });

    it("refuses rather than guessing when the source cannot be read", async () => {
      readable = false;
      const result = await approve(MY_SOURCE);
      assert.equal(result.status, 503);
      assert.equal(result.body.code, "cannot_check_source");
      assert.equal(patched, null);
    });

    it("will not approve a source with no address, which would approve nothing", async () => {
      const result = await approve(ADDRESSLESS_SOURCE);
      assert.equal(result.status, 409);
      assert.equal(result.body.code, "source_has_no_address");
      assert.equal(patched, null);
    });

    it("refuses an id that is not an id, rather than putting it in a filter", async () => {
      const result = await approve("not-a-uuid");
      assert.equal(result.status, 400);
      assert.equal(patched, null);
    });

    // The row action is an HTML form, so a button press must land back on the
    // page rather than on a JSON body.
    it("returns a manager to their page", async () => {
      const result = await request(app)
        .post(`/api/business/research-sources/${MY_SOURCE}/approve`)
        .set("Cookie", `${CUSTOMER_SESSION_COOKIE}=stub`)
        .set("Accept", "text/html")
        .type("form")
        .send({})
        .redirects(0);
      assert.equal(result.status, 303);
      assert.equal(result.headers.location, "/business-builder/owner/research-sources?approved=1");
    });
  });
});
