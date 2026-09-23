// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const { CONNECTION_STATES } = require("./sonara-connector-verification.cjs");

const CONNECTION_REGISTRY_VERSION = "1.0.0";
const CONNECTION_REGISTRY_RESEARCH_DATE = "2026-09-23";
const CONNECTION_REGISTRY_TABLE = "business_integration_connections";

const AUTH_TYPES = Object.freeze([
  "oauth2",
  "api_key",
  "service_account",
  "jwt_key",
  "basic",
  "webhook_secret",
  "managed_auth",
  "manual_export",
  "none"
]);

const CONNECTION_ENVIRONMENTS = Object.freeze([
  "development",
  "sandbox",
  "production"
]);

const CAPABILITY_STATES = Object.freeze([
  "unknown",
  "available",
  "limited",
  "scope_missing",
  "unavailable",
  "disabled",
  "deprecated"
]);

const HEALTH_STATES = Object.freeze([
  "unknown",
  "healthy",
  "degraded",
  "outage",
  "rate_limited"
]);

const DEPRECATION_STATES = Object.freeze([
  "none",
  "announced",
  "sunsetting",
  "retired"
]);

const CONNECTION_REGISTRY_FIELDS = Object.freeze([
  "organization_id",
  "business_id",
  "provider_key",
  "external_account_id",
  "auth_type",
  "credential_reference",
  "scopes",
  "environment",
  "capability_state",
  "provider_version",
  "expires_at",
  "health_state",
  "deprecation_state",
  "deprecation_at",
  "last_checked_at",
  "last_successful_sync_at",
  "last_reconciliation_at"
]);

// These are the typed fields the active business_integration_connections table
// still needs before it is sufficient as the shared SONARA connection registry.
// This module does not mutate the database. A separately generated, reviewed,
// replay-tested Supabase migration must own that change.
const CONNECTION_REGISTRY_SCHEMA_DELTA = Object.freeze([
  Object.freeze({ field: "external_account_id", type: "text", reason: "stable provider account/workspace/property/app identity" }),
  Object.freeze({ field: "auth_type", type: "text", reason: "separate OAuth, service-account, API-key, JWT-key, managed-auth, and manual authority paths" }),
  Object.freeze({ field: "scopes", type: "jsonb", reason: "persist exact granted scopes instead of a binary connected flag" }),
  Object.freeze({ field: "environment", type: "text", reason: "keep sandbox/development/production evidence distinct" }),
  Object.freeze({ field: "capability_state", type: "text", reason: "record whether the exact connection can perform the requested operation" }),
  Object.freeze({ field: "provider_version", type: "text", reason: "track API/adapter compatibility and provider drift" }),
  Object.freeze({ field: "expires_at", type: "timestamptz", reason: "surface credential or grant expiration before runtime failure" }),
  Object.freeze({ field: "health_state", type: "text", reason: "distinguish healthy, degraded, outage, and rate-limited behavior" }),
  Object.freeze({ field: "deprecation_state", type: "text", reason: "track announced/sunsetting/retired provider contracts" }),
  Object.freeze({ field: "deprecation_at", type: "timestamptz", reason: "make provider sunset deadlines queryable" }),
  Object.freeze({ field: "last_successful_sync_at", type: "timestamptz", reason: "measure sync freshness with evidence" }),
  Object.freeze({ field: "last_reconciliation_at", type: "timestamptz", reason: "measure convergence against provider state" })
]);

const FORBIDDEN_SECRET_KEYS = Object.freeze(new Set([
  "accesstoken",
  "refreshtoken",
  "idtoken",
  "clientsecret",
  "apikey",
  "privatekey",
  "password",
  "bearertoken",
  "authorizationheader",
  "oauthtoken"
]));

function normalizedKey(key) {
  return String(key || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function findForbiddenSecretPaths(value, prefix = "") {
  const paths = [];
  if (!value || typeof value !== "object") return paths;

  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (FORBIDDEN_SECRET_KEYS.has(normalizedKey(key))) paths.push(path);
    if (child && typeof child === "object") {
      paths.push(...findForbiddenSecretPaths(child, path));
    }
  }

  return paths;
}

function validDateOrNull(value) {
  return value == null || value === "" || Number.isFinite(Date.parse(String(value)));
}

function requiredString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validateConnectionRecord(record = {}) {
  const errors = [];
  const authType = String(record.auth_type || "");

  if (!requiredString(record.organization_id)) errors.push("organization_id_required");
  if (!requiredString(record.provider_key)) errors.push("provider_key_required");
  if (!requiredString(record.external_account_id)) errors.push("external_account_id_required");

  if (!AUTH_TYPES.includes(authType)) errors.push("valid_auth_type_required");
  if (!["manual_export", "none"].includes(authType) && !requiredString(record.credential_reference)) {
    errors.push("credential_reference_required");
  }

  if (!Array.isArray(record.scopes)) errors.push("scopes_array_required");
  else if (record.scopes.some((scope) => !requiredString(scope))) errors.push("valid_scopes_required");

  if (!CONNECTION_ENVIRONMENTS.includes(record.environment)) errors.push("valid_environment_required");
  if (!CAPABILITY_STATES.includes(record.capability_state)) errors.push("valid_capability_state_required");
  if (!requiredString(record.provider_version)) errors.push("provider_version_required");
  if (!validDateOrNull(record.expires_at)) errors.push("valid_expiration_required");
  if (!HEALTH_STATES.includes(record.health_state)) errors.push("valid_health_state_required");
  if (!DEPRECATION_STATES.includes(record.deprecation_state)) errors.push("valid_deprecation_state_required");
  if (!validDateOrNull(record.deprecation_at)) errors.push("valid_deprecation_at_required");

  if (record.deprecation_state !== "none" && !validDateOrNull(record.deprecation_at)) {
    errors.push("deprecation_date_required");
  }

  const secretPaths = findForbiddenSecretPaths(record);
  if (secretPaths.length) errors.push("raw_secret_material_forbidden");

  return Object.freeze({
    ok: errors.length === 0,
    errors: Object.freeze([...new Set(errors)]),
    forbiddenSecretPaths: Object.freeze(secretPaths)
  });
}

function deriveTruthfulConnectionState(input = {}) {
  if (input.disabled === true) return "disabled";
  if (input.available === false) return "unavailable";
  if (input.revoked === true) return "revoked";
  if (input.setupComplete === false) return "setup_required";
  if (input.reauthorizationRequired === true || input.credentialExpired === true) return "reauthorization_required";
  if (input.scopeMissing === true) return "scope_missing";
  if (input.schemaDrift === true) return "schema_drift";
  if (input.providerOutage === true || input.healthState === "outage") return "provider_outage";
  if (input.rateLimited === true || input.healthState === "rate_limited") return "rate_limited";
  if (input.budgetBlocked === true) return "budget_blocked";
  if (input.healthState === "degraded") return "degraded";
  if (input.capabilityState === "limited") return "limited";
  return "connected";
}

function getConnectionRegistryContract() {
  return Object.freeze({
    version: CONNECTION_REGISTRY_VERSION,
    observed: CONNECTION_REGISTRY_RESEARCH_DATE,
    databaseTarget: CONNECTION_REGISTRY_TABLE,
    tenantColumn: "organization_id",
    runtimeEnabled: false,
    grantsRuntimeAuthority: false,
    futureMigrationRequired: true,
    authTypes: AUTH_TYPES,
    environments: CONNECTION_ENVIRONMENTS,
    capabilityStates: CAPABILITY_STATES,
    healthStates: HEALTH_STATES,
    deprecationStates: DEPRECATION_STATES,
    publicConnectionStates: CONNECTION_STATES,
    requiredFields: CONNECTION_REGISTRY_FIELDS,
    schemaDelta: CONNECTION_REGISTRY_SCHEMA_DELTA,
    secretRule: "Persist only opaque credential references. Raw provider credentials, tokens, private keys, passwords, and authorization headers are forbidden."
  });
}

module.exports = {
  CONNECTION_REGISTRY_VERSION,
  CONNECTION_REGISTRY_RESEARCH_DATE,
  CONNECTION_REGISTRY_TABLE,
  AUTH_TYPES,
  CONNECTION_ENVIRONMENTS,
  CAPABILITY_STATES,
  HEALTH_STATES,
  DEPRECATION_STATES,
  CONNECTION_REGISTRY_FIELDS,
  CONNECTION_REGISTRY_SCHEMA_DELTA,
  findForbiddenSecretPaths,
  validateConnectionRecord,
  deriveTruthfulConnectionState,
  getConnectionRegistryContract
};
