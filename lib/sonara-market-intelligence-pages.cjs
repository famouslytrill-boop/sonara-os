// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// The market intelligence work screen: what a business has recorded, and the
// forms that record more.
//
// The page used to be guidance plus four counts, and the four record types --
// segments, competitors, signals, opportunities -- could be written only by an
// API client. tests/form-reachability.test.js excused that as deliberate: "a
// free-text form would produce exactly the invented market data the page exists
// to refuse." The reason did not hold. The endpoints already accepted the same
// records from any client, with the same validation, so withholding the form
// kept out the customer rather than invented data -- and left a page whose
// heading promises tracking that nobody could do from the product.
//
// The rules that actually keep invented data out are the endpoints' and they
// apply to the form unchanged: a competitor needs the https page its details
// were read from and the date they were checked; a signal needs its source, the
// date it was observed and a confidence level; an opportunity is scored on the
// published scale and changes state only through a review with a rationale.
//
// Every option list here is the one the endpoints validate against. Two copies
// would be two places to drift, and a dropdown offering a value the server
// refuses is a form that fails after somebody has filled it in.

const {
  MARKET_INTELLIGENCE_FRAMEWORK,
  scoreMarketOpportunity,
  recommendMarketAction
} = require("./sonara-market-intelligence-registry.cjs");

const STUDIOS = Object.freeze([
  ["sonara_industries", "SONARA Industries"],
  ["business_builder", "Business Builder"],
  ["creator_studio", "Creator Studio"],
  ["growth_studio", "Growth Studio"]
]);
const SIGNAL_TYPES = Object.freeze(["market_size", "customer_need", "pricing", "competitor", "technology", "regulation", "channel", "behavior", "risk"]);
const CONFIDENCE_LEVELS = Object.freeze(["low", "medium", "high", "authoritative"]);
const OPPORTUNITY_STATES = Object.freeze(["watch", "validate", "prioritized", "building", "launched", "hold", "rejected"]);
const REVIEW_DECISIONS = Object.freeze(["prioritize", "validate", "watch", "hold", "reject"]);
const RECORD_STATUSES = Object.freeze(["active", "watch", "archived"]);
const BILLING_PERIODS = Object.freeze(["free", "monthly", "annual", "usage", "percentage", "custom", "mixed"]);

// The eight inputs of the score, in the order the framework publishes them,
// with their maxima read from the framework rather than restated.
const SCORE_FIELDS = Object.freeze([
  ["demand_evidence", "demandEvidence", "Demand evidence", "positive"],
  ["willingness_to_pay", "willingnessToPay", "Willingness to pay", "positive"],
  ["strategic_fit", "strategicFit", "Strategic fit", "positive"],
  ["underserved_need", "underservedNeed", "Underserved need", "positive"],
  ["differentiation", "differentiation", "Differentiation", "positive"],
  ["channel_access", "channelAccess", "Channel access", "positive"],
  ["delivery_complexity", "deliveryComplexity", "Delivery complexity", "penalties"],
  ["compliance_risk", "complianceRisk", "Compliance risk", "penalties"]
].map(([name, key, label, kind]) => Object.freeze({ name, key, label, kind, max: MARKET_INTELLIGENCE_FRAMEWORK.scoring[kind][key] })));

// What a refusal means, in words. Only these codes are ever shown: the page
// reads `?problem=` from its own address, and printing whatever arrived there
// would let a link put any sentence on this page.
const PROBLEMS = Object.freeze({
  studio_segment_key_and_name_required: "A segment needs a short key and a name.",
  studio_name_source_and_verified_at_required: "A competitor needs a name, the https address you read its details on, and the date you checked them.",
  complete_evidence_backed_signal_required: "A signal needs a type, a title, a summary, the source's name and https address, the date you observed it, and how confident you are.",
  complete_market_opportunity_required: "An opportunity needs a name, the problem, the target segment and the value you propose.",
  decision_and_rationale_required: "A review needs a decision and the reason for it.",
  focus_evidence_incomplete: "Focus evidence needs every field: the customer commitment, the source, the date it was measured, the cost ceiling, and the same month's revenue and variable cost.",
  opportunity_update_required: "Nothing was changed.",
  https_source_url_required: "Give the https address of the page.",
  supabase_setup_required: "Your account database is not connected yet, so nothing was saved.",
  database_operation_failed: "That could not be saved just now. Nothing was recorded.",
  organization_setup_required: "We could not tell which business you are signed in to. Sign in again.",
  market_intelligence_auth_required: "Sign in again to record evidence.",
  invalid_opportunity_id: "That opportunity is not in your business.",
  resource_not_found: "That opportunity is not in your business, or it has been removed."
});

const DONE = Object.freeze({
  segment: "Segment saved.",
  competitor: "Competitor saved.",
  signal: "Signal saved.",
  opportunity: "Opportunity scored and saved.",
  review: "Review recorded, and the opportunity's state follows the decision.",
  opportunity_updated: "Opportunity updated and rescored.",
  focus_evidence: "Focus evidence saved."
});

function notice(query = {}, escape) {
  const problem = PROBLEMS[String(query.problem || "")];
  const done = DONE[String(query.done || "")];
  if (problem) return `<article class="card" role="alert"><h2>Not saved</h2><p>${escape(problem)}</p></article>`;
  if (done) return `<article class="card" role="status"><h2>Saved</h2><p>${escape(done)}</p></article>`;
  if (query.problem) return `<article class="card" role="alert"><h2>Not saved</h2><p>That could not be saved. Nothing was recorded.</p></article>`;
  return "";
}

const words = (value) => String(value || "").replaceAll("_", " ");
const studioLabel = (key) => (STUDIOS.find(([value]) => value === key) || [null, "SONARA"])[1];
const dateOnly = (value) => (value ? String(value).slice(0, 10) : "");

function options(values, selected = "", label = words) {
  return values.map((value) => `<option value="${value}"${value === selected ? " selected" : ""}>${label(value)}</option>`).join("");
}

// The studio a record belongs to. A studio page records into its own studio;
// the parent page, which shows all four, asks.
function studioField(studioKey, escape) {
  if (studioKey) return `<input type="hidden" name="studio_key" value="${escape(studioKey)}">`;
  return `<label>Studio<select name="studio_key" required>${options(STUDIOS.map(([value]) => value), "sonara_industries", studioLabel)}</select></label>`;
}

const backField = (back, escape) => `<input type="hidden" name="back" value="${escape(back)}">`;

// Three states, not two: a list that could not be read says so rather than
// telling somebody they have recorded nothing. And a list that reached the
// page's cap says it is the newest hundred, not all of them -- the count card
// above is the total.
const LIST_LIMIT = 100;
function listOrSay(result, empty, render) {
  if (!result || result.ok === false) return `<p>We could not read these just now. This is not the same as having none.</p>`;
  if (!result.rows.length) return `<p>${empty}</p>`;
  const capped = result.rows.length >= LIST_LIMIT ? `<p class="fine">Showing the ${LIST_LIMIT} most recent.</p>` : "";
  return render(result.rows) + capped;
}

function sourceLink(url, label, escape) {
  const text = String(url || "");
  return /^https:\/\//i.test(text) ? `<a href="${escape(text)}" rel="noopener noreferrer">${escape(label || text)}</a>` : escape(label || "");
}

function opportunitiesCard(result, { studioKey, back, escape }) {
  const table = listOrSay(result, "No opportunities scored yet.", (rows) => `<table><thead><tr><th>Opportunity</th><th>Score</th><th>Recommendation</th><th>State</th><th>Next review</th></tr></thead><tbody>${rows.map((row) => `<tr><td><a href="/market-intelligence/opportunities/${escape(row.id)}">${escape(row.name)}</a></td><td>${escape(String(row.market_score ?? ""))}</td><td>${escape(words(row.recommendation))}</td><td>${escape(words(row.state))}</td><td>${escape(dateOnly(row.next_review_at) || "Not set")}</td></tr>`).join("")}</tbody></table>`);
  const scores = SCORE_FIELDS.map((field) => `<label>${escape(field.label)} (0–${field.max}${field.kind === "penalties" ? ", subtracted" : ""})<input type="number" name="${field.name}" min="0" max="${field.max}" step="1" value="0" required></label>`).join("");
  return `<article class="card"><h2>Opportunities</h2><p class="fine">Scored out of 100: the six positive factors add, delivery complexity and compliance risk subtract. 75 and above is prioritize, 55 validate, 35 watch, below that hold. The score recommends; a review with a reason decides.</p>${table}<form method="post" action="/api/market-intelligence/opportunities">${backField(back, escape)}${studioField(studioKey, escape)}<label>Name<input name="name" required maxlength="300"></label><label>Problem<textarea name="problem" required maxlength="4000"></textarea></label><label>Target segment<input name="target_segment" required maxlength="500"></label><label>Value you propose<textarea name="proposed_value" required maxlength="4000"></textarea></label>${scores}<label>Owner<input name="owner_name" maxlength="240"></label><label>Next review<input type="date" name="next_review_at"></label><button class="action" type="submit">Score and save</button></form></article>`;
}

function signalsCard(result, segments, { studioKey, back, escape }) {
  const table = listOrSay(result, "No signals recorded yet.", (rows) => `<table><thead><tr><th>Signal</th><th>Type</th><th>Confidence</th><th>Observed</th><th>Expires</th><th>Source</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${escape(row.title)}</td><td>${escape(words(row.signal_type))}</td><td>${escape(row.confidence)}</td><td>${escape(dateOnly(row.observed_at))}</td><td>${escape(dateOnly(row.expires_at) || "No expiry")}</td><td>${sourceLink(row.source_url, row.source_name, escape)}</td></tr>`).join("")}</tbody></table>`);
  return `<article class="card"><h2>Market signals</h2><p class="fine">A signal is evidence somebody has judged: where it came from, when it was observed, and how far to trust it.</p>${table}${signalForm({ studioKey, back, escape, segments })}${fetchForm({ back, escape })}</article>`;
}

// Prefilled when it follows a fetched page: the address and the site's name are
// known, and nothing else is -- the summary, type and confidence are a person's
// judgement and are never guessed here.
function signalForm({ studioKey, back, escape, segments, sourceUrl = "", sourceName = "" }) {
  const segmentChoice = segments && segments.ok && segments.rows.length
    ? `<label>Segment<select name="segment_key"><option value="">None</option>${segments.rows.map((row) => `<option value="${escape(row.segment_key)}">${escape(row.name)}</option>`).join("")}</select></label>`
    : "";
  return `<form method="post" action="/api/market-intelligence/signals">${backField(back, escape)}${studioField(studioKey, escape)}<label>Type<select name="signal_type" required>${options(SIGNAL_TYPES)}</select></label><label>Title<input name="title" required maxlength="300"></label><label>Summary, in your words<textarea name="summary" required maxlength="4000"></textarea></label><label>Source name<input name="source_name" required maxlength="300" value="${escape(sourceName)}"></label><label>Source address (https)<input type="url" name="source_url" required pattern="https://.*" maxlength="2000" value="${escape(sourceUrl)}"></label><label>Observed on<input type="date" name="observed_at" required></label><label>Confidence<select name="confidence" required>${options(CONFIDENCE_LEVELS, "medium")}</select></label><label>Expires on<input type="date" name="expires_at"></label><label>Metric<input name="metric_name" maxlength="240"></label><label>Value<input type="number" step="any" name="metric_value"></label><label>Unit<input name="metric_unit" maxlength="80"></label><label>Geography<input name="geography" maxlength="240"></label>${segmentChoice}<button class="action" type="submit">Record signal</button></form>`;
}

function fetchForm({ back, escape }) {
  return `<form method="post" action="/api/market-intelligence/fetch-source">${backField(back, escape)}<label>Read a source page instead of pasting it (https)<input type="url" name="source_url" required pattern="https://.*" maxlength="2000"></label><p class="fine">Only from a site you have approved as a research source. It fetches the text for you to read and records nothing.</p><button type="submit">Fetch the page</button></form>`;
}

function competitorsCard(result, { studioKey, back, escape }) {
  const table = listOrSay(result, "No competitors recorded yet.", (rows) => `<table><thead><tr><th>Competitor</th><th>Category</th><th>Entry price</th><th>Checked</th><th>Source</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${escape(row.name)}</td><td>${escape(row.category || "")}</td><td>${row.entry_price === null || row.entry_price === undefined ? "Not recorded" : escape(`${row.entry_price} ${row.currency || ""} ${words(row.billing_period)}`.trim())}</td><td>${escape(dateOnly(row.verified_at))}</td><td>${sourceLink(row.source_url, "Page read", escape)}</td></tr>`).join("")}</tbody></table>`);
  return `<article class="card"><h2>Competitors</h2><p class="fine">Prices and capabilities change, so each one carries the page they were read from and the date they were checked.</p>${table}<form method="post" action="/api/market-intelligence/competitors">${backField(back, escape)}${studioField(studioKey, escape)}<label>Name<input name="name" required maxlength="240"></label><label>Category<input name="category" maxlength="240"></label><label>Where you read it (https)<input type="url" name="source_url" required pattern="https://.*" maxlength="2000"></label><label>Checked on<input type="date" name="verified_at" required></label><label>Entry price<input type="number" name="entry_price" min="0" step="0.01"></label><label>Currency<input name="currency" value="USD" maxlength="12"></label><label>Billing<select name="billing_period">${options(BILLING_PERIODS, "monthly")}</select></label><label>Pricing model<input name="pricing_model" maxlength="500"></label><label>Capabilities, one per line<textarea name="capabilities" maxlength="4000"></textarea></label><label>Strengths, one per line<textarea name="strengths" maxlength="4000"></textarea></label><label>Weaknesses, one per line<textarea name="weaknesses" maxlength="4000"></textarea></label><label>Notes<textarea name="notes" maxlength="3000"></textarea></label><button class="action" type="submit">Record competitor</button></form></article>`;
}

function segmentsCard(result, { studioKey, back, escape }) {
  const table = listOrSay(result, "No segments defined yet.", (rows) => `<table><thead><tr><th>Segment</th><th>Key</th><th>Customer type</th><th>Geography</th><th>Status</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${escape(row.name)}</td><td>${escape(row.segment_key)}</td><td>${escape(row.customer_type || "")}</td><td>${escape(row.geography || "")}</td><td>${escape(words(row.status))}</td></tr>`).join("")}</tbody></table>`);
  return `<article class="card"><h2>Customer segments</h2>${table}<form method="post" action="/api/market-intelligence/segments">${backField(back, escape)}${studioField(studioKey, escape)}<label>Name<input name="name" required maxlength="240"></label><label>Short key<input name="segment_key" required maxlength="120" pattern="[A-Za-z0-9 _-]+"></label><label>Description<textarea name="description" maxlength="2000"></textarea></label><label>Customer type<input name="customer_type" maxlength="240"></label><label>Geography<input name="geography" maxlength="240"></label><label>Jobs to be done, one per line<textarea name="jobs_to_be_done" maxlength="4000"></textarea></label><label>Pain points, one per line<textarea name="pain_points" maxlength="4000"></textarea></label><label>Buying triggers, one per line<textarea name="buying_triggers" maxlength="4000"></textarea></label><label>Constraints, one per line<textarea name="constraints" maxlength="4000"></textarea></label><label>Status<select name="status">${options(RECORD_STATUSES)}</select></label><button class="action" type="submit">Save segment</button></form></article>`;
}

// The score, shown as the sum it is. A number with no breakdown invites being
// trusted or argued with; the parts can be checked.
function scoreBreakdown(row, escape) {
  const parts = SCORE_FIELDS.map((field) => `<tr><th>${escape(field.label)}</th><td>${field.kind === "penalties" ? "−" : "+"}${escape(String(Number(row[field.name]) || 0))} of ${field.max}</td></tr>`).join("");
  const score = scoreMarketOpportunity(row);
  return `<article class="card"><h2>Score: ${escape(String(score))} of 100</h2><p>Recommendation: ${escape(words(recommendMarketAction(score)))}. State: ${escape(words(row.state))}.</p><table><tbody>${parts}</tbody></table></article>`;
}

const FOCUS_BLOCKERS = Object.freeze({
  target_segment_required: "No target segment.",
  owner_name_required: "No owner named.",
  customer_commitment_required: "No customer commitment recorded.",
  source_reference_required: "No source for the commitment.",
  fresh_dated_evidence_required: "The evidence is undated, in the future, or older than 30 days.",
  cost_ceiling_required: "No cost ceiling.",
  same_period_revenue_and_cost_required: "No revenue and variable cost for the same month.",
  positive_contribution_required: "Variable cost is at or above revenue.",
  cost_ceiling_exceeded: "Variable cost is above the ceiling you set."
});

function focusCard(assessment, row, { back, escape }) {
  const blockers = assessment.blockers.map((code) => `<li>${escape(FOCUS_BLOCKERS[code] || words(code))}</li>`).join("");
  const economics = assessment.economics
    ? `<p>Contribution: ${escape((assessment.economics.contributionCents / 100).toFixed(2))} a month, a margin of ${escape(String(assessment.economics.contributionMarginPercent))}%.</p>`
    : "";
  const evidence = row?.metadata?.focus_evidence || {};
  const money = (cents) => (Number.isSafeInteger(cents) ? (cents / 100).toFixed(2) : "");
  return `<article class="card"><h2>Pilot focus: ${escape(assessment.decision === "pilot_candidate" ? "pilot candidate" : "keep validating")}</h2><p class="fine">Advisory. This reads what you recorded and does not verify it, and it never changes the opportunity's state.</p>${blockers ? `<ul>${blockers}</ul>` : "<p>Nothing is missing.</p>"}${economics}<form method="post" action="/market-intelligence/opportunities/${escape(row.id)}/focus-evidence">${backField(back, escape)}<label>Customer commitment<input name="customer_commitment" required maxlength="1000" value="${escape(evidence.customer_commitment || "")}"></label><label>Source of that commitment<input name="source_reference" required maxlength="2000" value="${escape(evidence.source_reference || "")}"></label><label>Measured on<input type="date" name="measured_on" required value="${escape(dateOnly(evidence.measured_at))}"></label><label>Monthly cost ceiling<input type="number" name="cost_ceiling" min="0" step="0.01" required value="${escape(money(evidence.cost_ceiling_cents))}"></label><label>Revenue that month<input type="number" name="revenue" min="0" step="0.01" required value="${escape(money(evidence.revenue_cents))}"></label><label>Variable cost that month<input type="number" name="variable_cost" min="0" step="0.01" required value="${escape(money(evidence.variable_cost_cents))}"></label><p class="fine">All three amounts in the same currency and for the same month. A missing cost is unknown, never zero.</p><button type="submit">Save focus evidence</button></form></article>`;
}

function reviewsCard(reviews, row, { back, escape }) {
  const list = listOrSay(reviews, "No reviews yet.", (rows) => `<table><thead><tr><th>When</th><th>Decision</th><th>Score then</th><th>Why</th></tr></thead><tbody>${rows.map((review) => `<tr><td>${escape(dateOnly(review.created_at))}</td><td>${escape(words(review.decision))}</td><td>${escape(String(review.market_score ?? ""))}</td><td>${escape(review.rationale || "")}</td></tr>`).join("")}</tbody></table>`);
  return `<article class="card"><h2>Reviews</h2>${list}<form method="post" action="/api/market-intelligence/opportunities/${escape(row.id)}/reviews">${backField(back, escape)}<label>Decision<select name="decision" required>${options(REVIEW_DECISIONS, "validate")}</select></label><label>Why<textarea name="rationale" required maxlength="4000"></textarea></label><button class="action" type="submit">Record review</button></form></article>`;
}

function updateCard(row, { back, escape }) {
  const scores = SCORE_FIELDS.map((field) => `<label>${escape(field.label)} (0–${field.max})<input type="number" name="${field.name}" min="0" max="${field.max}" step="1" required value="${escape(String(Number(row[field.name]) || 0))}"></label>`).join("");
  return `<article class="card"><h2>Rescore or correct</h2><p class="fine">The state changes through a review, not here.</p><form method="post" action="/market-intelligence/opportunities/${escape(row.id)}">${backField(back, escape)}<label>Name<input name="name" required maxlength="300" value="${escape(row.name || "")}"></label><label>Problem<textarea name="problem" required maxlength="4000">${escape(row.problem || "")}</textarea></label><label>Target segment<input name="target_segment" required maxlength="500" value="${escape(row.target_segment || "")}"></label><label>Value you propose<textarea name="proposed_value" required maxlength="4000">${escape(row.proposed_value || "")}</textarea></label>${scores}<label>Owner<input name="owner_name" maxlength="240" value="${escape(row.owner_name || "")}"></label><label>Next review<input type="date" name="next_review_at" value="${escape(dateOnly(row.next_review_at))}"></label><button class="action" type="submit">Save and rescore</button></form></article>`;
}

function opportunitySummary(row, escape) {
  return `<article class="card"><h2>${escape(row.name)}</h2><table><tbody><tr><th>Studio</th><td>${escape(studioLabel(row.studio_key))}</td></tr><tr><th>Problem</th><td>${escape(row.problem || "")}</td></tr><tr><th>Target segment</th><td>${escape(row.target_segment || "")}</td></tr><tr><th>Value proposed</th><td>${escape(row.proposed_value || "")}</td></tr><tr><th>Owner</th><td>${escape(row.owner_name || "Not named")}</td></tr><tr><th>Next review</th><td>${escape(dateOnly(row.next_review_at) || "Not set")}</td></tr></tbody></table></article>`;
}

// The fetched page, to read before writing a signal about it. Escaped and shown
// as text: it is somebody else's page, and nothing of it is trusted as markup.
function fetchedSourceSections(result, { studioKey, back, escape }) {
  const host = (() => { try { return new URL(String(result.sourceUrl || result.requestedUrl || "")).hostname; } catch { return ""; } })();
  const form = signalForm({ studioKey, back, escape, segments: null, sourceUrl: result.sourceUrl || result.requestedUrl || "", sourceName: host });
  if (!result.fetched) {
    return [
      `<article class="card"><h2>Not fetched</h2><p>${escape(result.detail || "That page could not be fetched.")}</p></article>`,
      `<article class="card"><h2>Record a signal yourself</h2>${form}</article>`
    ];
  }
  return [
    `<article class="card"><h2>The page, as text</h2><p class="fine">${escape(result.note || "")}${result.truncated ? " Cut at 20,000 characters." : ""}</p><pre style="white-space:pre-wrap;max-height:28rem;overflow:auto">${escape(result.text || "")}</pre></article>`,
    `<article class="card"><h2>Record what it shows</h2>${form}</article>`
  ];
}

module.exports = {
  LIST_LIMIT,
  STUDIOS,
  SIGNAL_TYPES,
  CONFIDENCE_LEVELS,
  OPPORTUNITY_STATES,
  REVIEW_DECISIONS,
  RECORD_STATUSES,
  BILLING_PERIODS,
  SCORE_FIELDS,
  PROBLEMS,
  DONE,
  notice,
  opportunitiesCard,
  signalsCard,
  competitorsCard,
  segmentsCard,
  scoreBreakdown,
  focusCard,
  reviewsCard,
  updateCard,
  opportunitySummary,
  fetchedSourceSections,
  studioLabel
};
