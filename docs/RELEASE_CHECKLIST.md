# Release Checklist

Use this checklist before shipping a production or beta release.

## Local Validation

```sh
pnpm install --frozen-lockfile
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

Do not use automated audit-fix commands without review.

## Launch Security Gate Validation

Run these before release and document the result in the release notes:

```sh
pnpm run security:scan-artifacts
pnpm run validate:migrations
npx vitest run --pool=threads --no-isolate packages/web/src/sourceLeakPrevention.test.ts packages/web/src/aiProviderRegistry.test.ts packages/web/src/legalReadiness.test.ts packages/web/src/securityCenter.test.ts packages/web/src/launchAudit.test.ts
```

Blocking results include any critical source leak finding, failed migration validation, failed safety test, unreviewed production secret exposure, or public claims that imply guaranteed outcomes, attorney replacement, fake reviews, fake provider status, or unsafe media generation.

## CI Checks

- Confirm install uses the root lockfile.
- Confirm lint, tests, typecheck, build, migration validation, and infrastructure validation run from the same package context.
- Confirm Docker steps are skipped unless a root `Dockerfile` exists.
- Confirm source leak scanning runs after build artifacts exist.

## Deployment

- Confirm the build output path expected by the hosting provider still exists.
- Do not change Vercel/root output settings without validating generated output.
- Confirm `.env.example` contains placeholders only.
- Configure production secrets in the hosting provider, not in repo files.

## Environment Variables

- `NEXT_PUBLIC_*` values are browser-exposed.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only and must never be prefixed with `NEXT_PUBLIC_`.
- Provider API keys, webhook secrets, service-role keys, and private tokens must stay out of client code and build artifacts.

## Supabase

- Apply migrations in filename order:
  - `supabase/migrations/0001_auth_organization_scaffold.sql`
  - `supabase/migrations/0002_launch_mvp_core_tables.sql`
- Verify RLS manually for:
  - anonymous user
  - organization member
  - organization admin or owner
  - non-member
- Confirm public policies expose only approved public fields.
- Confirm customer records, audit logs, internal settings, and private organization data are not publicly readable.

## Payments

- Use provider-hosted checkout, invoice, booking deposit, or external payment links.
- Do not store raw card numbers, CVV, full bank credentials, provider secrets, or tokens.
- Confirm suspicious or unverified links show warnings.
- Confirm no fake active subscription, fake paid status, or fake provider connection is displayed.

## Admin And Security Routes

- Confirm admin routes require a real user, organization, active membership, and eligible role.
- Confirm blocked previews contain setup-only information, not private records.
- Confirm audit logs and approval events exist before enabling sensitive writes.

## AI And Media Safety

- Confirm external AI providers are disabled or review-required by default.
- Confirm prompt redaction blocks secrets, service-role keys, private keys, JWTs, and full private repo dumps before external routing.
- Confirm these dangerous capabilities remain false unless explicitly approved:
  - `VIDEO_UPLOAD_PROCESSING_ENABLED`
  - `VOICE_CLONING_ENABLED`
  - `PUBLIC_VISUAL_GENERATION_ENABLED`
  - `LOCAL_VISUAL_MODELS_ENABLED`

## Public Claims And Legal

- Public pages must not claim guaranteed revenue, fake reviews, legal/tax/financial advice, attorney replacement, guaranteed compliance, or 100 percent uptime.
- Legal Readiness pages are preparation tools only and require human review for high-risk items.

## Rollback

- Keep the previous deployed build available.
- Record migration application time and rollback notes.
- Do not run production migrations without backup and rollback review.
- If a critical scanner, RLS, auth, or payment issue appears, stop launch and revert to the last verified deployment.
