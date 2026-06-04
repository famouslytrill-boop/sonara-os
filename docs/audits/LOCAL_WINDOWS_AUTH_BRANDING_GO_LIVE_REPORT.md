# Local Windows Auth Branding Go-Live Report

## 1. Local Windows setup docs added

Added Windows PowerShell setup documentation for Git, GitHub CLI, VS Code, Docker Desktop, WSL2, Volta, Node 22, pnpm/Corepack, Supabase CLI, Vercel CLI through `pnpm dlx`, Stripe CLI, FFmpeg, optional Android Studio/JDK, `pnpm approve-builds`, local Supabase, `pnpm dev`, and verification commands.

Docs added:

- `docs/development/LOCAL_WINDOWS_SETUP.md`
- `docs/development/LOCAL_TOOLING_CHECKLIST.md`
- `docs/development/LOCAL_SUPABASE_SETUP.md`
- `docs/development/LOCAL_ENVIRONMENT_VARIABLES.md`
- `docs/development/TROUBLESHOOTING_LOCAL_RUN.md`

## 2. Local tool checks added

Added:

- `scripts/check-local-tools.ps1`
- `scripts/check-local-dev-readiness.mjs`
- package scripts `check:local-tools` and `check:local-dev`

The PowerShell script verifies Git, GitHub CLI, Node, pnpm, Docker, Docker Compose, WSL2, Supabase CLI, FFmpeg, Java, `package.json`, `package-lock.json`, `.env.local`, and `node_modules`. Missing provider/local machine tools are warnings unless they are repo blockers.

## 3. Auth routes created/fixed

Created or wired these auth/security routes:

- `/login`
- `/signup`
- `/auth/callback`
- `/forgot-password`
- `/reset-password`
- `/app/settings/security`
- `/app/admin/owner-bootstrap`

Route definitions were added to `packages/web/src/routes/route-manifest.ts`, route rendering was wired in `packages/web/src/app.ts`, and route smoke coverage was expanded in `scripts/smoke.mjs`.

## 4. Login/signup UX changes

Login now includes:

- Continue with Google setup-gated UI
- Email magic link setup-gated UI
- Email/password form
- show/hide password support
- forgot password link
- create account link
- auth configuration diagnostic
- terms/privacy/support links
- generic auth error notice behavior

Signup now includes:

- name
- email
- password with show/hide toggle
- product interest selector for Business Builder, Creator Studio, and Growth Studio
- terms/privacy consent checkbox
- Google option
- magic-link option
- account confirmation state scaffold
- auth readiness card

## 5. Password visibility support

Added `packages/web/src/components/auth/PasswordField.tsx`. It toggles password inputs between `password` and `text`, updates button text between Show and Hide, and updates the accessibility label.

## 6. OAuth readiness

Added:

- `packages/web/src/components/auth/OAuthButtons.tsx`
- `packages/web/src/lib/auth/oauth-provider-registry.ts`

Google OAuth is represented as setup-gated UI only. No OAuth client secrets are stored, rendered, or hardcoded.

## 7. Magic link/password reset readiness

Added:

- `packages/web/src/components/auth/MagicLinkForm.tsx`
- `packages/web/src/app/forgot-password/page.ts`
- `packages/web/src/app/reset-password/page.ts`
- `packages/web/src/app/auth/callback/page.ts`
- `packages/web/src/lib/auth/auth-redirects.ts`

Updated `docs/SUPABASE_AUTH_FIX.md` with production and local redirect URLs for `/auth/callback`, `/reset-password`, and `/app/settings/security`.

## 8. Owner bootstrap status

Owner bootstrap remains manual and provider-side. Added:

- `packages/web/src/components/auth/OwnerBootstrapNotice.tsx`
- `packages/web/src/lib/auth/owner-bootstrap-policy.ts`

The app still does not expose a public owner-creation endpoint or any service-role action in client code.

## 9. Old branding removed

Updated root package metadata from the old public name to `sonara-industries` and SONARA Industries workspace copy.

Added:

- `scripts/check-old-branding.mjs`
- `scripts/check-metadata-branding.mjs`

Updated `scripts/check-legacy.mjs` so `check:legacy` scans package metadata, README, env example, docs, scripts, and public/source packages while allowing only audit/archive history and intentional compatibility redirect references.

Remaining old-name references are compatibility redirect/test/checker references and audit history, not active public product copy.

## 10. Files changed

Primary files changed:

- `package.json`
- `pnpm-lock.yaml`
- `docs/SUPABASE_AUTH_FIX.md`
- `packages/web/src/app.ts`
- `packages/web/src/routes/route-manifest.ts`
- `packages/web/src/app/login/page.ts`
- `packages/web/src/app/signup/page.ts`
- `packages/web/src/app/auth/callback/page.ts`
- `packages/web/src/app/forgot-password/page.ts`
- `packages/web/src/app/reset-password/page.ts`
- `packages/web/src/app/settings/security/page.ts`
- `packages/web/src/components/auth/*`
- `packages/web/src/lib/auth/*`
- `packages/web/src/authScaffold.test.ts`
- `scripts/check-local-tools.ps1`
- `scripts/check-local-dev-readiness.mjs`
- `scripts/check-auth-readiness.mjs`
- `scripts/check-auth-public-copy.mjs`
- `scripts/check-old-branding.mjs`
- `scripts/check-metadata-branding.mjs`
- `scripts/lint.mjs`
- `scripts/check-legacy.mjs`
- `scripts/smoke.mjs`
- `scripts/verify-all.mjs`
- `docs/development/*`
- `docs/audits/LOCAL_WINDOWS_AUTH_BRANDING_GO_LIVE_REPORT.md`

## 11. Commands run/results

- `pnpm install --frozen-lockfile` passed.
- `pnpm run check:local-dev` passed with warning: `.env.local` is missing.
- `pnpm run check:local-tools` passed with warning: `.env.local` is missing.
- `pnpm run check:auth-readiness` passed.
- `pnpm run check:auth-public-copy` passed after allowing explicit blocked/policy context.
- `pnpm run check:old-branding` passed after allowing checker/redirect compatibility files.
- `pnpm run check:metadata-branding` passed.
- `pnpm run check:legacy` passed.
- `pnpm run check:public-claims` passed.
- `pnpm run check:env-safety` passed.
- `pnpm run typecheck` passed after fixing the auth diagnostic shape and password blocklist retired-name conflict.
- `pnpm run lint -- --quiet` passed after adding `scripts/lint.mjs` to strip pnpm's literal separator before invoking ESLint.
- `pnpm run build` passed.
- `pnpm run smoke:routes` passed.
- `pnpm run verify:all` passed.

## 12. Remaining manual setup

- Create `.env.local` for local provider-backed testing.
- Set Vercel production env vars.
- Set GitHub Actions secrets.
- Verify `NEXT_PUBLIC_SUPABASE_URL` exactly matches Supabase Project Settings -> API -> Project URL.
- Configure Supabase Auth redirect URLs.
- Enable and verify Google OAuth in Supabase.
- Verify magic-link and password-reset email templates.
- Start local Supabase only after Docker Desktop is running.
- Verify Cloudflare/email DNS and outbound email provider.
- Create first owner user and active owner organization membership.
- Approve production Supabase migrations.
- Complete legal/privacy/license review.
- Final PR review, merge, and production deploy approval.

## 13. Merge/deploy recommendation

This local sprint is merge-ready only after review of the package/lockfile dependency state already present in the worktree. Do not launch until remote CI, Vercel deploy, Supabase Preview, provider env vars, Supabase Auth redirects, owner bootstrap, email delivery, legal/privacy review, and final human production approval are complete.
