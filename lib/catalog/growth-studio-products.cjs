"use strict";

// See lib/catalog/sonara-industries-products.cjs for the row shape. name,
// summary and customerOutcome are customer-facing copy; the rest is internal.

module.exports = Object.freeze([
  [
    "customer-timeline-consent-center",
    "Customer History & Permissions",
    "crm",
    "Merged leads, customers and fans, with every touchpoint, purchase, and the permission behind each one.",
    "See the whole customer journey, and never contact somebody who asked you not to.",
    "core",
    "beta",
    "/growth-studio/consent",
    "customer timeline|identity linkage|consent ledger|suppression|source freshness",
    "customer records|touchpoints|transactions",
    "Ambiguous matches require review and suppression always overrides eligibility."
  ],
  [
    "lead-capture-segments-crm",
    "Lead Capture & Lists",
    "acquisition",
    "Permission-aware forms, lead records, audience rules written in plain English, sources, status, and who to call first.",
    "Collect real interest, and see exactly why somebody is on a list.",
    "starter",
    "beta",
    "/growth-studio/segments",
    "lead forms|lead records|segments|source tracking|lead scoring|follow-up priority",
    "growth leads|forms|consent",
    "Collect only necessary data; sensitive targeting and unsupported inferred attributes are prohibited."
  ],
  [
    "campaign-journey-builder",
    "Campaign Builder",
    "campaigns",
    "Goals, audience, offer, channels, content, owners, dates, approvals, triggers, steps, stop rules, and results.",
    "Turn campaigns and follow-up into something repeatable that you control.",
    "core",
    "beta",
    "/growth-studio/your-campaigns",
    "campaign calendar|journey steps|automation rules|approval gates|stop controls",
    "growth campaigns|workflow engine",
    "No journey may message, publish, spend, or mutate sensitive data without authorization."
  ],
  [
    "lifecycle-messaging-social-planning",
    "Follow-Up & Social Planning",
    "messaging",
    "Welcome messages, follow-ups, win-backs, review and referral asks, and social content, ready to hand to your sending tool.",
    "Say the right thing at the right time without blasting everybody at once.",
    "core",
    "planned",
    "/growth-studio",
    "email sequences|social plan|content approvals|publishing handoff|unsubscribe",
    "Resend or approved provider|Buffer or approved connector",
    "Sending and publishing stay disabled until consent, domain, suppression, deliverability, and approval controls are verified."
  ],
  [
    "landing-conversion-tracking",
    "Landing Pages & Results",
    "conversion",
    "Link your message, offer, page, form, booking or payment, campaign tag, and the sales that came from it.",
    "See one clear path from somebody noticing you to somebody buying.",
    "starter",
    "beta",
    "/growth-studio/attribution",
    "landing handoff|offer link|forms|UTM builder|online conversions|offline conversions",
    "Business Builder|conversion events",
    "Pages require truthful claims and active destinations; tracking must respect consent and data gaps."
  ],
  [
    "attribution-incrementality-lab",
    "Did It Actually Work?",
    "measurement",
    "Written-down methods, how fresh the data is, how confident we are, duplicate handling, fair comparisons, and what the numbers cannot tell you.",
    "Tell the difference between marketing that worked and a coincidence.",
    "pro",
    "beta",
    "/growth-studio/experiments",
    "revenue attribution|holdout planning|experiment design|confidence evidence|ROI reporting",
    "customer timeline|payments|experiments",
    "No result is called lift without an eligible comparison; every attribution result states limitations."
  ],
  [
    "reviews-referrals-partnerships",
    "Reviews, Referrals & Partners",
    "retention",
    "Honest review requests, referral offers, creator partnerships, disclosures, deliverables, costs, and outcomes.",
    "Grow through word of mouth you can actually stand behind.",
    "pro",
    "validation_required",
    "/growth-studio",
    "review workflow|referral workflow|creator measurement|audience fit|deliverable evidence",
    "customer records|Creator Studio|campaigns",
    "No fake reviews, review gating, undisclosed incentives, or modeled lift presented as fact."
  ],
  [
    "provider-diagnostics-answer-visibility",
    "Connection Health",
    "operations",
    "Which connections are working, what they are allowed to do, limits, jobs, errors, retries, costs, approvals, and where you are being mentioned.",
    "Know what can run safely before you press go.",
    "pro",
    "beta",
    "/growth-studio/providers",
    "provider diagnostics|approval queue|job history|answer-engine evidence|referral tracking",
    "integration hub|observability|market intelligence",
    "Diagnostics never execute sensitive actions; no guaranteed ranking, citation, traffic, or placement claims."
  ]
]);
