# Public Launch Lock

Date: 2026-05-19

Scope: SONARA Industries static web shell in this repository.

Status: locked for beta/public release review. This is not a production launch approval.
The MVP route set is stable, advanced systems are gated, source leak scanning passes, and
the build passes. Production release still requires the launch blockers listed below to be
resolved or formally accepted.

## Scope Freeze

MVP scope is frozen to these surfaces:

- Public pages: `/`, `/pricing`, `/about`, `/security`, `/contact`, `/terms`, `/privacy`
- Beta and support: `/beta`, `/help`, `/help/business-builder`, `/help/creator-studio`,
  `/help/growth-studio`, `/feedback`, `/support`
- Onboarding: `/onboarding`, `/business-builder/setup`, `/creator-studio/setup`,
  `/growth-studio/setup`, `/admin/launch-checklist`
- Business Builder core: `/business-builder`, `/business-builder/proof-passport`,
  `/business-builder/money-path`, `/business-builder/smart-intake`,
  `/business-builder/offers`, `/business-builder/customers`,
  `/business-builder/payment-options`, `/business-builder/bookings`,
  `/business-builder/reviews`, `/business-builder/legal-readiness`,
  `/business-builder/autopilot-board`
- Creator Studio core: `/creator-studio`, `/creator-studio/proof-card`,
  `/creator-studio/asset-vault`, `/creator-studio/project-rooms`,
  `/creator-studio/release-checklist`, `/creator-studio/service-offers`,
  `/creator-studio/payment-booking`, `/creator-studio/legal-readiness/rights-licensing`
- Growth Studio core: `/growth-studio`, `/growth-studio/offers`,
  `/growth-studio/campaigns`, `/growth-studio/win-back`, `/growth-studio/referrals`,
  `/growth-studio/review-requests`, `/growth-studio/reviews`,
  `/growth-studio/local-growth`, `/growth-studio/legal-readiness/campaign-review`
- Security and reliability: `/security-center`, `/security-center/audit-logs`,
  `/security-center/approval-gates`, `/security-center/source-leak-prevention`,
  `/security-center/phishing-defense`, `/security-center/external-model-safety`,
  `/security-center/legal-risk-review`, `/admin/reliability-center`,
  `/admin/reliability-center/providers`, `/admin/reliability-center/incidents`,
  `/admin/reliability-center/continuity-mode`

No new public product systems should be added after this lock without a new spec, explicit
scope approval, and updated launch-gate review.

## Advanced Module Gates

Advanced modules are not part of the public MVP. They remain optional, non-navigation beta
or admin surfaces:

- `/admin/video-intelligence`: `admin-ready`, optional
- `/creator-studio/video-review`: `admin-ready`, optional, beta shell only
- `/creator-studio/voice-studio`: `admin-ready`, optional, beta shell only
- `/creator-studio/visual-studio`: `admin-ready`, optional, beta shell only
- `/growth-studio/campaign-visuals`: `admin-ready`, optional, beta shell only
- `/security-center/voice-safety`: `admin-ready`, optional
- `/security-center/visual-safety`: `admin-ready`, optional
- `/security-center/video-source-safety`: `admin-ready`, optional
- `/admin/dev-tunnel-tools`: `admin-ready`, optional

Dangerous media capabilities remain off by default:

- `VIDEO_UPLOAD_PROCESSING_ENABLED=false`
- `VOICE_CLONING_ENABLED=false`
- `PUBLIC_VISUAL_GENERATION_ENABLED=false`
- `LOCAL_VISUAL_MODELS_ENABLED=false`

All advanced media outputs remain draft-only until reviewed. No unrestricted generation,
voice cloning, private video processing, local visual model processing, or auto-publishing
is enabled.

## Verification Matrix

| Area                       | Status             | Evidence                                                                                                              | Lock decision                                                              |
| -------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Pricing page               | Stable for review  | `/pricing` is required/public and uses plain pricing tiers with no guaranteed revenue claims.                         | Locked; commercial/legal review still needed.                              |
| Contact/support            | Stable for review  | `/contact`, `/support`, `/feedback`, and `/help` routes exist. Support and feedback save locally or stub safely.      | Locked; backend support workflow can be added later by spec.               |
| Auth routes                | Conditional        | `/account`, `/downloads`, `/settings`, and `/billing` are `auth-ready`; admin/security routes are `admin-ready`.      | Locked for shell review; real auth/session verification remains a blocker. |
| Onboarding                 | Stable for review  | Setup routes and launch checklist render and save local setup state.                                                  | Locked; persistence can be added after RLS verification.                   |
| Business Builder core      | Stable for review  | Required routes render and stay local/setup-focused.                                                                  | Locked; no new Business Builder scope without review.                      |
| Creator Studio core        | Stable for review  | Core creator routes render. Advanced video/voice/visual surfaces are optional and gated.                              | Locked.                                                                    |
| Growth Studio core         | Stable for review  | Core growth routes render. Campaign visuals are optional and gated.                                                   | Locked.                                                                    |
| Security Center            | Stable for review  | Security routes are `admin-ready`; source leak, approval, AI provider, and legal-risk surfaces exist.                 | Locked; live audit writes remain a blocker.                                |
| Reliability Center         | Stable for review  | Reliability routes are `admin-ready`; provider health avoids fake status and public status is private/off by default. | Locked; real provider evidence can be added later.                         |
| Source leak scan           | Pass               | `pnpm run security:scan-artifacts` reports zero critical findings.                                                    | Locked; re-run before release.                                             |
| Raw secrets                | Pass for repo scan | `.env.example` uses placeholders and scanner found no critical secrets.                                               | Locked; hosting secrets still need environment review.                     |
| Legal/privacy placeholders | Needs final review | Terms and privacy pages clearly say they are placeholders and not final agreements.                                   | Acceptable for review, not production launch.                              |
| Mobile layout              | Needs visual QA    | CSS includes mobile breakpoint, responsive grids, and minimum action heights.                                         | Acceptable for review; run browser/mobile QA before production.            |

## Launch Blockers

These are not fixed by the lock and must remain visible:

1. Supabase migrations and RLS must be applied and manually verified in the target database.
   Files: `supabase/migrations/0001_auth_organization_scaffold.sql`,
   `supabase/migrations/0002_launch_mvp_core_tables.sql`.
   Fix: apply migrations, test anonymous/member/admin/non-member access, and document results.

2. Real auth and organization session wiring must be verified.
   Files: `packages/web/src/lib/auth/organization-context.ts`,
   `packages/web/src/lib/auth/protected-route.ts`.
   Fix: wire real session-backed organization lookup and role tests before exposing private data.

3. Sensitive actions need durable audit writes before production use.
   Files: `packages/web/src/lib/security/trust-shield-mvp.ts`, Supabase migration files.
   Fix: write audit events for payment, security, privacy, publishing, provider, and admin changes.

4. Dependency audit must remain in the release gate.
   Files: `package.json`, `pnpm-lock.yaml`, `docs/RISK_REGISTER.md`.
   Fix: keep `pnpm audit --audit-level moderate` in CI and review dependency changes before applying them.

5. Final legal/privacy pages must be reviewed before production launch.
   Files: `packages/web/src/app/terms/page.ts`, `packages/web/src/app/privacy/page.ts`.
   Fix: replace placeholders with reviewed policies.

## Required Validation

Run before beta/public release review:

```sh
pnpm run validate:infrastructure
pnpm run validate:migrations
pnpm run typecheck
pnpm run lint
pnpm test
pnpm run build
pnpm run smoke
pnpm run security:scan-artifacts
```

Run as a launch blocker check:

```sh
pnpm audit --audit-level moderate
```

## Lock Recommendation

Proceed to beta/public release review, not production launch.

The app is buildable, MVP routes are stable, advanced routes are gated, and no critical
repo-secret issue is currently detected. Production launch remains blocked until database,
auth, audit, dependency, legal/privacy, and final mobile review items are completed.
