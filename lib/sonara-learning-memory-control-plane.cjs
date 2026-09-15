"use strict";

// SONARA learning/memory is deliberately a policy layer before it is a model
// feature. The repository already contains an older user-scoped
// sonara_memory_records schema and dormant entity_agent_memory tables. This
// module prevents those historical artifacts from being described as a live,
// organization-scoped semantic-memory product before the runtime and migration
// actually exist.

const MEMORY_CLASSES = Object.freeze([
  memoryClass({ key: "operational_fact", retention: "workspace_record_lifecycle", approval: "record_authority", embedding: "allowed_after_provider_review" }),
  memoryClass({ key: "owner_preference", retention: "until_changed_or_deleted", approval: "explicit_owner_or_user", embedding: "allowed_after_provider_review" }),
  memoryClass({ key: "approved_pattern", retention: "reviewed_learning_window", approval: "human_review", embedding: "allowed_after_provider_review" }),
  memoryClass({ key: "product_feedback", retention: "feedback_retention_policy", approval: "source_and_purpose_required", embedding: "allowed_after_provider_review" }),
  memoryClass({ key: "research_evidence", retention: "research_provenance_policy", approval: "source_grounded", embedding: "allowed_after_provider_review" }),
  memoryClass({ key: "ephemeral_context", retention: "request_or_session_only", approval: "none", embedding: "not_persisted" })
]);

const BLOCKED_SENSITIVITY = Object.freeze(new Set([
  "password",
  "access_token",
  "refresh_token",
  "api_key",
  "service_role_key",
  "raw_card_data",
  "cvv",
  "private_key",
  "authentication_secret"
]));

const REVIEW_SENSITIVITY = Object.freeze(new Set([
  "personal_data",
  "financial_data",
  "health_data",
  "legal_data",
  "precise_location",
  "biometric_data",
  "voice_identity",
  "government_identifier"
]));

function evaluateMemoryCandidate(input = {}) {
  const memoryClassKey = String(input.memoryClass || "").trim();
  const definition = MEMORY_CLASSES.find((item) => item.key === memoryClassKey);
  const organizationId = String(input.organizationId || "").trim();
  const source = String(input.source || "").trim();
  const sensitivity = String(input.sensitivity || "none").trim().toLowerCase();
  const userApproved = input.userApproved === true;
  const purpose = String(input.purpose || "").trim();

  if (!definition) return decision("blocked", "unknown_memory_class", false);
  if (definition.key === "ephemeral_context") {
    return {
      ...decision("ephemeral_only", "session_context_is_not_persisted", false),
      memoryClass: definition.key,
      retention: definition.retention
    };
  }
  if (!organizationId) return decision("blocked", "organization_scope_required", false);
  if (!source) return decision("review_required", "source_provenance_required", false);
  if (!purpose) return decision("review_required", "purpose_required", false);
  if (BLOCKED_SENSITIVITY.has(sensitivity)) return decision("blocked", "credential_or_payment_secret_must_not_be_learned", false);
  if (REVIEW_SENSITIVITY.has(sensitivity) && !userApproved) {
    return decision("review_required", "sensitive_memory_requires_explicit_approval", false);
  }
  if ((definition.key === "owner_preference" || definition.key === "approved_pattern") && !userApproved) {
    return decision("review_required", "preference_or_pattern_requires_explicit_approval", false);
  }

  return {
    ...decision("retain_candidate", "policy_allows_reviewed_retention", true),
    memoryClass: definition.key,
    retention: definition.retention,
    approval: definition.approval,
    source,
    purpose,
    organizationId,
    sensitivity,
    embeddingPolicy: definition.embedding
  };
}

function getLearningMemoryControlPlane(env = process.env) {
  const embeddingProvider = String(env.SONARA_EMBEDDING_PROVIDER || "").trim();
  const embeddingModel = String(env.SONARA_EMBEDDING_MODEL || "").trim();
  const semanticConfigured = Boolean(embeddingProvider && embeddingModel);

  return {
    ok: true,
    mode: "governed_learning_memory_control_plane",
    memoryClassCount: MEMORY_CLASSES.length,
    memoryClasses: MEMORY_CLASSES.map(clone),
    currentState: {
      projectAgentMemory: {
        status: "repository_native",
        path: ".ai/shared/PROJECT_MEMORY.md",
        scope: "development_project_facts",
        runtimeCustomerMemory: false
      },
      legacyVectorMemorySchema: {
        status: "schema_present_runtime_not_current",
        table: "sonara_memory_records",
        scope: "legacy_user_scoped",
        note: "Existing schema stores text/metadata and optional embedding, but it is not the current organization-scoped learning runtime."
      },
      entityAgentMemory: {
        status: "schema_present_runtime_inactive",
        table: "entity_agent_memory",
        note: "Database artifacts exist, but current runtime evidence does not establish active agent-memory reads/writes."
      },
      organizationLearningRuntime: {
        status: "design_and_policy_ready_runtime_not_enabled",
        requirement: "organization-scoped persistence, provenance, retention, approval, deletion/export, audit, and provider-verified semantic retrieval"
      },
      semanticRetrieval: {
        status: semanticConfigured ? "configured_requires_runtime_verification" : "not_configured",
        provider: embeddingProvider || null,
        model: embeddingModel || null,
        executionEnabledByThisModule: false
      }
    },
    learningLoop: [
      "observe an authorized record/outcome/feedback signal",
      "classify memory purpose and sensitivity",
      "require organization scope and provenance",
      "require explicit approval for preferences/patterns and sensitive memory",
      "retain only through an approved storage runtime",
      "retrieve with tenant scope and explainable provenance",
      "expire, correct, export, or delete according to retention/user controls",
      "never convert remembered context into authority for consequential actions"
    ],
    blockedMemory: [...BLOCKED_SENSITIVITY],
    reviewRequiredMemory: [...REVIEW_SENSITIVITY],
    providerStrategy: {
      preferredFoundation: "Supabase Postgres + pgvector when an embedding model/dimension is approved",
      alternatives: ["Qdrant", "Chroma", "Milvus", "Weaviate", "Faiss local"],
      rule: "Embedding providers are optional; deterministic text/metadata memory and record checks must continue to work without them."
    },
    boundaries: [
      "No cross-tenant memory or retrieval.",
      "No secrets, raw card/CVV data, passwords, access tokens, private keys, or service-role credentials may become learned memory.",
      "Preferences and personalization must be explainable, editable, exportable where applicable, and removable.",
      "Sensitive memory requires explicit reviewed purpose and user/owner approval.",
      "Memory does not bypass agent authority, owner approval, payment, campaign, publication, security, or release gates.",
      "This module does not claim semantic retrieval is live and does not write database rows."
    ],
    productionExecutionAdded: 0
  };
}

function memoryClass(input) {
  return Object.freeze({ humanReviewRequired: true, canExecuteFromRecord: false, ...input });
}

function decision(status, reason, persistable) {
  return { ok: status !== "blocked", status, reason, persistable };
}

function clone(value) {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(clone);
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]));
}

module.exports = {
  MEMORY_CLASSES,
  BLOCKED_SENSITIVITY,
  REVIEW_SENSITIVITY,
  evaluateMemoryCandidate,
  getLearningMemoryControlPlane
};
