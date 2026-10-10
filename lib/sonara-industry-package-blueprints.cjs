// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Read-only industry composition. Evidence is caller-supplied and MUST be checked
// against authenticated tenant, provider receipts and durable records by the
// server before any activation. This module cannot authorize side effects.
const { validateWorkflow } = require("./sonara-workflow-planner.cjs");
const { planMediaWorkflow } = require("./sonara-creator-media-workflows.cjs");

const PACKAGES = Object.freeze({
  creator_production: Object.freeze({
    product: "creator_studio",
    audience: "music_video_creators",
    tables: Object.freeze(["creator_assets", "creator_releases", "merchant_products", "organization_entitlements"]),
    workflow: Object.freeze({ medium: "mixed", name: "Creator production and licensed handoff", steps: [
      "create_daw_export_plan", "package_release", "publish_release"
    ] }),
    capabilities: Object.freeze({
      multitrack_handoff: Object.freeze(["sourceAssetRef", "sourceSha256", "timelineValidationRef", "rightsRef"]),
      render_job: Object.freeze(["mediaWorkerRef", "computeBudgetRef", "rightsRef"]),
      license_package: Object.freeze(["rightsRef", "licenseTermsRef", "licenseApprovalRef"]),
      private_digital_delivery: Object.freeze(["buyerRef", "licenseGrantRef", "verifiedPaymentReceiptRef", "privateAssetRef"])
    }),
    approval: Object.freeze(["publish_release", "license_grant", "customer_delivery"])
  }),
  social_business: Object.freeze({
    product: "growth_studio",
    audience: "social_media_businesses",
    tables: Object.freeze(["organization_integrations", "growth_campaigns", "user_notifications", "organization_entitlements"]),
    workflow: Object.freeze({ name: "Reviewed social content publishing", trigger: "content_ready", autonomy: "safe_automatic", steps: [
      { action: "create_task" }, { action: "publish_content" }
    ] }),
    capabilities: Object.freeze({
      moderated_feed: Object.freeze(["communityRef", "moderationPolicyRef", "reportingAndBlockingProofRef"]),
      community_analytics: Object.freeze(["analyticsSourceRef", "privacyNoticeRef", "metricsEvidenceRef"]),
      publishing_connector: Object.freeze(["contentRef", "ownerApprovalRef", "providerConnectionRef", "providerPermissionRef", "moderationReceiptRef"])
    }),
    approval: Object.freeze(["publish_content", "customer_campaign", "moderation_override"])
  }),
  independent_professional: Object.freeze({
    product: "business_builder",
    audience: "independent_professionals",
    tables: Object.freeze(["business_appointments", "contact_records", "organization_entitlements", "payments"]),
    workflow: Object.freeze({ name: "Reviewed appointment offer", trigger: "booking_requested", autonomy: "safe_automatic", steps: [
      { action: "prepare_booking_offer" }, { action: "notify_customer" }
    ] }),
    capabilities: Object.freeze({
      booking_offer: Object.freeze(["clientRef", "serviceRef", "availabilitySnapshotRef", "contactConsentRef"]),
      quote_document: Object.freeze(["clientRef", "itemizedQuoteRef", "termsVersionRef"]),
      customer_workspace: Object.freeze(["clientRef", "privacyNoticeRef", "ownerAccessPolicyRef"])
    }),
    approval: Object.freeze(["notify_customer", "charge_payment", "contract_publication"])
  })
});

// Freeze nested workflow steps and capability arrays: previews must not acquire
// new actions through mutable shared catalogue objects.
function freezeDeep(value) {
  if (value && typeof value === "object") {
    for (const entry of Object.values(value)) freezeDeep(entry);
    Object.freeze(value);
  }
  return value;
}
freezeDeep(PACKAGES);

const ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,159}$/;
const SHA256_PATTERN = /^[a-fA-F0-9]{64}$/;
const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
const plain = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const validRef = (value) => typeof value === "string" && ID_PATTERN.test(value);

function createIndustryPackagePreview(packageKey, context = {}) {
  if (!own(PACKAGES, packageKey)) return { ok: false, code: "unknown_industry_package" };
  if (!plain(context)) return { ok: false, code: "invalid_industry_context" };
  const pack = PACKAGES[packageKey];
  const identity = plain(context.identity) ? context.identity : {};
  const facts = plain(context.evidence) ? context.evidence : {};
  const entitledProducts = Array.isArray(identity.entitledProducts) ? identity.entitledProducts : [];
  const commonMissing = [];
  if (!validRef(identity.organizationId) || identity.organizationId !== identity.actorOrganizationId) {
    commonMissing.push("authenticated_tenant_scope");
  }
  if (!entitledProducts.includes(pack.product)) commonMissing.push("verified_product_entitlement");

  const capabilities = Object.entries(pack.capabilities).map(([name, required]) => {
    const missing = [...commonMissing];
    for (const field of required) {
      const valid = field === "sourceSha256" ? typeof facts[field] === "string" && SHA256_PATTERN.test(facts[field]) : validRef(facts[field]);
      if (!valid) missing.push(field);
    }
    return {
      name,
      missing,
      status: missing.length ? "missing_evidence" : "requires_authoritative_server_verification",
      executable: false
    };
  });

  const planned = packageKey === "creator_production"
    ? planMediaWorkflow(pack.workflow)
    : validateWorkflow(pack.workflow);
  if (!planned.ok) return { ok: false, code: "invalid_package_workflow", detail: planned.code };
  const workflow = packageKey === "creator_production" ? planned.plan : planned.workflow;

  return {
    ok: true,
    packageKey,
    product: pack.product,
    audience: pack.audience,
    canonicalTables: [...pack.tables],
    capabilities,
    workflow,
    ownerReviewActions: [...pack.approval],
    launchState: "template_only",
    sourceEvidenceIsAuthoritative: false,
    canActivate: false,
    canExecute: false,
    canPublish: false,
    canDeliverPaidAssets: false
  };
}

module.exports = { PACKAGES, createIndustryPackagePreview };
