# Final Commands

Date: 2026-05-26

This file records the command gate for the Master Sprint. It is a command log, not launch approval.

## Package Manager

The sprint uses pnpm commands and this checkout is now pnpm-configured:

- `package-lock.json` must not exist.
- `package.json` uses pnpm workspace scripts.
- `pnpm-workspace.yaml` is configured for this checkout.

Correct command set for this repo:

```powershell
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm run lint
pnpm test
pnpm run build
pnpm run validate:infrastructure
pnpm run validate:migrations
pnpm run security:scan-artifacts
pnpm run deployment:check
pnpm run env:check
pnpm run security:sync-check
pnpm run paywall:check
pnpm run github:update-watch
pnpm run smoke
```

No `spec:check` script exists in `package.json`; spec coverage remains under the existing package tests and smoke checks.

## Commands Run

| Command                            | Result                            | Notes                                                                                                                                    |
| ---------------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm install`                     | Passed                            | Updated workspace links and pnpm lockfile; pnpm audit later passed with no known vulnerabilities.                                        |
| `pnpm install --frozen-lockfile`   | Passed                            | Frozen install completed after pnpm lockfile update; pnpm audit passed with no known vulnerabilities.                                    |
| `pnpm run typecheck`               | Passed                            | Package typecheck gates and `tsc --noEmit` passed.                                                                                       |
| `pnpm run lint`                    | Passed                            | ESLint completed without errors.                                                                                                         |
| `pnpm test`                        | Passed                            | 67 test files and 213 tests passed. Vitest still emits a non-blocking `--localstorage-file` warning.                                     |
| `pnpm run build`                   | Passed                            | Build completed for all packages.                                                                                                        |
| `pnpm run validate:infrastructure` | Passed                            | Infrastructure validation passed.                                                                                                        |
| `pnpm run validate:migrations`     | Passed                            | Existing Supabase migration validation passed.                                                                                           |
| `pnpm run security:scan-artifacts` | Passed                            | Source leak artifact scan completed with `findings=0 critical=0`.                                                                        |
| `pnpm run deployment:check`        | Passed with needs_review findings | Local report generated. Domain, env, GitHub, Vercel, Supabase, Stripe, auth, paywall, and security require deployed/manual verification. |
| `pnpm run env:check`               | Passed with needs_review findings | Missing production env vars are visible and secrets are redacted.                                                                        |
| `pnpm run security:sync-check`     | Passed with needs_review findings | Security headers, source leak scan, and secret exposure checks require host/deploy verification.                                         |
| `pnpm run paywall:check`           | Passed with needs_review findings | Pricing model exists; feature gates and billing behavior need production Stripe verification.                                            |
| `pnpm run github:update-watch`     | Passed                            | Generated report-only update watcher output for selected research repos.                                                                 |
| `pnpm run smoke`                   | Passed after sequential rerun     | A parallel run with `pnpm run build` caused a dist cleanup race; sequential rerun passed every package smoke gate.                       |
| Local HTTP route check             | Passed                            | Verified `/`, new `/app/admin/*` setup pages, recommendation routes, `/api/health`, and `/api/stripe/webhook` over the dev server.       |

## Remaining Command Risk

- pnpm audit reports no known vulnerabilities. Do not run automated audit-fix commands without dependency review.
- Deployment, env, paywall, and security sync checks intentionally report `needs_review` until production env vars and cloud services are configured and manually verified.
- The Browser automation tool was not exposed in this session, so route verification used the static dev server and HTTP checks instead of a browser console pass.

## Launch Command Gate

Launch remains blocked if any of these fail:

- `pnpm install --frozen-lockfile`
- `pnpm run typecheck`
- `pnpm run lint`
- `pnpm test`
- `pnpm run build`
- `pnpm run security:scan-artifacts`
- `pnpm run smoke`

Even when local commands pass, public paid launch remains blocked until production domain/SSL, auth, Supabase/RLS, Stripe webhooks, and owner approval paths are manually verified.
