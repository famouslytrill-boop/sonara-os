# Google Search Console Customer-Owned Provider Runtime — Engineering Review
Date: 2026-10-08
Review by: 2026-11-08
Status: adapter-runtime implementation in review; no production OAuth route, credential, database migration, or provider activation

## Objective

Advance SONARA's customer-owned provider model with one low-consequence, measurable connector:

**Google Search Console — read-only — one organization — one business — one connection — customer-authorized properties.**

This slice exists to prove the reusable connection/runtime machinery before SONARA enables external writes, publication, advertising mutations, refunds, payouts, or customer-funds operations.

## Current repository implementation

The branch implements three layers:

1. `lib/sonara-provider-oauth-flow.cjs`
   - transaction-specific random OAuth state;
   - PKCE S256;
   - HMAC-signed state capsule;
   - capsule binds provider, organization, business, user, connection, redirect URI and exact scopes;
   - deterministic expiry;
   - constant-time signature comparison;
   - HTTPS/allowlisted authorization endpoint;
   - no open-redirect parameter override;
   - grants no provider runtime authority.

2. `lib/sonara-provider-secret-broker.cjs`
   - tenant/provider/connection-bound credential operations;
   - store returns only an opaque reference;
   - resolve exposes the secret only inside a server operation callback;
   - refuses an operation result that echoes the resolved secret;
   - revoke requires positive backend evidence;
   - Supabase Vault is the preferred low-budget backend, but its runtime adapter is not implemented yet.

3. `lib/sonara-google-search-console-read.cjs`
   - exact read-only Search Console scope;
   - Google authorization-code flow using the shared signed OAuth transaction;
   - offline access for background refresh;
   - strict rejection of the write scope or broader grant;
   - authorization-code exchange is attempted once, not blindly retried;
   - ephemeral access token is used for property discovery and never returned;
   - refresh token must become an opaque credential reference before the connection becomes review-ready;
   - background sync can resolve that reference only inside the credential broker, refresh an ephemeral access token, and perform one daily read without returning either token;
   - disconnect is ordered provider-revoke first, local credential revoke second, with partial-failure evidence if local cleanup fails;
   - provider-returned refresh-token rotation is never silently discarded and remains blocked until rotation persistence is implemented;
   - property list retains provider permission level;
   - finalized Search Analytics data is requested explicitly;
   - Search Console dates are recorded as provider-time-zone dates in `America/Los_Angeles`;
   - Search Analytics pagination remains 25,000 rows per request and is explicitly not claimed exhaustive;
   - provider quota exhaustion is returned for durable deferred retry rather than tight in-request retry;
   - 5xx/network failures retain bounded short retry behavior.

No user-facing connection route is added in this slice because the credential backend and development-database proof are not complete.

## OAuth security reasoning

RFC 9700, published January 2025, is the current OAuth 2.0 Security Best Current Practice.

Applicable controls implemented here:

- authorization code flow rather than implicit grant;
- transaction-specific PKCE;
- S256 challenge method;
- redirect URI bound to the exact string used to start the flow;
- CSRF state bound to the user-agent transaction;
- no arbitrary redirect target supplied by a browser;
- state contains no raw provider token;
- provider authorization endpoint origin is allowlisted.

Source: https://www.rfc-editor.org/rfc/rfc9700.html

Google's current web-server OAuth guidance says:

- redirect URI must exactly match a configured URI;
- offline access is recommended when the server needs to refresh tokens without user interaction;
- state is recommended;
- incremental authorization is generally recommended;
- when `include_granted_scopes=true`, Google can roll previously granted scopes for the same API project into the combined authorization, including grants from different clients;
- `prompt=consent` can be used when consent must be forced;
- a refresh token may be returned only on the first authorization.

Source: https://developers.google.com/identity/protocols/oauth2/web-server

SONARA therefore does **not** force `prompt=consent` on every authorization. A future route should request fresh consent only when no durable refresh credential exists or when explicit reauthorization requires one.

For this connector, SONARA also deliberately **does not** set `include_granted_scopes=true`. Search Console is being used as an isolated least-privilege canary, and combining unrelated prior Google grants would violate the connector's exact-scope authority model. The callback still verifies that the granted scope is exactly `webmasters.readonly`. A future multi-Google product integration may use incremental authorization behind a different reviewed authority boundary.

## Scope policy

The connector requests only:

`https://www.googleapis.com/auth/webmasters.readonly`

It refuses:

`https://www.googleapis.com/auth/webmasters`

and refuses a token response containing unexpected additional scopes.

This is intentionally stricter than merely asking Google for a narrow scope. A token with broader authority must not silently upgrade SONARA's connector capability.

Google's OAuth verification system classifies scopes in Cloud Console and requires verification for scopes categorized as sensitive or restricted. Before public production activation, the exact Search Console scope classification and consent-screen verification status must be proven from the configured Google Cloud project; this document does not guess that classification.

Sources:
- https://support.google.com/cloud/answer/13463073
- https://support.google.com/cloud/answer/13464321

## Search Analytics correctness

Google's current Search Analytics reference states:

- `rowLimit` is 1–25,000;
- `startRow` is the pagination offset;
- `dataState=final` returns finalized data;
- omitting `dataState` also defaults to final, but SONARA sends it explicitly;
- date values are interpreted in Pacific Time (UTC-7/8);
- the API does not guarantee every row, only top rows under its internal limits.

Source: https://developers.google.com/webmaster-tools/v1/searchanalytics/query

Therefore SONARA keeps two separate facts:

```text
provider summary for the property/day
page-dimension rows actually returned
```

and stores the delta instead of falsely claiming that page-level rows are complete.

## Quota and retry model

Google's Search Console usage guide states:

- short-term Search Analytics load quota is measured in 10-minute chunks;
- if short-term load quota is exceeded, Google recommends waiting 15 minutes before trying again;
- one-day queries are cheaper than long date ranges;
- repeatedly re-querying the same historical data should be avoided;
- per-site Search Analytics quota is 1,200 QPM;
- per-user quota is 1,200 QPM;
- per-project quota is 40,000 QPM and 30,000,000 QPD.

Source: https://developers.google.com/webmaster-tools/limits

An HTTP request must not sleep for 15 minutes. The runtime now classifies quota exhaustion as:

```text
provider_rate_limited
retryMode = durable_deferred
retryAfterSeconds = Retry-After when meaningful, otherwise 900
```

A future durable worker will schedule that retry. Short bounded retries remain appropriate for transient network/5xx failures.

## Credential custody

Supabase Vault is installed on SONARA's current project and is the preferred low-budget backend.

Supabase's current documentation says Vault stores authenticated encrypted secret material on disk, while `vault.decrypted_secrets` exposes plaintext to callers that can read it. Supabase also emphasizes that database grants and RLS are separate controls and that service-role credentials stay backend-only.

Sources:
- https://supabase.com/docs/guides/database/vault
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/database/secure-data

This branch deliberately **does not** add a public RPC that resolves Vault secrets.

The required future broker path is:

```text
Google refresh token
  -> dedicated server-only broker
  -> Supabase Vault
  -> opaque credential reference
  -> connection metadata stores reference only

sync job
  -> tenant + connection + capability check
  -> server-only broker resolves one credential
  -> Google token refresh
  -> Search Console request
  -> sanitized evidence/result
  -> secret discarded from operation scope
```

## Why the Vault adapter is still blocked

The active Supabase project currently has no development branch available for isolated migration/RPC testing. Creating one may incur provider cost and requires explicit cost confirmation. Production DDL is not an acceptable substitute for preview proof.

Before a Vault runtime adapter is added:

1. provision an approved Supabase development branch;
2. design a server-only/private resolver path;
3. prove grants independently from RLS;
4. prove browser roles cannot read decrypted Vault values;
5. test two-tenant cross-reference denial;
6. test store/resolve/revoke lifecycle;
7. test logs and errors for token leakage;
8. replay migrations from empty database;
9. run Supabase security advisors;
10. only then wire the customer OAuth route.

## Connection lifecycle target

```text
setup_required
 -> oauth_started
 -> callback_verified
 -> token_exchange_verified
 -> property_identity_verified
 -> refresh_credential_stored
 -> authorization_review_ready
 -> sandbox_verified
 -> tenant_canary_verified
 -> production_verified
```

Failure states remain first class:

```text
reauthorization_required
scope_missing
rate_limited
provider_outage
credential_store_failed
revoked
disabled
```

A consent screen or a 2xx response never equals `production_verified`.

## Next engineering gates

P0 — current branch:
- signed tenant/provider OAuth state;
- strict Search Console read-only grant;
- deferred quota retry;
- credential broker boundary;
- focused negative/security tests;
- no provider secrets in outputs.

P0 — next provider-dependent unit:
- approved Google OAuth client and redirect;
- approved Supabase development database branch;
- server-only Vault adapter;
- connection record persistence;
- OAuth start/callback routes outside locked Growth campaign work;
- one real customer/test Google account and one Search Console property.

P1:
- durable `integration_sync_cursors` persistence;
- durable connector runs and sanitized provider receipts;
- daily checkpoint/backfill worker using the broker-resolved sync contract already implemented here;
- refresh-token rotation persistence and reauthorization workflow;
- wire the implemented Google-revoke -> local-revoke disconnect contract to the future Vault adapter;
- OpenTelemetry metrics/traces with no token values.

P1 acceptance:
- one-tenant canary;
- cross-tenant adversarial rejection;
- quota deferral and recovery evidence;
- exact live SHA;
- rollback;
- deletion/disconnect proof.

## Claims deliberately not made

This branch does not prove:

- a production Google OAuth client exists;
- Google consent verification is complete;
- a refresh token has been stored in Vault;
- a customer Search Console account has been connected;
- a durable sync worker exists (the broker-resolved execution function is synchronous adapter code, not a queue/worker);
- a Vault-backed disconnect has actually executed;
- a migration has been applied;
- a canary has run;
- production has been deployed;
- the connector is production verified.

Those claims remain blocked until provider/database/deployment evidence exists.
