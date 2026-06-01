# Vercel Live Deployment Checklist

## Required before production approval

- Run `pnpm install --frozen-lockfile`.
- Run `pnpm run verify:all`.
- Confirm no `package-lock.json` must not exist.
- Confirm Vercel uses Node 22 or a compatible runtime.
- Configure all required public and server-only variables from `docs/deployment/VERCEL_ENVIRONMENT_VARIABLES.md`.
- Confirm browser title, favicon, manifest, and Open Graph preview use the current SONARA Industries branding.
- Confirm support/contact routes render without provider secrets.
- Confirm protected routes show setup/sign-in/owner-bootstrap messaging instead of private data when auth is missing.

## Manual checks

- Confirm production domain and SSL.
- Confirm Supabase auth redirect URLs.
- Rerun Supabase Preview or equivalent migration validation with real project secrets.
- Verify Cloudflare/email DNS and support inbox delivery.
- Perform mobile and desktop QA before merge/deploy approval.
