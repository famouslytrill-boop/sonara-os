"use strict";
const assert = require("node:assert/strict");
const { createIndustrySessionPreflight } = require("../lib/sonara-industry-session-preflight.cjs");
const { PACKAGES } = require("../lib/sonara-industry-package-blueprints.cjs");

const user = Object.freeze({ id: "user_01" });
const tenant = "org_01";
function readers() {
  const calls = [];
  const data = {
    authenticatedUser: user,
    async getCustomerPrimaryOrganization(actor, options) {
      calls.push(["membership", actor, options]);
      return { ok: true, organizationId: tenant, role: "owner", source: "organization_memberships" };
    },
    async getCustomerPaidEntitlement(actor, product, options) {
      calls.push(["billing", actor, product, options]);
      return { ok: true, organizationId: tenant, source: "billing_subscriptions", entitlementKey: "all_three_monthly" };
    },
    async readCapabilityEvidence({ organizationId, product, requiredFields }) {
      calls.push(["evidence", organizationId, product, requiredFields]);
      return { ok: true, organizationId, product,
        fields: Object.fromEntries(requiredFields.map(field => [field,
          { organizationId, status: "verified", value: field === "sourceSha256" ? "a".repeat(64) : "ref_1" }])) };
    }
  };
  return { data, calls };
}

describe("canonical authenticated industry session binding", () => {
  it("refuses construction without an authenticated actor and trusted readers", () => {
    assert.throws(() => createIndustrySessionPreflight({}), TypeError);
    assert.throws(() => createIndustrySessionPreflight({ authenticatedUser: user }), TypeError);
  });

  it("uses exact authenticated user, disables workspace auto-bootstrap and reuses canonical billing", async () => {
    const { data, calls } = readers();
    const result = await createIndustrySessionPreflight(data)("creator_production");
    assert.equal(result.ok, true);
    assert.deepEqual(calls.map(row => row[0]), ["membership", "billing", "evidence"]);
    assert.equal(calls[0][1], user);
    assert.deepEqual(calls[0][2], { autoBootstrap: false });
    assert.equal(calls[1][1], user);
    assert.equal(calls[1][2], "creator_studio");
    assert.deepEqual(calls[1][3], { autoBootstrap: false });
    assert.equal(result.canExecute, false);
    assert.equal(result.canDeliverPaidAssets, false);
    assert.equal(JSON.stringify(result).includes("ref_1"), false);
  });

  it("works for all three packages but never permits publishing or activation", async () => {
    for (const key of Object.keys(PACKAGES)) {
      const { data } = readers();
      const result = await createIndustrySessionPreflight(data)(key);
      assert.equal(result.ok, true);
      assert.equal(result.product, PACKAGES[key].product);
      assert.equal(result.canActivate, false);
      assert.equal(result.canPublish, false);
    }
  });

  it("rejects untrusted, bootstrapped, missing or alternate-tenant membership", async () => {
    for (const replacement of [
      { ok: true, organizationId: tenant, source: "automatic_workspace_bootstrap" },
      { ok: true, organizationId: tenant, source: "caller_supplied" },
      { ok: false, code: "workspace_unreadable" },
      { ok: true, organizationId: "", source: "organization_memberships" }
    ]) {
      const { data, calls } = readers();
      data.getCustomerPrimaryOrganization = async () => replacement;
      const result = await createIndustrySessionPreflight(data)("social_business");
      assert.equal(result.code, "membership_not_verified");
      assert.equal(calls.length, 0);
    }
  });

  it("rejects stale, failed, or cross-tenant billing without trusting a plan label", async () => {
    for (const paid of [
      { ok: true, organizationId: "org_02", source: "billing_subscriptions" },
      { ok: true, organizationId: tenant, source: "client_input", entitlementKey: "all_three_monthly" },
      { ok: false, code: "upgrade_required", status: 402 }
    ]) {
      const { data } = readers();
      data.getCustomerPaidEntitlement = async () => paid;
      assert.equal((await createIndustrySessionPreflight(data)("independent_professional")).code, "entitlement_not_verified");
    }
  });

  it("distinguishes unreadable billing from unpaid without leaking provider text", async () => {
    const { data } = readers();
    data.getCustomerPaidEntitlement = async () => ({ ok: false, code: "entitlement_unreadable", message: "secret" });
    const result = await createIndustrySessionPreflight(data)("creator_production");
    assert.equal(result.code, "entitlement_unavailable");
    assert.equal(JSON.stringify(result).includes("secret"), false);
  });

  it("never invents source or provider evidence when not configured", async () => {
    const { data } = readers();
    data.readCapabilityEvidence = async () => { throw new Error("provider not configured"); };
    assert.equal((await createIndustrySessionPreflight(data)("social_business")).code, "evidence_unavailable");
  });

  it("does not share mutable authorization across simultaneous package calls", async () => {
    const { data } = readers();
    const run = createIndustrySessionPreflight(data);
    const [creator, growth] = await Promise.all([run("creator_production"), run("social_business")]);
    assert.equal(creator.ok, true);
    assert.equal(growth.ok, true);
    assert.equal(creator.product, "creator_studio");
    assert.equal(growth.product, "growth_studio");
  });

  it("fails closed when the canonical billing reader throws", async () => {
    const { data } = readers();
    data.getCustomerPaidEntitlement = async () => { throw new Error("provider outage"); };
    assert.equal((await createIndustrySessionPreflight(data)("social_business")).code, "entitlement_unavailable");
  });
});
