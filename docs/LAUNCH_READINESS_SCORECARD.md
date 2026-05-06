# Launch Readiness Scorecard

This scorecard is honest production-prep status, not a claim that live production is complete.

| Category | Score | Evidence | Remaining Blocker | Owner | Exact Next Action |
| --- | ---: | --- | --- | --- | --- |
| Build stability | 9 | Build previously passed and route/config repairs are in place. | Re-run after every infra patch. | Codex | Run `npm run build`. |
| Type safety | 8 | Typecheck script exists. | Some legacy code uses relaxed strictness. | Codex | Run `npm run typecheck`. |
| Security/RLS | 8 | Entity migration includes scoped RLS helpers and no broad true policies. | Live Supabase RLS must be manually verified. | Human | Apply migration and run manual RLS tests. |
| Supabase readiness | 8 | Migrations and deployment runbooks exist. | Migration 008 must be applied manually. | Human | Back up DB, apply migration, verify policies. |
| Stripe readiness | 8 | Checkout/webhook are preserved; runbooks exist. | Live dashboard/webhook checks remain manual. | Human | Test checkout and webhook delivery. |
| Storage readiness | 7 | Validation helpers and storage docs exist. | Buckets/policies must be confirmed live. | Human | Create/verify buckets and signed URL flow. |
| Worker readiness | 6 | Smoke script and worker docs exist. | Production worker runtime not configured. | Human | Choose worker/cron host and configure queues. |
| PWA/mobile readiness | 7 | Manifest and PWA docs exist. | Final icons/install QA required. | Human | Test mobile install. |
| UI/UX clarity | 8 | Entity dashboards and setup-required labels are added. | Browser QA still needed. | Human | Review `/dashboard/entities`. |
| Legal template readiness | 7 | Legal/terms docs and pages exist elsewhere in repo. | Attorney review required. | Human | Have a qualified attorney review. |
| Monitoring/backups | 7 | Monitoring/backups docs and scripts exist. | Live monitoring/backups not configured. | Human | Configure monitoring and backup schedule. |
| Testing coverage | 7 | Smoke/security/entity tests exist. | End-to-end live tests remain manual. | Codex/Human | Run `npm run verify:all`. |
| Documentation | 9 | Deployment, security, storage, workers, entity docs exist. | Keep docs current after dashboard setup. | Codex/Human | Update final audit after verification. |
| Production deployment readiness | 7 | Build and verification commands are scripted. | Live migration, env, Stripe, and deployment checks remain manual. | Human | Complete post-deploy runbook. |
| Market/commercial readiness | 5 | Core product pages and infrastructure exist. | Commercial campaign system intentionally excluded from this task. | Human | Handle separately only if requested. |

## Honest Status

The repo is ready for human deployment review after verification commands pass. It is not honestly production-finished until live migrations, Stripe, Supabase, Vercel, storage, monitoring, and legal review are completed.
