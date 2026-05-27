# SONARA Industries Agent Rules

## Product Architecture

SONARA Industries is the parent company for SONARA One, Business Builder, Creator Studio, and Growth Studio.

- Parent company: SONARA Industries
- Platform: SONARA One
- Products: Business Builder, Creator Studio, Growth Studio
- Public message: Build. Create. Grow.

Do not reintroduce retired public names in active UI, navigation, metadata, manifests, tests, or launch docs. If historical context is required, keep it in `docs/archive/legacy-names.md`.

## Public Product Positioning

- Business Builder: create, launch, run, and manage a business with guided systems, payments, bookings, records, and operational intelligence.
- Creator Studio: organize, protect, publish, monetize, and grow creative work, digital products, media, and creator operations.
- Growth Studio: attract customers, leads, fans, referrals, reviews, and revenue through campaigns, follow-up, offers, and growth systems.

Use plain customer-facing language. Avoid overusing internal engine names or "AI" in public copy.

## Safety

- Keep service-role secrets server-only.
- Use Provider Gateway or approved server-side provider adapters for AI calls.
- Enforce provenance, consent, and anti-clone safety.
- Do not store raw card data or CVV.
- Do not automate refunds, payout changes, legal/policy publishing, customer campaigns, proof/review publishing, security setting changes, or destructive data changes without owner approval.
- Unknown sensitive actions default to owner review.

## UI Direction

- Public overview screens should feel polished, dark-first, readable, and marketable.
- Work screens should be calm, clear, and operational.
- Mobile layouts must avoid overflow and use large enough tap targets.
- Sounds, voice announcements, haptics, SMS, push, and email alerts must be off or explicitly user-controlled by default.

## Build And CI Guardrails

- Use pnpm only.
- Do not use npm, npm audit fix, or package-lock.json.
- Do not commit secrets.
- Do not weaken audit/security checks without documenting the exact reason in `SECURITY_NOTES.md`.
- Keep CI fixes minimal and separate from product features.
- Verify with `pnpm install --frozen-lockfile`, `pnpm audit --audit-level moderate`, `pnpm run typecheck`, `pnpm run lint`, `pnpm test`, and `pnpm run build` before push.
