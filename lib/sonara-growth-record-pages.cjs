"use strict";

// The six Growth Studio record pages.
//
// /growth-studio/segments, /experiments, /attribution, /providers, /consent and
// /provider-jobs were all registered routes, all listed in the route registry
// with titles, and all six did the same thing: a 302 to an /api/ URL. So they
// appeared in navigation as destinations and delivered a wall of JSON.
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

function conversionRate(row) {
  const exposures = Number(row.exposures);
  const conversions = Number(row.conversions);
  if (!Number.isFinite(exposures) || !Number.isFinite(conversions) || exposures <= 0) return "Not enough data";
  return `${((conversions / exposures) * 100).toFixed(1)}%`;
}

const GROWTH_RECORD_PAGES = Object.freeze([
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
  }
]);

module.exports = {
  GROWTH_RECORD_PAGES,
  conversionRate,
  countText,
  dayText,
  percentText,
  summariseMetrics,
  text,
  whenText
};
