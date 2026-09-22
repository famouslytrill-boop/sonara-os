// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Clean-room strategy extraction from the 22 September screenshot/repository
// research. These are repository-owned patterns, not imported third-party
// skills. Records are descriptive and never grant execution authority.

const SCREENSHOT_DERIVED_STRATEGIES = Object.freeze([
  Object.freeze({
    key: "typed_fast_decision",
    purpose: "Use a constrained choice/score model lane for high-volume triage only after deterministic rules prove insufficient.",
    sequence: Object.freeze(["define_labels", "deterministic_baseline", "offline_eval", "calibrate", "abstain", "verify", "observe"]),
    guardrails: Object.freeze([
      "typed outputs only",
      "abstain below confidence/calibration threshold",
      "no consequential authorization from score alone",
      "record model/version/evaluation evidence"
    ]),
    canExecuteFromRecord: false,
    humanReviewRequired: true
  }),
  Object.freeze({
    key: "minimal_change_ladder",
    purpose: "Prefer the smallest repository-owned change that satisfies the requirement while preserving safety/correctness.",
    sequence: Object.freeze(["does_need_exist", "reuse_existing", "stdlib_or_platform", "existing_dependency", "small_local_change", "new_dependency_last"]),
    guardrails: Object.freeze([
      "never remove trust-boundary validation",
      "never trade away accessibility or data-loss protection",
      "tests and release evidence remain required"
    ]),
    canExecuteFromRecord: false,
    humanReviewRequired: true
  }),
  Object.freeze({
    key: "curated_skill_supply_chain",
    purpose: "Treat agent skills as reviewed supply-chain inputs rather than arbitrary prompt files.",
    sequence: Object.freeze(["detect_stack_locally", "approved_registry", "review", "hash_manifest", "dry_run", "approve", "lock", "drift_check"]),
    guardrails: Object.freeze([
      "no live random repository install",
      "hash every approved artifact",
      "record source and version",
      "skills never grant tool/account authority"
    ]),
    canExecuteFromRecord: false,
    humanReviewRequired: true
  }),
  Object.freeze({
    key: "versioned_memory",
    purpose: "Make agent memory mutations provenance-aware, reversible and conflict-aware.",
    sequence: Object.freeze(["tenant_scope", "provenance", "confidence", "revision", "retrieve", "contradiction_check", "supersede_or_rollback"]),
    guardrails: Object.freeze([
      "no cross-tenant memory",
      "secrets and credentials excluded",
      "authoritative business data outranks inferred memory",
      "support deletion and rollback"
    ]),
    canExecuteFromRecord: false,
    humanReviewRequired: true
  }),
  Object.freeze({
    key: "browser_action_index",
    purpose: "Constrain browser agents to explicit operation/target choices and independently verify completion.",
    sequence: Object.freeze(["authorized_destination", "observe", "enumerate_actions", "choose_typed_action", "execute", "read_back", "verify_postcondition"]),
    guardrails: Object.freeze([
      "no CAPTCHA or access-control bypass",
      "writes/purchases/publishing need approval",
      "DONE is never success evidence by itself",
      "bounded retries/time/cost"
    ]),
    canExecuteFromRecord: false,
    humanReviewRequired: true
  }),
  Object.freeze({
    key: "financial_truth_before_narrative",
    purpose: "Calculate and reconcile financial KPIs before any model-generated explanation or recommendation.",
    sequence: Object.freeze(["source_lineage", "normalize", "classify", "reconcile", "deterministic_formula", "quality_flags", "scenario", "optional_narrative"]),
    guardrails: Object.freeze([
      "no invented numbers",
      "estimates labeled with assumptions",
      "no autonomous money movement/trading/credit decisions",
      "human decision remains separate"
    ]),
    canExecuteFromRecord: false,
    humanReviewRequired: true
  }),
  Object.freeze({
    key: "premium_ui_evidence_review",
    purpose: "Review design through structure, hierarchy, spacing, state clarity, restrained motion, accessibility and performance evidence.",
    sequence: Object.freeze(["page_job", "structure", "typography", "spacing", "states", "motion", "responsive", "accessibility", "performance", "proof"]),
    guardrails: Object.freeze([
      "SONARA tokens remain authoritative",
      "external references are not copied",
      "no subjective beauty score",
      "state clarity before decorative polish"
    ]),
    canExecuteFromRecord: false,
    humanReviewRequired: true
  }),
  Object.freeze({
    key: "automation_recovery",
    purpose: "Design workflows so partial failure does not turn the operator into the hidden retry engine.",
    sequence: Object.freeze(["idempotency_key", "checkpoint", "execute", "postcondition", "bounded_retry", "dead_letter_or_escalate", "safe_replay"]),
    guardrails: Object.freeze([
      "bounded retries/backoff",
      "observable failure state",
      "no duplicate consequential effects",
      "human escalation when recovery is ambiguous"
    ]),
    canExecuteFromRecord: false,
    humanReviewRequired: true
  })
]);

function getScreenshotDerivedStrategies() {
  return {
    ok: true,
    mode: "clean_room_repository_owned_strategy_catalog",
    strategyCount: SCREENSHOT_DERIVED_STRATEGIES.length,
    sourceBatch: 17,
    canExecuteFromRecord: false,
    strategies: SCREENSHOT_DERIVED_STRATEGIES.map((item) => ({
      ...item,
      sequence: [...item.sequence],
      guardrails: [...item.guardrails]
    }))
  };
}

module.exports = {
  SCREENSHOT_DERIVED_STRATEGIES,
  getScreenshotDerivedStrategies
};
