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
    "active",
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
    "active",
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
    "active",
    "/growth-studio/your-campaigns",
    "campaign calendar|journey steps|automation rules|approval gates|stop controls",
    "growth campaigns|workflow engine",
    "No journey may message, publish, spend, or mutate sensitive data without authorization."
  ],
  [
    "landing-conversion-tracking",
    "Landing Pages & Results",
    "conversion",
    "Your totals, and which campaign or source the sales you recorded actually came from.",
    "Tell where your customers came from instead of guessing.",
    // Was "starter". growth_studio opens at Core, so a Starter plan
    // could not have opened this one whatever the row said.
    "core",
    "active",
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
    "active",
    "/growth-studio/experiments",
    "revenue attribution|holdout planning|experiment design|confidence evidence|ROI reporting",
    "customer timeline|payments|experiments",
    "No result is called lift without an eligible comparison; every attribution result states limitations."
  ],
  [
    "provider-diagnostics-answer-visibility",
    "Connection Health",
    "operations",
    "Which services you have connected, what each one is allowed to do, and what it has run.",
    "Know what can run safely before you press go.",
    "pro",
    "active",
    "/growth-studio/providers",
    // Trimmed. The page lists the services an account has connected and their
    // state. Answer-engine evidence and referral tracking are not built.
    "which services are connected|what each one may do|what it has run",
    "integration hub|observability|market intelligence",
    "Diagnostics never execute sensitive actions; no guaranteed ranking, citation, traffic, or placement claims."
  ],
  [
    "campaign-budget-split",
    "Campaign Budget Split",
    "campaigns",
    "Split a monthly budget across channels and see what it has to return before it is worth spending at all.",
    "Know the break-even cost per lead before the money goes out.",
    "free",
    "active",
    "/growth-studio/tools/budget-split",
    "per-channel budget|expected leads|expected customers|break-even cost per lead",
    "module_outputs|planner tools",
    "Your own assumptions worked through. Nothing here is measured, and no channel is guaranteed to deliver at your target cost."
  ],
  [
    "referral-reward-planner",
    "Referral Reward Planner",
    "referrals",
    "Check whether a referral reward is affordable at your margin before you promise it to anybody.",
    "Offer a reward you can still pay in a bad month.",
    "free",
    "active",
    "/growth-studio/tools/referral",
    "margin per sale|net per referral|monthly effect|maximum affordable reward",
    "module_outputs|planner tools",
    "Paying money to customers is a payout change and needs owner approval before it goes live."
  ],
  [
    "follow-up-schedule-planner",
    "Follow-Up Schedule",
    "follow-up",
    "Turn one enquiry into a dated sequence of follow-ups, each with a purpose, and a point where you stop.",
    "Follow up properly without becoming the business that never stops emailing.",
    "free",
    "active",
    "/growth-studio/tools/follow-up-schedule",
    "dated sequence|purpose per touch|stop rule|consent reminder",
    "module_outputs|planner tools",
    "A plan you or your team follow. Nothing is sent for you, and it must only be used for somebody who gave you their details for this purpose."
  ],
  [
    "referral-source-tracker",
    "Referral Source Tracker",
    "referrals",
    "Who actually sends you business, what they are worth, and whether it all rests on one person.",
    "83% of small businesses call referrals their best source. Most cannot name one.",
    "free",
    "active",
    "/growth-studio/tools/referral-source",
    "referral totals|value of referrals|top referrer|concentration risk",
    "module_outputs|market tools",
    "Counts what you record by hand. There is no tracking pixel on a conversation, which is why this exists."
  ],
  [
    "review-recency-score",
    "Review Recency Score",
    "reputation",
    "A strong rating from two years ago reads as a business that used to be good. This scores how current your reviews look.",
    "Stay looking open, not just well rated.",
    "core",
    "active",
    "/growth-studio/tools/review-recency",
    "recent share|shortfall to stay current|weekly rate needed",
    "module_outputs|market tools",
    "Never offer anything in exchange for a review; every major platform treats that as grounds for removing the reviews you already have."
  ],
  [
    "enquiry-response-clock",
    "Enquiry Response Clock",
    "follow-up",
    "A number on what answering enquiries slowly costs you each month, from one stated assumption you can change.",
    "Find out whether your problem is leads or the wait after them.",
    "free",
    "active",
    "/growth-studio/tools/response-time",
    "enquiries won now|enquiries won if answered same day|monthly value of the gap",
    "module_outputs|market tools",
    "Uses an explicit stated rule rather than a fitted curve, and the result says plainly that it is an assumption rather than a measurement."
  ],
]);
