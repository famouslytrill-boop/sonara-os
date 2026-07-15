# SONARA Launch QA Checklist

## Core pages
- [ ] `/` returns 200
- [ ] `/start` returns 200
- [ ] `/service-catalog` returns 200
- [ ] `/dashboard` works with auth/setup behavior
- [ ] `/pricing` works
- [ ] `/contact` works
- [ ] legal routes work
- [ ] unknown route returns 404

## Product routes
- [ ] Business Builder dashboard/tools/catalog/billing
- [ ] Creator Studio dashboard/tools/music-system/releases
- [ ] Growth Studio dashboard/tools/campaigns/leads

## Assets
- [ ] `/sonara-brand-system.css`
- [ ] `/sonara-friendly-premium.css`
- [ ] `/sonara-experience.js`
- [ ] `/site.webmanifest`
- [ ] `/favicon.svg`

## Auth/Billing
- [ ] login works
- [ ] signup works
- [ ] logout works
- [ ] checkout route exists
- [ ] webhook route exists
- [ ] paid tools locked without billing/admin
- [ ] paid tools unlocked only from real billing/admin state

## Database
- [ ] readiness shows exact missing tables
- [ ] no fake save success
- [ ] service requests save when tables exist
- [ ] support requests save when tables exist
- [ ] setup-required shown when missing

## UI
- [ ] no clipped title
- [ ] no horizontal overflow on mobile
- [ ] no bad encoding like `â€¢`
- [ ] tap targets 44px+
- [ ] visible nav links are real
- [ ] product cards are actionable
