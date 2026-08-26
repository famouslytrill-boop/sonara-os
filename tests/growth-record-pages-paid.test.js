"use strict";

// The four Growth Studio workspaces that were placeholders.
//
// /growth-studio/content-plan and /growth-studio/automations existed as paths
// and rendered a card saying the workspace "unlocks after billing state
// confirms plan access" -- shown to customers whose billing state had already
// confirmed it. The POST endpoints behind both had worked the whole time.
// /growth-studio/conversions and /growth-studio/touchpoints had endpoints and
// no page at all.
//
// tests/growth-create-forms.test.js already checks the forms against their
// handlers, and it covered the new ones the moment they were added, because it
// iterates GROWTH_CREATE_SPECS. What it cannot see is any of this:
//
//   whether the pages render at all;
//   whether the placeholder or the real page won the path, which Express
//     decides by registration order and does not warn about;
//   whether replacing a paid placeholder with a real page quietly handed a
//     plan-gated workspace to free accounts;
//   whether the one form that was deliberately refused stayed refused.
//
// The stub keys below are shaped like real ones on purpose. isPlaceholderValue()
// in server.js matches the literal word "placeholder", and keys named that way
// make the application report its own database as unconfigured -- which sends
// whole blocks of workspaces down a setup-required redirect while a crawl that
// accepts redirects stays green. That cost a full round of wrong conclusions in
// tests/signed-in-workspace-crawl.test.js.

const assert = require("node:assert/strict");
const request = require("supertest");

// Set in before() and restored in after(), per tests/setup-env.cjs. Assigning
// at module scope instead is what broke tests/signed-in-workspace-crawl.test.js
// when this file was first written: mocha loads every file before running any
// test, so the assignments piled up and this file's after() deleted variables
// the crawl was still relying on. Both files own their environment during their
// own run now.
const SUPABASE_ENV = Object.freeze({
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.stub-anon-key-for-growth",
  SUPABASE_SERVICE_ROLE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.stub-service-role-for-growth"
});
const original = Object.fromEntries(Object.keys(SUPABASE_ENV).map((key) => [key, process.env[key]]));

const app = require("../server");
const { CUSTOMER_SESSION_COOKIE } = require("../lib/sonara-customer-auth.cjs");
const { GROWTH_RECORD_PAGES } = require("../lib/sonara-growth-record-pages.cjs");
const { GROWTH_CREATE_SPECS } = require("../lib/sonara-growth-create-specs.cjs");
const { hasColumn } = require("../lib/sonara-migration-columns.cjs");
const { STAGES } = require("../lib/sonara-customer-journey.cjs");

const USER = { id: "55555555-5555-4555-8555-555555555555", email: "growth@example.com" };
const ORGANIZATION_ID = "66666666-6666-4666-8666-666666666666";

const REPLACED_PLACEHOLDERS = ["/growth-studio/content-plan", "/growth-studio/automations"];
const NEW_PAGES = ["/growth-studio/conversions", "/growth-studio/touchpoints"];
const PAID_PAGES = [...REPLACED_PLACEHOLDERS, ...NEW_PAGES];

let entitled = true;

function json(body, status = 200) {
  return { ok: status < 400, status, headers: { get: () => null }, json: async () => body };
}

function stubFetch() {
  return async (url, options = {}) => {
    const target = String(url);
    const method = (options.method || "GET").toUpperCase();
    if (target.includes("/auth/v1/user")) return json(USER);
    if (target.includes("/rest/v1/rpc/")) return json({});
    if (target.includes("/rest/v1/")) {
      const table = (target.split("/rest/v1/")[1] || "").split("?")[0];
      if (table === "organization_memberships") {
        return json([{ organization_id: ORGANIZATION_ID, user_id: USER.id, role: "owner", status: "active" }]);
      }
      // Echo back a key the request itself asked for, so the entitlement
      // granted is exactly the one the page requires rather than a guess at
      // what the column holds.
      if (entitled && table === "billing_entitlements") {
        const asked = decodeURIComponent((target.match(/entitlement_key=in\.\(([^)]*)\)/) || ["", ""])[1])
          .split(",").filter(Boolean);
        return json(asked[0] ? [{ entitlement_key: asked[0], status: "active" }] : []);
      }
      if (method === "POST" || method === "PATCH") return json([{ id: "created" }], 201);
      return json([]);
    }
    return undefined;
  };
}

function open(page) {
  return request(app)
    .get(page)
    .set("Accept", "text/html")
    .set("Cookie", `${CUSTOMER_SESSION_COOKIE}=stub-access-token`)
    .redirects(0);
}

describe("the Growth Studio workspaces that were placeholders", () => {
  let realFetch;

  before(() => {
    Object.assign(process.env, SUPABASE_ENV);
    realFetch = global.fetch;
    global.fetch = stubFetch();
  });

  after(() => {
    global.fetch = realFetch;
    entitled = true;
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("registers each of them exactly once", () => {
    // The failure this guards against is silent. Express keeps the first
    // handler registered for a path, so leaving the placeholder entry in
    // lib/sonara-product-pages.cjs while adding the record page would have left
    // the placeholder serving and the real page unreachable, with both
    // "registered" and nothing to see.
    const seen = [];
    (function walk(stack) {
      for (const layer of stack) {
        if (layer.route && layer.route.methods.get) seen.push(layer.route.path);
        else if (layer.handle && layer.handle.stack) walk(layer.handle.stack);
      }
    })(app._router ? app._router.stack : app.router.stack);
    const duplicated = PAID_PAGES.filter((page) => seen.filter((path) => path === page).length !== 1)
      .map((page) => `${page} registered ${seen.filter((path) => path === page).length} times`);
    assert.deepEqual(duplicated, [], duplicated.join("\n  "));
  });

  it("renders records instead of a card saying the workspace is locked", async () => {
    const stillPlaceholder = [];
    for (const page of PAID_PAGES) {
      const res = await open(page);
      if (res.status !== 200) {
        stillPlaceholder.push(`${page} returned ${res.status} for an entitled customer`);
        continue;
      }
      // The exact wording the two placeholders carried. A customer holding the
      // plan should never be told the page unlocks with the plan.
      if (/unlocks after billing state confirms|remains setup required until owner-approved/i.test(res.text)) {
        stillPlaceholder.push(`${page} still renders the placeholder copy`);
      }
      if (!/<table/.test(res.text)) stillPlaceholder.push(`${page} renders no record table`);
    }
    assert.deepEqual(stillPlaceholder, [], stillPlaceholder.join("\n  "));
  });

  it("still asks a free account to pay, rather than opening because the page got built", async () => {
    // Both replaced pages were paid. Publishing a real page in place of a stub
    // must not be how a plan-gated workspace becomes free.
    entitled = false;
    try {
      const opened = [];
      for (const page of PAID_PAGES) {
        const res = await open(page);
        if (res.status !== 402) opened.push(`${page} returned ${res.status} for an account with no entitlement`);
      }
      assert.deepEqual(opened, [], opened.join("\n  "));
    } finally {
      entitled = true;
    }
  });

  it("puts a working create form on the three that should have one", async () => {
    const expected = { "/growth-studio/content-plan": "content", "/growth-studio/automations": "automations", "/growth-studio/conversions": "conversions" };
    const wrong = [];
    for (const [page, key] of Object.entries(expected)) {
      const res = await open(page);
      if (!res.text.includes(`action="/api/growth/${key}"`)) wrong.push(`${page} has no form posting to /api/growth/${key}`);
    }
    assert.deepEqual(wrong, [], wrong.join("\n  "));
  });

  it("offers the attestation the content handler refuses to write without", async () => {
    // POST /api/growth/content rejects outbound channels without
    // consent_basis_attested. A form missing the box would send every email,
    // SMS and push draft straight into a 400 the customer cannot act on.
    const res = await open("/growth-studio/content-plan");
    assert.match(res.text, /name="consent_basis_attested" type="checkbox"/, "the consent attestation is not on the content form");
    assert.doesNotMatch(res.text, /name="consent_basis_attested"[^>]*checked/, "the attestation is pre-ticked, which asserts it on the customer's behalf");
  });

  it("offers a hand-entry form for touchpoints only alongside the things that make it safe", async () => {
    // This test refused the form twice, and its own message named the condition:
    // "if that is intended, growth_touchpoints needs a column recording that a
    // person entered the row". Migration 20260818090000 adds `hand_entered`, so
    // the form exists now -- and this checks the three parts together, because
    // any one of them alone reintroduces the problem the refusals prevented.
    //
    // Without the funnel exclusion, a business could raise its own reach and
    // lower its own apparent drop-off by typing. That is the failure, not the
    // form.
    const spec = GROWTH_CREATE_SPECS.find((entry) => entry.tableKey === "touchpoints");
    assert.ok(spec, "the touchpoints form has gone; if that is deliberate, this test should say why rather than being deleted");

    // 1. The column exists to record it.
    assert.ok(hasColumn("growth_touchpoints", "hand_entered"), "growth_touchpoints lost the column this form depends on");

    // 2. The funnel does not count typed rows as measured, and reports them.
    const reached = STAGES.find((stage) => stage.id === "reached");
    assert.equal(reached.counts({ hand_entered: true }), false, "a typed touchpoint is being counted as measured reach");
    assert.equal(reached.counts({ hand_entered: null }), true, "a row from before the column is not a typed row");
    assert.ok(reached.columns.includes("hand_entered"), "the stage cannot filter on a column it does not select");

    // 3. The form does not offer the fields that would dress a typed row as a
    // tracked one.
    for (const forbidden of ["provider_key", "anonymous_id", "external_event_id"]) {
      assert.equal(
        spec.fields.some(([column]) => column === forbidden), false,
        `the hand-entry form offers ${forbidden}, which identifies a tracked source`
      );
    }

    const res = await open("/growth-studio/touchpoints");
    assert.equal(res.status, 200, "the touchpoints page does not render");
    // And the attestation the handler refuses to write without, un-ticked.
    assert.match(res.text, /name="tracking_basis_attested" type="checkbox"/, "the tracking-basis attestation is not on the form");
    assert.doesNotMatch(res.text, /name="tracking_basis_attested"[^>]*checked/, "the attestation is pre-ticked, which asserts it on the customer's behalf");
  });

  it("shows no column that is not selected, so nothing renders as permanently empty", () => {
    // A column reading a field the query never asked for shows "Not recorded"
    // on every row forever, and looks like missing data rather than a missing
    // select.
    const problems = [];
    for (const page of GROWTH_RECORD_PAGES) {
      const selected = new Set(page.select.split(",").map((column) => column.trim()));
      const row = Object.fromEntries([...selected].map((column) => [column, column === "config" ? {} : "value"]));
      for (const column of page.columns) {
        // If a column can render from a row containing only selected fields,
        // it is reading selected fields.
        let rendered;
        try {
          rendered = column.value(row);
        } catch (error) {
          problems.push(`${page.path} · ${column.label} threw: ${error.message}`);
          continue;
        }
        if (rendered === undefined || rendered === null) problems.push(`${page.path} · ${column.label} rendered nothing`);
      }
    }
    assert.deepEqual(problems, [], problems.join("\n  "));
  });

  it("keeps secrets and provider blobs off every one of these pages", async () => {
    // The rule the file already held for the first six, checked against the
    // four that were added rather than trusted.
    const forbidden = [/credential_reference/, /provider_response/, /request_payload/, /idempotency_key/, /anonymous_id/, /deduplication_key/];
    const leaked = [];
    for (const page of PAID_PAGES) {
      const res = await open(page);
      for (const pattern of forbidden) {
        if (pattern.test(res.text)) leaked.push(`${page} renders ${pattern.source}`);
      }
    }
    assert.deepEqual(leaked, [], leaked.join("\n  "));
  });
});
