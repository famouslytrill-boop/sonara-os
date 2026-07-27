# SONARA Industries — Complete Engineering Audit

**Date:** 2026-07-27
**Audited commit:** `d5093bb9f538ef3f50d5985bbd76c5531a4b8646`
**Scope:** Architecture, database, API, frontend, security, AI, CI/CD, Supabase, performance
**Method:** Repository inspection + live read-only Supabase advisor queries against the linked
production project `yqncsonkxgwhcxedgevk`.

---

## 0. How to read this report

Every finding below is tied to a file, line, migration, or a live advisor result. Where I could
not verify something from the repository or from read-only production queries, it is labelled
**[UNVERIFIED]** with the specific check required.

The single most important thing this audit found is a **mismatch between the handoff document and
the deployed system**. The handoff describes a Next.js + TypeScript multi-tenant SaaS with an AI
layer. The deployed artifact is a single 4,731-line CommonJS Express file with no framework, no
TypeScript compilation, and no AI inference path. Several of the "verified" and "completed" claims
in the handoff do not hold when tested against the repository.

This is not a criticism of progress made. The security scaffolding, migration discipline, and
deployment gating are genuinely above average for a company at this stage. But the objective —
"move from MVP toward enterprise AI operating system" — cannot be planned accurately from the
handoff's picture of the system. The rest of this document is the corrected picture.

---

## 1. Verified ground truth vs. handoff claims

| Handoff claim | Verified status | Evidence |
|---|---|---|
| Next.js | **False for the deployed app** | `next` is not in `package.json` dependencies or devDependencies. `vercel.json` sets `"framework": null` and rewrites `/(.*)` → `/api`, which is `api/index.js` → `module.exports = require("../server")`, an Express app. |
| TypeScript | **False for the deployed app** | `typescript` is not a dependency. `"typecheck": "node --check server.js && node --check api/index.js"` — this is a **syntax parse only**, not type checking. 1,165 `.ts`/`.tsx` files exist but nothing in the deployed runtime imports them. |
| PostgreSQL / Supabase / RLS / multi-tenant | **True** | 64 migrations, 299 tables, extensive RLS. Confirmed live. |
| pgvector | **Installed, unused** | Extension exists (live advisor confirms `vector` in `public`). Exactly one column declared: `sonara_memory_records.embedding` (`20260528071000`). **No vector index** (no `ivfflat`/`hnsw` anywhere), **no similarity operator** (`<=>`/`<->`) anywhere, **no runtime code reads or writes it**. |
| Vercel / GitHub Actions | **True** | 8 workflows; controlled deploy pipeline is real and reasonably thorough. |
| OpenAPI | **Partially true** | Post-codegen, `openapi/sonara.yaml` documents **187 operations across 136 paths**; the server registers **498 route+method pairs across 423 distinct paths**. So ~62% of the API surface is undocumented. `verify:api` passes because it checks that documented operations *match* the runtime, not that the runtime is *covered*. (The committed spec has only 64 paths — see CRIT-1: the committed tree is not the built artifact.) |
| "Deep reconciliation verifies RLS enabled, policies, indexes, drift" | **Partially true — has real gaps** | The 8 `sonara_*_registry` / control-plane tables from `20260621020300` are **not in `lib/sonara-database-contract.cjs`** and **not covered by `verify-production-supabase.mjs`**. Their migration never enables RLS, yet production reports RLS *is* enabled on them — meaning production state diverges from the migration files and the reconciler did not catch it. |
| Production deployment healthy | **Needs confirmation** | The Supabase org contains a project literally named `sonara-industries-prod` (`ltzpppffnwopdxbchajr`) whose status is **INACTIVE** (paused). The project the repo actually pins is `yqncsonkxgwhcxedgevk` — named *"famouslytrill-boop's Project"*. See CRIT-2. |
| AI architecture exists | **False** | See §6. There is no inference path of any kind in the deployed runtime. |

---

## 2. Critical issues

### CRIT-1 — `server.js` is a build output committed as source, rewritten by 44 codegen scripts

**Evidence:** `package.json` `apply:runtime` chains **32 script invocations**; `grep -l "server.js" scripts/*.cjs` returns **44 files**. Each performs string surgery on `server.js`, e.g. `scripts/apply-last9-routes.cjs`:

```js
source = source.replace(anchor, anchor + wiring);
fs.writeFileSync(serverPath, source);
```

`apply:runtime` runs on **`pretest`** and inside **`vercel-build`**. So the file is mutated before every test run and again during every production build.

**Why this is critical:**
- `server.js` is simultaneously hand-edited source *and* generated artifact. Any manual edit can be clobbered; any codegen change silently rewrites hand-written code. Git history cannot distinguish the two.
- Every script anchors on **exact string literals** (`app.use(express.json({ limit: "64kb" }));`). Reformatting a single line breaks the build with `process.exit(1)`. This is the most brittle possible coupling.
- Ordering is significant and implicit across 32 steps. There is no dependency graph, no idempotency contract, and two scripts already exist purely to patch idempotency (`apply-catalog-helper-scope.cjs`, `prompt-security-verifier` in git history).
- It makes the codebase effectively unmaintainable by anyone who did not write the generators, and blocks any refactor, module split, or framework migration.

**Measured during Phase 0 implementation.** A single `pnpm test` (which fires
`pretest` → `apply:runtime`) rewrote **23 tracked files: 3,182 insertions, 387
deletions**, with no source edit by anyone:

```
server.js  openapi/sonara.yaml  lib/sonara-database-contract.cjs
lib/sonara-ecosystem-manifest.cjs  lib/sonara-route-registry.cjs
public/sw.js  public/sonara-one.js  data/open-source-tools.ts
routes/*.cjs (6 files)  ui/sonara/**  docs/SONARA_EXTERNAL_REPOSITORY_REGISTRY.md
scripts/apply-market-intelligence-system.cjs    <-- codegen rewriting codegen
scripts/verify-supabase-contract.mjs            <-- codegen rewriting a verifier
```

Three consequences follow directly, and they are worse than "brittle":

1. **The committed tree is not the deployed artifact.** `openapi/sonara.yaml` at
   `d5093bb` has 64 paths; after `apply:runtime` it has 136. Reading the repo at
   any commit tells you something different from what production runs.
2. **Codegen rewrites its own tooling** — including a verifier (`verify-supabase-contract.mjs`),
   so a generated script is validating generated output.
3. **Anchors are already stale.** `scripts/apply-last9-routes.cjs` anchors on
   `app.use(express.json({ limit: "64kb" }));`, but `server.js` now reads
   `limit: "1mb"`. It only survives because a separate marker check short-circuits
   first. Remove that marker and the build hard-fails on a string that no longer
   exists.
4. **An entire feature exists nowhere in version control.**
   `routes/product-lifecycle-routes.cjs` is **606 lines with no git history** —
   `git log` on it returns nothing and it is not `.gitignore`d. Both the module
   and its `require` line in `server.js` are written at build time by
   `scripts/apply-product-lifecycle-system.cjs`. It is the only one of seven
   generated route modules in this state; the other six are committed.

   Consequences: the Product Lifecycle API cannot be code-reviewed, cannot be
   scanned by any repository-based security tool, and does not appear in any
   audit of this codebase — including the route and OpenAPI counts elsewhere in
   this document unless `apply:runtime` has been run first. Five test files
   (`product-lifecycle-contract`, `product-lifecycle-system`,
   `market-intelligence-system`, and two Supabase contract suites) exercise code
   that exists only because `pretest` materialised it moments earlier.

   It also means **a fresh clone of this repository does not boot.** `pnpm start`
   without `apply:runtime` fails on a missing module. The committed tree is not a
   runnable program.

**This is the root cause of most other findings in this report** — modularity, testability, and bundle/structure issues all trace back to it.

**Fix:** Freeze codegen. Run `apply:runtime` once, commit the result, delete the scripts from the build path, and split `server.js` into the `routes/` modules that already exist as a pattern. Remove `apply:runtime` from `pretest` and `vercel-build`.
**Effort:** 3–4 engineer-weeks. **ROI:** Very high — unblocks essentially every other item.

---

### CRIT-2 — Production may be running on a personal/unlabelled Supabase project while a project named `sonara-industries-prod` sits paused

**Evidence (live):** `list_projects` returns two projects in org `kkgxjldlugkhsfzjkxfi`:

| Project | Ref | Status |
|---|---|---|
| `sonara-industries-prod` | `ltzpppffnwopdxbchajr` | **INACTIVE** |
| `famouslytrill-boop's Project` | `yqncsonkxgwhcxedgevk` | ACTIVE_HEALTHY |

The repository pins the **second** one: `scripts/verify-supabase-contract.mjs:268` hard-fails unless the MCP URL contains `project_ref=yqncsonkxgwhcxedgevk`, and `sonara-industries/supabase/.temp/project-ref` contains `yqncsonkxgwhcxedgevk`. `supabase/config.toml` names the project `famouslytrill-project`.

**Why this is critical:** Customer data, billing records, and auth for a paid product are on a project named after a personal account, while the project carrying the production name is paused. Paused Supabase projects are subject to deletion policies after prolonged inactivity. If `sonara-industries-prod` was ever intended as production, there is a live/dead mismatch nobody's tooling is checking.

**Severity note after measuring data volume:** the live project holds 4 profiles
and 2 organizations (see HIGH-1), so the *data-custody* exposure today is small.
The identity and operational-hygiene problem stands on its own: nothing verified
which project the pipeline was migrating, and an operator reaching for
"sonara-industries-prod" during an incident would find the wrong, paused project.

**Owner decision (made 2026-07-27):** keep `yqncsonkxgwhcxedgevk` as production
and rename it; archive the paused sibling.

**Status: partially closed.** `scripts/verify-production-project-identity.mjs`
now runs in the deploy workflow before anything is applied, and asserts the
pinned project ref, `ACTIVE_HEALTHY` status, and — once
`SONARA_EXPECTED_SUPABASE_PROJECT_NAME` is set — the project name. It also warns
about any paused sibling named like production.

**Still requires manual action in the Supabase dashboard** (cannot be done from
this repository):
1. Rename `yqncsonkxgwhcxedgevk` to `sonara-industries-prod` (or similar), then
   set `SONARA_EXPECTED_SUPABASE_PROJECT_NAME` so the name check becomes binding.
2. Archive or delete the paused `ltzpppffnwopdxbchajr` so it cannot be mistaken
   for the live project.

**Effort:** 1–3 days. **ROI:** High.

---

### CRIT-3 — RLS is not the tenant-isolation boundary; hand-written URL filter strings are

**Evidence:** Every data path in `server.js` uses the service-role key, which **bypasses RLS entirely**:

```js
// server.js:4696
function supabaseHeaders(config, options = {}) {
  const headers = { apikey: config.serviceRoleKey, Authorization: `Bearer ${config.serviceRoleKey}`, ... };
```

Tenant scoping is then applied by manually concatenating PostgREST filters, e.g. `server.js:3354`:

```js
`${config.url}/rest/v1/launch_checklist_items?id=eq.${encodeURIComponent(id)}&organization_id=eq.${encodeURIComponent(organization.organizationId)}`
```

**Why this is critical:** The 259 tables with RLS enabled and the ~1,600 policies provide **zero protection for application traffic** — they only protect direct anon/authenticated PostgREST access. The actual multi-tenant boundary is a developer remembering to append `&organization_id=eq.…` to every one of ~100+ query sites. A single omission is a silent cross-tenant data leak with no test, no lint, and no runtime check that would catch it.

Note: the values *are* consistently `encodeURIComponent`-wrapped, so I found **no PostgREST filter-injection vector** — that part is done correctly. The risk is omission, not injection.

**Fix (in priority order):**
1. Introduce a single data-access helper that takes `(table, orgId, filters)` and **refuses to build a query without an explicit tenant scope**. Ban raw `fetch(\`${config.url}/rest/v1/...\`)` via ESLint `no-restricted-syntax`.
2. Medium term, move user-facing reads to a **user-scoped client** (forward the caller's JWT instead of the service-role key) so RLS becomes a real second line of defence, reserving service-role for genuine admin paths.
3. Add cross-tenant integration tests: seed two orgs, assert org A cannot read org B on every table group.

**Effort:** 2 weeks for (1)+(3); 4–6 weeks for (2). **ROI:** Very high.

---

### CRIT-4 — No rate limiting anywhere, on any route, including authentication

**Evidence:** `grep -rn "rateLimit\|rate_limit\|429" server.js` returns **nothing**. `app.post("/admin/login", …)` (`server.js:927`) and the customer login/signup routes have no throttle, no lockout, no CAPTCHA, and no backoff.

**Why this is critical:** Unlimited credential stuffing against admin login. Worse, it compounds with PERF-1: each login attempt triggers server-side Supabase auth calls, so an attacker can also drive Supabase auth quota exhaustion and Vercel function spend from a single host. There is an `admin_audit_events` table recording `admin.login.failed`, so attempts are logged — but nothing acts on them.

**Fix:** Per-IP and per-account rate limits on all auth routes, exponential lockout on repeated failure, and a global limiter on write endpoints. On Vercel serverless, in-process counters do not work across instances — use Upstash/Redis or Vercel's edge middleware. Enable Supabase's leaked-password protection (currently **disabled**, per live advisor).
**Effort:** 1 week. **ROI:** Very high.

---

### CRIT-5 — Migrations are applied to production *before* deployment, with no rollback path

**Evidence:** `.github/workflows/controlled-production-deploy.yml` step order:

1. `supabase db push --linked --include-all` ← **schema changes land in production here**
2. Pull Vercel env, run DB verification
3. `vercel deploy --prod`
4. Health/alias/commit verification

If step 3 or 4 fails, the schema has already changed and there is **no down-migration, no snapshot, and no revert step** anywhere in the workflow. `if: failure()` only uploads diagnostics.

Additionally `--include-all` overrides Supabase's ordering safety, and there is no pre-push backup.

**Fix:** Take a PITR checkpoint or `pg_dump` before push; require migrations to be expand-only (additive) so old and new code can both run; deploy application first, migrate second where possible; add an explicit rollback job that redeploys the previous Vercel deployment. Document a tested rollback runbook — `LAUNCH_RUNBOOK.md` is currently **0 bytes**.
**Effort:** 1–2 weeks. **ROI:** Very high.

---

## 3. High-priority improvements

### HIGH-1 — Database performance: 2,348 advisor findings, all currently latent

**Read this first — it changes how the 2,348 findings should be treated.**
Measured live during Phase 1 work:

| Measure | Value |
|---|---:|
| Tables in `public` | 346 |
| **Total live rows, all tables** | **200** |
| Tables with any rows | 14 |
| Largest table | 34 rows |
| `profiles` / `organizations` / `organization_memberships` | 4 / 2 / 2 |

Most of those 200 rows are seed catalog data (`service_catalog_items`,
`huggingface_resource_catalog`, `integration_providers`). Actual customer data is
4 profiles and 2 organizations.

So **none of the 2,348 findings is causing a slow query today** — there is no
data to be slow over. They are latent scalability debt, not an active
bottleneck. Any claim that fixing them "speeds up the platform" would be false.

The reason to fix them now is different and still good: **this is the cheapest
and safest moment**. Altering 300+ policies and building indexes is instant and
reversible on empty tables. After launch the same work needs `CONCURRENTLY`,
lock windows, and rehearsal. The benefit is realised later; the cost of buying
it is lowest today.

There is also a second-order point worth stating plainly: because the
application uses the service-role key for all traffic (CRIT-3), **RLS policy
performance currently affects almost nothing the application does** — policies
are only evaluated for direct anon/authenticated PostgREST access. The RLS
performance work pays off when, and only when, user-scoped clients land.

Live `get_advisors(type: "performance")` on `yqncsonkxgwhcxedgevk`:

| Finding | Count | Impact |
|---|---:|---|
| `multiple_permissive_policies` (WARN) | **1,330** | Every permissive policy for a role/action is evaluated **per row**. Tables commonly carry both `org members can read X` and `service role can manage X` for both `anon` and `authenticated` — 4 combinations per table. |
| `unindexed_foreign_keys` (INFO) | **511** | e.g. `accounting_exports_created_by_fkey`, `admin_audit_events_actor_user_id_fkey`. Causes sequential scans on joins and slow cascading deletes. |
| `auth_rls_initplan` (WARN) | **312** across **228 tables** | `auth.uid()` / `current_setting()` re-evaluated **per row** instead of once per query. This is the single highest-leverage RLS fix in Postgres. |
| `unused_index` (INFO) | **191** | Write amplification and storage with no read benefit. |
| `duplicate_index` (WARN) | **4** | e.g. `business_memberships_workspace_id_user_id_key` vs `business_memberships_workspace_user_key`. |

**Fixes, and what was actually done:**

1. **`auth_rls_initplan` — done** (`20260727180000_rls_initplan_and_index_hygiene.sql`).
   Wraps `auth.uid()`/`auth.role()`/`auth.jwt()` in a scalar subquery so the
   planner folds them into a once-per-query InitPlan. Applied by iterating
   `pg_policies` rather than hand-listing 312 statements, with the 18
   already-wrapped policies protected against double-wrapping. Validated
   read-only before writing: 292 policies change on `qual` alone, zero
   double-wraps. The codebase already used this pattern correctly in
   `is_admin_or_founder()`; it just wasn't applied uniformly.
2. **Duplicate indexes — done.** All 4 dropped.
3. **FK indexes — scoped deliberately, not applied wholesale.** The advisor
   reports 511 uncovered foreign keys, but only **5** are on tables with any
   rows. Creating all 511 would add write amplification across 346 tables to
   serve queries that do not exist — in a database that *already* carries 191
   indexes the advisor calls unused. The migration indexes the **218 `ON DELETE
   CASCADE`** keys plus the 5 populated ones: an uncovered cascade key forces a
   sequential scan of every child table on parent delete, which is structural
   and size-independent (deleting one organization would scan dozens of child
   tables). The remaining ~288 are deferred until query evidence justifies them.
4. **Consolidating the 1,330 permissive policies — deliberately deferred.**
   Merging the `service_role` branch into member policies (the pattern in
   `20260726163000`) would remove roughly half, but it *rewrites authorization
   logic* rather than just its evaluation strategy. That deserves its own change
   with cross-tenant tests behind it — ideally after CRIT-3, so those tests
   exist. Bundling it with a mechanical performance pass would be the wrong risk
   trade.
5. **The 191 unused indexes — not touched.** On a 200-row database "unused" is
   uninformative; it mostly means "feature not launched". Revisit with real
   traffic.

**Effort:** 2–3 weeks for the full set; items 1–3 are done. **ROI:** Low today,
high at scale — see the framing above. The value captured now is the *option* to
have made these changes cheaply.

---

### HIGH-2 — 4–6 sequential uncached network round trips before any business logic

**Evidence:** `verifySupabaseAccessToken` (`server.js:3738`) performs a network call to `/auth/v1/user` on **every request**. `getUserRoles` (`3930`) performs another. `resolveWorkspaceAccess` contains 3 awaits; `getCustomerPaidEntitlement` performs 2 more fetches. `getCustomerPrimaryOrganization` (`3817`) issues two more sequential queries.

`grep` for any cache/memo/TTL in `server.js` returns **nothing**. There is zero caching of any kind.

So a single authenticated page load costs roughly **4–6 sequential HTTPS round trips to Supabase before the handler starts**, on every request, on serverless (no warm in-process state to rely on, and no connection reuse guarantees).

**Fix:**
- Verify the Supabase JWT **locally** using the project JWT secret (signature + `exp` + `aud`) instead of calling `/auth/v1/user`. Removes one full round trip per request with no security loss.
- Cache roles/entitlements in a short-TTL store (60s) keyed by user id, or fold them into a signed session cookie refreshed on login and on plan change.
- Parallelise the remaining independent lookups with `Promise.all` — several are currently sequential for no reason.

**Effort:** 1–2 weeks. **ROI:** Very high — likely the largest single latency reduction available, and it cuts Supabase auth request volume by a large multiple.

---

### HIGH-3 — 1,165 TypeScript files are dead weight relative to the deployed system

**Evidence:** No deployed file imports `app/`, `components/`, or `src/` (`grep` across `server.js` and `routes/*.cjs` returns nothing). `next` and `typescript` are not installed, so this tree **cannot even be compiled or type-checked**. `"lint"` explicitly excludes `frontend/`, `my-app/`, and `sonara-industries/`. There are at least six parallel app trees: `app/`, `frontend/`, `my-app/`, `src/`, `sonara-industries/`, `packages/`.

**Why it matters:** It makes the repository unnavigable, produces false confidence ("we have a Next.js frontend"), guarantees any search or audit returns misleading results, and means `npm audit`/dependency scanning covers code that isn't deployed while the deployed code has almost no dependency surface at all.

**Fix (owner decision required):** Either (a) commit to the Express app and move these trees to `docs/archive/` or a separate repository, or (b) commit to migrating to Next.js and make the TS tree the real app. Both are defensible; the current state — maintaining both, deploying neither together — is the worst option. Given CRIT-1, I'd recommend (a) first, then reconsider (b) once `server.js` is modularised.
**Effort:** 1 week to archive; 8–12 weeks for a genuine Next.js migration. **ROI:** High for archiving.

---

### HIGH-4 — Functions in `public` still granting EXECUTE to PUBLIC

**Severity corrected after direct catalog inspection.** The live advisor reports
`capture_initial_sonara_prompt_version()` as an anon-callable `SECURITY DEFINER`
function, which reads as critical. Querying `pg_proc` directly gives a smaller
and more precise picture, and the audit should reflect the smaller one:

| Function | ACL state | SECURITY DEFINER | Returns |
|---|---|---|---|
| `capture_initial_sonara_prompt_version()` | NULL → default `EXECUTE TO PUBLIC` | yes | `trigger` |
| `set_sonara_prompt_updated_at()` | NULL → default `EXECUTE TO PUBLIC` | yes | `trigger` |
| `current_user_id()` | explicit `=X/postgres` (PUBLIC) | **no** | `uuid` |

Why this is High and not Critical:

- Both `SECURITY DEFINER` functions return `trigger`. PostgreSQL refuses to
  invoke a trigger-returning function directly, so the reachable call fails
  before the body runs. The grant is wrong; it is not a usable escalation.
- `current_user_id()` is `SECURITY INVOKER`, so its mutable `search_path` is a
  hardening item, **not** the privilege-escalation vector I first described. It
  only returns `auth.uid()`.

Two genuinely notable facts came out of the check:

- `current_user_id()` **exists in production but is created by no migration in
  this repository** — more drift, of the same class as HIGH-5. Zero RLS policies
  reference it, so it is also dead code.
- Scoped to non-extension functions, this is the *entire* remaining exposure: all
  25 app functions are `postgres`-owned and 22 already carry closed ACLs. The
  `20260718064853` hardening worked; these three post-date or slipped past it.

**Status: fixed in this branch** by `20260727170000_phase0_function_execute_boundary.sql`,
which revokes the three grants, codifies and pins `current_user_id()`, and adds a
self-verifying assertion that fails the migration if *any* non-extension function
in `public` grants EXECUTE to PUBLIC — closing the class, not just these three.

Do **not** revoke the other helper functions executable by `authenticated`: RLS
policies invoke them, so `authenticated` requires EXECUTE for those policies to
evaluate. The `20260718064853` grants are correct as written.
**Effort:** 1–2 days. **ROI:** Medium-high (hygiene and advisor cleanliness rather than a closed breach).

---

### HIGH-5 — The verifier does not cover the control-plane tables, and production has drifted

**Evidence:** `20260621020300_sonara_runtime_control_plane.sql` creates 8 tables (`sonara_write_api_registry`, `sonara_permission_matrix`, `sonara_webhook_verification_registry`, `sonara_storage_bucket_registry`, `sonara_realtime_channel_registry`, `sonara_worker_job_registry`, `sonara_ui_capability_registry`, `sonara_control_plane_checks`) with **no RLS statement, no policies, and no grants** in the migration.

But the live advisor reports RLS **is** enabled on all of them ("RLS enabled, but no policies exist"). So production state does not match the migration files, and `verify-production-supabase.mjs` did not flag it — because `grep` confirms none of these tables appear in `lib/sonara-database-contract.cjs` or the verifier.

The current live state is **fail-closed** (RLS on, no policies = deny all for anon/authenticated), which is safe. But it is unmanaged, unreproducible from migrations, and invisible to the reconciler that the handoff describes as verifying "RLS enabled", "policies", and "unexpected production drift".

Live advisor also shows the same pattern on **customer-relevant** tables: `customers`, `billing_events`, `audit_logs`, `prompt_templates`, `sonara_launch_settings` all have RLS enabled with **no policies**.

**Fix:** Add an explicit migration enabling RLS and declaring intended policies (even if that policy is "service_role only") for all 15 tables. Add every table to the database contract. Make the reconciler fail on *any* `public` table absent from the contract, rather than only checking contract members — this closes the whole class of gap.
**Effort:** 1 week. **ROI:** High.

---

### HIGH-6 — ~62% of the API surface is undocumented despite an OpenAPI CI gate

**Evidence (measured post-codegen, the state CI actually validates):** the spec
declares **187 operations across 136 paths**; the runtime registers **498
route+method pairs across 423 distinct paths**. `verify:api` passes and reports
*"187 operations across 136 paths match the Express runtime"* — confirming the
gate checks that documented operations match reality, never that reality is
covered. Undocumented routes are invisible to it.

**Fix:** Add a coverage assertion to `verify-openapi-contract.mjs`: enumerate registered routes from the Express router stack and fail if any non-internal route is missing from the spec. Backfill the spec.
**Effort:** 2 weeks. **ROI:** High — required for any enterprise/partner API story.

---

## 4. Medium improvements

- **MED-1 — No CSRF tokens.** Cookies are correctly `httpOnly`, `sameSite: "lax"`, `secure` in production (`server.js:3576`), and CSP sets `form-action 'self'`. `SameSite=Lax` does block cross-site POST, so this is **not currently exploitable in modern browsers** — but for a cookie-session HTML-form app, token-based CSRF is the expected defence in depth, especially given `GET` routes that mutate state should be audited. *Effort: 1 week.*
- **MED-2 — Session cookie stores the raw Supabase access token.** `res.cookie(ADMIN_SESSION_COOKIE, auth.session.accessToken, …)` (`server.js:947`). An XSS or cookie-disclosure bug yields a token usable directly against the Supabase API, not just against SONARA. Prefer an opaque server-side session id. *Effort: 1 week.*
- **MED-3 — `pnpm audit`: 1 low-severity vulnerability.** Genuinely good posture; the `pnpm-workspace.yaml` `overrides` block is well-maintained. Keep it. *Effort: trivial.*
- **MED-4 — Migration hygiene.** 64 migrations with mixed naming conventions (`003_…` sequential vs `20260528…` timestamped), and at least 6 `retry`/`fix` migrations including two files with near-identical names (`019_sonara_operational_strengthening_retry.sql` and `20260621020000_sonara_operational_strengthening_retry.sql`). Consider a squashed baseline. *Effort: 1 week.*
- **MED-5 — `pgvector` extension installed in `public` schema.** Advisor WARN. Move to a dedicated `extensions` schema. *Effort: 1 day.*
- **MED-6 — No structured logging, tracing, or error tracking** in the deployed runtime. No Sentry, no OpenTelemetry, no request ids. Debugging production is limited to Vercel's raw function logs. *Effort: 1–2 weeks.*
- **MED-7 — `build` does not build.** `"build": "node --check server.js && node -e \"require('./server')\""` — a syntax check plus a module load. Combined with `typecheck` also being `node --check`, **CI has no type safety or compilation step at all** for a system described as TypeScript. *Effort: folded into CRIT-1.*
- **MED-8 — No CI parallelisation or caching beyond pnpm.** `controlled-production-deploy.yml` runs ~15 sequential steps in one job. Test/lint/verify stages are independent and could be a matrix, cutting wall-clock substantially. There is also no `pull_request` validation gate in that workflow — it triggers only on `push` to `main`. *Effort: 1 week.*
- **MED-9 — Response payloads are unbounded in places.** Some queries use `limit=20` (`server.js:3196`), others (e.g. `launch_checklist_items`, `server.js:3308`) fetch **all rows for an organization with no limit**. No cursor pagination anywhere. *Effort: 2 weeks.*

---

## 5. Nice-to-have improvements

- **NICE-1** — `LAUNCH_RUNBOOK.md` is **0 bytes**. Fill it, or delete it so it stops implying coverage.
- **NICE-2** — `test-output.txt`, `output/`, `reports/`, and `_claude_workbench/` are committed to the repo root. Move to artifacts or `.gitignore`.
- **NICE-3** — Two ESLint configs coexist (`eslint.config.cjs` and `eslint.config.mjs`). Consolidate.
- **NICE-4** — `server-saas.js` (265 lines) appears orphaned; nothing requires it. Confirm and delete.
- **NICE-5** — Accessibility and Lighthouse: the app server-renders HTML from template literals with a consistent `escapeHtml` helper (`server.js:4729`, correctly escaping `&<>"'`). I found **no XSS vector** in the escaping itself. However there is no automated a11y testing, no axe/Lighthouse CI, and no bundle analysis — though the last matters little given there is essentially no client-side JS. **[UNVERIFIED]** — a real Lighthouse/axe run against production is needed; static inspection cannot substitute.
- ~~**NICE-6** — Add `Permissions-Policy` and `Referrer-Policy` headers.~~
  **Withdrawn — I was wrong.** Both are already set, alongside
  `X-Content-Type-Options`, `Cross-Origin-Opener-Policy`, and
  `Cross-Origin-Resource-Policy` (`server.js:82–88`). The response-header posture
  is complete; nothing to add here.

---

## 6. AI architecture — there is no AI system to review

This is the finding with the largest gap between the handoff and reality, so it needs stating plainly.

**What was verified:**
- **No inference calls.** `grep` for `api.openai.com`, `api.anthropic.com`, `generativelanguage`, `api-inference.huggingface`, `/v1/chat/completions`, `/v1/embeddings`, `/v1/messages` across `server.js`, `routes/`, and `lib/*.cjs` returns exactly **one** hit: a `defaultBaseUrl` string constant in `lib/creator-generation-provider-registry.cjs:32`. It is never called.
- **The "Provider Gateway" makes no network calls.** `lib/optional-ai-gateway.cjs` states this in its own header comment: *"This is a readiness DETECTOR only. It never makes network calls."* It reads env vars and reports configuration status.
- **No embeddings are ever generated or stored.** The only `embedding` column has no index and no reader/writer.
- **No retrieval, no memory, no agents, no evaluation, no observability, no inference routing.** The `entity_agents`, `entity_agent_runs`, `entity_agent_memory` tables exist with RLS and policies, but nothing in the runtime writes to them.

**What actually exists** is a well-organised **governance catalog**: `lib/sonara-huggingface-catalog.cjs` holds curated model metadata (BGE, Qwen3-Embedding-0.6B, SigLIP2, Whisper, Granite Docling) with task, runtime class, capability, licence and risk annotations, plus evaluation dataset entries (GSM8K, MMLU, Banking77, MInDS-14). This is genuinely useful **preparatory** work — but it is a spreadsheet of intentions, not an architecture.

**Recommendation — build the thinnest real vertical slice before expanding the catalog:**

1. **One server-side provider adapter** behind an interface, with timeout, retry, cost accounting, and per-org quota. Keep keys server-only per `AGENTS.md`.
2. **One real retrieval path:** generate embeddings for `sonara_memory_records`, add an **HNSW index** (`vector_cosine_ops`), and expose a `security definer` RPC that does the similarity search with an explicit org filter. Note the current `vector(1536)` dimension is a placeholder — BGE-small is 384, Qwen3-Embedding-0.6B is 1024. **Pick the model before fixing the dimension**, or the column is wrong on day one.
3. **Observability from the first call**: log prompt/response/token/cost/latency per request. Retrofitting this is much harder.
4. **An eval harness** before the second model, using the datasets already catalogued.
5. Only then expand orchestration, agents, and inference routing.

**On the Hugging Face research request:** expanding the catalog is premature while there is no inference path — the highest-value work is item 1 above, not more catalog entries. The assets already catalogued (BGE, Qwen3-Embedding, SigLIP2, Whisper-family, Granite Docling) are appropriate starting choices for a commercial SaaS, and the existing risk/licence annotation discipline is the right approach. **[UNVERIFIED]** — I did not perform live licence verification against the Hugging Face Hub during this audit. Every asset's licence must be re-confirmed at the moment of adoption, since Hub licences and gating status change; the existing "blocked: non-commercial / gated / unsafe serialization / unknown licensing" policy is the correct gate to run them through.

**Effort:** 6–8 weeks for a production-grade vertical slice. **ROI:** This is the entire premise of "enterprise AI operating system" — currently at zero.

---

## 7. Risk register

| ID | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Cross-tenant data leak from an omitted `organization_id` filter | Medium | Critical | CRIT-3 |
| R2 | Production DB is a personal-named project; sibling "prod" project paused | Confirmed | Critical | CRIT-2 |
| R3 | Failed deploy leaves production schema ahead of code, no rollback | Medium | Critical | CRIT-5 |
| R4 | Credential stuffing / auth brute force | High | High | CRIT-4 |
| R5 | Codegen corrupts `server.js`; no one can safely modify it | High | High | CRIT-1 |
| R6 | DB performance collapse as row counts grow (312 per-row `auth.uid()` policies) | High | High | HIGH-1 |
| R7 | Anon-callable `SECURITY DEFINER` RPC | Confirmed | Medium | HIGH-4 |
| R8 | Key-person dependency — the 44 codegen scripts are effectively undocumented tribal knowledge | High | High | CRIT-1 + docs |
| R9 | Roadmap planned against an inaccurate system picture | Confirmed | High | This document |

---

## 8. Proposed implementation order

Sequenced so that each phase unblocks the next. Effort assumes 1–2 engineers.

> **Revised after measuring production data volume (HIGH-1).** The platform has
> 4 profiles and 2 organizations — it is pre-launch. That is the single most
> useful scheduling fact in this document, and it argues for doing the
> *structural* work first, not the performance work:
>
> - **CRIT-1 (freeze codegen)** and **CRIT-3 (tenant isolation)** are the two
>   items whose cost rises fastest with adoption. Rewriting the data-access layer
>   with 2 organizations is a refactor; with 2,000 it is a migration project.
> - **CRIT-5 (rollback)** and the DB performance work matter most *after* launch,
>   but both are cheapest to build now.
> - Nothing here is currently on fire. There is no incident to outrun, which is
>   exactly the condition under which the expensive structural fixes are
>   affordable.
>
> If launch is near, do CRIT-1 and CRIT-3 before it, not after.

**Phase 0 — Stop the bleeding (1–2 weeks)**
1. CRIT-2 — resolve the Supabase project identity question. **Open; owner decision — cannot be resolved from the repository.**
2. CRIT-4 — rate limiting on auth routes. **Done** (`lib/sonara-rate-limit.cjs`,
   `20260727171000_phase0_auth_rate_limits.sql`, applied to all six credential
   endpoints). Leaked-password protection is a **dashboard setting** and is still
   **off** — it cannot be changed from this repository; enable it under
   Authentication → Providers → Password.
3. HIGH-4 — **Done** (`20260727170000_phase0_function_execute_boundary.sql`).
4. CRIT-5 — **Done** (pre-migration checkpoint step in the deploy workflow +
   `docs/PRODUCTION_ROLLBACK_RUNBOOK.md`). The deeper fix — reordering the
   pipeline so the app deploys before expand-only migrations — remains open.

**Phase 1 — Make the codebase workable (4–6 weeks)**
5. CRIT-1 — freeze codegen, commit generated output, split `server.js` into modules.
6. HIGH-3 — archive or commit to the dead TS trees.
7. MED-7 — restore a real build and type-check step.

**Phase 2 — Make it safe and fast (4–6 weeks)**
8. CRIT-3 — tenant-scoped data-access helper, ESLint ban on raw fetch, cross-tenant tests.
9. HIGH-1 — the `(select auth.uid())` rewrite, policy consolidation, FK indexes.
10. HIGH-2 — local JWT verification, role/entitlement caching, parallelised lookups.
11. HIGH-5 — contract coverage for all `public` tables; reconciler fails on unknown tables.

**Phase 3 — Make it enterprise-credible (4–6 weeks)**
12. HIGH-6 — OpenAPI coverage gate + backfill.
13. MED-6 — structured logging, tracing, error tracking.
14. MED-8/MED-9 — CI parallelisation, PR gate, pagination.

**Phase 4 — Build the AI system (6–8 weeks)**
15. §6 items 1–5, in order.

**Total: roughly 20–28 engineer-weeks** to reach a defensible enterprise posture, with the AI platform as the final phase rather than the first.

---

## 9. What is genuinely good

Worth recording, because it should not be regressed during the work above:

- **Secret hygiene.** Service-role key is confined to specific CI steps with explanatory comments, never at job scope. `.vercelignore` and `.gitignore` are thorough. A dedicated client-secret scanner runs in CI.
- **CSP** (`server.js:88`) is well-constructed — `script-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`, no `unsafe-inline` for scripts.
- **Stripe webhook verification** uses `crypto.timingSafeEqual` with a length check (`server.js:4206–4209`) — correctly implemented.
- **Invite tokens** are `randomBytes(32)` stored as SHA-256 hashes (`server.js:2657`, `2778`) — correct pattern.
- **`20260718064853_data_api_privilege_hardening.sql`** is a genuinely sophisticated migration: revokes default privileges so new objects are opt-in, pins `search_path` on helpers, and includes self-verifying `do $$` assertion blocks that fail the migration if the boundary didn't take. This is the standard the rest of the schema should be held to.
- **Deployment verification** — asserting the deployed commit SHA matches `GITHUB_SHA` on both apex and www before declaring success is a strong control that many mature teams lack.
- **PostgREST parameter encoding** is consistently correct; I found no injection vector.
- **Dependency posture** — one low-severity finding, with an actively maintained overrides block.

---

## 10. Verification commands used

```bash
# Deployed-runtime reality
grep -rn "\"next\"\|typescript" package.json          # absent
grep -l "server.js" scripts/*.cjs | wc -l             # 44
grep -rhoE "app\.(get|post|put|patch|delete)\(" server.js routes/*.cjs | wc -l   # 309
grep -cE "^  /" openapi/sonara.yaml                   # 64

# AI reality
grep -rn "api.openai.com\|api.anthropic.com\|/v1/embeddings\|/v1/chat/completions" \
  server.js routes/ lib/*.cjs                         # 1 unused constant
grep -rn "ivfflat\|hnsw\|<=>\|<->" supabase/migrations/*.sql   # none

# Security / rate limiting
grep -rn "rateLimit\|rate_limit\|429" server.js       # none
grep -rn "csrf" server.js routes/*.cjs                # none

# Live, read-only
mcp__Supabase__list_projects
mcp__Supabase__get_advisors(project_id="yqncsonkxgwhcxedgevk", type="security")
mcp__Supabase__get_advisors(project_id="yqncsonkxgwhcxedgevk", type="performance")
```

No write operations were performed against any Supabase project during this audit.
