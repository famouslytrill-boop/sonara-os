# Final Codex Go-Live Completion Plan

## 1. Current Branch and Commit

- Branch: `sonara-one-full-project-update-v101`
- Inspected commit: `0ffbced`
- Worktree note: `package.json` and `pnpm-lock.yaml` were already modified at inspection time.

## 2. Current Scripts

The root `package.json` uses `pnpm@11.1.1` as the package-manager source of truth and includes launch gates for lint, format, test, typecheck, build, route smoke, legacy copy, public claims, risky features, environment safety, license risk, provider registry, technology registry, GitHub Radar, Supabase, Vercel env docs, app-store readiness, privacy data map, database verification, infrastructure validation, and `verify:all`.

## 3. Current Workflows

- `.github/workflows/ci.yml` uses pnpm setup, Node 22, `cache: pnpm`, `cache-dependency-path: pnpm-lock.yaml`, `pnpm install --frozen-lockfile`, and `pnpm run check`.
- `.github/workflows/open-source-update-watch.yml` is report-only, uses pnpm, Node 22, frozen lockfile install, and the GitHub update watcher package.

## 4. Current Public Routes

The web shell is under `packages/web/src`, not a root Next.js app. Public route definitions are tracked in `packages/web/src/routes/route-manifest.ts` and rendered through `packages/web/src/app.ts`. Current public product routes include `/`, `/about`, `/pricing`, `/security`, `/contact`, `/support`, `/help`, `/feedback`, `/business-builder`, `/creator-studio`, `/growth-studio`, `/status`, and legal/policy routes under the current flat route convention.

Legacy TrackFoundry routes are not active manifest routes; they are compatibility redirects in `packages/web/src/app.ts`.

## 5. Current Protected Routes

Protected app/admin surfaces include `/app`, `/app/settings`, `/app/settings/readiness`, `/app/business-builder`, `/app/creator-studio`, `/app/growth-studio`, `/app/admin/*`, `/admin/*`, `/settings`, and `/billing`. Route auth boundaries are modeled as `public`, `auth-ready`, and `admin-ready`.

## 6. Current Migrations

- `0001_auth_organization_scaffold.sql`
- `0002_launch_mvp_core_tables.sql`

Migration versions are unique. The organization and membership scaffold is created before org-scoped MVP tables and policies.

## 7. Current RLS State

The Supabase migrations enable RLS on `user_profiles`, `organizations`, `organization_members`, `audit_logs`, and MVP org-scoped tables. Policies use active organization membership or owner/admin/developer/support role checks. Public visibility policies are limited to explicitly public records.

## 8. Current Supabase State

Supabase is the source-of-truth backend contract. The repo has Supabase environment, service-role safety, migration, RLS, and storage policy scripts. Live Supabase Preview still requires GitHub Actions secrets and a linked project.

## 9. Current Auth/Login State

Login and signup are setup-mode pages. They do not collect passwords or execute provider auth in this static shell. This pass adds a safe browser-auth diagnostic for malformed or missing `NEXT_PUBLIC_SUPABASE_URL`.

## 10. Current Owner/Admin Readiness

Owner/admin routes are modeled and protected by auth-boundary metadata. First owner bootstrap still requires real Supabase Auth user creation, organization row creation, and active owner membership.

## 11. Current Storage State

Storage is represented by policy/registry scaffolds and checks. Production storage bucket creation, file scanning, and private/public bucket verification remain provider tasks.

## 12. Current Setup Blockers

- Real Vercel environment values.
- GitHub Actions Supabase secrets.
- Supabase Preview rerun.
- Supabase Auth redirect URLs.
- First owner and organization membership.
- DNS, SSL, Cloudflare Email Routing, and outbound email verification.
- Stripe/Square/PayPal configuration.
- Legal, privacy, license, and app-store reviews.

## 13. Current Email/Support Readiness

Support/contact/help/feedback routes exist. Email readiness is provider-aware. Inbound Cloudflare Email Routing and outbound provider delivery remain external verification tasks.

## 14. Current GitHub Radar State

Technology candidates are tracked as registry/watchlist records only. Recent candidates including OpenJarvis, SkillOpt, LongLive, PentestAgent, NASA Worldview, Linphone iPhone, and HyperFrames are review-gated and not installed.

## 15. Current Provider Registry State

Provider records exist for AI, email, vector/database, communications, video rendering, and infrastructure candidates. Restricted and research-only tools remain gated.

## 16. Current Legacy References

Public TrackFoundry routes are redirects, not active product routes. Historical/audit references remain in `docs/audits`. Internal package scopes still use the original `@signal-os/*` names and are treated as internal package identifiers, not public product copy.

## 17. Current App-Store/Mobile Readiness

App Store, Google Play, mobile metadata, privacy data map, screenshots, signing, and testing docs exist. Native submission remains owner/provider work.

## 18. Codex-Completable Work

- Harden URL diagnostics and public auth error copy.
- Keep CI and pnpm gates aligned.
- Update launch docs and final audit reports.
- Run local verification and document any failures honestly.
- Clean visible public brand wording where safe.

## 19. Owner/Provider Manual Work

Provider secrets, DNS, email verification, production Supabase migration approval, Stripe/Square/PayPal setup, app-store submission, legal/license/privacy review, final merge, and production deploy approval must remain human-controlled.
