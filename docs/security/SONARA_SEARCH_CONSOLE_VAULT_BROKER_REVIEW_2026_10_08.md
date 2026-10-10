# Search Console Vault Broker — Security and Engineering Review
Date: 2026-10-08
Review by: 2026-11-08
Status: source implementation on stacked review branch; not deployed; no production secret created; no production DDL applied

## Scope

This review covers the next engineering unit after the signed OAuth/provider-runtime work in PR #553:

- server-to-server broker transport;
- Supabase Vault credential custody;
- Google Search Console authorization-code exchange and refresh;
- property authorization and read-only canary;
- bounded daily Search Analytics reads;
- provider revocation and local credential deletion.

It does not authorize production deployment.

## Live Supabase observations

Read-only inspection of project `yqncsonkxgwhcxedgevk` on 2026-10-08/09 UTC established:

- `supabase_vault` extension version 0.3.1 is installed.
- `vault.secrets` currently contains zero secrets.
- `vault.create_secret` and `vault.update_secret` exist.
- `anon` and `authenticated` do not have Vault schema/table read access.
- `service_role` can read `vault.secrets` and `vault.decrypted_secrets`.
- the Data API configuration exposes `public` and `graphql_public`, not `vault`.
- `public.business_integration_connections.credential_reference` is not SELECT-granted to `anon` or `authenticated`; those roles have REFERENCES privilege, while `service_role` has server-side read/write privileges.

The important conclusion is that **Vault is encrypted persistence, not the complete application authorization boundary**. A broadly privileged backend holding the service-role credential can still read decrypted Vault values. The broker narrows how SONARA's application code is permitted to exercise that authority.

## Why an Edge Function broker

Supabase Edge Functions are a server-side execution environment and can connect to Postgres from server code. The broker therefore reads Vault through its direct database connection instead of introducing a public PostgREST RPC that returns decrypted secret material.

References:

- https://supabase.com/docs/guides/functions
- https://supabase.com/docs/guides/functions/connect-to-postgres
- https://supabase.com/docs/guides/database/vault
- https://supabase.com/docs/guides/database/postgres/row-level-security

The repository deliberately does **not** add:

- a public `SECURITY DEFINER` secret resolver;
- a generic `get_secret` operation;
- a generic SQL operation;
- a browser-callable credential endpoint;
- a raw provider token endpoint.

## Broker transport

The Express/server-side client calls only:

`/functions/v1/google-search-console-broker`

The request carries:

1. a current server-only Supabase `sb_secret_…` key in the `apikey` header; this new broker does not accept the legacy service-role key;
2. a timestamp;
3. an HMAC-SHA256 signature over:
   - timestamp;
   - HTTP method `POST`;
   - fixed broker path;
   - exact JSON body.

The shared broker secret itself is not transmitted.

Supabase's pinned `@supabase/server@1.9.1` middleware first authenticates the caller with `auth: 'secret'` using the `apikey` header. After that, SONARA's handler rejects:

- non-POST requests;
- requests with a browser `Origin` header;
- any `Authorization` header;
- stale signatures outside a 120-second clock-skew window;
- malformed signatures;
- payloads larger than 32 KiB;
- unsupported protocol versions;
- operations outside the five-item allowlist.

This is defense in depth. It is not a substitute for network/service isolation, and a total compromise of all backend secrets remains a high-impact event.

### Supabase API-key migration decision

Supabase's current Edge Function authorization documentation distinguishes JWTs from the newer API keys. The platform `verify_jwt` check validates JWTs; `sb_secret_…` keys are API keys and are not JWTs. Supabase's migration guidance deprecates legacy `service_role` keys by the end of 2026 and recommends secret keys for backend services.

Because this broker is a new service-to-service component rather than a user-JWT endpoint:

- `verify_jwt = false` is explicit for this function;
- the Edge entrypoint is wrapped with pinned `@supabase/server@1.9.1` and `auth: 'secret'`;
- the wrapper sets `cors: 'disabled'`, so it does not auto-answer browser preflights or add CORS response headers;
- callers must send the current Supabase secret key in `apikey`;
- the broker client refuses legacy service-role fallback;
- the independent SONARA HMAC is still required after Supabase secret authentication;
- browser-origin and Authorization-header requests remain blocked.

The current project already exposes the new `default` publishable key family, confirming the new API-key system is enabled. No secret value was read or copied during this review.

References:

- https://supabase.com/docs/guides/functions/auth-headers
- https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys
- https://supabase.com/docs/guides/functions/secrets

## Exactly five operations

The broker supports only:

1. `complete_authorization`
2. `review_sites`
3. `bind_site`
4. `read_daily`
5. `disconnect`

There is no generic provider-execution operation. `review_sites` is intentionally read-only and exists so a successfully stored refresh credential can recover after a transient site-list probe failure without replaying an already-consumed authorization code.

### complete_authorization

Input contains the one-time Google authorization code and PKCE verifier already validated by the parent OAuth transaction.

The broker:

- exchanges the code once;
- requires Bearer token semantics;
- rejects any explicit authority broader than `webmasters.readonly`;
- accepts omitted token-response scope only because the original request is already bound to the one exact read-only scope;
- stores a returned refresh token in Vault;
- stores only `vault://<uuid>` in the connection record;
- replaces that reference only if the connection still has the credential reference observed at authorization start; a concurrent change makes the transaction roll back, including the Vault mutation;
- probes the account's accessible Search Console sites;
- returns sanitized site identities and no provider token.

Automatic retry is prohibited because authorization codes are one-time protocol material. If the credential is stored but the immediate property probe fails, the connection records `credential_stored_provider_probe_pending` and returns `review_sites` as its recovery operation.

### review_sites

The broker resolves the already-stored refresh credential, refreshes an ephemeral access token, re-lists authorized Search Console properties, and moves the connection back to `authorization_review_ready`. It does not exchange an authorization code and it does not mark the connection `connected`.

### bind_site

The broker:

- reauthorizes the organization, business, user, connection and provider in the current database;
- resolves the exact Vault UUID referenced by that connection;
- refreshes an ephemeral Google access token;
- confirms the requested Search Console property belongs to the authorized account;
- executes a real daily Search Analytics canary;
- stores the property identity, permission level, canary date and evidence hash;
- marks the connection `connected` only after that provider read succeeds.

A consent screen or stored refresh token alone is not a verified connection.

### read_daily

The broker requires:

- connection status `connected`;
- stored property identity;
- exactly one stored scope: Search Console read-only;
- exact Vault credential reference.

It refreshes an ephemeral access token inside the broker and returns only a bounded Search Analytics report.

### disconnect

The broker:

1. resolves the exact refresh credential referenced by the connection;
2. submits it to Google's revocation endpoint;
3. requires positive provider success;
4. deletes the exact Vault secret;
5. clears the connection's credential reference and disables the connection.

If Google revocation succeeds but local cleanup fails, the broker reports a partial failure instead of claiming complete disconnect.

## OAuth research

RFC 9700 is the OAuth 2.0 Security Best Current Practice. It recommends PKCE for confidential web clients, requires transaction-specific binding, exact redirect-URI matching at authorization servers, CSRF protection and avoidance of open redirectors.

Reference:
https://www.rfc-editor.org/rfc/rfc9700.html

Google's current web-server OAuth documentation confirms:

- offline access is required for background refresh;
- redirect URIs must exactly match configured values;
- `state` is recommended;
- incremental authorization is optional;
- `prompt=consent` can force fresh consent;
- DPoP is supported for additional refresh-token sender constraint.

Reference:
https://developers.google.com/identity/protocols/oauth2/web-server

SONARA intentionally does **not** enable `include_granted_scopes=true` for this isolated canary because Google documents that the resulting access token can cover scopes previously granted to the application. The connector's security contract is exact Search Console read-only authority.

## Search Analytics correctness

Google documents:

- Search Console dates are interpreted in Pacific Time;
- `rowLimit` is 1 through 25,000;
- pagination uses `startRow`;
- `dataState=final` requests finalized data;
- Search Analytics can be paginated beyond 25,000 rows.

References:

- https://developers.google.com/webmaster-tools/v1/searchanalytics/query
- https://developers.google.com/webmaster-tools/v1/how-tos/search_analytics

SONARA's broker reads at most 50,000 rows per daily canary/read and returns at most 500 page samples. It separately records:

- provider summary;
- observed page totals;
- reconciliation delta;
- row count;
- provider row-cap state;
- SHA-256 evidence hash.

It still sets `completeClaimed=false`; a bounded read is not advertised as exhaustive provider history.

## Quotas

Google's current Search Console limits state that short-term Search Analytics load quota is measured in ten-minute chunks and recommends waiting 15 minutes after quota exhaustion. Current per-site and per-user Search Analytics limits are 1,200 QPM; per-project limits are 40,000 QPM and 30,000,000 QPD.

Reference:
https://developers.google.com/webmaster-tools/limits

The broker returns durable retry metadata instead of sleeping for long provider quota windows inside a request.

## DPoP

Google's current OAuth documentation supports DPoP-bound refresh tokens. DPoP would improve refresh-token sender constraint, but it also introduces:

- a persistent P-256 private key;
- `jti` uniqueness;
- nonce caching/rotation;
- DPoP proof generation for code and refresh-token exchanges;
- key-loss recovery and reauthorization.

This branch deliberately does not add DPoP before key custody is proven. A correct DPoP implementation should use the same isolated broker boundary and durable secret/key lifecycle rather than putting a signing key into the general web process.

## Source controls added

- `lib/sonara-provider-broker-client.cjs`
- `supabase/functions/google-search-console-broker/index.ts`
- `supabase/config.toml` explicitly sets `verify_jwt = false` for this service-to-service function; pinned `@supabase/server@1.9.1` validates `auth: 'secret'`, then the handler validates SONARA's HMAC.
- `tests/sonara-provider-broker-client.test.js`
- `tests/sonara-google-search-console-broker-source.test.js`

The source test deliberately fails if the broker is weakened into:

- a generic SQL/secret endpoint;
- a browser/CORS endpoint;
- broad Google authority;
- name-based Vault resolution;
- unbounded Search Analytics output;
- secret-shaped responses;
- delete-before-revoke disconnect behavior;
- a public SECURITY DEFINER resolver.

## Current limitations and blockers

This branch does not prove:

- Edge Function TypeScript/runtime compilation on Supabase;
- an actual Edge Function deployment;
- the function can connect to the target database under hosted runtime networking;
- Vault store/resolve/delete against a development database;
- a real Google OAuth credential;
- a real Search Console property;
- a customer canary;
- durable checkpoint/job persistence;
- DPoP;
- production deployment.

The production project was not mutated for this work.

## Next acceptance sequence

1. exact-head repository CI passes for the stacked source branch;
2. approved Supabase development branch is provisioned;
3. deploy the broker only to that development branch;
4. configure non-production Google OAuth credentials and dedicated broker signing secret;
5. prove bad JWT, bad HMAC, stale HMAC and browser-origin rejection;
6. prove cross-organization/business/user/connection rejection;
7. store one test refresh credential and confirm ordinary browser roles cannot retrieve it;
8. inject another tenant's Vault reference and prove the broker rejects the connection/context mismatch;
9. bind one real Search Console test property with one-day canary evidence;
10. prove rate-limit deferral and reauthorization state;
11. disconnect and prove both Google revocation and Vault deletion;
12. inspect logs/advisors for token leakage and security regressions;
13. only then wire customer-facing OAuth routes and durable jobs;
14. only after canary/SLO/rollback/exact-live-SHA evidence consider production verification.
