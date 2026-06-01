# Final UI Brand Audit

Date: 2026-05-21

Status: needs review before public paid launch.

The current static web shell has a consistent SONARA One™ brand system, dark-first visual foundation, controlled logo references, mobile navigation, pricing pages, onboarding routes, product dashboards, empty states, loading states, error states, and metadata asset references. The UI is suitable for beta review, but final public launch still needs real-device visual QA, final designed logo/metadata artwork, production-domain verification, and legal/owner review of public copy.

## Brand Rules Checked

| Rule                                                         | Result       | Evidence                                                                                                                       |
| ------------------------------------------------------------ | ------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Parent brand is SONARA Industries                            | Pass         | `packages/ui/src/brand/tokens.ts` and public navigation use SONARA Industries.                                                 |
| Platform is SONARA One                                       | Pass         | Platform identity is centralized and the home hero now displays SONARA One™.                                                   |
| Products are Business Builder, Creator Studio, Growth Studio | Pass         | Product names are centralized in `packages/ui/src/brand/tokens.ts`.                                                            |
| Use ™ where appropriate                                      | Pass         | Public home hero uses SONARA One™. No ® usage was found.                                                                       |
| Plain public wording                                         | Pass         | Public product and pricing copy avoids internal implementation language.                                                       |
| Do not overuse internal engine names                         | Needs review | Public marketing surfaces avoid engine names; some internal/admin pages still use technical labels intentionally.              |
| Do not overuse AI                                            | Needs review | Public marketing copy avoids AI-heavy positioning; admin/legal/safety pages reference AI where required for safety boundaries. |
| Final message                                                | Pass         | `Build. Prove. Get paid. Grow.` is the central product promise.                                                                |

## Files Inspected

- `packages/ui/src/brand/tokens.ts`
- `packages/ui/src/brand/logos.ts`
- `packages/ui/src/brand/product-themes.ts`
- `packages/ui/src/brand/backgrounds.ts`
- `packages/web/src/brand/*.svg`
- `packages/web/src/favicon.svg`
- `packages/web/src/site.webmanifest`
- `packages/web/src/index.html`
- `packages/web/src/styles.css`
- `packages/web/src/app.ts`
- `packages/web/src/app/public-marketing/page.ts`
- `packages/web/src/lib/public-marketing/marketing-content.ts`
- `packages/web/src/app/sonara-shell.ts`
- `packages/web/src/app/onboarding/onboarding-page.ts`
- `packages/web/src/ui/shared-components.ts`

## Fixes Applied In This Pass

- Home hero now presents `SONARA One™` as the first visible brand signal.
- Home primary CTA now routes to `/onboarding` with the label `Start setup`.
- Pricing headline now reinforces `Build. Prove. Get paid. Grow.`
- Setup service names now match the launch offer:
  - Profile Setup: `$99`
  - Business Launch Setup: `$299`
  - Premium Setup: `$499+`
- Public navigation now includes `Start Setup` as a clear onboarding path.

No payment, auth, database, or product behavior was changed.

## Visual System Audit

| Area               | Status          | Notes                                                                                                                                         |
| ------------------ | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Logos              | Needs review    | Controlled SVG references exist. Final designed assets can replace placeholders without page-level path changes.                              |
| Favicon            | Ready for beta  | `/favicon.svg` exists and is referenced from `packages/web/src/index.html` and the manifest.                                                  |
| App icons          | Ready for beta  | `/brand/sonara-one-app-icon.svg` exists and is referenced by the manifest.                                                                    |
| Product marks      | Ready for beta  | Business Builder, Creator Studio, and Growth Studio SVG placeholders exist and resolve locally.                                               |
| Open Graph image   | Needs review    | `/brand/sonara-one-og.svg` exists as a placeholder. Replace with final designed social preview before paid launch.                            |
| Backgrounds        | Ready for beta  | Dark-first backgrounds and restrained product accent washes are centralized in CSS and brand tokens.                                          |
| Dashboard cards    | Ready for beta  | Cards use shared `.planning-card`, `.shell-card`, status badges, and product theme classes.                                                   |
| Navigation         | Ready for beta  | Public nav, app nav, admin nav, and mobile bottom nav exist.                                                                                  |
| Sidebar            | Ready for beta  | Desktop sidebar is sticky and grouped by Products, Admin, Signal OS, and support utilities.                                                   |
| Mobile layout      | Needs device QA | CSS switches to single-column layout, larger touch targets, sticky form actions, and bottom nav under 760px. Real-device QA remains required. |
| Pricing page       | Ready for beta  | Plans and setup services are readable and include no hidden-fee or guaranteed-outcome claims.                                                 |
| Onboarding         | Ready for beta  | Product path selection, setup forms, local save behavior, warnings, and launch checklist render.                                              |
| Product dashboards | Ready for beta  | Product cards explain what each area does and mark setup/beta/review state honestly.                                                          |
| Login/auth screens | Needs review    | Protected-route cards exist, but production sign-in and role-based screens remain blocked by real auth wiring.                                |
| Empty states       | Ready for beta  | Empty-state components and copy exist for product setup and record pages.                                                                     |
| Loading states     | Ready for beta  | Route loading state uses `aria-live` and shared loading component.                                                                            |
| Error states       | Ready for beta  | Route render failures use client-safe error messaging instead of raw stack traces.                                                            |
| Metadata images    | Needs review    | Metadata and icon references exist; final production artwork and domain verification remain pending.                                          |

## Product Identity Review

| Product          | Identity intent              | Current UI status                                                                 |
| ---------------- | ---------------------------- | --------------------------------------------------------------------------------- |
| Business Builder | Trust, operations, business  | Green accent, proof/payment/booking/intake/customer setup, practical copy.        |
| Creator Studio   | Creative, media, assets      | Purple accent, proof card, asset vault, project rooms, rights/licensing warnings. |
| Growth Studio    | Campaigns, revenue, momentum | Gold accent, campaign, review, referral, win-back, and follow-up planning.        |

The product themes are clean and distinct enough for launch review. They do not create separate visual systems or clashing palettes.

## Public Copy Review

Passes:

- No guaranteed income, customer, or growth claims were added.
- No fake testimonials, fake reviews, fake logos, or fake customers were added.
- No legal, tax, financial, security, or uptime guarantees were added.
- Pricing notes state that external providers may charge their own fees.
- Product pages keep incomplete systems labeled as Beta or setup/review state.

Needs review:

- Legal/policy pages are review-ready drafts and still need attorney/owner approval.
- Public claims should be rechecked after final assets and production domain are configured.

## Launch Recommendation

UI/brand status is `needs_review`.

The interface is coherent enough for beta review and internal launch-candidate testing. Do not mark it fully public-launch-ready until production mobile QA, final brand assets, production metadata, real auth screens, and legal review are complete.
