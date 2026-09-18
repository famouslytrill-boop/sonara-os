// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// This module reports evidence and gaps.  It is intentionally not a compliance
// engine and never emits a "compliant" or "certified" state.  External
// frameworks require legal, operational, and often independent assessment that
// cannot be inferred from environment variables or a code scan.

const CONTROL_STAGES = Object.freeze([
  Object.freeze({
    key: "visibility",
    label: "1. Visibility",
    purpose: "Know what systems, providers, records, and access paths exist and whether they can be observed.",
    evidence: Object.freeze([
      "organization-scoped audit_events and permission audit structures",
      "provider registries and provider readiness metadata",
      "tenant-scoped database contract and readiness probes"
    ]),
    permanentGaps: Object.freeze([
      "A configuration check does not prove continuous monitoring coverage.",
      "The current codebase does not prove that every AI/provider call emits a complete provider/request audit event."
    ])
  }),
  Object.freeze({
    key: "protect_localize",
    label: "2. Protect and localize data",
    purpose: "Enforce least privilege, secret boundaries, protected payment handling, and explicit data-location decisions.",
    evidence: Object.freeze([
      "tenant isolation and server-side authorization boundaries",
      "server-only service-role/provider secret policy",
      "Stripe-hosted card handling with no raw card or CVV storage"
    ]),
    permanentGaps: Object.freeze([
      "Data residency and cross-border transfer posture is not verified for every provider and storage path.",
      "No code-only check can establish jurisdiction-specific legal compliance."
    ])
  }),
  Object.freeze({
    key: "governance",
    label: "3. Governance",
    purpose: "Keep provider choice, consequential actions, retention, access, and lifecycle decisions explicit and reviewable.",
    evidence: Object.freeze([
      "Provider Gateway or reviewed server-side adapter boundary",
      "owner approval for consequential agent actions",
      "account data export/erasure request surfaces and legal-review boundary"
    ]),
    permanentGaps: Object.freeze([
      "Retention and deletion rules still require provider-by-provider operational verification.",
      "A governance policy in source code is not evidence that every external system enforces it."
    ])
  }),
  Object.freeze({
    key: "audit_reporting",
    label: "4. Audit and reporting",
    purpose: "Preserve enough trustworthy evidence to explain who did what, through which provider, with what outcome.",
    evidence: Object.freeze([
      "organization-scoped audit event tables",
      "admin and business control-plane audit writers",
      "release, security, and readiness evidence gates"
    ]),
    permanentGaps: Object.freeze([
      "Generative-AI audit coverage is partial until provider/model, outcome/error, timing, and redacted request provenance are emitted consistently.",
      "Independent audit or certification evidence is not produced by this readiness model."
    ])
  })
]);

function normalizeStatus(value) {
  return ["configured", "enabled", "owner_approved"].includes(String(value || "")) ? "configured" : "setup_required";
}

function stageStatus(stage, services) {
  const database = normalizeStatus(services.accountDatabase || services.supabase);
  const admin = normalizeStatus(services.adminProtection || services.founderAccess);
  const payments = normalizeStatus(services.paymentConnection || services.stripe);

  if (stage.key === "visibility") {
    return database === "configured" && admin === "configured" ? "partial_evidence" : "setup_required";
  }
  if (stage.key === "protect_localize") {
    return admin === "configured" && payments === "configured" ? "partial_evidence" : "review_required";
  }
  if (stage.key === "governance") {
    return admin === "configured" ? "partial_evidence" : "review_required";
  }
  if (stage.key === "audit_reporting") {
    return database === "configured" ? "partial_evidence" : "setup_required";
  }
  return "review_required";
}

function getComplianceEvidenceReadiness(platformReadiness = {}) {
  const services = platformReadiness && typeof platformReadiness.services === "object"
    ? platformReadiness.services
    : {};

  const stages = CONTROL_STAGES.map((stage) => ({
    key: stage.key,
    label: stage.label,
    purpose: stage.purpose,
    status: stageStatus(stage, services),
    evidence: [...stage.evidence],
    gaps: [...stage.permanentGaps],
    certificationClaim: false
  }));

  return {
    ok: true,
    mode: "evidence_and_gap_readiness",
    frameworkAlignment: "implementation guidance only",
    certificationStatus: "not_assessed",
    complianceClaim: false,
    stages,
    counts: {
      partialEvidence: stages.filter((stage) => stage.status === "partial_evidence").length,
      reviewRequired: stages.filter((stage) => stage.status === "review_required").length,
      setupRequired: stages.filter((stage) => stage.status === "setup_required").length
    },
    boundaries: [
      "This output is not legal advice, an audit opinion, or a certification.",
      "Configured infrastructure is evidence of setup, not proof that a regulatory control is operating effectively.",
      "No stage may be rendered as compliant or certified from this function."
    ]
  };
}

module.exports = {
  CONTROL_STAGES,
  getComplianceEvidenceReadiness
};
