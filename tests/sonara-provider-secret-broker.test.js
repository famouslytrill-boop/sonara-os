"use strict";

const assert = require("node:assert/strict");
const {
  brokerContext,
  credentialReference,
  storeProviderCredential,
  withProviderCredential,
  revokeProviderCredential,
  getProviderSecretBrokerContract
} = require("../lib/sonara-provider-secret-broker.cjs");

const CONTEXT = Object.freeze({
  organizationId: "11111111-1111-4111-8111-111111111111",
  businessId: "22222222-2222-4222-8222-222222222222",
  userId: "33333333-3333-4333-8333-333333333333",
  connectionId: "44444444-4444-4444-8444-444444444444",
  providerKey: "google_search_console"
});

describe("provider secret broker boundary", () => {
  it("binds every secret operation to tenant, business, user, connection and provider", () => {
    assert.deepEqual({ ...brokerContext(CONTEXT) }, CONTEXT);
    assert.throws(
      () => brokerContext({ ...CONTEXT, organizationId: "not-a-uuid" }),
      /organizationId/
    );
  });

  it("accepts only opaque credential references", () => {
    assert.equal(
      credentialReference("vault://customer-providers/gsc-1"),
      "vault://customer-providers/gsc-1"
    );
    for (const value of ["raw-token", "https://secret.example/token", "", "vault://"]) {
      assert.throws(() => credentialReference(value), /opaque credential reference/);
    }
  });

  it("stores a raw provider secret only through the injected server writer and returns only a reference", async () => {
    let observed = null;
    const out = await storeProviderCredential({
      context: CONTEXT,
      secret: "refresh-token-secret",
      purpose: "provider_refresh_token",
      writeSecret: async (input) => {
        observed = input;
        return { credentialReference: "vault://customer-providers/gsc-1" };
      }
    });
    assert.equal(out.ok, true);
    assert.equal(out.credentialReference, "vault://customer-providers/gsc-1");
    assert.equal(out.secretReturned, false);
    assert.equal(observed.secret, "refresh-token-secret");
    assert.equal(observed.organizationId, CONTEXT.organizationId);
    assert.equal(JSON.stringify(out).includes("refresh-token-secret"), false);
  });

  it("fails closed if secret storage does not return an opaque reference", async () => {
    const out = await storeProviderCredential({
      context: CONTEXT,
      secret: "refresh-token-secret",
      writeSecret: async () => ({ credentialReference: "refresh-token-secret" })
    });
    assert.equal(out.ok, false);
    assert.equal(out.code, "provider_secret_store_failed");
    assert.equal(out.credentialReference, null);
  });

  it("resolves a secret only inside the operation callback and blocks secret echo", async () => {
    let seen = null;
    const safe = await withProviderCredential({
      context: CONTEXT,
      credentialReference: "vault://customer-providers/gsc-1",
      resolveSecret: async () => ({ secret: "refresh-token-secret" }),
      operation: async (secret) => {
        seen = secret;
        return { ok: true, providerRequestId: "request-1" };
      }
    });
    assert.equal(safe.ok, true);
    assert.equal(seen, "refresh-token-secret");
    assert.equal(JSON.stringify(safe).includes("refresh-token-secret"), false);

    const leaking = await withProviderCredential({
      context: CONTEXT,
      credentialReference: "vault://customer-providers/gsc-1",
      resolveSecret: async () => ({ secret: "refresh-token-secret" }),
      operation: async (secret) => ({ ok: true, diagnostic: secret })
    });
    assert.equal(leaking.ok, false);
    assert.equal(leaking.code, "provider_secret_leak_detected");
    assert.equal(JSON.stringify(leaking).includes("refresh-token-secret"), false);
  });

  it("requires positive revocation evidence instead of treating a request as a revoke", async () => {
    let calls = 0;
    let out = await revokeProviderCredential({
      context: CONTEXT,
      credentialReference: "vault://customer-providers/gsc-1",
      revokeSecret: async () => {
        calls += 1;
        return { ok: true, revoked: false };
      }
    });
    assert.equal(out.ok, false);
    assert.equal(out.code, "provider_secret_revoke_unverified");

    out = await revokeProviderCredential({
      context: CONTEXT,
      credentialReference: "vault://customer-providers/gsc-1",
      revokeSecret: async () => {
        calls += 1;
        return { ok: true, revoked: true };
      }
    });
    assert.equal(out.ok, true);
    assert.equal(out.revoked, true);
    assert.equal(calls, 2);
  });

  it("records Vault as the preferred low-budget backend without pretending its runtime adapter exists", () => {
    const contract = getProviderSecretBrokerContract();
    assert.equal(contract.preferredLowBudgetBackend, "supabase_vault");
    assert.equal(contract.browserDecryptedVaultAccess, false);
    assert.equal(contract.rawSecretInConnectionRows, false);
    assert.ok(contract.blockers.includes("supabase_vault_runtime_adapter_not_implemented"));
    assert.ok(contract.blockers.includes("development_database_branch_not_provisioned"));
  });
});
