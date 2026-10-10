"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const broker = fs.readFileSync(
  path.join(root, "supabase/functions/google-search-console-broker/index.ts"),
  "utf8"
);
const config = fs.readFileSync(path.join(root, "supabase/config.toml"), "utf8");

function sliceBetween(start, end) {
  const from = broker.indexOf(start);
  const to = broker.indexOf(end, from + start.length);
  assert.ok(from >= 0, "missing start marker: " + start);
  assert.ok(to > from, "missing end marker: " + end);
  return broker.slice(from, to);
}

describe("Search Console Vault broker source boundary", () => {
  it("pins the database client and current Supabase server-auth middleware for service calls", () => {
    assert.match(broker, /npm:postgres@3\.4\.3/);
    assert.match(broker, /npm:@supabase\/server@1\.9\.1/);
    assert.match(config, /\[functions\.google-search-console-broker\][\s\S]*?verify_jwt\s*=\s*false/);
    assert.match(broker, /withSupabase\(\{ auth: "secret", cors: "disabled" \}, brokerHandler\)/);
    assert.doesNotMatch(broker, /SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("is server-to-server only and requires Supabase secret auth plus a fresh body-bound HMAC", () => {
    assert.match(broker, /browser_origin_refused/);
    assert.match(broker, /authorization_header_refused/);
    assert.match(broker, /withSupabase\(\{ auth: "secret", cors: "disabled" \}, brokerHandler\)/);
    assert.match(broker, /x-sonara-provider-broker-timestamp/);
    assert.match(broker, /x-sonara-provider-broker-signature/);
    assert.match(broker, /MAX_CLOCK_SKEW_SECONDS\s*=\s*120/);
    assert.match(broker, /\[timestamp, "POST", BROKER_PATH, body\]\.join\("\\n"\)/);
    assert.doesNotMatch(broker, /x-sonara-provider-broker-token/);
    assert.doesNotMatch(broker, /access-control-allow-origin/i);
    assert.match(broker, /cors: "disabled"/);
  });

  it("exposes only the five reviewed lifecycle operations and no generic SQL or credential endpoint", () => {
    assert.match(
      broker,
      /new Set\(\["complete_authorization", "review_sites", "bind_site", "read_daily", "disconnect"\]\)/
    );
    for (const forbidden of ["run_sql", "query_sql", "get_secret", "list_secrets", "decrypt_secret"]) {
      assert.equal(broker.includes('"' + forbidden + '"'), false, forbidden);
    }
  });

  it("reauthorizes the exact tenant, business, user and connection on every call", () => {
    const auth = sliceBetween("async function authorizedConnection", "async function providerFetch");
    for (const required of [
      "business_integration_connections",
      "business_workspaces",
      "organization_memberships",
      "m.status='active'",
      "c.id=$2::uuid",
      "c.organization_id=$3::uuid",
      "c.business_id=$4::uuid",
      "c.provider_key=$5",
      'connection.connection_mode !== "oauth"'
    ]) {
      assert.ok(auth.includes(required), required);
    }
    assert.match(broker, /OWNER_ROLES = new Set\(\["owner", "admin", "business_owner"\]\)/);
  });

  it("keeps the Google authority read-only and provider destinations fixed", () => {
    assert.match(broker, /webmasters\.readonly/);
    assert.match(broker, /oauth2\.googleapis\.com\/token/);
    assert.match(broker, /oauth2\.googleapis\.com\/revoke/);
    assert.match(broker, /API_ORIGIN = "https:\/\/www\.googleapis\.com"/);
    assert.match(broker, /url\.origin !== API_ORIGIN/);
    assert.match(broker, /oauth_write_scope_refused/);
    assert.doesNotMatch(broker, /include_granted_scopes/);
  });

  it("uses Vault only by the exact UUID stored on the authorized connection", () => {
    const resolve = sliceBetween("async function resolveRefresh", "async function storeRefresh");
    assert.match(resolve, /vaultId\(connection\.credential_reference\)/);
    assert.match(resolve, /from vault\.decrypted_secrets where id=\$1::uuid limit 1/);
    assert.doesNotMatch(resolve, /select \*/i);
    assert.doesNotMatch(resolve, /where name/i);

    const store = sliceBetween("async function storeRefresh", "function providerSettings");
    assert.match(store, /vault\.update_secret/);
    assert.match(store, /vault\.create_secret/);
    assert.match(store, /credential_reference=\$1/);
    assert.match(store, /credential_reference is not distinct from \$6/);
    assert.doesNotMatch(store, /decrypted_secret/);
  });

  it("never returns raw provider credentials from authorization, reads or disconnect", () => {
    const publicResponseKeys = [
      "providerSecretsReturned: false",
      "credentialStored: true"
    ];
    for (const value of publicResponseKeys) assert.ok(broker.includes(value), value);
    assert.doesNotMatch(broker, /body:\s*\{[^}]*accessToken/s);
    assert.doesNotMatch(broker, /body:\s*\{[^}]*refreshToken/s);
    assert.doesNotMatch(broker, /credentialReference:/);
    assert.equal(broker.includes("console.log"), false);
    assert.equal(broker.includes("console.error"), false);
  });

  it("will not silently lose a rotated refresh token", () => {
    assert.match(broker, /provider_refresh_rotation_requires_persistence/);
  });

  it("can recover site review after the one-time authorization code has already been consumed", () => {
    const authorization = sliceBetween("async function completeAuthorization", "async function reviewSites");
    assert.match(authorization, /credential_stored_provider_probe_pending/);
    assert.match(authorization, /recoveryOperation: "review_sites"/);
    assert.match(authorization, /provider_probe_error_code/);

    const review = sliceBetween("async function reviewSites", "async function bindSite");
    assert.match(review, /brokerAccess\(sql, config, connection\)/);
    assert.match(review, /listSites\(access\.accessToken\)/);
    assert.match(review, /authorization_review_ready/);
    assert.match(review, /providerSecretsReturned: false/);
    assert.doesNotMatch(review, /exchangeCode/);
  });

  it("requires a real provider canary before marking the connection connected", () => {
    const bind = sliceBetween("async function bindSite", "async function readDaily");
    assert.match(bind, /listSites\(access\.accessToken\)/);
    assert.match(bind, /dailyReport\(access\.accessToken, siteUrl, canaryDate\)/);
    assert.match(bind, /canary_evidence_hash/);
    assert.match(bind, /"connected"/);
  });

  it("bounds Search Analytics output and refuses an exhaustive-coverage claim", () => {
    assert.match(broker, /PAGE_SIZE = 25000/);
    assert.match(broker, /MAX_ROWS = 50000/);
    assert.match(broker, /MAX_SAMPLE_ROWS = 500/);
    assert.match(broker, /dataState: "final"/);
    assert.match(broker, /providerDateZone: "America\/Los_Angeles"/);
    assert.match(broker, /completeClaimed: false/);
    assert.match(broker, /top_rows_not_guaranteed_exhaustive/);
  });

  it("positively verifies Google revocation before deleting the Vault secret", () => {
    const disconnect = sliceBetween("async function disconnect", "Deno.serve");
    const providerCall = disconnect.indexOf("REVOKE_URL");
    const positiveCheck = disconnect.indexOf("!revoked.response.ok");
    const vaultDelete = disconnect.indexOf("delete from vault.secrets");
    assert.ok(providerCall >= 0);
    assert.ok(positiveCheck > providerCall);
    assert.ok(vaultDelete > positiveCheck);
    assert.match(disconnect, /provider_revoke_unverified/);
    assert.match(disconnect, /provider_revoked_local_credential_cleanup_failed/);
  });

  it("does not introduce a public database secret resolver or SECURITY DEFINER function", () => {
    assert.doesNotMatch(broker, /security\s+definer/i);
    assert.doesNotMatch(broker, /\/rest\/v1\/rpc\//);
    assert.doesNotMatch(broker, /create\s+(?:or\s+replace\s+)?function/i);
  });
});
