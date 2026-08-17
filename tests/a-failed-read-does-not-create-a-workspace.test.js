"use strict";

// Which organization a customer belongs to is the tenant boundary: the
// service-role key bypasses row level security, so this value is the only thing
// keeping one business's records away from another's. It is read on 95 call
// sites.
//
// The resolver looks in `organization_memberships`, then `business_memberships`,
// and if neither has a row it calls `sonara_bootstrap_customer_workspace` to
// make one. Both lookups were guarded by `if (response?.ok)` with no else, so a
// read that failed and a read that found nothing arrived at the third step
// looking identical.
//
// The bootstrap RPC checks `organization_memberships` for an existing active
// membership before creating anything, so a failed read of *that* table was
// covered by accident. It does not check `business_memberships`. A customer
// whose only membership lives there, on a request where that read failed, was
// given a brand-new empty organization while their real one sat there with all
// of their records in it.
//
// Creating a workspace is a write. Doing it because a read failed is doing it
// because we do not know.

const assert = require("node:assert/strict");
const { createCustomerPrimaryOrganizationResolver } = require("../lib/sonara-customer-organization.cjs");

const USER = { id: "11111111-1111-4111-8111-111111111111", email: "owner@example.com" };
const CONFIG = { ok: true, url: "https://project.supabase.co", serviceRoleKey: "service-role" };

const ok = (body) => ({ ok: true, status: 200, json: async () => body });
const failed = () => ({ ok: false, status: 500, json: async () => ({}) });

// `organizations` and `businesses` are what each membership read answers:
// an array of rows, or the string "failed" for a read that did not answer.
function build({ organizations, businesses, bootstrap = "created" }) {
  const calls = [];
  global.fetch = async (url) => {
    const target = String(url);
    calls.push(target);
    if (target.includes("/rpc/sonara_bootstrap_customer_workspace")) {
      return bootstrap === "failed" ? failed() : ok({ organization_id: "new-organization", created: true });
    }
    if (target.includes("/organization_memberships")) return organizations === "failed" ? failed() : ok(organizations);
    if (target.includes("/business_memberships")) return businesses === "failed" ? failed() : ok(businesses);
    throw new Error(`unexpected read: ${target}`);
  };
  const resolve = createCustomerPrimaryOrganizationResolver({
    getSupabaseServerConfig: () => CONFIG,
    supabaseHeaders: () => ({ apikey: CONFIG.serviceRoleKey })
  });
  return { resolve, bootstrapped: () => calls.some((call) => call.includes("/rpc/sonara_bootstrap_customer_workspace")) };
}

describe("a failed read does not create a workspace", () => {
  // Captured per test, not once when this file loads. The suite installs an
  // offline firewall as `global.fetch`, and a value read at load time predates
  // it -- restoring that would put the firewall back only if this file happened
  // to be required after it, which is not something a test should depend on.
  let originalFetch;
  beforeEach(() => { originalFetch = global.fetch; });
  afterEach(() => { global.fetch = originalFetch; });

  it("returns the organization membership when there is one", async () => {
    const probe = build({ organizations: [{ organization_id: "org-1" }], businesses: [] });
    const result = await probe.resolve(USER);
    assert.deepEqual({ ok: result.ok, organizationId: result.organizationId, source: result.source },
      { ok: true, organizationId: "org-1", source: "organization_memberships" });
    assert.equal(probe.bootstrapped(), false);
  });

  it("falls back to the business membership", async () => {
    const probe = build({ organizations: [], businesses: [{ organization_id: "org-2" }] });
    const result = await probe.resolve(USER);
    assert.equal(result.organizationId, "org-2");
    assert.equal(result.source, "business_memberships");
    assert.equal(probe.bootstrapped(), false);
  });

  // Without this the two assertions below would pass against a resolver that
  // never bootstraps at all, and the fix they describe would be untested.
  it("still creates one when both reads answered and found nothing", async () => {
    const probe = build({ organizations: [], businesses: [] });
    const result = await probe.resolve(USER);
    assert.equal(result.ok, true);
    assert.equal(result.source, "automatic_workspace_bootstrap");
    assert.equal(probe.bootstrapped(), true, "a customer with genuinely no workspace must still get one");
  });

  it("does not create one when the business membership read failed", async () => {
    const probe = build({ organizations: [], businesses: "failed" });
    const result = await probe.resolve(USER);
    assert.equal(probe.bootstrapped(), false, "a second workspace was created on the strength of a read that failed");
    assert.equal(result.ok, false);
    assert.equal(result.code, "workspace_unreadable");
  });

  it("does not create one when the organization membership read failed", async () => {
    const probe = build({ organizations: "failed", businesses: [] });
    const result = await probe.resolve(USER);
    assert.equal(probe.bootstrapped(), false);
    assert.equal(result.code, "workspace_unreadable");
  });

  it("does not create one when the reads answered with something that is not a list", async () => {
    // PostgREST answers 200 with an error object in some failure modes. `rows[0]`
    // on an object is undefined, which read as "no membership" and bootstrapped.
    const probe = build({ organizations: { message: "server error" }, businesses: { message: "server error" } });
    const result = await probe.resolve(USER);
    assert.equal(probe.bootstrapped(), false);
    assert.equal(result.code, "workspace_unreadable");
  });

  it("separates having no workspace from not being able to tell", async () => {
    // Same absent-vs-empty collapse one level up. Both used to come back as
    // `workspace_not_ready`, which reads as a fact about the customer -- and a
    // customer mid-outage was told they had no workspace, with a button to make
    // one.
    const none = await build({ organizations: [], businesses: [] }).resolve(USER, { autoBootstrap: false });
    assert.equal(none.code, "workspace_not_ready");

    const unreadable = await build({ organizations: "failed", businesses: [] }).resolve(USER, { autoBootstrap: false });
    assert.equal(unreadable.code, "workspace_unreadable");
    assert.notEqual(none.code, unreadable.code);
  });

  it("does not report a workspace when the bootstrap itself failed", async () => {
    const probe = build({ organizations: [], businesses: [], bootstrap: "failed" });
    const result = await probe.resolve(USER);
    assert.equal(result.ok, false);
    assert.equal(result.code, "workspace_unreadable", "a failed bootstrap is not evidence the customer has no workspace");
  });

  it("refuses to be built without the two things it reads with", () => {
    assert.throws(() => createCustomerPrimaryOrganizationResolver({ supabaseHeaders: () => ({}) }), TypeError);
    assert.throws(() => createCustomerPrimaryOrganizationResolver({ getSupabaseServerConfig: () => CONFIG }), TypeError);
  });
});
