"use strict";

// The marketplace's routes, driven for real against a recording fetch.
//
// tests/you-cannot-sell-what-you-cannot-publish.test.js checks the decision
// module, and it passed -- all 39 -- while the routes it serves were querying a
// column that does not exist. They filtered creator_asset_approvals on
// `version_id`; that table keys on `asset_version_id`. Every approvals read would
// have failed, approval_unreadable would have refused every listing, and no work
// could ever have gone on sale. A module test cannot see the query a route builds.
//
// So this file checks what the routes ASK FOR, and checks every column they name
// against the table's real columns, read from data/capability-inventory.json, which
// is generated from the migrations. It also holds the four properties the public
// catalogue exists for:
//
//   1. The public pages read the catalogue and nothing else -- no tenant table.
//   2. Listing writes the catalogue only after the gate is asked again, and writes
//      the price the gate checked.
//   3. Withdrawing removes the catalogue row before it touches the state, so a
//      failure leaves the work off sale.
//   4. An edit that makes something on sale unsellable takes it off sale, and an
//      edit that keeps it sellable refreshes what buyers see.

const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");

const registerCreatorMarketplaceRoutes = require("../routes/sonara-creator-marketplace-routes.cjs");
const { takeVersionOffSale } = registerCreatorMarketplaceRoutes;
const graph = require("../lib/sonara-creator-approval-graph.cjs");
const inventory = require("../data/capability-inventory.json");

const ORG = "aaaaaaaa-0000-4000-8000-00000000000a";
const OTHER_ORG = "bbbbbbbb-0000-4000-8000-00000000000b";
const LISTING = "11111111-1111-4111-8111-111111111111";
const VERSION = "22222222-2222-4222-8222-222222222222";

const TENANT_TABLES = new Set(["creator_listings", "creator_asset_versions", "creator_asset_approvals"]);

function columnsOf(table) {
  const entry = (inventory.tables || []).find((candidate) => candidate.name === table);
  return entry ? new Set(entry.columns.map((column) => column.name)) : null;
}

/** Every column a PostgREST query names: select list, filters, order. */
function columnsNamedBy(query) {
  const named = new Set();
  const params = new URLSearchParams(query);
  for (const [key, value] of params) {
    if (key === "select") value.split(",").map((column) => column.trim()).filter(Boolean).forEach((column) => named.add(column));
    else if (key === "order") value.split(",").map((part) => part.split(".")[0]).forEach((column) => named.add(column));
    else if (!["limit", "offset", "on_conflict"].includes(key)) named.add(key);
  }
  if (params.get("on_conflict")) named.add(params.get("on_conflict"));
  return named;
}

const PINNED = Object.freeze([{ version_id: VERSION, object_path: `${ORG}/versions/pinned-a-track.wav`, filename: "a-track.wav", bytes: 1024 }]);

function harness({ listing, version, approvals, entryRows = [], failCatalogueWrite = false, failCatalogueDelete = false,
  connectEnabled = false, paymentRows = [], livePayment = null, failAccountRead = false, organizationId = ORG,
  pinnedRows = PINNED, assetRows = [], failCopy = false, failPinWrite = false } = {}) {
  const calls = [];
  const realFetch = global.fetch;
  global.fetch = async (url, init = {}) => {
    const parsed = new URL(url);
    const table = parsed.pathname.replace("/rest/v1/", "");
    const method = (init.method || "GET").toUpperCase();
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ table, method, query: parsed.search.slice(1), body });
    const ok = (rows) => ({ ok: true, status: 200, json: async () => rows });
    if (parsed.pathname.startsWith("/storage/v1/")) {
      if (parsed.pathname === "/storage/v1/object/copy" && failCopy) return { ok: false, status: 500, json: async () => ({}) };
      return ok({ Key: "copied" });
    }
    if (table === "creator_version_files") {
      if (method === "POST" && failPinWrite) return { ok: false, status: 500, json: async () => ({}) };
      return ok(method === "GET" ? pinnedRows : []);
    }
    if (table === "creator_assets") return ok(assetRows);
    if (parsed.hostname === "api.stripe.com") {
      if (!livePayment) throw new Error("Provider unavailable");
      return ok(livePayment);
    }
    if (table === "business_payment_accounts") return failAccountRead ? { ok: false } : ok(paymentRows);
    if (table === "creator_marketplace_entries") {
      if (method === "POST" && failCatalogueWrite) return { ok: false, status: 500, json: async () => ({}) };
      if (method === "DELETE" && failCatalogueDelete) return { ok: false, status: 500, json: async () => ({}) };
      return ok(method === "GET" ? entryRows : []);
    }
    if (table === "creator_listings") return ok(method === "GET" ? (listing ? [listing] : []) : []);
    if (table === "creator_asset_versions") return ok(version ? [version] : []);
    if (table === "creator_asset_approvals") return ok(approvals || []);
    return ok([]);
  };
  const app = express();
  app.use(express.urlencoded({ extended: false }));
  registerCreatorMarketplaceRoutes(app, {
    layout: (input) => `<title>${input.title}</title><h1>${input.heading}</h1><p>${input.body}</p>${(input.sections || []).join("")}`,
    brandCard: (title, body) => `<section><h2>${title}</h2><p>${body}</p></section>`,
    linkAction: (href, label) => `<a href="${href}">${label}</a>`,
    responsePage: (title, body) => `<title>${title}</title><p>${body}</p>`,
    escapeHtml: (value) => String(value == null ? "" : value).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])),
    requireWorkspaceAccess: () => (req, res, next) => { req.sonaraUser = { id: "u1" }; next(); },
    getCustomerPrimaryOrganization: async () => ({ ok: true, organizationId }),
    getEnv: (name) => connectEnabled ? ({ STRIPE_CONNECT_ENABLED: "true", STRIPE_SECRET_KEY: "sk_test_local_fixture_not_a_secret" }[name] || "") : "",
    getSupabaseServerConfig: () => ({ ok: true, url: "https://example.invalid", serviceRoleKey: "test" }),
    supabaseHeaders: () => ({})
  });
  return { app, calls, restore: () => { global.fetch = realFetch; } };
}

const CLEARED_LISTING = Object.freeze({
  id: LISTING, title: "A track", medium: "audio", price_cents: 2500, currency: "usd",
  licence: "commercial_single", state: "draft", rights_attested: true, consent_attested: null,
  note: "private", version_id: VERSION
});
const HUMAN_VERSION = Object.freeze({
  id: VERSION, asset_id: "a1", version_number: 1, source: "uploaded", ai_disclosure: null,
  provenance: { involves_person: false }
});
const APPROVED = Object.freeze([{ state: "approved", decided_at: "2026-10-01T00:00:00Z", decided_by: "u2", created_at: "2026-10-01T00:00:00Z" }]);

describe("a listing on sale is a listing still cleared", () => {
  describe("seller payment prerequisites", () => {
    it("checks only this workspace's account and performs no writes", async () => {
      const { app, calls, restore } = harness({ connectEnabled: true,
        paymentRows: [{ stripe_account_id: "acct_test12345678" }],
        livePayment: { charges_enabled: true, payouts_enabled: true, details_submitted: true } });
      try {
        const response = await request(app).get(`/creator-studio/owner/marketplace?organizationId=${OTHER_ORG}`);
        assert.equal(response.status, 200);
        assert.match(response.text, /can accept charges and payouts are enabled/);
        // The account works; checkout does not, because this platform has no
        // Connect webhook secret. Both are said, and neither is mistaken for the other.
        assert.match(response.text, /Buyer checkout is not switched on for this platform yet/);
        assert.match(response.text, /pins a copy of its file to the version/);
        const account = calls.find((call) => call.table === "business_payment_accounts");
        assert.equal(new URLSearchParams(account.query).get("organization_id"), `eq.${ORG}`);
        assert.ok(calls.every((call) => call.method === "GET"));
      } finally { restore(); }
    });

    it("never substitutes cached charges-enabled state for a failed live check", async () => {
      const { app, restore } = harness({ connectEnabled: true,
        paymentRows: [{ stripe_account_id: "acct_test12345678", charges_enabled: true }] });
      try {
        const response = await request(app).get("/creator-studio/owner/marketplace");
        assert.equal(response.status, 200);
        assert.match(response.text, /could not verify your payment account/);
        assert.doesNotMatch(response.text, /can accept charges/);
      } finally { restore(); }
    });

    it("distinguishes an empty account result from a failed database read", async () => {
      for (const failAccountRead of [false, true]) {
        const { app, calls, restore } = harness({ connectEnabled: true, failAccountRead });
        try {
          const response = await request(app).get("/creator-studio/owner/marketplace");
          assert.match(response.text, failAccountRead ? /could not verify your payment account/ : /Connect your payment account/);
          assert.ok(calls.every((call) => call.method === "GET"));
        } finally { restore(); }
      }
    });

    it("does not check private payment accounts while browsing public listings", async () => {
      const { app, calls, restore } = harness({ connectEnabled: true });
      try {
        await request(app).get("/marketplace");
        assert.ok(calls.every((call) => call.table === "creator_marketplace_entries"));
      } finally { restore(); }
    });
  });
  describe("every column a route names exists", () => {
    it("reads the real column lists, not an empty inventory", () => {
      for (const table of [...TENANT_TABLES, "creator_marketplace_entries"]) {
        const columns = columnsOf(table);
        assert.ok(columns && columns.size >= 5, `${table} has ${columns ? columns.size : "no"} columns in the inventory; this check has gone blind`);
      }
    });

    it("names only real columns on every query the owner page and the list action issue", async () => {
      const { app, calls, restore } = harness({ listing: CLEARED_LISTING, version: HUMAN_VERSION, approvals: APPROVED });
      try {
        await request(app).get("/creator-studio/owner/marketplace");
        await request(app).post(`/creator-studio/owner/marketplace/${LISTING}/list`);
      } finally {
        restore();
      }
      assert.ok(calls.length >= 5, `only ${calls.length} queries recorded; this check has gone blind`);
      const unknown = [];
      for (const call of calls) {
        const columns = columnsOf(call.table);
        assert.ok(columns, `${call.table} is not a table the migrations create`);
        for (const column of columnsNamedBy(call.query)) {
          if (!columns.has(column)) unknown.push(`${call.method} ${call.table}: ${column}`);
        }
        for (const column of Object.keys(call.body && !Array.isArray(call.body) ? call.body : {})) {
          if (!columns.has(column)) unknown.push(`${call.method} ${call.table} body: ${column}`);
        }
      }
      // The bug this file was written for: `version_id` on creator_asset_approvals.
      assert.deepEqual(unknown, [], `these columns do not exist:\n  ${unknown.join("\n  ")}`);
    });

    it("filters approvals on asset_version_id and reads created_at", async () => {
      const { app, calls, restore } = harness({ listing: CLEARED_LISTING, version: HUMAN_VERSION, approvals: APPROVED });
      try {
        await request(app).get("/creator-studio/owner/marketplace");
      } finally {
        restore();
      }
      const approvals = calls.filter((call) => call.table === "creator_asset_approvals");
      assert.ok(approvals.length > 0, "the owner page never read approvals");
      for (const call of approvals) {
        assert.match(call.query, /asset_version_id=eq\./);
        assert.match(decodeURIComponent(call.query), /select=[^&]*created_at/);
      }
    });
  });

  describe("a re-review un-clears, whatever order the rows come back in", () => {
    // The ordering bug: a review request has no decided_at, so without created_at
    // a later request sorted first and the approval before it stayed "latest".
    const mapped = (rows) => rows.map((row) => ({ state: row.state, decidedAt: row.decided_at, decidedBy: row.decided_by, createdAt: row.created_at }));

    it("treats a review requested after an approval as not approved", () => {
      const rows = [
        { state: "approved", decided_at: "2026-10-01T00:00:00Z", created_at: "2026-10-01T00:00:00Z" },
        { state: "review_requested", decided_at: null, created_at: "2026-10-02T00:00:00Z" }
      ];
      const ready = graph.publishReadiness({ id: VERSION, source: "uploaded" }, mapped(rows));
      assert.equal(ready.approval, "review_requested");
      assert.equal(ready.ok, false);
    });

    it("would have kept it cleared without created_at -- which is why the route reads it", () => {
      const rows = [
        { state: "approved", decided_at: "2026-10-01T00:00:00Z" },
        { state: "review_requested", decided_at: null }
      ];
      const ready = graph.publishReadiness({ id: VERSION, source: "uploaded" }, mapped(rows));
      // Documents the failure the created_at column prevents. If this ever stops
      // being "approved", the graph's ordering changed and the comment in the
      // route needs re-reading.
      assert.equal(ready.approval, "approved");
    });
  });

  describe("the public pages read the catalogue and nothing else", () => {
    it("explains zero platform fees without claiming checkout or trading is live", async () => {
      const { app, restore } = harness();
      try {
        const response = await request(app).get("/marketplace");
        assert.equal(response.status, 200);
        assert.match(response.text, /no listing fee, buyer fee or seller commission/);
        assert.match(response.text, /external payment-processing charges are separate/);
        assert.match(response.text, /Checkout is not switched on yet, so no purchase can be made today/);
        assert.doesNotMatch(response.text, /pays on Stripe's own checkout/);
      } finally {
        restore();
      }
    });
    it("lists from creator_marketplace_entries alone", async () => {
      const { app, calls, restore } = harness({
        entryRows: [{ listing_id: LISTING, title: "A track", medium: "audio", price_cents: 2500, currency: "usd", licence: "commercial_single", made_by_machine: false, ai_disclosed: null, listed_at: "2026-10-03T00:00:00Z" }]
      });
      let response;
      try {
        response = await request(app).get("/marketplace");
      } finally {
        restore();
      }
      assert.equal(response.status, 200);
      assert.match(response.text, /A track/);
      assert.match(response.text, /\$25\.00/);
      assert.ok(calls.length > 0, "the public page issued no query; this check has gone blind");
      const touched = new Set(calls.map((call) => call.table));
      assert.deepEqual([...touched], ["creator_marketplace_entries"]);
      for (const table of TENANT_TABLES) assert.ok(!touched.has(table), `/marketplace read ${table}`);
    });

    it("reads one listing from the catalogue alone", async () => {
      const { app, calls, restore } = harness({
        entryRows: [{ listing_id: LISTING, title: "A track", medium: "audio", price_cents: 2500, currency: "usd", licence: "commercial_single", made_by_machine: true, ai_disclosed: true, listed_at: "2026-10-03T00:00:00Z" }]
      });
      let response;
      try {
        response = await request(app).get(`/marketplace/${LISTING}`);
      } finally {
        restore();
      }
      assert.equal(response.status, 200);
      assert.match(response.text, /disclosed this as made or altered by a machine/);
      assert.deepEqual([...new Set(calls.map((call) => call.table))], ["creator_marketplace_entries"]);
    });

    it("tells a buyer checkout is not connected rather than showing a button that cannot charge", async () => {
      const { app, restore } = harness({
        entryRows: [{ listing_id: LISTING, title: "A track", medium: null, price_cents: 2500, currency: "usd", licence: "commercial_single", made_by_machine: false, ai_disclosed: null, listed_at: "2026-10-03T00:00:00Z" }]
      });
      try {
        const response = await request(app).get(`/marketplace/${LISTING}`);
        assert.match(response.text, /Checkout is not switched on for this marketplace yet/);
        assert.doesNotMatch(response.text, /<button[^>]*>\s*Buy/i);
      } finally {
        restore();
      }
    });
  });

  describe("listing writes the catalogue only after asking again", () => {
    it("writes the snapshot of what the gate cleared, after the state", async () => {
      const { app, calls, restore } = harness({ listing: CLEARED_LISTING, version: HUMAN_VERSION, approvals: APPROVED });
      let response;
      try {
        response = await request(app).post(`/creator-studio/owner/marketplace/${LISTING}/list`);
      } finally {
        restore();
      }
      assert.equal(response.status, 303);
      const writes = calls.filter((call) => call.method !== "GET");
      const stateIndex = writes.findIndex((call) => call.table === "creator_listings" && call.body?.state === "listed");
      const entryIndex = writes.findIndex((call) => call.table === "creator_marketplace_entries" && call.method === "POST");
      assert.ok(stateIndex >= 0 && entryIndex >= 0, "listing did not write both the state and the catalogue");
      assert.ok(stateIndex < entryIndex, "the catalogue was written before the state; a failure would leave a public entry for a draft");
      const entry = writes[entryIndex].body;
      assert.equal(entry.price_cents, 2500);
      assert.equal(entry.listing_id, LISTING);
      for (const leak of ["note", "rights_attested", "consent_attested", "organization_id"]) {
        assert.ok(!(leak in entry), `the public snapshot carries ${leak}`);
      }
    });

    it("writes nothing public when the version is not approved", async () => {
      const { app, calls, restore } = harness({ listing: CLEARED_LISTING, version: HUMAN_VERSION, approvals: [] });
      let response;
      try {
        response = await request(app).post(`/creator-studio/owner/marketplace/${LISTING}/list`);
      } finally {
        restore();
      }
      assert.equal(response.status, 400);
      assert.match(response.text, /not ready to sell/);
      assert.ok(!calls.some((call) => call.table === "creator_marketplace_entries" && call.method !== "GET"), "an unapproved listing reached the catalogue");
      assert.ok(!calls.some((call) => call.body?.state === "listed"), "an unapproved listing was marked listed");
    });

    it("puts the state back when the catalogue cannot be written", async () => {
      const { app, calls, restore } = harness({ listing: CLEARED_LISTING, version: HUMAN_VERSION, approvals: APPROVED, failCatalogueWrite: true });
      let response;
      try {
        response = await request(app).post(`/creator-studio/owner/marketplace/${LISTING}/list`);
      } finally {
        restore();
      }
      assert.equal(response.status, 503);
      assert.match(response.text, /still a draft/);
      const states = calls.filter((call) => call.table === "creator_listings" && call.body?.state).map((call) => call.body.state);
      assert.deepEqual(states, ["listed", "draft"]);
    });
  });

  describe("listing pins the file a buyer will receive", () => {
    // A version recorded a checksum and no file, and the asset's one file can be
    // replaced at any time. So "deliver version 1" meant "deliver whatever the asset
    // holds today". Listing now copies the file to a path nothing else writes and
    // records it against the version, before anything goes on sale.
    const CHECKSUM = "a".repeat(64);
    const assetWith = (storage) => [{ id: "a1", metadata: { storage } }];
    const FILE = Object.freeze({ path: `${ORG}/assets/current-a-track.wav`, bytes: 1024, filename: "a-track.wav", type: "audio/wav", sha256: CHECKSUM });
    const list = async (options) => {
      const run = harness({ listing: CLEARED_LISTING, approvals: APPROVED, pinnedRows: [], ...options });
      try {
        const response = await request(run.app).post(`/creator-studio/owner/marketplace/${LISTING}/list`);
        return { response, calls: run.calls };
      } finally { run.restore(); }
    };
    const storageCalls = (calls) => calls.filter((call) => call.table.startsWith("/storage/v1/"));
    const listedState = (calls) => calls.some((call) => call.table === "creator_listings" && call.body?.state === "listed");

    it("copies the asset's file inside the seller's own folder and records it before going on sale", async () => {
      const { response, calls } = await list({ version: { ...HUMAN_VERSION, checksum: `sha256:${CHECKSUM}` }, assetRows: assetWith(FILE) });
      assert.equal(response.status, 303);
      const copy = storageCalls(calls).find((call) => call.table === "/storage/v1/object/copy");
      assert.ok(copy, "listing put a version on sale without copying its file");
      assert.equal(copy.body.sourceKey, FILE.path);
      assert.ok(copy.body.destinationKey.startsWith(`${ORG}/versions/`), `the copy left the seller's folder: ${copy.body.destinationKey}`);
      assert.notEqual(copy.body.destinationKey, FILE.path);
      const pin = calls.find((call) => call.table === "creator_version_files" && call.method === "POST");
      assert.ok(pin, "the copy was never recorded against the version");
      assert.equal(pin.body.version_id, VERSION);
      assert.equal(pin.body.organization_id, ORG);
      assert.equal(pin.body.object_path, copy.body.destinationKey);
      assert.equal(pin.body.copied_from_path, FILE.path);
      assert.equal(pin.body.bytes, 1024);
      const writes = calls.filter((call) => call.method !== "GET");
      assert.ok(writes.indexOf(pin) < writes.findIndex((call) => call.body?.state === "listed"), "on sale before its file was pinned");
    });

    it("refuses a file whose checksum is not the version's, and writes nothing", async () => {
      const { response, calls } = await list({ version: { ...HUMAN_VERSION, checksum: "b".repeat(64) }, assetRows: assetWith(FILE) });
      assert.equal(response.status, 400);
      assert.match(response.text, /not the file this version recorded/);
      assert.deepEqual(storageCalls(calls), []);
      assert.ok(!listedState(calls));
      assert.ok(!calls.some((call) => call.table === "creator_marketplace_entries" && call.method !== "GET"));
    });

    it("refuses a version with no file attached", async () => {
      const { response, calls } = await list({ version: HUMAN_VERSION, assetRows: [{ id: "a1", metadata: {} }] });
      assert.equal(response.status, 400);
      assert.match(response.text, /no file attached/);
      assert.ok(!listedState(calls));
    });

    it("will not copy a file from another workspace's folder", async () => {
      const { response, calls } = await list({ version: HUMAN_VERSION, assetRows: assetWith({ ...FILE, path: `${OTHER_ORG}/assets/theirs.wav`, sha256: null }) });
      assert.equal(response.status, 400);
      assert.deepEqual(storageCalls(calls), [], "a copy was requested from another workspace's folder");
      assert.ok(!listedState(calls));
    });

    it("leaves it off sale when the copy fails", async () => {
      const { response, calls } = await list({ version: HUMAN_VERSION, assetRows: assetWith(FILE), failCopy: true });
      assert.equal(response.status, 400);
      assert.match(response.text, /could not be copied/);
      assert.ok(!calls.some((call) => call.table === "creator_version_files" && call.method === "POST"));
      assert.ok(!listedState(calls));
    });

    it("removes an unrecorded copy rather than leaving a file nothing points at", async () => {
      const { response, calls } = await list({ version: HUMAN_VERSION, assetRows: assetWith(FILE), failPinWrite: true });
      assert.equal(response.status, 400);
      const copy = storageCalls(calls).find((call) => call.table === "/storage/v1/object/copy");
      const removed = storageCalls(calls).find((call) => call.method === "DELETE");
      assert.ok(removed, "the orphaned copy was left in storage");
      assert.ok(removed.table.endsWith(`/${copy.body.destinationKey}`));
      assert.ok(!listedState(calls));
    });

    it("reuses the version's pin rather than copying again", async () => {
      const { response, calls } = await list({ version: HUMAN_VERSION, pinnedRows: PINNED, assetRows: assetWith({ ...FILE, path: `${ORG}/assets/replaced.wav` }) });
      assert.equal(response.status, 303);
      assert.deepEqual(storageCalls(calls), [], "a pinned version was copied again from whatever the asset holds now");
      assert.ok(!calls.some((call) => call.table === "creator_assets"), "read the asset's current file for a version already pinned");
    });
  });

  describe("withdrawing stops the sale first", () => {
    it("removes the catalogue row before it changes the state", async () => {
      const { app, calls, restore } = harness({ listing: { ...CLEARED_LISTING, state: "listed" }, version: HUMAN_VERSION, approvals: APPROVED });
      try {
        await request(app).post(`/creator-studio/owner/marketplace/${LISTING}/withdraw`);
      } finally {
        restore();
      }
      const writes = calls.filter((call) => call.method !== "GET");
      assert.equal(writes[0].table, "creator_marketplace_entries");
      assert.equal(writes[0].method, "DELETE");
      assert.ok(writes.some((call) => call.body?.state === "withdrawn"));
    });

    it("says it is still on sale when the catalogue row could not be removed, and leaves the state alone", async () => {
      const { app, calls, restore } = harness({ listing: { ...CLEARED_LISTING, state: "listed" }, failCatalogueDelete: true });
      let response;
      try {
        response = await request(app).post(`/creator-studio/owner/marketplace/${LISTING}/withdraw`);
      } finally {
        restore();
      }
      assert.equal(response.status, 503);
      assert.match(response.text, /still on sale/);
      assert.ok(!calls.some((call) => call.body?.state === "withdrawn"), "the state said withdrawn while the work was still on sale");
    });
  });

  describe("an edit to something on sale keeps the public snapshot true", () => {
    it("rejects unsafe or non-decimal prices before making any write", async () => {
      const { app, calls, restore } = harness({ listing: CLEARED_LISTING });
      try {
        for (const priceCents of ["9007199254740993", "2147483648", "0x64", "1e2"]) {
          const response = await request(app).post(`/creator-studio/owner/marketplace/${LISTING}`)
            .type("form").send({ title: "A track", priceCents });
          assert.equal(response.status, 400);
        }
        assert.ok(!calls.some((call) => call.method !== "GET"));
      } finally {
        restore();
      }
    });
    const form = { title: "A track", priceCents: "3000", currency: "usd", licence: "commercial_single", rightsAttested: "yes", consentAttested: "unanswered" };

    it("refreshes the public price when the work is still cleared", async () => {
      const { app, calls, restore } = harness({ listing: { ...CLEARED_LISTING, state: "listed", price_cents: 3000 }, version: HUMAN_VERSION, approvals: APPROVED });
      try {
        await request(app).post(`/creator-studio/owner/marketplace/${LISTING}`).type("form").send(form);
      } finally {
        restore();
      }
      const refreshed = calls.find((call) => call.table === "creator_marketplace_entries" && call.method === "POST");
      assert.ok(refreshed, "a price change on something on sale left the old price on show");
      assert.equal(refreshed.body.price_cents, 3000);
    });

    it("takes it off sale when the edit makes it unsellable", async () => {
      const { app, calls, restore } = harness({ listing: { ...CLEARED_LISTING, state: "listed", rights_attested: false }, version: HUMAN_VERSION, approvals: APPROVED });
      let response;
      try {
        response = await request(app).post(`/creator-studio/owner/marketplace/${LISTING}`).type("form").send({ ...form, rightsAttested: "no" });
      } finally {
        restore();
      }
      assert.match(response.text, /taken off sale/);
      assert.ok(calls.some((call) => call.table === "creator_marketplace_entries" && call.method === "DELETE"));
      assert.ok(calls.some((call) => call.body?.state === "draft"));
    });
  });

  describe("the approval graph's hook", () => {
    it("scopes every query to the organization it was given", async () => {
      const calls = [];
      const realFetch = global.fetch;
      global.fetch = async (url, init = {}) => {
        const parsed = new URL(url);
        calls.push({ table: parsed.pathname.replace("/rest/v1/", ""), method: (init.method || "GET").toUpperCase(), query: parsed.search.slice(1) });
        return { ok: true, status: 200, json: async () => (parsed.pathname.endsWith("creator_listings") && !init.method ? [{ id: LISTING }] : []) };
      };
      let result;
      try {
        result = await takeVersionOffSale({ config: { ok: true, url: "https://example.invalid" }, supabaseHeaders: () => ({}), organizationId: ORG, versionId: VERSION });
      } finally {
        global.fetch = realFetch;
      }
      assert.equal(result.taken, 1);
      for (const call of calls.filter((entry) => entry.table === "creator_listings")) {
        assert.match(call.query, new RegExp(`organization_id=eq\\.${ORG}`), `${call.method} creator_listings was not scoped`);
        assert.doesNotMatch(call.query, new RegExp(OTHER_ORG));
      }
      const order = calls.filter((call) => call.method !== "GET").map((call) => `${call.method} ${call.table}`);
      assert.deepEqual(order, ["DELETE creator_marketplace_entries", "PATCH creator_listings"]);
    });

    it("refuses without an organization rather than acting on every one", async () => {
      const result = await takeVersionOffSale({ config: { ok: true, url: "https://example.invalid" }, supabaseHeaders: () => ({}), organizationId: null, versionId: VERSION });
      assert.equal(result.ok, false);
      assert.equal(result.taken, 0);
    });

    it("is called from both places an approval stops holding", () => {
      const source = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "routes", "sonara-creator-approval-graph-routes.cjs"), "utf8");
      const calls = (source.match(/await takeVersionOffSale\(/g) || []).length;
      assert.equal(calls, 2, `takeVersionOffSale is called ${calls} times; review and decide should both call it`);
      assert.match(source, /state !== "approved"/);
    });
  });
});
