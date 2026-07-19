# Current State

- `main` includes the organization-setup compatibility repair, readiness-card repair, paid-launch baseline, PWA privacy contract, 1 MiB structured-body guard, and 42/42 production migration baseline.
- The production Supabase connection, Stripe connection/webhook, Resend connection, founder/admin protection, and checkout allowlist currently report configured through `/api/readiness`.
- The hosted organization schema still requires compatibility with legacy private `company_key` and `created_by` fields; the merged runtime repair preserves that boundary without a migration.
- The cohesive 2027 public frontend is being integrated on `codex/merge-cohesive-2027-ui` through the accepted Express `layout()` runtime, a canonical presentation registry, server-rendered readiness states, scoped CSS, and progressive JavaScript.
- The frontend merge changes no migration, RLS policy, provider secret, billing authorization, customer record, or legal approval state.
- Production success for the new frontend requires exact-head CI, READY Preview, guarded merge, exact-SHA Production deployment, live homepage/assets/readiness verification, and runtime-error inspection.
- Organization creation still requires one authenticated deployed smoke test before the write path is called production-proven.
