"use strict";

const leadConversion = require("./sonara-lead-conversion.cjs");

// The ten Growth Studio record pages.
//
// /growth-studio/segments, /experiments, /attribution, /providers, /consent and
// /provider-jobs were all registered routes, all listed in the route registry
// with titles, and all six did the same thing: a 302 to an /api/ URL. So they
// appeared in navigation as destinations and delivered a wall of JSON.
//
// Four more were added later -- content-plan, automations, conversions and
// touchpoints. The first two already existed as paths, but as placeholder pages
// from lib/sonara-product-pages.cjs: a card saying the workspace "unlocks after
// billing state confirms plan access", shown to a customer whose billing state
// already confirmed it. The endpoints behind them had worked the whole time.
// Those two placeholder entries were removed in the same change rather than
// left in place, because Express keeps the first registration for a path and
// the second would have been dead code that looked live.
//
// Those four carry `paid: true`. The six above them are reachable by any
// signed-in customer; these sit behind the same plan check the placeholders
// did, so publishing a real page in place of a stub does not quietly hand a
// paid workspace to a free account.
//
// The link check could not see it. It only reads links out of pages that
// return 200, and a redirect is not a 200 -- so six catalogued pages pointed at
// raw data for as long as they existed without a single test objecting.
//
// Each page is a description rather than a handler: which records, which
// columns, and what to say when there are none. The rendering is done once in
// routes/growth-studio-control-routes.cjs. Adding a seventh should be a table
// entry, not another redirect.
//
// Two rules hold for every column below:
//
//   Nothing that could carry a secret is listed. growth_provider_connections
//   has credential_reference and a configuration blob; neither is rendered, and
//   the connected account is reported as connected or not rather than by id.
//
//   Nothing is invented. A missing value reads as "Not recorded", never as a
//   zero or a plausible-looking default.

const { growthStatusLabel } = require("./sonara-plain-language.cjs");

function text(value, fallback = "Not recorded") {
  const output = String(value == null ? "" : value).trim();
  return output || fallback;
}

function whenText(value, fallback = "Not recorded") {
  if (!value) return fallback;
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed.toISOString().replace("T", " ").slice(0, 16);
}

function dayText(value, fallback = "Not recorded") {
  if (!value) return fallback;
  return String(value).slice(0, 10);
}

function countText(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? String(parsed) : "Not counted";
}

function percentText(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? `${Math.round(parsed * 100)}%` : "Not set";
}

// A metrics blob is provider-shaped and varies by report. Rather than guess at
// which keys matter, the first few are shown as they were recorded.
function summariseMetrics(metrics) {
  if (!metrics || typeof metrics !== "object" || Array.isArray(metrics)) return "Not recorded";
  const pairs = Object.entries(metrics)
    .filter(([, value]) => value !== null && value !== undefined && typeof value !== "object")
    .slice(0, 4)
    .map(([key, value]) => `${key.replaceAll("_", " ")}: ${value}`);
  return pairs.length ? pairs.join(" · ") : "Not recorded";
}

// Attribution confidence, said as a caveat rather than a grade. "unknown" is
// the default the handler writes when nothing better is known, and on a sales
// figure that is the reader's most important piece of context.
const ATTRIBUTION_CONFIDENCE = Object.freeze({
  unknown: "Not established",
  low: "Low — treat as a guess",
  medium: "Reasonable",
  high: "High",
  provider_reported: "As the service reported it"
});

function attributionConfidenceText(value) {
  return ATTRIBUTION_CONFIDENCE[String(value || "")] || "Not established";
}

function conversionRate(row) {
  const exposures = Number(row.exposures);
  const conversions = Number(row.conversions);
  if (!Number.isFinite(exposures) || !Number.isFinite(conversions) || exposures <= 0) return "Not enough data";
  return `${((conversions / exposures) * 100).toFixed(1)}%`;
}

const GROWTH_RECORD_PAGES = Object.freeze([
  {
    // The campaigns themselves, as opposed to a plan for one.
    //
    // /growth-studio/campaigns already exists and is the planner: it posts to
    // /api/growth-studio/campaigns, which calls saveModuleOutput and writes a
    // plan into module_outputs. growth_campaigns -- the table the totals count,
    // the control center lists, and a lead's campaign_id points at -- had no
    // page and no form. The two were conflated in a comment calling one a "JSON
    // twin" of the other, which is how a whole table stayed unwritable.
    //
    // Named for the distinction rather than around it: one page plans a
    // campaign, this one holds the ones you are actually running.
    path: "/growth-studio/your-campaigns",
    tableKey: "campaigns",
    title: "Your campaigns",
    heading: "Your campaigns",
    body: "The efforts you have under way to bring people in, and where each one stands. Nothing is sent from here.",
    select: "id,name,goal,channel,status,created_at",
    order: "created_at.desc",
    empty: "No campaigns yet. Add one below and leads can point at it.",
    columns: [
      { label: "Campaign", value: (row) => text(row.name, "Untitled campaign") },
      { label: "What it is for", value: (row) => text(row.goal, "Not recorded") },
      { label: "Where it runs", value: (row) => text(row.channel, "Not recorded") },
      { label: "Where it stands", value: (row) => growthStatusLabel(row.status) },
      { label: "Started", value: (row) => dayText(row.created_at) }
    ]
  },
  {
    // People who got in touch, and the button that turns one into a customer.
    //
    // /growth-studio/leads already exists and is a capture form -- somewhere to
    // write a lead down, with no list of the ones already written. So the
    // conversion built in lib/sonara-lead-conversion.cjs, its endpoint, its
    // duplicate guards and its migration all shipped with nowhere to press:
    // the same defect as the quote step, which was found the same way and is
    // recorded at routes/sonara-last9-routes.cjs. An endpoint reachable only by
    // an API client is not a feature a small business owner has.
    //
    // Named for what it holds rather than for the table. "People who got in
    // touch" is already how the totals card on this same product counts them.
    path: "/growth-studio/enquiries",
    tableKey: "leads",
    title: "People who got in touch",
    heading: "People who got in touch",
    body: "Everyone who has come to you, how to reach them, and whether they have become a customer yet.",
    select: "id,name,email,phone,source,status,customer_id,created_at",
    order: "created_at.desc",
    empty: "Nobody has come to you yet. New enquiries appear here as they are recorded.",
    columns: [
      { label: "Name", value: (row) => text(row.name, "No name recorded") },
      { label: "Email", value: (row) => text(row.email, "None") },
      { label: "Phone", value: (row) => text(row.phone, "None") },
      { label: "How they found you", value: (row) => text(row.source, "Not recorded") },
      { label: "Status", value: (row) => growthStatusLabel(row.status) },
      { label: "First heard from", value: (row) => dayText(row.created_at) }
    ],
    // The whole reason for the page. Loading the customer list is not optional
    // decoration: the rule that decides whether this lead can become a customer
    // includes "is there already a customer with that email", and a button that
    // appears and then refuses is worse than a row that says why up front.
    needsCustomers: true,
    rowAction: {
      api: "/api/growth-studio/leads/:id/customer",
      label: "Make them a customer",
      columnLabel: "Customer",
      // Deliberately the endpoint's own function rather than a second copy of
      // the rules. Two implementations of "can this convert" drift, and the one
      // on the page is the one that drifts silently -- it only ever shows or
      // hides a button, so nobody finds out until an owner presses one that
      // refuses.
      reasonUnavailable: (row, context) => {
        // An unreadable customer list is not an empty one. The endpoint refuses
        // outright in this case, so the page must not offer a button that is
        // already known to fail.
        if (!context || !Array.isArray(context.customers)) {
          return "We could not check your customer list just now.";
        }
        return leadConversion.reasonNotConvertible(row, context.customers);
      }
    }
  },
  {
    path: "/growth-studio/segments",
    tableKey: "segments",
    title: "Audience groups",
    heading: "Audience groups",
    body: "The groups you have defined, how many people are estimated to be in each, and when that was last worked out.",
    select: "id,name,description,status,estimated_count,last_evaluated_at,created_at",
    order: "created_at.desc",
    empty: "You have not defined any audience groups yet.",
    columns: [
      { label: "Group", value: (row) => text(row.name, "Untitled group") },
      { label: "What it is", value: (row) => text(row.description, "No description") },
      { label: "Status", value: (row) => growthStatusLabel(row.status) },
      { label: "Estimated people", value: (row) => countText(row.estimated_count) },
      { label: "Last worked out", value: (row) => whenText(row.last_evaluated_at, "Not yet") }
    ]
  },
  {
    path: "/growth-studio/experiments",
    tableKey: "experiments",
    title: "Tests",
    heading: "Tests you are running",
    body: "What you set out to learn, which version is in front of people, and what the numbers say so far.",
    select: "id,name,hypothesis,result,status,created_at",
    order: "created_at.desc",
    empty: "You have not set up any tests yet.",
    columns: [
      { label: "Test", value: (row) => text(row.name, "Untitled test") },
      { label: "What you expect", value: (row) => text(row.hypothesis, "Not written down") },
      { label: "Status", value: (row) => growthStatusLabel(row.status) },
      { label: "What happened", value: (row) => text(row.result, "Too early to say") },
      { label: "Started", value: (row) => whenText(row.created_at) }
    ]
  },
  {
    path: "/growth-studio/attribution",
    tableKey: "metrics",
    title: "Where results came from",
    heading: "Where your results came from",
    body: "Your totals, and the figures behind them as they were reported to us.",
    // This page replaces a link labelled "Live numbers" that pointed at
    // /api/growth/metrics -- a computed summary, not this table. Dropping the
    // link without carrying the totals across would have quietly removed them,
    // so the page shows both.
    includesTotals: true,
    select: "id,report_type,provider_key,date_start,date_end,metrics,sampled,data_freshness,captured_at",
    order: "captured_at.desc",
    empty: "No figures have been recorded yet. They appear once a connected service reports some.",
    columns: [
      { label: "Report", value: (row) => text(row.report_type).replaceAll("_", " ") },
      { label: "Source", value: (row) => text(row.provider_key, "Not stated").replaceAll("_", " ") },
      { label: "Period", value: (row) => `${dayText(row.date_start)} to ${dayText(row.date_end)}` },
      { label: "Figures", value: (row) => summariseMetrics(row.metrics) },
      { label: "How complete", value: (row) => (row.sampled ? "A sample, not everything" : text(row.data_freshness, "Reported as final")) },
      { label: "Read at", value: (row) => whenText(row.captured_at) }
    ]
  },
  {
    path: "/growth-studio/providers",
    tableKey: "connections",
    title: "Connected services",
    heading: "Services you have connected",
    body: "Which services are connected and working. Keys and account details are held on our servers and are never shown here.",
    // No credential_reference and no configuration blob: neither is safe to put
    // on a page, and neither tells the customer anything they need.
    select: "id,provider_key,external_account_id,connection_status,last_verified_at,last_error_code",
    order: "created_at.desc",
    empty: "You have not connected any services yet.",
    columns: [
      { label: "Service", value: (row) => text(row.provider_key, "Unnamed").replaceAll("_", " ") },
      { label: "Status", value: (row) => growthStatusLabel(row.connection_status) },
      { label: "Account linked", value: (row) => (row.external_account_id ? "Yes" : "Not yet") },
      { label: "Last checked", value: (row) => whenText(row.last_verified_at, "Not yet") },
      { label: "Last problem", value: (row) => text(row.last_error_code, "None").replaceAll("_", " ") }
    ]
  },
  {
    path: "/growth-studio/consent",
    tableKey: "consents",
    title: "Permission records",
    heading: "Who has agreed to hear from you",
    body: "One record per person, channel and purpose, with where the permission came from. Nothing is sent to anybody whose record here does not allow it.",
    select: "id,channel,purpose,consent_status,source,granted_at,expires_at,withdrawn_at",
    order: "created_at.desc",
    empty: "No permission records yet.",
    columns: [
      { label: "Channel", value: (row) => text(row.channel).replaceAll("_", " ") },
      { label: "What for", value: (row) => text(row.purpose) },
      { label: "Status", value: (row) => growthStatusLabel(row.consent_status) },
      { label: "Where it came from", value: (row) => text(row.source).replaceAll("_", " ") },
      { label: "Agreed", value: (row) => whenText(row.granted_at, "Not agreed") },
      { label: "Runs out", value: (row) => whenText(row.expires_at, "No end date") }
    ]
  },
  {
    path: "/growth-studio/provider-jobs",
    tableKey: "jobs",
    title: "Work sent to services",
    heading: "Work sent to connected services",
    body: "Everything handed to a connected service on your behalf, what it was for, and whether it needed your approval first.",
    // idempotency_key, request_payload and provider_response stay off the page.
    select: "id,provider_key,capability,operation,status,progress_percent,approval_required,approved_at,error_message,created_at",
    order: "created_at.desc",
    empty: "Nothing has been sent to a connected service yet.",
    columns: [
      { label: "Service", value: (row) => text(row.provider_key, "Unnamed").replaceAll("_", " ") },
      { label: "What it was", value: (row) => `${text(row.capability).replaceAll("_", " ")} · ${text(row.operation).replaceAll("_", " ")}` },
      { label: "Status", value: (row) => growthStatusLabel(row.status) },
      { label: "Progress", value: (row) => `${Number(row.progress_percent || 0)}%` },
      { label: "Your approval", value: (row) => (row.approval_required ? (row.approved_at ? `Given ${whenText(row.approved_at)}` : "Waiting on you") : "Not needed") },
      { label: "Problem", value: (row) => text(row.error_message, "None") },
      { label: "Sent", value: (row) => whenText(row.created_at) }
    ]
  },
  {
    path: "/growth-studio/content-plan",
    tableKey: "content",
    paid: true,
    title: "Content plan",
    heading: "Content you have lined up",
    body: "Everything drafted or scheduled, what channel it is for, whether it has been approved, and whether it went out.",
    // provider_response and media_references stay off the page. The first is a
    // provider blob, the second is a list of storage references that means
    // nothing to the person reading it.
    select: "id,title,channel,content_type,approval_status,publish_status,scheduled_for,published_at,failure_code,created_at",
    order: "created_at.desc",
    empty: "You have not drafted any content yet.",
    columns: [
      { label: "Title", value: (row) => text(row.title, "Untitled") },
      { label: "Kind", value: (row) => text(row.content_type).replaceAll("_", " ") },
      { label: "Channel", value: (row) => text(row.channel) },
      { label: "Approved", value: (row) => growthStatusLabel(row.approval_status) },
      { label: "Published", value: (row) => growthStatusLabel(row.publish_status) },
      { label: "Scheduled for", value: (row) => whenText(row.scheduled_for, "Not scheduled") },
      { label: "Went out", value: (row) => whenText(row.published_at, "Not yet") },
      { label: "Problem", value: (row) => text(row.failure_code, "None").replaceAll("_", " ") }
    ]
  },
  {
    path: "/growth-studio/automations",
    tableKey: "automations",
    paid: true,
    title: "Automations",
    heading: "Rules that run on their own",
    body: "What each rule watches for, what it does, and whether it is switched on. New rules are created switched off.",
    // The config blob is not rendered, but one key inside it is: whether the
    // rule needs a person to approve before it acts. The handler sets that from
    // the action, and it is the single most important thing to be able to see
    // about a rule that runs without you.
    select: "id,name,trigger_key,action_key,status,config,created_at",
    order: "created_at.desc",
    empty: "You have not set up any automatic rules yet.",
    columns: [
      { label: "Rule", value: (row) => text(row.name, "Unnamed rule") },
      { label: "When", value: (row) => text(row.trigger_key).replaceAll("_", " ") },
      { label: "It does", value: (row) => text(row.action_key).replaceAll("_", " ") },
      { label: "Switched on", value: (row) => growthStatusLabel(row.status) },
      { label: "Needs your approval", value: (row) => (row.config && row.config.human_approval_required ? "Yes, every time" : "No") },
      { label: "Created", value: (row) => whenText(row.created_at) }
    ]
  },
  {
    path: "/growth-studio/conversions",
    tableKey: "conversions",
    paid: true,
    title: "Sales recorded",
    heading: "Sales and sign-ups you have recorded",
    body: "What was recorded, what it was worth, and how confident we are about which campaign it came from.",
    select: "id,conversion_type,value,currency,attribution_model,attribution_confidence,source,medium,occurred_at",
    order: "occurred_at.desc",
    empty: "No sales or sign-ups have been recorded yet.",
    columns: [
      { label: "What happened", value: (row) => text(row.conversion_type).replaceAll("_", " ") },
      { label: "Worth", value: (row) => (Number.isFinite(Number(row.value)) ? `${row.value} ${text(row.currency, "").toUpperCase()}`.trim() : "Not recorded") },
      { label: "Credited to", value: (row) => text(row.attribution_model).replaceAll("_", " ") },
      // Said plainly rather than as a grade, because "unknown" on a sales
      // figure is a caveat the reader needs, not a label to skim past.
      { label: "How sure", value: (row) => attributionConfidenceText(row.attribution_confidence) },
      { label: "Came from", value: (row) => `${text(row.source, "Not stated")} · ${text(row.medium, "not stated")}` },
      { label: "When", value: (row) => whenText(row.occurred_at) }
    ]
  },
  {
    path: "/growth-studio/touchpoints",
    tableKey: "touchpoints",
    paid: true,
    title: "Contact history",
    heading: "Every recorded contact",
    body: "One row per recorded interaction, where it came from, and when. This is the trail the sales figures are matched against.",
    // anonymous_id, external_event_id and deduplication_key stay off the page.
    // They identify a person or a provider record and tell the reader nothing.
    select: "id,event_name,channel,provider_key,source,medium,value,currency,occurred_at",
    order: "occurred_at.desc",
    empty: "No contact has been recorded yet.",
    columns: [
      { label: "What happened", value: (row) => text(row.event_name).replaceAll("_", " ") },
      { label: "Channel", value: (row) => text(row.channel, "Not stated") },
      { label: "Service", value: (row) => text(row.provider_key, "Recorded directly").replaceAll("_", " ") },
      { label: "Came from", value: (row) => `${text(row.source, "Not stated")} · ${text(row.medium, "not stated")}` },
      { label: "Worth", value: (row) => (Number.isFinite(Number(row.value)) ? `${row.value} ${text(row.currency, "").toUpperCase()}`.trim() : "Not recorded") },
      { label: "When", value: (row) => whenText(row.occurred_at) }
    ]
  }
]);

module.exports = {
  GROWTH_RECORD_PAGES,
  attributionConfidenceText,
  conversionRate,
  countText,
  dayText,
  percentText,
  summariseMetrics,
  text,
  whenText
};
