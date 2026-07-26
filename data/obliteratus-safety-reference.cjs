"use strict";

const OBLITERATUS_SAFETY_REFERENCE = Object.freeze({
  id: "elder-plinius-obliteratus",
  name: "OBLITERATUS",
  repository: "elder-plinius/OBLITERATUS",
  repositoryUrl: "https://github.com/elder-plinius/OBLITERATUS",
  pinnedCommit: "a5a1ffa5849b442cf188b3c03fd4de71ddf5bdcc",
  upstreamLicense: "AGPL-3.0 with upstream commercial-license option",
  licenseRisk: "critical_for_proprietary_saas",
  sourcePurpose: "Alignment research toolkit that analyzes and removes model refusal behavior.",
  sonaraPurpose: "Defensive reference for refusal-integrity testing, model-change governance, and safety-resilience review only.",
  integrationMode: "quarantined_reference_only",
  status: "blocked_from_runtime_execution",
  codeCopied: false,
  packageInstalled: false,
  runtimeDependency: false,
  remoteAdapterEnabled: false,
  telemetryEnabled: false,
  customerDataAllowed: false,
  modelWeightModificationAllowed: false,
  modelExportAllowed: false,
  allowedUses: Object.freeze([
    "Study high-level model-safety and mechanistic-interpretability risk categories.",
    "Design defensive refusal-integrity and alignment-regression evaluations.",
    "Review proposed model changes for safety, licensing, privacy, provenance, and supply-chain risk.",
    "Compare safety metrics on unmodified, owner-authorized models in an isolated future research environment.",
    "Inform human-reviewed AI governance policy and incident-response planning."
  ]),
  blockedUses: Object.freeze([
    "Removing, weakening, bypassing, suppressing, or steering around model safety or refusal behavior.",
    "Running upstream obliteration, ablation, excision, liberation, uncensoring, or guardrail-removal pipelines.",
    "Uploading customer prompts, outputs, datasets, tokens, credentials, or model artifacts to upstream telemetry or Hugging Face Spaces.",
    "Exporting, publishing, pushing, distributing, selling, or serving modified or safety-disabled model weights.",
    "Giving customer-facing agents access to uncensored or deliberately de-aligned models.",
    "Installing AGPL code inside SONARA's proprietary production runtime without separate legal approval.",
    "Autonomous GPU jobs, shell execution, repository cloning, model downloads, or network calls from customer requests."
  ]),
  activationRequirements: Object.freeze([
    "Founder approval and documented business justification.",
    "Independent legal review of AGPL and commercial-license obligations.",
    "AI safety and abuse-risk review.",
    "Isolated worker design with no production secrets or customer data.",
    "Telemetry disabled and outbound network allowlist enforced.",
    "Model license, dataset rights, provenance, and artifact hash verification.",
    "Human-reviewed test plan, rollback plan, incident response, and audit logging.",
    "A separate pull request proving the use is defensive and does not weaken safeguards."
  ])
});

const MODEL_SAFETY_CONTROL_AREAS = Object.freeze([
  Object.freeze({
    slug: "refusal-integrity",
    title: "Refusal integrity",
    purpose: "Detect whether a model update weakens established safety behavior without authorizing guardrail removal.",
    evidence: Object.freeze(["baseline refusal tests", "post-change refusal tests", "capability regression tests", "human safety review"])
  }),
  Object.freeze({
    slug: "artifact-provenance",
    title: "Model artifact provenance",
    purpose: "Require known model licenses, checksums, source repositories, datasets, and modification history.",
    evidence: Object.freeze(["model card", "license record", "artifact hash", "dependency and dataset inventory"])
  }),
  Object.freeze({
    slug: "privacy-egress",
    title: "Privacy and egress",
    purpose: "Prevent prompts, outputs, credentials, datasets, and model artifacts from leaving approved boundaries.",
    evidence: Object.freeze(["telemetry disabled", "network allowlist", "secret scan", "data-retention policy"])
  }),
  Object.freeze({
    slug: "isolated-compute",
    title: "Isolated compute",
    purpose: "Keep experimental GPU work outside the customer request path and away from production credentials.",
    evidence: Object.freeze(["container boundary", "non-production credentials", "resource limits", "job audit record"])
  }),
  Object.freeze({
    slug: "human-approval",
    title: "Human approval",
    purpose: "Require explicit review before model changes, exports, publishing, or deployment.",
    evidence: Object.freeze(["named reviewer", "approved scope", "rollback owner", "change record"])
  }),
  Object.freeze({
    slug: "license-boundary",
    title: "License boundary",
    purpose: "Prevent AGPL or commercial-license obligations from being silently introduced into proprietary production services.",
    evidence: Object.freeze(["legal decision", "dependency placement", "source-disclosure assessment", "commercial license if required"])
  })
]);

module.exports = {
  OBLITERATUS_SAFETY_REFERENCE,
  MODEL_SAFETY_CONTROL_AREAS
};
