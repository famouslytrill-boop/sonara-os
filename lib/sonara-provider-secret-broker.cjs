// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAFE_KEY = /^[a-z0-9][a-z0-9._:-]{1,119}$/i;
const OPAQUE_REFERENCE = /^(?:vault|secret|kms|provider|managed):\/\/[A-Za-z0-9._~:/-]{3,240}$/;
const MAX_SECRET_BYTES = 64 * 1024;

function required(value, field) {
  const out = String(value == null ? "" : value).trim();
  if (!out) throw new TypeError(`${field} is required`);
  return out;
}

function brokerContext(input = {}) {
  const organizationId = required(input.organizationId, "organizationId");
  const businessId = required(input.businessId, "businessId");
  const userId = required(input.userId, "userId");
  const connectionId = required(input.connectionId, "connectionId");
  const providerKey = required(input.providerKey, "providerKey");
  for (const [field, value] of Object.entries({ organizationId, businessId, userId, connectionId })) {
    if (!UUID.test(value)) throw new TypeError(`${field} must be a UUID`);
  }
  if (!SAFE_KEY.test(providerKey)) throw new TypeError("providerKey is invalid");
  return Object.freeze({ organizationId, businessId, userId, connectionId, providerKey });
}

function secretValue(value) {
  if (typeof value !== "string" || value.length < 1) throw new TypeError("secret must be a non-empty string");
  if (Buffer.byteLength(value, "utf8") > MAX_SECRET_BYTES) {
    throw new RangeError(`secret exceeds ${MAX_SECRET_BYTES} bytes`);
  }
  return value;
}

function credentialReference(value) {
  const out = String(value == null ? "" : value).trim();
  if (!OPAQUE_REFERENCE.test(out)) throw new TypeError("opaque credential reference required");
  return out;
}

function outputContainsSecret(output, secret) {
  if (output == null) return false;
  if (typeof output === "string") return output.includes(secret);
  try { return JSON.stringify(output).includes(secret); }
  catch { return true; }
}

async function storeProviderCredential({
  context,
  secret,
  purpose = "provider_refresh_token",
  writeSecret
} = {}) {
  const ctx = brokerContext(context);
  const raw = secretValue(secret);
  const cleanPurpose = required(purpose, "purpose");
  if (!SAFE_KEY.test(cleanPurpose)) throw new TypeError("purpose is invalid");
  if (typeof writeSecret !== "function") {
    return Object.freeze({ ok: false, code: "provider_secret_writer_unavailable", credentialReference: null });
  }

  let stored;
  try {
    stored = await writeSecret({
      ...ctx,
      purpose: cleanPurpose,
      secret: raw
    });
  } catch {
    return Object.freeze({ ok: false, code: "provider_secret_store_failed", credentialReference: null });
  }

  let reference;
  try { reference = credentialReference(stored?.credentialReference); }
  catch {
    return Object.freeze({ ok: false, code: "provider_secret_store_failed", credentialReference: null });
  }
  return Object.freeze({
    ok: true,
    credentialReference: reference,
    secretReturned: false,
    custodyVerifiedByBroker: true
  });
}

async function withProviderCredential({
  context,
  credentialReference: rawReference,
  resolveSecret,
  operation
} = {}) {
  const ctx = brokerContext(context);
  const reference = credentialReference(rawReference);
  if (typeof resolveSecret !== "function") {
    return Object.freeze({ ok: false, code: "provider_secret_resolver_unavailable" });
  }
  if (typeof operation !== "function") {
    return Object.freeze({ ok: false, code: "provider_secret_operation_required" });
  }

  let resolved;
  try { resolved = await resolveSecret({ ...ctx, credentialReference: reference }); }
  catch { return Object.freeze({ ok: false, code: "provider_secret_resolve_failed" }); }

  let raw;
  try { raw = secretValue(resolved?.secret); }
  catch { return Object.freeze({ ok: false, code: "provider_secret_resolve_failed" }); }

  let result;
  try { result = await operation(raw); }
  catch {
    return Object.freeze({ ok: false, code: "provider_operation_failed", secretReturned: false });
  }
  if (outputContainsSecret(result, raw)) {
    return Object.freeze({ ok: false, code: "provider_secret_leak_detected", secretReturned: false });
  }
  return Object.freeze({
    ok: true,
    result,
    secretReturned: false
  });
}

async function revokeProviderCredential({
  context,
  credentialReference: rawReference,
  revokeSecret
} = {}) {
  const ctx = brokerContext(context);
  const reference = credentialReference(rawReference);
  if (typeof revokeSecret !== "function") {
    return Object.freeze({ ok: false, code: "provider_secret_revoker_unavailable", revoked: false });
  }
  let result;
  try { result = await revokeSecret({ ...ctx, credentialReference: reference }); }
  catch { return Object.freeze({ ok: false, code: "provider_secret_revoke_failed", revoked: false }); }
  if (result?.ok !== true || result?.revoked !== true) {
    return Object.freeze({ ok: false, code: "provider_secret_revoke_unverified", revoked: false });
  }
  return Object.freeze({
    ok: true,
    revoked: true,
    credentialReference: reference,
    secretReturned: false
  });
}

function getProviderSecretBrokerContract() {
  return Object.freeze({
    custody: "server_only",
    persistence: "implementation_injected",
    preferredLowBudgetBackend: "supabase_vault",
    browserSecretAccess: false,
    browserDecryptedVaultAccess: false,
    rawSecretInConnectionRows: false,
    rawSecretInLogs: false,
    guarantees: Object.freeze([
      "store returns only an opaque credential reference",
      "resolve is scoped to tenant + provider + connection",
      "resolved secret exists only inside a server operation callback",
      "operation results are refused if they echo the resolved secret",
      "revoke requires positive backend evidence"
    ]),
    blockers: Object.freeze([
      "supabase_vault_runtime_adapter_not_implemented",
      "development_database_branch_not_provisioned",
      "vault_grants_and_private_resolver_not_replay_tested"
    ])
  });
}

module.exports = {
  MAX_SECRET_BYTES,
  brokerContext,
  credentialReference,
  storeProviderCredential,
  withProviderCredential,
  revokeProviderCredential,
  getProviderSecretBrokerContract
};
