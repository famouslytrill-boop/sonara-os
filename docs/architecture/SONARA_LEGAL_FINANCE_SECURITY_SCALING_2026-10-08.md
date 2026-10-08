# Legal, business sustainability, accessibility, data and scaling — 2026-10-08

Governance records (proposed, not migrated): versioned Terms/AUP, privacy notices and consent, seller contracts, creator license templates, performer/model/property releases, takedown/counter-notice, refund/dispute approvals, legal-entity proof, digital signatures, retention/erasure and moderation appeals. Store document hash, revision, locale, signer authorization, UTC timestamp and a revocation/appeal link. Jurisdiction-specific legal review is required before publishing binding terms. Never assume SONARA is legally permitted to hold funds, provide escrow or make regulated decisions.

Accessibility baseline: WCAG 2.2 AA, including headings/semantics, captions, transcripts, keyboard-only operation, screen-reader results and form errors, focus, contrast, reduced motion, responsive zoom, language/localization, hearing and mobility needs. Requires real assistive-tech validation, not only automated scans. Reference: https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/

Marketing: parent public discovery, proof-based 15–30 second demos per child, SEO on true public product pages, Search Console, accessible education, creator/merchant referrals and consented email. Structured merchant Product/Offer/variant markup only on genuinely purchasable product pages; Google does not guarantee results: https://developers.google.com/search/docs/appearance/structured-data/merchant-listing?hl=en

Metering: separate zero-fee social/store creation from actual item pricing and processor charges. Track SONARA's contribution = revenue - variable provider fees - compute/storage/egress - support - chargeback/fraud losses. Do not promise unlimited GPU, external paid APIs, email sending, flights or media generation as free. Customer analytics must expose period, units, provenance and unknown values.

Reliability: per-product SLO/error budgets; p95 reads and writes from measured staging; queue wait, dead-letter age, idempotency, provider failures, cost/tenant and object storage egress. Start with controlled small tenants and use real k6/load data before capacity claims. Use OpenTelemetry sanitized events, restore drills, RLS adversarial tests, grant audits and automatic rollback criteria. No invented latency/SLA/ROI metrics.

Supabase 2026 breaking changes include upcoming Oct 30 default Data API exposure enforcement; inspect actual grants and role policies before any new table. Official change list: https://supabase.com/changelog?types=breaking-change

Observed preview database advisories: 66 RLS/no-policy INFO, 8 executable SECURITY DEFINER WARN, 28 auth RLS initplan WARN, 1,292 overlapping permissive-policy WARN, 379 unindexed-FK INFO, 583 unused-index INFO. Counts are review signals, not verified exploit findings. Server-only tables might intentionally have zero policies; never install blanket access grants or drop unused indexes without actual workload, security review, migration and rollback proof.

Production Supabase is INACTIVE; production-target Vercel deployments were BLOCKED. No database mutation or deployment is performed by this plan.