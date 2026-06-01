# Launch Security Gate

Date: 2026-06-01

Scope: current Signal OS / SONARA One static web shell, typed safety modules, package scripts, and Supabase migration files in this repository.

Overall status: conditional pass for repository artifacts. Production launch remains blocked until migrations are applied to the target Supabase project, admin/session enforcement is verified against real auth, and hosting environment secrets are reviewed.

## Current Verification Snapshot

Latest sprint verification on 2026-06-01:

- `pnpm run security:scan-artifacts` passed with `findings=0 critical=0`.
- `pnpm run validate:migrations` passed.
- Targeted safety tests passed for source leak prevention, AI provider privacy gate, Legal Readiness, Security Center, and launch audit checks.
- Public-claim scan found disclaimer/blocking language only for guaranteed revenue, legal/tax/financial advice, fake reviews, attorney replacement, and uptime terms.
- Production launch remains no-go until the hard launch blocks below are resolved in the target deployment environment.

## Gate Matrix

| Gate                                            | Evidence                                                                                                                                                                                                                                                         | Status                  | Required action                                                                                                 |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------- |
| No secrets in repo                              | `.env.example` is the only `.env*` file. `pnpm run security:scan-artifacts` completed with `findings=0 critical=0`.                                                                                                                                              | Pass                    | Re-run scanner before every release.                                                                            |
| Env examples are safe                           | `.env.example` uses empty placeholders for Supabase values and keeps unsafe flags false.                                                                                                                                                                         | Pass                    | Configure production secrets only in the hosting provider.                                                      |
| No service-role keys client-side                | `packages/web/src/lib/server-secrets.ts` returns `SUPABASE_SERVICE_ROLE_KEY` only outside browser runtime. `packages/web/src/lib/env.ts` reads only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` for client-safe config.                       | Pass                    | Never introduce `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`.                                                        |
| RLS-ready tables                                | `supabase/migrations/0001_auth_organization_scaffold.sql` and `supabase/migrations/0002_launch_mvp_core_tables.sql` enable RLS and include organization-scoped policies. `pnpm run validate:migrations` passed.                                                  | Ready, not applied here | Apply migrations in order and manually verify RLS in the target Supabase project.                               |
| Admin routes protected                          | `packages/web/src/routes/route-manifest.ts` marks admin and Security Center routes as `admin-ready`. `packages/web/src/lib/auth/protected-route.ts` blocks routes without a user, organization, active membership, and admin-capable role.                       | Conditional pass        | Verify with real auth/session wiring before public launch. Keep blocked previews limited to setup-only content. |
| Payment data is not stored                      | `payment_options` and money-adjacent records store labels, external URLs, status, and metadata. SQL comments and TypeScript helpers explicitly block raw card numbers, CVV, bank credentials, provider secrets, and tokens.                                      | Pass                    | Keep provider-hosted checkout/link flows. Do not store credentials.                                             |
| Audit logs exist for sensitive actions          | `audit_logs` and `approval_events` exist in migrations; Trust Shield MVP has typed audit and approval models.                                                                                                                                                    | Ready, not fully wired  | Wire live audit inserts before enabling sensitive writes.                                                       |
| Source map leak scan                            | `scripts/security-scan-artifacts.mjs` scans env files, build outputs, `.map` files, API key patterns, and service-role key patterns.                                                                                                                             | Pass                    | Run scanner after build and before deployment.                                                                  |
| External AI provider privacy gate               | `packages/web/src/lib/ai-models/model-provider-registry.ts` disables external providers by default, keeps Kimi disabled, blocks sensitive external routing, and redacts secret-like prompts.                                                                     | Pass                    | Require approval before enabling external sensitive-data routing.                                               |
| Public pages have no fake claims                | Copy scan found only safety disclaimers and blocked-claim language for guaranteed revenue, legal advice, fake reviews, and uptime claims.                                                                                                                        | Pass                    | Keep claims evidence-backed and remove any future guaranteed outcome wording.                                   |
| Legal Readiness disclaimers                     | `packages/web/src/lib/legal-readiness/records.ts` states preparation only, not legal advice, no guaranteed compliance, and human review for high-risk items.                                                                                                     | Pass                    | Keep Legal Readiness as prep and review support only.                                                           |
| Voice, visual, video dangerous capabilities off | `packages/web/src/lib/shared/feature-flags.ts`, `.env.example`, and `packages/web/src/lib/beta-studios/records.ts` keep `VIDEO_UPLOAD_PROCESSING_ENABLED`, `VOICE_CLONING_ENABLED`, `PUBLIC_VISUAL_GENERATION_ENABLED`, and `LOCAL_VISUAL_MODELS_ENABLED` false. | Pass                    | Do not enable dangerous media processing without consent, review, and audit wiring.                             |
| Dependency audit reviewed                       | `pnpm audit --audit-level moderate` passed with no known vulnerabilities after the unused Next.js lockfile path was removed.                                                                                                                                     | Pass                    | Keep audit in CI and review dependency updates before applying them.                                            |

## Hard Launch Blocks

- Real secrets, service-role keys, private keys, or provider tokens in repo or build output.
- Any client-side service-role secret exposure.
- Supabase migrations not applied or RLS not manually verified.
- Admin, Security Center, Developer Tools, AI Provider, or Reliability routes serving private data without real auth and organization membership.
- Raw payment credential, CVV, full bank credential, provider secret, or token storage.
- Source maps or secret-like values in public build artifacts.
- External AI routing with unredacted secrets, private repo dumps, or sensitive customer data.
- Public claims of guaranteed revenue, guaranteed compliance, attorney replacement, fake reviews, fake ratings, or 100 percent uptime.
- Voice cloning, unrestricted visual generation, local visual model processing, or video upload processing enabled without explicit review.
- Unreviewed dependency audit findings at moderate severity or above.

## Commands

Run these before release:

```sh
pnpm run security:scan-artifacts
pnpm audit --audit-level moderate
pnpm run validate:infrastructure
pnpm run validate:migrations
pnpm run typecheck
pnpm run lint
pnpm test
pnpm run build
pnpm run smoke
```

## Launch Decision

Recommendation: no-go for production release until environment secrets, Supabase migration application, RLS verification, and real auth/session behavior are confirmed in the deployment environment.

Repository status: safe to continue development with current gates documented and critical unsafe capabilities blocked by defaults.
