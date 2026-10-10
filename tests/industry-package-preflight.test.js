"use strict";
const assert = require("node:assert/strict");
const { PACKAGES } = require("../lib/sonara-industry-package-blueprints.cjs");
const { createIndustryPackagePreflight } = require("../lib/sonara-industry-package-preflight.cjs");

const actor = "user_01", org = "org_01";
function contextFor(packageKey) {
  const pack = PACKAGES[packageKey];
  const requirements = [...new Set(Object.values(pack.capabilities).flat())];
  const calls = [];
  const dependencies = {
    async resolveMemberOrganization(request) { calls.push(["member", request]); return { ok: true, userId: actor, organizationId: org, status: "active" }; },
    async readProductEntitlement(request) { calls.push(["entitlement", request]); return { ok: true, organizationId: org, product: pack.product, status: "active", active: true }; },
    async readCapabilityEvidence(request) { calls.push(["evidence", request]); return { ok: true, organizationId: org, product: pack.product, fields: Object.fromEntries(requirements.map((field) => [field, { organizationId: org, status: "verified", value: field === "sourceSha256" ? "a".repeat(64) : "ref_01" }])) }; }
  };
  return { dependencies, calls, pack, requirements };
}

describe("server-bound industry preflight", () => {
  it("requires all three server readers, not request-supplied entitlement or proof", () => {
    assert.throws(() => createIndustryPackagePreflight({}), TypeError);
    assert.throws(() => createIndustryPackagePreflight({ resolveMemberOrganization() {}, readProductEntitlement() {} }), TypeError);
  });

  it("rejects unknown package and unauthenticated user before any server read", async () => {
    const { dependencies, calls } = contextFor("social_business");
    const run = createIndustryPackagePreflight(dependencies);
    assert.equal((await run({ authenticatedUserId: actor, packageKey: "__proto__" })).code, "unknown_industry_package");
    assert.equal((await run({ authenticatedUserId: "", packageKey: "social_business" })).code, "authenticated_user_required");
    assert.equal(calls.length, 0);
  });

  it("returns no raw IDs or receipts and never grants execution even with complete verified rows", async () => {
    for (const key of Object.keys(PACKAGES)) {
      const { dependencies, calls, pack } = contextFor(key);
      const preview = await createIndustryPackagePreflight(dependencies)({ authenticatedUserId: actor, packageKey: key, evidence: { forged: true }, organizationId: "org_other", entitledProducts: [] });
      assert.equal(preview.ok, true);
      assert.equal(preview.product, pack.product);
      assert.equal(preview.launchState, "template_only");
      assert.equal(preview.canExecute, false);
      assert.equal(preview.canPublish, false);
      assert.equal(preview.canDeliverPaidAssets, false);
      assert.equal(preview.canActivate, false);
      assert.ok(preview.capabilities.every(x => x.status === "requires_owner_and_runtime_review"));
      assert.equal(JSON.stringify(preview).includes("ref_01"), false);
      assert.deepEqual(calls.map(c => c[0]), ["member", "entitlement", "evidence"]);
    }
  });

  it("does not read entitlements or evidence for foreign or inactive membership", async () => {
    const { dependencies, calls } = contextFor("creator_production");
    dependencies.resolveMemberOrganization = async () => ({ ok: true, userId: actor, organizationId: "org_02", status: "inactive" });
    const result = await createIndustryPackagePreflight(dependencies)({ authenticatedUserId: actor, packageKey: "creator_production" });
    assert.equal(result.code, "membership_not_verified");
    assert.equal(calls.length, 0);
  });

  it("rejects stale, cross-tenant, or forged product entitlements", async () => {
    const { dependencies } = contextFor("social_business");
    dependencies.readProductEntitlement = async () => ({ ok: true, organizationId: "org_other", product: "growth_studio", status: "active", active: true });
    const result = await createIndustryPackagePreflight(dependencies)({ authenticatedUserId: actor, packageKey: "social_business" });
    assert.equal(result.code, "entitlement_not_verified");
  });

  it("refuses an unreadable evidence source instead of treating it as an empty successful read", async () => {
    const { dependencies } = contextFor("independent_professional");
    dependencies.readCapabilityEvidence = async () => { throw new Error("sensitive upstream credential failed"); };
    const result = await createIndustryPackagePreflight(dependencies)({ authenticatedUserId: actor, packageKey: "independent_professional" });
    assert.equal(result.code, "evidence_unavailable");
    assert.equal(JSON.stringify(result).includes("sensitive upstream"), false);
  });

  it("does not accept a forged other-tenant capability or non-hex source hash", async () => {
    const { dependencies } = contextFor("creator_production");
    const original = dependencies.readCapabilityEvidence;
    dependencies.readCapabilityEvidence = async request => {
      const response = await original(request);
      response.fields.rightsRef.organizationId = "org_other";
      response.fields.sourceSha256.value = "z".repeat(64);
      return response;
    };
    const result = await createIndustryPackagePreflight(dependencies)({ authenticatedUserId: actor, packageKey: "creator_production" });
    assert.equal(result.ok, true);
    assert.ok(result.unreadableEvidence.includes("rightsRef"));
    assert.ok(result.unreadableEvidence.includes("sourceSha256"));
    assert.ok(result.capabilities.find(c => c.name === "multitrack_handoff").missing.includes("sourceSha256"));
    assert.equal(result.canActivate, false);
  });

  it("fails shut for exceptions in member/entitlement readers", async () => {
    const x = contextFor("social_business").dependencies;
    x.resolveMemberOrganization = async () => { throw new Error("database secret"); };
    assert.equal((await createIndustryPackagePreflight(x)({ authenticatedUserId: actor, packageKey: "social_business" })).code, "membership_unavailable");
    const y = contextFor("social_business").dependencies;
    y.readProductEntitlement = async () => { throw new Error("provider token"); };
    assert.equal((await createIndustryPackagePreflight(y)({ authenticatedUserId: actor, packageKey: "social_business" })).code, "entitlement_unavailable");
  });
});
