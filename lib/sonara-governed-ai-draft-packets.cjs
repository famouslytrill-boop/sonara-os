// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// A deterministic context compiler for OPTIONAL AI assistance. Not an API call.
// Never feeds raw customer conversations, tenants' financial records, secret
// tokens or private media into a model. This refuses unrestricted legal agents.
// AI output is ALWAYS an unapproved internal draft, never signed or executed.
// Caller-provided facts/links are still UNVERIFIED; trusted route adapters must
// resolve each from a scoped database and approved law-source registry.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SOURCE_REF = /^src_[A-Za-z0-9_-]{8,100}$/;
const SAFE_FACT_NAMES = Object.freeze([
  "workspace", "plan_label", "price_minor_units", "renewal_period",
  "jurisdiction_code", "asset_reference", "model_reference",
  "rights_status", "contract_reference", "customer_action"
]);
const ALLOWED_DRAFT_TYPES = Object.freeze([
  "saas_terms_explanation", "creator_license_review_outline",
  "landlord_deposit_review_checklist", "media_provenance_disclosure",
  "growth_claims_review", "merchant_invoice_help"
]);
const SENSITIVE_PATTERNS = Object.freeze([
  /sk_(test|live)_[A-Za-z0-9_]+/i,
  /whsec_[A-Za-z0-9_]+/i,
  /\b\d{3}-\d{2}-\d{4}\b/,
  /\b(?:\d[ -]*?){13,19}\b/
]);
function compileDraftPacket({
  organizationId, authenticatedOrganizationId,
  draftType, ruleVersionRef, policySources = [],
  facts = {}, modelId, templateEnabled = true
} = {}) {
  const errors = [];
  if (!UUID.test(organizationId || "") || organizationId !== authenticatedOrganizationId)
    errors.push("tenant_scope_unverified");
  if (!ALLOWED_DRAFT_TYPES.includes(draftType)) errors.push("unknown_draft_template");
  if (typeof ruleVersionRef !== "string" || !/^rule_[A-Za-z0-9_-]{5,100}$/.test(ruleVersionRef))
    errors.push("policy_rule_version_missing");
  if (!Array.isArray(policySources) || !policySources.length || policySources.length > 8 ||
      policySources.some(x=>!SOURCE_REF.test(x))) errors.push("verified_source_registry_refs_required");
  if (typeof modelId !== "string" || !/^[A-Za-z0-9._:-]{3,120}$/.test(modelId))
    errors.push("model_version_required");
  if (!templateEnabled) errors.push("ai_template_not_approved");
  const cleaned = Object.create(null);
  if (!facts || typeof facts !== "object" || Array.isArray(facts)) {
    errors.push("structured_facts_required");
  } else {
    for (const [name, value] of Object.entries(facts)) {
      if (!SAFE_FACT_NAMES.includes(name)) { errors.push("unsupported_fact_" + name.slice(0,32)); continue; }
      if (typeof value !== "string" && typeof value !== "number") {
        errors.push("invalid_fact_value");continue;
      }
      const str = String(value);
      if (str.length > 160 || /[\x00-\x1F]/.test(str) ||
          SENSITIVE_PATTERNS.some(re=>re.test(str))) {
        errors.push("sensitive_or_unbounded_fact");
        continue;
      }
      if (name === "price_minor_units" && (!Number.isSafeInteger(value) || value < 0)) {
        errors.push("invalid_minor_unit_price");continue;
      }
      cleaned[name]=str;
    }
  }
  // Never hand the model an action plan that can execute regulated decisions.
  return Object.freeze({
    status: errors.length ? "blocked_pending_review" : "bounded_draft_packet",
    errors: Object.freeze(errors),
    draftType: ALLOWED_DRAFT_TYPES.includes(draftType) ? draftType : null,
    ruleVersionRef: errors.length ? null : ruleVersionRef,
    sourceRefs: errors.length ? Object.freeze([]) : Object.freeze([...policySources]),
    factFields: errors.length ? Object.freeze({}) : Object.freeze({...cleaned}),
    structuredOutputContract: Object.freeze({
      draft_text: "string", source_refs: "array_of_provided_source_refs",
      missing_facts: "string_array", human_review_flags: "string_array",
      uncertainty_notes: "string_array"
    }),
    instructions: "Draft educational material only. Never claim legal approval, invent statutory citations, certify ownership, advise on tenant eligibility, or authorize payment, signing, publication, legal notice or refunds. Mark facts without proof as unverified. Only cite approved source IDs supplied in this packet. No tools or web access.",
    modelRequestSent: false, aiOutputGenerated: false,
    publicationAuthorized: false, counselApprovalClaimed: false
  });
}
function reviewGeneratedDraft({ packet, generated } = {}) {
  const problems = [];
  if (!packet || packet.status !== "bounded_draft_packet") problems.push("approved_packet_missing");
  if (!generated || typeof generated !== "object" || Array.isArray(generated)) problems.push("unstructured_model_output");
  if (!problems.length) {
    if (typeof generated.draft_text !== "string" ||
        generated.draft_text.length < 1 || generated.draft_text.length > 16000)
      problems.push("model_draft_length_invalid");
    for (const field of ["source_refs", "missing_facts", "human_review_flags", "uncertainty_notes"]) {
      if (!Array.isArray(generated[field]) || generated[field].length > 25 ||
          generated[field].some(v=>typeof v !== "string" || v.length > 240)) {
        problems.push("model_output_field_invalid_" + field);
      }
    }
    if (Array.isArray(generated.source_refs) &&
        generated.source_refs.some(x=>!packet.sourceRefs.includes(x))) problems.push("unapproved_model_source_ref");
  }
  return Object.freeze({
    status: problems.length ? "quarantined_model_output" : "human_review_required",
    problems: Object.freeze(problems),
    safeToPublish: false, legalCorrectnessProven: false,
    allStatementsFactChecked: false, paymentAuthorized: false,
    modelOutputStillUntrusted: true
  });
}
module.exports = { ALLOWED_DRAFT_TYPES, SAFE_FACT_NAMES, compileDraftPacket, reviewGeneratedDraft };
