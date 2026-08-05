"use strict";

// Forms for Growth Studio create endpoints that had no form.
//
// The endpoints were already there. POST /api/growth/segments,
// /api/growth/experiments, /api/growth/consents, /api/growth/automations,
// /api/growth/content, /api/growth/conversions and /api/growth/touchpoints all
// existed, validated their input, scoped to the organization and wrote audit
// events. Ten of the fourteen record types in TABLES could be created.
//
// No page rendered a form for a single one of them. Before this file, the only
// way a customer could create a segment was to hand-craft an HTTP request. The
// record page listed segments, correctly showed none, and offered no way to add
// one -- so from the customer's seat the workflow was missing, even though the
// server had been ready for it the whole time.
//
// That distinction cost me a published mistake. docs/WORKSPACE_WORKFLOW_AUDIT.md
// first said these record types had no create endpoint, because I checked
// /api/growth-studio/<type> when the routes live at /api/growth/<type>. The
// document is corrected and records what happened.
//
// So these are descriptions of a form, and nothing else. They do not validate,
// default or insert -- the handlers already do all three, and a second copy of
// those rules here would be a second thing to keep in step. Every field name
// below is one the matching handler actually reads; a field the handler ignores
// would render as a box that silently does nothing, which is worse than not
// offering it. tests/growth-create-forms.test.js checks that against the
// handlers rather than trusting this comment.
//
// Three record types are described here, the three with a record page in
// lib/sonara-growth-record-pages.cjs, so each form lands on a page a customer
// already reaches. Content, automations, conversions and touchpoints have
// endpoints and no record page; giving them forms means giving them pages
// first, which is a larger piece of work than this one.

const GROWTH_CREATE_SPECS = Object.freeze([
  {
    key: "segments",
    tableKey: "segments",
    noun: "segment",
    intro: "A named list rule. Write who belongs in it in plain words. Nothing is sent to anyone from here.",
    fields: [
      ["name", "text", { label: "Segment name", max: 240, required: true }],
      ["description", "longText", { label: "Who belongs in it", max: 2000 }],
      ["status", "choice", { label: "Status", values: ["draft", "active", "archived"], fallback: "draft" }]
    ]
  },
  {
    key: "experiments",
    tableKey: "experiments",
    noun: "experiment",
    intro: "One question, one hypothesis, one measure. Record what you expect before you run it.",
    // No status field: the handler does not read one, and an input it ignores
    // would look like a decision the customer had made.
    fields: [
      ["name", "text", { label: "What are you testing", max: 240, required: true }],
      ["hypothesis", "longText", { label: "What you expect to happen", max: 2000 }],
      ["primary_metric", "text", { label: "What you will measure", max: 240 }],
      ["assignment_unit", "text", { label: "Measured per (visitor, lead, session)", max: 80 }],
      ["campaign_id", "uuid", { label: "Campaign it belongs to (optional)" }]
    ]
  },
  {
    key: "consents",
    tableKey: "consents",
    noun: "recorded permission",
    intro: "Record permission somebody gave you away from this system — a signed form, a reply, a tick box on your own site.",
    fields: [
      ["channel", "text", { label: "Channel (email, sms, post, phone)", max: 80, required: true }],
      ["purpose", "text", { label: "What they agreed to", max: 240, required: true }],
      // Required here because a consent record asserts that somebody agreed to
      // something. One with no stated origin is that assertion with nothing
      // behind it. The column is NOT NULL in the schema and the handler refuses
      // it too; this only makes the form say so before the round trip.
      ["source", "text", { label: "Where the permission came from", max: 200, required: true }],
      ["evidence_reference", "text", { label: "Where the proof is kept", max: 400 }],
      ["lead_id", "uuid", { label: "Lead (optional)" }],
      ["granted_at", "date", { label: "When they agreed" }],
      ["expires_at", "date", { label: "Expires (optional)" }],
      ["consent_status", "choice", { label: "Status", values: ["granted", "withdrawn", "expired", "unknown"], fallback: "granted" }]
    ],
    safetyNote: "A consent record says somebody gave you permission, so where it came from is required rather than optional."
  }
]);

function getGrowthCreateSpec(tableKey) {
  return GROWTH_CREATE_SPECS.find((spec) => spec.tableKey === String(tableKey || "")) || null;
}

module.exports = { GROWTH_CREATE_SPECS, getGrowthCreateSpec };
