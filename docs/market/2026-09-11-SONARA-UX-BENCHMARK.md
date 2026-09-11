# SONARA UX Benchmark and Implementation Notes

## Scope

This is a repository-grounded comparison of the competitor and reference set already reviewed by Codex and Claude. It uses the governed registry, the per-product reassessment, the market-gap research, and the user-provided reference patterns. It is not a license to copy branding, source code, logos, layouts, or claims.

## What the reference set does well

| Reference set | Useful pattern | SONARA application |
| --- | --- | --- |
| Jobber, Housecall Pro, ServiceTitan | Put the next operational action close to the workspace entry | Business Builder now exposes intake, dashboard, payment setup, and readiness paths from the public entry point |
| Podia, Kajabi, Gumroad, Teachable | Make creator work, selling, rights, and delivery distinct steps | Creator Studio keeps assets, rights, releases, offers, and payment readiness as separate routes |
| Brevo, Klaviyo, HubSpot | Treat campaigns as governed workflows with audience and provider state | Growth Studio keeps consent, provider operations, campaign records, and approval boundaries visible |
| Stripe | Clear pricing hierarchy and a direct path from plan to checkout | Pricing remains centralized and server-gated; missing or invalid price IDs remain setup-required |
| Spotify and media-library products | Let users enter a focused workspace quickly | Homepage quickstart cards open the first real workflow for each company |
| GOV.UK-style service design | Plain language, honest gaps, and explicit next steps | Readiness and setup-required states remain visible; no fake provider success is shown |
| Free developer directories | Searchable categories with free limits and upgrade boundaries | The existing Free Launch Stack and technology radar remain reference/resource surfaces, not hidden integrations |
| Emergent-style onboarding references | One clear first action and mobile-first signup flow | The homepage now presents four immediate routes: Business Builder intake, Creator assets, Growth campaign planning, and shared readiness |
| 3D interactive hero references | Progressive visual identity that supports the product story | SONARA uses original CSS/SVG motion and a real workspace preview; it does not require WebGL or a GPU |

## What SONARA should not copy

- No competitor logos, proprietary layouts, screenshots, slogans, testimonials, fake customer counts, or unsupported outcome claims.
- No automatic adoption of repositories from the photo/chat intake. External projects remain governed references, adapters, or worker candidates until license, security, tenancy, and rollback review pass.
- No live phone answering, autonomous outreach, unapproved publishing, secret-bearing browser automation, or customer-facing AI claims without a real provider and audit trail.

## Implemented in this pass

- A public quickstart panel puts the three companies and shared readiness on the first-screen path.
- Each destination is a real route already covered by the Express route registry.
- Cards are visually grouped by company identity and state language remains truthful.
- The workspace preview and quickstart panel are responsive, keyboard-focusable, and bounded at narrow widths.

## Remaining product gaps

- Business Builder still needs owner-authenticated production proof for connected Stripe payments and any future telephony capability.
- Creator Studio generation remains setup-required until a reviewed worker/provider is configured; browser-side model runtimes remain research-only.
- Growth Studio remains a consent and provider control plane; it must not be sold as a replacement for Klaviyo, HubSpot, or an email/SMS delivery provider.
- Live production proof still depends on owner/provider work: Stripe webhook events, Resend sender/domain, Supabase storage buckets, and exact deployment SHA.

Review by: 2026-12-10
