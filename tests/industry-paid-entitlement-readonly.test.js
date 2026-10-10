"use strict";
const assert = require("node:assert/strict");
const { createPaidEntitlementReader } = require("../lib/sonara-paid-entitlement.cjs");
const USER = Object.freeze({ id: "user_01" });
const ORG = "org_01";
const CONFIG = Object.freeze({ ok: true, url: "https://example.supabase.co" });

function build(resolver) {
  return createPaidEntitlementReader({
    getCustomerPrimaryOrganization: resolver,
    getSupabaseServerConfig: () => CONFIG,
    supabaseHeaders: () => ({ apikey: "masked" }),
    getPaidEntitlementKeys: () => ["all_three_monthly"]
  });
}

describe("non-bootstrapping paid entitlement read", () => {
  let oldFetch;
  beforeEach(() => { oldFetch = global.fetch; });
  afterEach(() => { global.fetch = oldFetch; });

  it("passes no-bootstrap and never queries billing for a missing workspace", async () => {
    let opts;
    let fetchCount = 0;
    global.fetch = () => { fetchCount += 1; throw Error("should not fetch"); };
    const read = build(async (_, o) => { opts = o; return { ok: false, code: "workspace_not_ready" }; });
    const result = await read(USER, "creator_studio", { autoBootstrap: false });
    assert.deepEqual(opts, { autoBootstrap: false });
    assert.equal(result.ok, false);
    assert.equal(fetchCount, 0);
  });

  it("preserves auto-bootstrap behavior for existing callers", async () => {
    let opts;
    const read = build(async (_, o) => { opts = o; return { ok: false, code: "workspace_not_ready" }; });
    await read(USER, "business_builder");
    assert.deepEqual(opts, { autoBootstrap: true });
  });

  it("still accepts a verified matching subscription without bootstrap", async () => {
    let opts;
    const queries = [];
    global.fetch = async (url, init) => {
      queries.push([String(url), init]);
      if (String(url).includes("/billing_entitlements?")) return { ok: true, json: async () => [] };
      if (String(url).includes("/billing_subscriptions?")) return { ok: true, json: async () => [
        { plan_slug: "all_three_monthly", status: "active", metadata: {} }
      ] };
      throw Error("unexpected query");
    };
    const read = build(async (_, o) => { opts = o; return { ok: true, organizationId: ORG }; });
    const result = await read(USER, "creator_studio", { autoBootstrap: false });
    assert.deepEqual(opts, { autoBootstrap: false });
    assert.equal(result.ok, true);
    assert.equal(result.organizationId, ORG);
    assert.equal(result.source, "billing_subscriptions");
    assert.equal(queries.length, 2);
    assert.ok(queries.every(([url, init]) => url.includes(`organization_id=eq.${ORG}`) && !init.method));
  });
});
