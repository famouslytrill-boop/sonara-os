"use strict";
const assert = require("node:assert/strict");
const { PACKAGES, createIndustryPackagePreview } = require("../lib/sonara-industry-package-blueprints.cjs");

const scope = (product) => ({ organizationId: "org_one", actorOrganizationId: "org_one", entitledProducts: [product] });
const refEvidence = (packKey) => Object.fromEntries(
  Object.values(PACKAGES[packKey].capabilities).flat().map((field) => [field, field === "sourceSha256" ? "a".repeat(64) : `verified_${field}`])
);

describe("industry package blueprints", () => {
  it("composes exactly three named packages using the existing workflow engines", () => {
    assert.deepEqual(Object.keys(PACKAGES).sort(), ["creator_production", "independent_professional", "social_business"]);
    for (const [key, pack] of Object.entries(PACKAGES)) {
      const preview = createIndustryPackagePreview(key, { identity: scope(pack.product) });
      assert.equal(preview.ok, true);
      assert.equal(preview.capabilities.length, 3 + Number(key === "creator_production"));
      assert.equal(preview.launchState, "template_only");
      assert.equal(preview.canExecute, false);
      assert.equal(preview.canActivate, false);
      assert.equal(preview.canPublish, false);
      assert.equal(preview.canDeliverPaidAssets, false);
      assert.equal(preview.sourceEvidenceIsAuthoritative, false);
    }
  });

  it("makes nested catalogue actions immutable", () => {
    assert.throws(() => PACKAGES.social_business.workflow.steps.push({ action: "send_webhook" }), TypeError);
    assert.throws(() => { PACKAGES.creator_production.workflow.steps[2] = "analyze_audio"; }, TypeError);
  });

  it("fails closed on unknown packages, invalid contexts, different tenants and no entitlement", () => {
    assert.deepEqual(createIndustryPackagePreview("__proto__"), { ok: false, code: "unknown_industry_package" });
    assert.deepEqual(createIndustryPackagePreview("fake"), { ok: false, code: "unknown_industry_package" });
    assert.deepEqual(createIndustryPackagePreview("social_business", []), { ok: false, code: "invalid_industry_context" });
    const result = createIndustryPackagePreview("social_business", { identity: { ...scope("growth_studio"), actorOrganizationId: "org_other", entitledProducts: [] } });
    assert.ok(result.capabilities.every((cap) => cap.missing.includes("authenticated_tenant_scope") && cap.missing.includes("verified_product_entitlement")));
  });

  it("requires actual rights and separately represented payment receipt evidence for creator delivery", () => {
    const result = createIndustryPackagePreview("creator_production", { identity: scope("creator_studio"), evidence: { verifiedPaymentReceiptRef: "evt_1" } });
    const delivery = result.capabilities.find((cap) => cap.name === "private_digital_delivery");
    assert.deepEqual(delivery.missing.sort(), ["buyerRef", "licenseGrantRef", "privateAssetRef"].sort());
    const handoff = result.capabilities.find((cap) => cap.name === "multitrack_handoff");
    assert.ok(handoff.missing.includes("sourceSha256"));
    assert.equal(result.workflow.externalWorkRequired, true);
    assert.equal(result.workflow.approvalRequired, true);
    assert.equal(result.workflow.publishesAutomatically, false);
  });

  it("forces social publishing and professional customer contact through owner review", () => {
    for (const key of ["social_business", "independent_professional"]) {
      const result = createIndustryPackagePreview(key, { identity: scope(PACKAGES[key].product) });
      assert.equal(result.workflow.effectiveAutonomy, "approval_required");
      assert.equal(result.workflow.approvalRequired, true);
      assert.equal(result.workflow.arbitraryCodeAllowed, false);
    }
  });

  it("never promotes forged or complete caller evidence into authorization", () => {
    for (const [key, pack] of Object.entries(PACKAGES)) {
      const result = createIndustryPackagePreview(key, { identity: scope(pack.product), evidence: refEvidence(key) });
      assert.ok(result.capabilities.every((cap) => cap.missing.length === 0 && cap.status === "requires_authoritative_server_verification"));
      assert.ok(result.capabilities.every((cap) => cap.executable === false));
      assert.equal(result.canActivate, false);
      assert.equal(result.canExecute, false);
    }
  });

  it("rejects malformed, oversized and non-hex source digests", () => {
    const evidence = refEvidence("creator_production");
    evidence.sourceSha256 = "z".repeat(64);
    const result = createIndustryPackagePreview("creator_production", { identity: scope("creator_studio"), evidence });
    assert.ok(result.capabilities.find((cap) => cap.name === "multitrack_handoff").missing.includes("sourceSha256"));
  });
});
