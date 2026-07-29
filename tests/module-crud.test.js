"use strict";

// A customer can now list, correct and retire the records they create.
//
// Until this existed, the six workspace tools were create-only: you could add a
// lead, a campaign or an asset and had no way to open one, fix a typo in it, or
// take it off your list. Everything was visible only through the aggregate
// /records feed.
//
// The tests worth having here are the ones about the boundary rather than the
// happy path. Every read and write carries an organization filter, an id from
// another tenant has to look like a record that does not exist, and a field the
// caller was not offered has to be refused rather than dropped.

const assert = require("node:assert/strict");
const { createModuleCrud, RESOURCES, REQUIRED } = require("../lib/sonara-module-crud.cjs");

const ORG = "11111111-1111-4111-8111-111111111111";
const OTHER_ORG = "22222222-2222-4222-8222-222222222222";
const RECORD = "33333333-3333-4333-8333-333333333333";

// Records every request the module makes, so the assertions can be about the
// query that was actually sent rather than about the answer it got back.
function harness({ rows = [], ok = true, organizationId = ORG } = {}) {
  const calls = [];
  const originalFetch = global.fetch;
  global.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method || "GET", body: init.body });
    if (!ok) return { ok: false, status: 500, json: async () => [] };
    return { ok: true, status: 200, json: async () => rows };
  };
  const crud = createModuleCrud({
    getSupabaseServerConfig: () => ({ ok: true, url: "https://project.supabase.co" }),
    supabaseHeaders: () => ({}),
    getCustomerPrimaryOrganization: async () => ({ ok: true, organizationId })
  });
  return { crud, calls, restore: () => { global.fetch = originalFetch; } };
}

const req = { sonaraAccess: { user: { id: "user-1" } }, query: {} };

describe("workspace record CRUD", () => {
  it("refuses to build without the helpers it needs", () => {
    assert.throws(() => createModuleCrud({}), TypeError);
    for (const name of REQUIRED) {
      const partial = {
        getSupabaseServerConfig: () => ({ ok: false }),
        supabaseHeaders: () => ({}),
        getCustomerPrimaryOrganization: async () => ({ ok: false })
      };
      delete partial[name];
      assert.throws(() => createModuleCrud(partial), TypeError, `omitting ${name} must throw`);
    }
  });

  it("puts an organization filter on every single query", async () => {
    // This is the tenant boundary. Service-role bypasses RLS, so a query without
    // this filter reads every customer's rows and returns HTTP 200 doing it.
    const h = harness({ rows: [{ id: RECORD }] });
    try {
      await h.crud.list(req, "growth_studio", "leads");
      await h.crud.getOne(req, "growth_studio", "leads", RECORD);
      await h.crud.update(req, "growth_studio", "leads", RECORD, { name: "Ada" });
      await h.crud.archive(req, "creator_studio", "assets", RECORD);
      await h.crud.restore(req, "growth_studio", "campaigns", RECORD);
      assert.ok(h.calls.length >= 5, "expected a request per operation");
      for (const call of h.calls) {
        assert.match(call.url, new RegExp(`organization_id=eq\\.${ORG}`), `unscoped query: ${call.url}`);
      }
    } finally {
      h.restore();
    }
  });

  it("treats another tenant's record as missing rather than forbidden", async () => {
    // Returning 403 would confirm the id exists, which is a slower way of
    // leaking the same thing.
    const h = harness({ rows: [] });
    try {
      const result = await h.crud.getOne(req, "growth_studio", "leads", RECORD);
      assert.equal(result.status, 404);
      assert.equal(result.body.code, "not_found");
      assert.doesNotMatch(JSON.stringify(result.body), /forbidden|denied/i);
    } finally {
      h.restore();
    }
  });

  it("refuses a field the caller was never offered instead of dropping it", async () => {
    // Silently ignoring an unknown field looks exactly like a save that worked.
    const h = harness({ rows: [{ id: RECORD }] });
    try {
      const result = await h.crud.update(req, "growth_studio", "leads", RECORD, { name: "Ada", organization_id: OTHER_ORG });
      assert.equal(result.status, 400);
      assert.equal(result.body.code, "unknown_fields");
      assert.match(result.body.message, /organization_id/);
      assert.equal(h.calls.length, 0, "a rejected patch must not reach the database");
    } finally {
      h.restore();
    }
  });

  it("will not let a record be moved to another organization", async () => {
    // The most valuable thing this refusal protects: organization_id is not
    // editable on any resource, so no patch can reassign a row.
    for (const spec of Object.values(RESOURCES)) {
      assert.ok(!spec.editable.includes("organization_id"), `${spec.table} must not expose organization_id`);
      assert.ok(!spec.editable.includes("user_id"), `${spec.table} must not expose user_id`);
      assert.ok(!spec.editable.includes("id"), `${spec.table} must not expose id`);
    }
  });

  it("only accepts a status the database would accept", async () => {
    // The column has a check constraint. Catching it here gives the customer a
    // sentence instead of a 502 from PostgREST.
    const h = harness({ rows: [{ id: RECORD }] });
    try {
      const bad = await h.crud.update(req, "growth_studio", "leads", RECORD, { status: "vip" });
      assert.equal(bad.status, 400);
      assert.equal(bad.body.code, "invalid_status");
      assert.match(bad.body.message, /new, contacted, qualified, won, lost, archived/);
      assert.equal(h.calls.length, 0);

      const good = await h.crud.update(req, "growth_studio", "leads", RECORD, { status: "qualified" });
      assert.equal(good.status, 200);
    } finally {
      h.restore();
    }
  });

  it("rejects an id that is not a uuid before building a query", async () => {
    const h = harness();
    try {
      for (const id of ["", "1", "' or 1=1--", "../../etc/passwd"]) {
        const result = await h.crud.getOne(req, "growth_studio", "leads", id);
        assert.equal(result.status, 400, `${id} must be refused`);
        assert.equal(result.body.code, "invalid_id");
      }
      assert.equal(h.calls.length, 0, "a malformed id must not reach the database");
    } finally {
      h.restore();
    }
  });

  it("hides archived records by default and shows them when asked", async () => {
    const h = harness({ rows: [] });
    try {
      await h.crud.list(req, "growth_studio", "leads");
      assert.match(h.calls[0].url, /status=neq\.archived/);

      await h.crud.list({ ...req, query: { include_archived: "true" } }, "growth_studio", "leads");
      assert.doesNotMatch(h.calls[1].url, /status=neq\.archived/);
    } finally {
      h.restore();
    }
  });

  it("archives rather than deletes", async () => {
    // Every one of these tables carries "archived" in its status check, and the
    // businesses resource already works this way. A stray click should be
    // reversible.
    const h = harness({ rows: [{ id: RECORD, status: "archived" }] });
    try {
      await h.crud.archive(req, "creator_studio", "assets", RECORD);
      assert.equal(h.calls[0].method, "PATCH", "retiring a record must not issue a DELETE");
      assert.match(h.calls[0].body, /"status":"archived"/);

      await h.crud.restore(req, "creator_studio", "assets", RECORD);
      assert.match(h.calls[1].body, /"status":"draft"/, "restore returns the resource to its own starting status");
    } finally {
      h.restore();
    }
  });

  it("bounds how much a caller can ask for at once", async () => {
    const h = harness({ rows: [] });
    try {
      await h.crud.list({ ...req, query: { limit: "100000" } }, "growth_studio", "leads");
      assert.match(h.calls[0].url, /limit=200/);
      await h.crud.list({ ...req, query: { limit: "-5" } }, "growth_studio", "leads");
      assert.match(h.calls[1].url, /limit=1|limit=50/);
    } finally {
      h.restore();
    }
  });

  it("says so plainly when there is nothing to change", async () => {
    const h = harness({ rows: [] });
    try {
      const result = await h.crud.update(req, "growth_studio", "leads", RECORD, {});
      assert.equal(result.status, 400);
      assert.equal(result.body.code, "empty_update");
      assert.equal(h.calls.length, 0);
    } finally {
      h.restore();
    }
  });

  it("does not serve a resource it was never given", async () => {
    const h = harness();
    try {
      const result = await h.crud.list(req, "business_builder", "invoices");
      assert.equal(result.status, 404);
      assert.equal(result.body.code, "unknown_resource");
    } finally {
      h.restore();
    }
  });

  it("reports setup required rather than failing when there is no workspace", async () => {
    const originalFetch = global.fetch;
    const crud = createModuleCrud({
      getSupabaseServerConfig: () => ({ ok: true, url: "https://project.supabase.co" }),
      supabaseHeaders: () => ({}),
      getCustomerPrimaryOrganization: async () => ({ ok: false, code: "organization_membership_missing" })
    });
    try {
      const result = await crud.list(req, "growth_studio", "leads");
      assert.equal(result.status, 503);
      assert.equal(result.body.code, "organization_membership_missing");
    } finally {
      global.fetch = originalFetch;
    }
  });
});

// The API existing is not the same as a customer being able to use it. Before
// this, every workspace tool page said "recent results appear in your private
// workspace" and then showed nothing -- the records were reachable only through
// an aggregate JSON feed, which no customer opens.
describe("saved records are visible on the tool that made them", () => {
  const { resourceForForm, renderRecordCards } = require("../lib/sonara-module-crud.cjs");

  it("finds the resource a tool page edits from the form it renders", () => {
    for (const [form, expected] of [
      ["creator_asset", "assets"],
      ["growth_campaign", "campaigns"],
      ["growth_lead", "leads"]
    ]) {
      const match = resourceForForm(form);
      assert.ok(match, `${form} must resolve to a resource`);
      assert.equal(match.resource, expected);
    }
    assert.equal(resourceForForm("business_checklist"), null, "a tool with no editable resource resolves to nothing");
  });

  it("shows each saved record with its values filled in", () => {
    const { spec } = resourceForForm("growth_lead");
    const html = renderRecordCards({
      records: [{ id: "a", name: "Ada Lovelace", email: "ada@example.com", source: "referral", status: "new" }],
      spec,
      basePath: "/api/growth-studio/leads"
    });
    assert.match(html, /value="Ada Lovelace"/);
    assert.match(html, /value="ada@example\.com"/);
    assert.match(html, /<option value="new" selected>/);
    assert.match(html, /action="\/api\/growth-studio\/leads\/a"/);
  });

  it("escapes record values rather than rendering them", () => {
    // These are customer-supplied. A lead named with a script tag must not run.
    const { spec } = resourceForForm("growth_lead");
    const html = renderRecordCards({
      records: [{ id: "a", name: '"><script>alert(1)</script>', status: "new" }],
      spec,
      basePath: "/api/growth-studio/leads"
    });
    assert.doesNotMatch(html, /<script>alert/);
    assert.match(html, /&lt;script&gt;/);
  });

  it("offers to take a record off the list, and to put it back", () => {
    const { spec } = resourceForForm("creator_asset");
    const active = renderRecordCards({ records: [{ id: "a", title: "Cover", status: "draft" }], spec, basePath: "/b" });
    assert.match(active, /\/b\/a\/archive/);
    assert.match(active, /Take off the list/);

    const archived = renderRecordCards({ records: [{ id: "a", title: "Cover", status: "archived" }], spec, basePath: "/b" });
    assert.match(archived, /\/b\/a\/restore/);
    assert.match(archived, /Put back on the list/);
  });

  it("says nothing is saved yet rather than showing an empty box", () => {
    const { spec } = resourceForForm("growth_campaign");
    const html = renderRecordCards({ records: [], spec, basePath: "/b" });
    assert.match(html, /Nothing saved yet/);
    assert.doesNotMatch(html, /<form/, "an empty list has nothing to submit");
  });

  it("never offers an input for a field the API would refuse", () => {
    // The form and the allow-list come from the same spec, so a field can only
    // appear on screen if a patch carrying it would be accepted.
    const { RESOURCES } = require("../lib/sonara-module-crud.cjs");
    for (const spec of Object.values(RESOURCES)) {
      const html = renderRecordCards({ records: [{ id: "a", status: spec.statuses[0] }], spec, basePath: "/b" });
      for (const name of [...html.matchAll(/name="([a-z_]+)"/g)].map((m) => m[1])) {
        assert.ok(spec.editable.includes(name), `${spec.table} renders an input for ${name}, which the API would reject`);
      }
    }
  });
});
