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
    // Was "starter". growth_studio opens at Core, so a Starter plan
    // could not have opened this one whatever the row said.
    "core",
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
    "landing-conversion-tracking",
    "Landing Pages & Results",
    "conversion",
    "Link your message, offer, page, form, booking or payment, campaign tag, and the sales that came from it.",
    "See one clear path from somebody noticing you to somebody buying.",
    // Was "starter". growth_studio opens at Core, so a Starter plan
    // could not have opened this one whatever the row said.
    "core",
    "beta",
    "/growth-studio/attribution",
    // Trimmed. The page shows totals and where results came from. There is no
    // UTM builder and no landing-page form anywhere in Growth Studio.
    "your totals|where the results came from|recorded conversions",
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
    "provider-diagnostics-answer-visibility",
    "Connection Health",
    "operations",
    "Which connections are working, what they are allowed to do, limits, jobs, errors, retries, costs, approvals, and where you are being mentioned.",
    "Know what can run safely before you press go.",
    "pro",
    "beta",
    "/growth-studio/providers",
    // Trimmed. The page lists the services an account has connected and their
    // state. Answer-engine evidence and referral tracking are not built.
    "which services are connected|what each one may do|what it has run",
    "integration hub|observability|market intelligence",
    "Diagnostics never execute sensitive actions; no guaranteed ranking, citation, traffic, or placement claims."
  ]
]);
