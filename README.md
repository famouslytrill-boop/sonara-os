# SONARA Industries™ / SONARA OS™

SONARA OS™ is a creator operating system for music as a whole.

It helps artists, songwriters, producers, bands, labels, engineers, managers, content creators, and music entrepreneurs turn ideas into structured lyrics, arrangement notes, sound direction, rights-aware assets, metadata, release plans, and export-ready creative bundles.

SONARA OS™ supports traditional, AI-assisted, and hybrid workflows. It is not only an AI music generator.

## Users

Normal users access SONARA OS™ from the browser/PWA. No desktop install, local Node.js, npm, Git, local GPU, Stripe account, Supabase account, Vercel account, or OpenAI key is required for the core workflow.

## Local Checks

```powershell
npm run check:software
npm run audit:deps
npm run lint
npm run build
npm run verify:launch
npm run verify:security
npm run scan:secrets
```

If port 3000 is already in use, that is not a build failure. See `docs/LOCAL_PORT_3000_HELP.md`.

## Safe Bootstrap

```powershell
npm run bootstrap:local
npm run launch:local-check
```

The bootstrap script installs only the dependencies pinned in `package-lock.json`. Optional tools are checked or documented, not blindly installed.

## Launch Notes

- Do not commit secrets.
- Keep OpenAI optional.
- Default provider remains `local_rules`.
- Add Stripe, Supabase, and app URL environment variables in Vercel.
- Revoke and rotate any exposed Stripe live key before redeploy.
- Apply Supabase migrations and confirm RLS before production.
- Test Stripe checkout and webhooks before enabling paid access.
- No public kit marketplace at launch.
- Software can make SONARA OS™ payment-ready, not profit-guaranteed.
