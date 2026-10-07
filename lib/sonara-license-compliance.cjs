// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// License/provenance decision support. "Open source", "AI generated", or
// "customer supplied" never means unrestricted. No function grants rights.
const SHA256 = /^[a-f0-9]{64}$/i;
const SPDX_ID = /^(?:[A-Za-z0-9.-]+|LicenseRef-[A-Za-z0-9.-]+)$/;
const RIGHTS_BASES = new Set([
  "proprietary_owned",
  "commercial_license",
  "open_source",
  "public_domain_verified",
  "customer_provided_with_attestation",
  "provider_terms"
]);

function nonempty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function licenseIntakeGate({
  componentName,
  versionOrDigest,
  rightsBasis,
  spdxId = null,
  spdxRegistryVerified = false,
  licenseTextOrCanonicalUrlRecorded = false,
  attributionRequired = false,
  attributionRecorded = false,
  noticesRequired = false,
  noticesRecorded = false,
  reciprocalObligationsReviewed = false,
  sourceDisclosureObligationReviewed = false,
  patentTermsReviewed = false,
  commercialUseReviewed = false,
  modificationReviewed = false,
  redistributionReviewed = false,
  providerTermsReviewed = false,
  customerRightsAttested = false
} = {}) {
  const blockers = [];
  if (!nonempty(componentName)) blockers.push("component_name_missing");
  if (!nonempty(versionOrDigest)) blockers.push("component_version_or_digest_missing");
  if (!RIGHTS_BASES.has(rightsBasis)) blockers.push("rights_basis_unknown");

  if (rightsBasis === "open_source") {
    if (!SPDX_ID.test(spdxId || "")) blockers.push("spdx_identifier_invalid_or_missing");
    if (spdxRegistryVerified !== true) blockers.push("spdx_registry_match_unverified");
    if (licenseTextOrCanonicalUrlRecorded !== true)
      blockers.push("license_text_or_canonical_url_missing");
    if (reciprocalObligationsReviewed !== true) blockers.push("reciprocal_obligations_unreviewed");
    if (sourceDisclosureObligationReviewed !== true)
      blockers.push("source_disclosure_obligation_unreviewed");
    if (patentTermsReviewed !== true) blockers.push("patent_terms_unreviewed");
  }

  if (rightsBasis === "commercial_license" || rightsBasis === "provider_terms") {
    if (providerTermsReviewed !== true) blockers.push("commercial_or_provider_terms_unreviewed");
  }

  if (rightsBasis === "customer_provided_with_attestation" && customerRightsAttested !== true)
    blockers.push("customer_rights_attestation_missing");

  if (attributionRequired === true && attributionRecorded !== true)
    blockers.push("required_attribution_missing");
  if (noticesRequired === true && noticesRecorded !== true)
    blockers.push("required_notice_missing");
  if (commercialUseReviewed !== true) blockers.push("commercial_use_scope_unreviewed");
  if (modificationReviewed !== true) blockers.push("modification_scope_unreviewed");
  if (redistributionReviewed !== true) blockers.push("redistribution_scope_unreviewed");

  return Object.freeze({
    state: blockers.length ? "license_review_blocked" : "license_intake_evidence_ready",
    blockers: Object.freeze([...new Set(blockers)]),
    rightsGrantedByEngine: false,
    legalConclusion: false,
    licenseCompatibilityCertified: false
  });
}

function distributionLicenseGate({
  releaseArtifactHash,
  components = [],
  sbomGenerated = false,
  noticesBundleGenerated = false,
  reciprocalBoundaryVerified = false,
  sourceOfferPlanReviewed = false,
  customerFacingAttributionReady = false
} = {}) {
  const blockers = [];
  if (!SHA256.test(releaseArtifactHash || "")) blockers.push("release_artifact_hash_invalid");
  if (!Array.isArray(components) || components.length === 0) blockers.push("component_inventory_missing");
  for (const row of Array.isArray(components) ? components : []) {
    if (!row || row.intakeState !== "license_intake_evidence_ready")
      blockers.push("component_license_intake_incomplete");
    if (!row || row.distributionReviewed !== true) blockers.push("component_distribution_scope_unreviewed");
    if (!row || row.obligationsFulfilled !== true) blockers.push("component_license_obligations_unfulfilled");
  }
  if (sbomGenerated !== true) blockers.push("sbom_not_generated");
  if (noticesBundleGenerated !== true) blockers.push("third_party_notices_bundle_missing");
  if (reciprocalBoundaryVerified !== true) blockers.push("reciprocal_license_boundary_unverified");
  if (sourceOfferPlanReviewed !== true) blockers.push("source_offer_or_source_delivery_plan_unreviewed");
  if (customerFacingAttributionReady !== true) blockers.push("customer_attribution_surface_not_ready");

  return Object.freeze({
    state: blockers.length ? "distribution_license_blocked" : "distribution_license_evidence_ready",
    blockers: Object.freeze([...new Set(blockers)]),
    releaseAuthorized: false,
    legalComplianceCertified: false
  });
}

function aiAssetRightsGate({
  assetHash,
  inputRightsEvidenceRecorded = false,
  modelOrProviderTermsReviewed = false,
  modelIdentifier,
  humanExpressiveContributionRecorded = false,
  copyrightClaimRequested = false,
  externalLikenessOrVoice = false,
  likenessConsentRecorded = false,
  customerPublicationApproved = false
} = {}) {
  const blockers = [];
  if (!SHA256.test(assetHash || "")) blockers.push("asset_hash_invalid");
  if (inputRightsEvidenceRecorded !== true) blockers.push("input_rights_evidence_missing");
  if (modelOrProviderTermsReviewed !== true) blockers.push("model_or_provider_terms_unreviewed");
  if (!nonempty(modelIdentifier)) blockers.push("model_identifier_missing");
  if (externalLikenessOrVoice === true && likenessConsentRecorded !== true)
    blockers.push("likeness_or_voice_consent_missing");
  if (copyrightClaimRequested === true && humanExpressiveContributionRecorded !== true)
    blockers.push("human_authorship_evidence_missing_for_copyright_claim");
  if (customerPublicationApproved !== true) blockers.push("customer_publication_approval_missing");

  return Object.freeze({
    state: blockers.length ? "ai_asset_rights_review_blocked" : "ai_asset_rights_evidence_ready",
    blockers: Object.freeze([...new Set(blockers)]),
    copyrightOwnershipCertified: false,
    publicationAuthorized: false,
    promptsAloneTreatedAsHumanAuthorship: false
  });
}

module.exports = {
  RIGHTS_BASES,
  licenseIntakeGate,
  distributionLicenseGate,
  aiAssetRightsGate
};
