# Risk Register

Date: 2026-06-01

This register tracks current launch security risks for the repository. It is not a replacement for production security review.

Latest sprint verification on 2026-06-01:

- Source leak artifact scan passed with zero critical findings.
- Migration validation passed, but target Supabase application and RLS verification remain blocked until the database environment is available.
- Targeted safety tests passed for source leak prevention, AI provider privacy gate, Legal Readiness, Security Center, and launch audit checks.
- Public copy matches for risky terms are currently disclaimers or blocked-claim language, not positive claims.

| ID    | Area                                   | Severity | Status                                 | Evidence                                                                                                                                                                             | Recommendation                                                                                                         |
| ----- | -------------------------------------- | -------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| R-001 | Secrets in repo                        | Critical | Mitigated in current scan              | `.env.example` is the only `.env*` file; source leak scanner returned zero critical findings.                                                                                        | Re-run `pnpm run security:scan-artifacts` after every build and before deployment.                                     |
| R-002 | Environment setup                      | High     | Open                                   | `.env.example` is safe, but production secrets are not verifiable from repo files.                                                                                                   | Configure Supabase, Stripe/provider, and server-only secrets in hosting settings. Do not commit real values.           |
| R-003 | Supabase RLS application               | Critical | Blocked until environment verification | Migrations include RLS policies and `pnpm run validate:migrations` passed, but local Supabase application was not verified in this environment.                                      | Apply migrations in order, then manually test anonymous, member, admin, and non-member access.                         |
| R-004 | Admin route enforcement                | High     | Conditional                            | Route manifest marks admin routes `admin-ready`; protected route helper blocks access without user, org, membership, and role. Some blocked previews render setup-only page content. | Verify real auth/session wiring before launch. Do not render private records in blocked previews.                      |
| R-005 | Payment data storage                   | Critical | Mitigated                              | Payment tables and local money-adjacent records store external URLs, labels, status, and metadata only.                                                                              | Keep payment processing provider-hosted. Do not add card, CVV, bank credential, provider secret, or token fields.      |
| R-006 | Audit coverage                         | High     | Partially ready                        | `audit_logs` and `approval_events` tables exist; Trust Shield typed audit models exist.                                                                                              | Add live audit writes before enabling sensitive payment, security, privacy, or publishing changes.                     |
| R-007 | Source map and artifact leakage        | High     | Mitigated in current scan              | `scripts/security-scan-artifacts.mjs` checks `.env` files, build outputs, source maps, API key patterns, and service-role patterns.                                                  | Run the scanner after build output exists and block release on critical findings.                                      |
| R-008 | External AI privacy                    | High     | Mitigated by default                   | AI provider registry disables external providers by default, disables Kimi, and blocks secret-like prompt routing.                                                                   | Keep sensitive external routing disabled until provider contracts, redaction, and approval logs are reviewed.          |
| R-009 | Public claims                          | Medium   | Mitigated in current copy scan         | Copy scan found safety disclaimers rather than guaranteed outcome claims.                                                                                                            | Continue scanning public copy for guaranteed revenue, fake reviews, legal/tax/financial advice, and uptime guarantees. |
| R-010 | Legal readiness misuse                 | High     | Mitigated by copy and risk model       | Legal readiness records say preparation only, not legal advice, no guaranteed compliance, and no automated legal notices.                                                            | Keep high-risk legal items human-review-required and do not auto-send notices.                                         |
| R-011 | Voice, visual, video beta capabilities | Critical | Mitigated by default                   | Dangerous flags for video upload processing, voice cloning, public visual generation, and local visual models are false.                                                             | Keep beta media outputs draft-only and require consent, provenance, and human review before enablement.                |
| R-012 | Test/tooling warning                   | Low      | Open                                   | `docs/KNOWN_ISSUES.md` records a non-blocking Vitest/Node localStorage warning from earlier validation.                                                                              | Investigate separately. Do not hide warnings by removing tests.                                                        |
| R-013 | Dependency audit                       | Medium   | Mitigated                              | `pnpm audit --audit-level moderate` passes with no known vulnerabilities after removing the stale unused Next.js lockfile path.                                                      | Keep audit in CI and review dependency changes before applying them.                                                   |

## Current Blockers

- Production launch is blocked until Supabase migrations are applied and RLS is manually verified in the target project.
- Production launch is blocked until admin/session enforcement is tested with real users, roles, and organization memberships.
- Sensitive writes should remain blocked until live audit logging is wired and reviewed.

## Accepted For Development

- Static setup pages, placeholder dashboards, and beta shells may remain available when they do not show private records, fake live data, fake provider state, or unsafe generation capability.
- External payment links may remain record-only and unverified until provider validation and review flows are enabled.
