# SONARA Adversarial Application Playbook

This playbook converts offensive-security training concepts into defensive SONARA tests. BreachLab is one external learning reference; it is not an authorization source and is not a production dependency.

## Scope rule

Run these exercises only against:

- local SONARA test fixtures;
- SONARA-owned staging systems explicitly approved for security testing;
- SONARA-owned production systems only when a written test window and rollback plan have been approved; or
- training targets whose provider explicitly authorizes the exercise.

Never use this playbook to scan, enumerate, exploit, credential-test, or disrupt a third-party system without explicit authorization.

## Priority attack classes

### 1. Tenant boundary / BOLA / IDOR

Goal: prove one organization cannot read, update, delete, enumerate, or infer another organization's records.

Automated baseline:

- create at least two simultaneous tenants with unmistakable marker data;
- authenticate as tenant A;
- send tenant B IDs in path, query, body, and common tenant headers;
- assert B data never renders;
- assert recorded data queries never target B;
- repeat as tenant B;
- assert anonymous and invalid sessions receive no private tenant state.

Current executable proof: `tests/cross-tenant-isolation.test.js`.

### 2. Authentication and role spoofing

Goal: caller-controlled metadata cannot become identity or privilege.

Test examples:

- forged `x-admin`, `x-role`, `x-user-role`, tenant, and organization headers;
- forged `user_id`, `organization_id`, role, or scope parameters;
- malformed, expired, unknown, or missing bearer tokens;
- direct requests to founder/admin routes from normal users;
- replay of authenticated requests after logout or session invalidation when a live auth harness is available.

Expected rule: identity comes from verified authentication; authorization comes from server-side membership/role policy.

### 3. Injection and unsafe rendering

Goal: untrusted input remains data.

Test SQL/PostgREST filter construction, HTML rendering, Markdown rendering, search, filenames, URLs, and provider prompts using inert payload fixtures that include metacharacters and markup. Assert input is encoded/parameterized and never changes the intended query or execution path.

Do not use destructive payloads against production data.

### 4. SSRF and outbound request control

Goal: user-supplied URLs cannot make SONARA reach internal, metadata, loopback, or otherwise prohibited destinations.

Test URL parsers and fetch adapters with local fixtures representing:

- loopback and localhost forms;
- private network address ranges;
- cloud metadata addresses;
- redirects from an allowed-looking host to a blocked destination;
- alternate numeric/IP encodings when supported by the parser.

Expected rule: outbound destinations are validated after redirects and before privileged requests.

### 5. Webhook forgery and replay

Goal: provider callbacks cannot mutate state unless authenticity and replay controls pass.

For Stripe and every future webhook provider:

- reject missing or malformed signatures;
- reject body/signature mismatch;
- reject stale/replayed events when provider semantics support replay detection;
- make duplicate valid events idempotent;
- ensure webhook input cannot grant entitlements outside the verified provider event.

### 6. File and media boundary

Goal: uploads cannot become executable authority or cross-tenant disclosure.

Test:

- MIME/extension mismatch;
- oversized files and decompression/resource exhaustion boundaries;
- unsafe filenames and path traversal strings;
- private-file access from a second tenant;
- public publishing without explicit rights/publishing state;
- media/document worker time, memory, and egress limits.

### 7. Agent/tool escalation

Goal: prompt content, memory, emotion, or presentation state cannot widen tool permissions.

Test that model/user content requesting any of the following remains subject to `lib/sonara-agent-authority.cjs`:

- refunds or payout changes;
- legal/policy publication;
- customer campaigns or messages;
- proof/review publication;
- security-setting changes;
- destructive data actions; and
- unknown consequential actions.

Memory is context, not authorization. A 3D avatar, emotional state, or system persona is presentation/context, not authorization.

### 8. Secrets and provider boundaries

Goal: server credentials do not leak to clients, logs, artifacts, generated diagrams, prompts, or error pages.

Use the existing client-secret scanner and targeted fixtures for provider keys, service-role keys, webhook secrets, access tokens, and private environment-variable names. Evidence artifacts must record status and hashes, never secret values.

## Evidence requirements

A release-grade adversarial run should record:

- commit SHA and environment;
- test suite and exact command;
- pass/fail counts;
- failed case names without secrets;
- relevant generated evidence/artifact hashes;
- known skipped live-provider tests; and
- owner-approved exceptions with expiry/next action.

The CI evidence bundle under `artifacts/release-evidence/` is the canonical automated receipt for repository-level checks.

## What this does not claim

A passing local adversarial suite is not a penetration-test certification. It proves the exercised application contracts at that commit. Production RLS, provider dashboards, network controls, DNS/redirect behavior, and third-party configuration still require environment-specific verification.
