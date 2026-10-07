# SONARA Customer-Owned Provider Access Architecture
Date: 2026-10-07
Review by: 2026-11-07
Status: engineering design + deterministic policy implementation; no new production provider runtime enabled

## Objective

Customers should be able to connect, use, inspect, revoke and leave SONARA for the providers they already own or choose themselves. SONARA should not force a provider when a safe customer-owned provider can be supported.

The control-plane rule is:

```
customer chooses provider
  -> provider identity/origin verified
  -> customer authorizes exact account/workspace
  -> least-privilege scopes requested
  -> provider grants scopes
  -> raw credential goes only to provider or server vault
  -> SONARA stores opaque credential reference + provider identity
  -> capability is verified
  -> read/sync action may become a candidate
  -> consequential write requires customer approval
  -> provider executes
  -> SONARA records provider receipt + reconciliation evidence
  -> customer can revoke/disconnect
```

"Connected" does not mean "SONARA may execute every capability."

## Supported authority pathways

| Pathway | Customer experience | SONARA stores | Runtime posture |
| --- | --- | --- | --- |
| Provider-hosted dashboard | Open the customer's own provider UI | approved HTTPS origin / optional account reference | no provider credential attached |
| Customer OAuth | Customer grants exact scopes at provider | opaque vault reference + external account + scopes + expiry | server-side adapter only |
| Customer-provided API credential | Customer submits credential directly to a server-side vault intake | opaque vault reference only | server-side adapter only |
| Customer service account | Customer supplies a provider-created service identity through protected intake | opaque vault reference + provider identity | server-side adapter only |
| Provider-managed auth | Provider/embedded-auth vendor owns token exchange/custody | managed credential reference | capability-gated |
| Manual export/import | Customer moves a file between systems | file/evidence references only | no provider credential |
| Signed webhook | Provider calls SONARA | signing-secret reference + verified event evidence | ingress only until event policy passes |
| Customer-provided/custom API | Owner registers a reviewed provider manifest | verified origins, capabilities, auth contract, docs | disabled until provider review passes |

## OAuth security baseline

SONARA's OAuth path should follow RFC 9700 / OAuth 2.0 Security BCP:
- exact redirect URI comparison;
- authorization-code flow;
- PKCE S256;
- transaction-bound state;
- issuer binding where supported;
- no implicit grant;
- tokens never placed in URLs or browser storage;
- sender-constrained tokens such as DPoP when the provider supports them;
- refresh-token rotation/revocation behavior recorded.

Reference: https://www.rfc-editor.org/rfc/rfc9700.html

Google recommends secure client/token storage, revocation/deletion when no longer needed, state validation and incremental authorization. SONARA should therefore ask for a scope when the customer turns on the feature that needs it rather than front-loading every permission.

Reference: https://developers.google.com/identity/protocols/oauth2/resources/best-practices

Shopify currently distinguishes offline, online and delegate access tokens. Offline tokens support background work; online tokens preserve staff-level attribution/permissions; delegate tokens narrow subsystem privileges. Shopify states public apps must use expiring offline tokens for GraphQL Admin API requests by January 1, 2027.

References:
- https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens
- https://shopify.dev/docs/apps/build/authentication-authorization

## Provider authority formula

For an operation `a`, connection `c`, organization `o`:

```
ProviderCandidate(a,c,o) =
  TenantMatch(c,o)
  AND ConnectionVerified(c)
  AND ProviderAccountBound(c)
  AND CapabilityDeclared(c,a)
  AND RequiredScopes(a) subset_of GrantedScopes(c)
  AND CredentialReferenceVerified(c)
  AND ProviderOriginVerified(c)
  AND RateBudgetAvailable(c,a)
  AND IdempotencyReady(a)
  AND ApprovalReady(a)
```

Even when the expression is true, the deterministic policy returns an execution **candidate**, not authority. The route/worker must still resolve the server-side credential, re-check tenant and provider account, execute through an approved adapter, persist a receipt and reconcile.

## Consequence classes

- `read`: provider state only.
- `sync`: repeatable read + canonical checkpoint.
- `reversible_write`: scoped write with idempotency and receipt.
- `external_publish`: public/customer communication; explicit approval.
- `financial_mutation`: provider money action; explicit approval and money-boundary policy.
- `security_admin`: credential/access/security change; step-up + governance approval.
- `destructive`: deletion/revocation/destructive provider mutation; explicit approval and proof.

For the current fee-only customer-funds posture, financial mutation is denied unless a future reviewed provider-specific mode explicitly states that the customer's provider executes customer funds. This policy still does not grant execution.

## Direct customer pathways

Every integration detail screen should eventually expose four distinct actions:

1. **Open provider** — safe allowlisted HTTPS navigation to the provider-owned dashboard; no credential in the URL.
2. **Review access** — exact account/workspace, requested/granted scopes, expiry, last verification, capability state.
3. **Reconnect / reduce access** — provider authorization flow with incremental scopes.
4. **Disconnect** — revoke provider grant where supported, remove the local credential reference, stop jobs/webhooks, preserve immutable audit evidence.

A fifth **Test connection** action can perform a non-mutating provider identity/capability probe. It must never make a financial, publishing, messaging, security or destructive change.

## Customer-provided provider onboarding

Unknown providers must not become arbitrary server-fetch destinations. Onboarding should create a reviewed manifest:

```
provider_key
provider label
verified API origin
approved dashboard origin(s)
official documentation URL
auth type(s)
read capabilities
write capabilities
required scopes per capability
rate-limit contract
webhook signature contract
data classes
commercial terms review
security review
adapter version
owner approval
```

The provider's API origin is an exact HTTPS origin. No localhost, IP-literal, embedded credential, fragment or arbitrary URL supplied at execution time is accepted.

A custom provider begins `review_only`. Read-only activation comes first. Writes follow only after provider receipts, replay/idempotency, reconciliation, disconnect and tenant-isolation tests pass.

## Credential handling

Never persist raw provider credentials in:
- `business_integration_connections`;
- ordinary JSON settings;
- logs;
- audit event metadata;
- browser storage;
- query strings;
- spreadsheet exports;
- AI prompts or agent memory.

The active connection row stores an opaque `credential_reference`. The reference resolves only inside an approved server-side adapter/vault boundary.

If a customer types an API key, the supported path is:

```
browser TLS form
 -> dedicated server vault-intake endpoint
 -> secret manager / vault
 -> opaque reference returned to control plane
 -> original request body discarded
 -> logs redact secret material
```

The generic integration CRUD route must never accept the raw credential.

## Verified Supabase secret-custody posture

Read-only inspection of the currently connected active project on 2026-10-07 found:

- `supabase_vault` **0.3.1 is installed**;
- `pgsodium` is **not installed**;
- `vault.secrets` currently contains **0 rows**;
- `vault.create_secret` and `vault.update_secret` are executable by the server/service role, not browser roles;
- `vault.decrypted_secrets` is readable by the service role and therefore must be treated as plaintext credential access;
- the active `business_integration_connections` table has RLS enabled, but browser roles still hold legacy `TRUNCATE`, `TRIGGER`, and `REFERENCES` object privileges.

Supabase's current documentation says Vault stores authenticated encrypted secrets on disk and exposes plaintext through `vault.decrypted_secrets`; anyone with access to that view can read the decrypted values. Supabase also marks direct new `pgsodium` usage as pending deprecation and recommends Vault instead.

Therefore the low-budget credential design is:

```
customer credential / OAuth token
  -> server-only credential intake
  -> Supabase Vault
  -> opaque vault UUID/reference in SONARA connection metadata
  -> server-only adapter resolves just in time
  -> provider request
  -> credential discarded from request memory as soon as practical
```

The application must not expose `vault.decrypted_secrets` through a customer RPC, view, browser role, spreadsheet, log, AI prompt, or generic provider API.

Current database security advisors also report broader issues that must be classified before provider-write activation: 64 RLS-enabled public tables with no policy, eight authenticated-callable `SECURITY DEFINER` functions, one extension in the public schema, and leaked-password protection disabled. Some no-policy tables are intentionally service-only; the advisor count therefore requires classification rather than blindly adding user policies.

Provider access should not become write-capable until the active database's object grants and privileged RPC surface are reconciled.

References:
- https://supabase.com/docs/guides/database/vault
- https://supabase.com/docs/guides/database/extensions/pgsodium
- https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Payment-provider boundary

Customer-owned Stripe/payment-provider access needs an additional boundary.

The fee-only default remains:
- SONARA charges for SONARA software.
- Customer commerce/rent/deposit funds remain at the customer's provider.
- A provider dashboard or hosted payment page can be opened directly.
- SONARA may record provider IDs/status/reconciliation evidence.
- Generic provider CRUD cannot activate customer-funds execution.

Stripe documents that connected-account requests are explicitly account-scoped (for example through a connected account identifier), and different charge models assign different fee/refund/negative-balance responsibilities. Therefore the account binding and money model must be provider-verified per request rather than inferred from "Stripe connected."

References:
- https://docs.stripe.com/api/connected_accounts
- https://docs.stripe.com/connect/enable-payment-acceptance-guide

## Data model

The design-only schema proposal is:
`docs/architecture/SONARA_CUSTOMER_PROVIDER_ACCESS_SCHEMA_PROPOSAL_2026_10_07.sql`

It separates:
- customer/provider connection;
- one-time OAuth transaction evidence;
- provider action request/approval/idempotency;
- sync checkpoint/reconciliation;
- signed provider-event inbox.

It is not an applied migration.

## Rollout order

P0:
- keep generic OAuth/API/webhook self-activation blocked;
- add customer-owned provider policy and schema contract;
- direct safe provider-dashboard navigation;
- scope/revocation/account identity review;
- first real read-only OAuth adapter.

P1:
- server vault intake for customer API credentials;
- OAuth callback broker with PKCE/state/issuer validation;
- durable sync checkpoints;
- signed webhook inbox;
- capability probes and provider health state;
- reconciliation and disconnect proof.

P2:
- governed write adapters;
- per-action owner approval;
- idempotent durable outbox;
- provider receipts;
- automated reconciliation;
- custom-provider manifest review workflow.

P3:
- verified financial-provider actions only where the business/legal/provider model permits them;
- organization-level connector marketplace;
- delegated provider credentials for isolated workers;
- sender-constrained OAuth tokens where supported.

## Release conditions

Do not claim a provider is production-connected until all of these are evidenced:
- exact tenant/account binding;
- provider authorization;
- exact granted scopes;
- credential reference custody;
- read/write capability probe;
- provider rate-limit behavior;
- retries/backoff;
- idempotency;
- webhook signature verification where used;
- sync checkpoint/reconciliation;
- disconnect/revocation;
- no cross-tenant replay;
- audit/proof records;
- exact deployed SHA;
- one-tenant canary;
- owner approval for consequential operations.

This architecture deliberately favors a smaller number of deeply verified connectors over a large catalog of logos that do not actually execute safely.
