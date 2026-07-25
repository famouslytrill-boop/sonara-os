"use strict";

module.exports = Object.freeze([
  [
    "customer-timeline-consent-center",
    "Customer Timeline & Consent Center",
    "crm",
    "Deduplicated leads, customers, fans, touchpoints, transactions, conversions, purpose-specific consent, and suppression.",
    "Understand the customer journey and prevent unauthorized outreach.",
    "core",
    "validation_required",
    "/growth-studio/consent",
    "customer timeline|identity linkage|consent ledger|suppression|source freshness",
    "customer records|touchpoints|transactions",
    "Ambiguous matches require review and suppression always overrides eligibility."
  ],
  [
    "lead-capture-segments-crm",
    "Lead Capture, Segments & CRM",
    "acquisition",
    "Consent-aware forms, lead records, transparent audience rules, source labels, status, and follow-up priority.",
    "Capture and organize qualified interest with visible targeting logic.",
    "starter",
    "beta",
    "/growth-studio/segments",
    "lead forms|lead records|segments|source tracking|lead scoring|follow-up priority",
    "growth leads|forms|consent",
    "Collect only necessary data; sensitive targeting and unsupported inferred attributes are prohibited."
  ],
  [
    "campaign-journey-builder",
    "Campaign & Journey Builder",
    "campaigns",
    "Plan objectives, audience, offer, channels, content, owners, schedule, approvals, triggers, steps, stop conditions, and outcomes.",
    "Turn campaigns and follow-up into controlled repeatable workflows.",
    "core",
    "validation_required",
    "/growth-studio/dashboard",
    "campaign calendar|journey steps|automation rules|approval gates|stop controls",
    "growth campaigns|workflow engine",
    "No journey may message, publish, spend, or mutate sensitive data without authorization."
  ],
  [
    "lifecycle-messaging-social-planning",
    "Lifecycle Messaging & Social Planning",
    "messaging",
    "Design onboarding, follow-up, retention, review, referral, win-back, and social content with provider handoff.",
    "Coordinate timely communication without uncontrolled bulk sending.",
    "core",
    "planned",
    "/growth-studio",
    "email sequences|social plan|content approvals|publishing handoff|unsubscribe",
    "Resend or approved provider|Buffer or approved connector",
    "Sending and publishing stay disabled until consent, domain, suppression, deliverability, and approval controls are verified."
  ],
  [
    "landing-conversion-tracking",
    "Landing Pages & Conversion Tracking",
    "conversion",
    "Connect campaign message, offer, destination, form, booking or payment action, UTM source, and verified conversion events.",
    "Create one measurable path from attention to customer action.",
    "starter",
    "beta",
    "/growth-studio/attribution",
    "landing handoff|offer link|forms|UTM builder|online conversions|offline conversions",
    "Business Builder|conversion events",
    "Pages require truthful claims and active destinations; tracking must respect consent and data gaps."
  ],
  [
    "attribution-incrementality-lab",
    "Attribution & Incrementality Lab",
    "measurement",
    "Document models, freshness, confidence, deduplication, hypotheses, comparisons, metrics, stop conditions, and limitations.",
    "Separate correlation from evidence that marketing caused improvement.",
    "pro",
    "validation_required",
    "/growth-studio/experiments",
    "revenue attribution|holdout planning|experiment design|confidence evidence|ROI reporting",
    "customer timeline|payments|experiments",
    "No result is called lift without an eligible comparison; every attribution result states limitations."
  ],
  [
    "reviews-referrals-partnerships",
    "Reviews, Referrals & Partnerships",
    "retention",
    "Plan truthful review requests, referral offers, creator partnerships, disclosures, deliverables, conversions, costs, and outcomes.",
    "Grow advocacy and partnerships using verifiable evidence.",
    "pro",
    "validation_required",
    "/growth-studio",
    "review workflow|referral workflow|creator measurement|audience fit|deliverable evidence",
    "customer records|Creator Studio|campaigns",
    "No fake reviews, review gating, undisclosed incentives, or modeled lift presented as fact."
  ],
  [
    "provider-diagnostics-answer-visibility",
    "Provider Diagnostics & Answer Visibility",
    "operations",
    "Show connection readiness, permissions, quotas, jobs, errors, retries, cost, approvals, plus observable citations and referrals.",
    "Know what can run safely and track discovery evidence without ranking promises.",
    "pro",
    "beta",
    "/growth-studio/providers",
    "provider diagnostics|approval queue|job history|answer-engine evidence|referral tracking",
    "integration hub|observability|market intelligence",
    "Diagnostics never execute sensitive actions; no guaranteed ranking, citation, traffic, or placement claims."
  ]
]);
