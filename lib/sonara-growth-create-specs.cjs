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
// Seven record types are described here. The first three landed alongside the
// record pages that already existed. Content, automations, conversions and
// touchpoints came later, once those four got record pages of their own -- a
// form has to live on a page somebody reaches, so the pages came first.
//
// Two of the four carry an attestation the handler refuses to write without:
// content on an outbound channel needs a consent basis, and every touchpoint
// needs a tracking basis. Those render as required tick boxes. They are
// deliberately not pre-ticked and not hidden inputs -- the handler is asking
// the customer to assert something, and an assertion the page makes on their
// behalf is not one they made.

// The channels a recorded permission can be about.
//
// One list, exported, because there were two: this form offered free text
// labelled "email, sms, post, phone" while the handler accepted a closed set
// that has never included "post". A customer who typed what the label told them
// to got a refusal naming no field. Two copies of a rule is the shape every
// drift in this codebase has taken.
const CONSENT_CHANNELS = Object.freeze(["email", "sms", "push", "whatsapp", "phone", "personalization", "analytics"]);

const GROWTH_CREATE_SPECS = Object.freeze([
  {
    // Recording somebody who got in touch.
    //
    // Nothing in the product created one of these. /api/growth/leads existed and
    // had no form, and the similarly named /api/growth-studio/leads writes a
    // module output -- guidance text -- rather than a growth_leads row, so the
    // page that looked like lead capture was capturing something else.
    //
    // **The whole lead-to-customer-to-quote-to-invoice chain started with a
    // record a customer could not create.** The enquiries page listed these and
    // would always have been empty; the conversion button would never have had a
    // row to act on.
    //
    // The endpoint requires one of name, email or phone -- refusing a lead with
    // no way to identify or reach anybody -- so all three are offered and none
    // is individually required, which is the same rule stated in a form.
    key: "leads",
    tableKey: "leads",
    noun: "enquiry",
    intro: "Somebody who got in touch. A name, an email or a phone number is enough to start -- one of the three is required, so there is a way to reach them.",
    fields: [
      ["name", "text", { label: "Their name", max: 240 }],
      ["email", "text", { label: "Email", max: 240 }],
      ["phone", "text", { label: "Phone", max: 80 }],
      ["source", "text", { label: "How they found you", max: 200, hint: "Referral, a search, an event, a repeat customer" }],
      ["status", "choice", { label: "Where it stands", values: ["new", "contacted", "qualified", "won", "lost", "archived"], fallback: "new" }]
    ]
  },
  {
    // The same finding as leads, one endpoint over, hidden by the same sentence.
    //
    // /api/growth/campaigns was exempted as a "JSON twin of
    // /api/growth-studio/campaigns, which has a form". It is not a twin: that
    // endpoint calls saveModuleOutput with the campaign_workspace module and
    // writes a plan into module_outputs. Nothing wrote a growth_campaigns row.
    //
    // The totals card counts campaigns, the control center lists them, a lead
    // can carry a campaign_id, and the metrics API scopes by one -- all of it
    // against a table with no way to add to it.
    key: "campaigns",
    tableKey: "campaigns",
    noun: "campaign",
    intro: "A named effort to bring people in. Nothing is sent from here -- this records what the campaign is, so leads and results can point at it.",
    fields: [
      ["name", "text", { label: "Campaign name", max: 240, required: true }],
      ["goal", "longText", { label: "What it is for", max: 1000, hint: "What you want it to achieve, in your own words" }],
      ["channel", "text", { label: "Where it runs", max: 120, hint: "Email, a local paper, word of mouth, a stall" }],
      ["status", "choice", { label: "Where it stands", values: ["draft", "active", "paused", "completed", "archived"], fallback: "draft" }]
    ]
  },
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
      // The handler has always required two variants, and no form offered a way
      // to give it any, so every submission from this page failed. Two named
      // sides, split evenly -- see the experiments handler for why the split is
      // not a field the customer has to get right.
      ["variant_a", "text", { label: "First version", max: 240, required: true, hint: "What you are testing against. Half see this." }],
      ["variant_b", "text", { label: "Second version", max: 240, required: true, hint: "The change you are trying. The other half see this." }],
      ["campaign_id", "uuid", { label: "Campaign it belongs to (optional)" }]
    ]
  },
  {
    key: "consents",
    tableKey: "consents",
    noun: "recorded permission",
    intro: "Record permission somebody gave you away from this system — a signed form, a reply, a tick box on your own site.",
    fields: [
      ["channel", "choice", { label: "Channel", values: CONSENT_CHANNELS, fallback: "email" }],
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
  },
  {
    key: "content",
    tableKey: "content",
    noun: "piece of content",
    intro: "Draft a post, email or message. Nothing is sent or published from here — it is saved as a draft, and publishing is a separate, deliberate step.",
    // approval_status and publish_status are not offered. The handler sets both
    // to their starting values and ignores anything sent for them, so a control
    // for either would let somebody mark their own draft approved by filling in
    // a box, which is precisely what the approval step exists to prevent.
    fields: [
      ["channel", "text", { label: "Channel (email, sms, push, whatsapp, blog, social)", max: 100, required: true }],
      ["content_type", "choice", { label: "What kind", values: ["social_post", "email", "sms", "push", "ad", "landing_page", "blog", "video", "other"], fallback: "social_post" }],
      ["title", "text", { label: "Title", max: 300 }],
      ["body", "longText", { label: "What it says", max: 20000 }],
      ["scheduled_for", "date", { label: "Planned date (optional)" }],
      ["campaign_id", "uuid", { label: "Campaign it belongs to (optional)" }],
      ["audience_segment_id", "uuid", { label: "Audience group (optional)" }],
      ["consent_basis_attested", "checkbox", { label: "Everyone this goes to has agreed to hear from me on this channel" }]
    ],
    safetyNote: "For email, SMS, push and WhatsApp the tick box is required — those go to people directly, and the record has to say you had permission before it is saved."
  },
  {
    key: "automations",
    tableKey: "automations",
    noun: "rule",
    intro: "Pick something to watch for and something to do when it happens. New rules are saved switched off, so nothing runs until you turn it on.",
    // Both keys are choices rather than free text because the handler refuses
    // anything outside its two allow-lists. A text box would let somebody type
    // a plausible trigger and get "automation_template_not_allowed" back with
    // no way to know what was allowed.
    fields: [
      ["name", "text", { label: "Name this rule", max: 240 }],
      ["trigger_key", "choice", { label: "When this happens", values: ["lead_created", "lead_qualified", "form_submitted", "campaign_started", "conversion_recorded", "consent_granted", "content_ready"], fallback: "lead_created" }],
      ["action_key", "choice", { label: "Do this", values: ["create_task", "notify_owner", "add_to_segment", "enqueue_email", "sync_provider", "send_webhook"], fallback: "create_task" }]
    ],
    safetyNote: "Anything beyond making a task or telling you about it needs your approval each time it runs. Rules cannot contain code."
  },
  {
    key: "conversions",
    tableKey: "conversions",
    noun: "sale",
    intro: "Record a sale or sign-up that happened. If you are not certain which campaign brought it in, leave the credit as not established rather than guessing.",
    fields: [
      ["conversion_type", "text", { label: "What happened (purchase, signup, booking)", max: 200, required: true }],
      ["value", "number", { label: "What it was worth" }],
      ["currency", "text", { label: "Currency", max: 20 }],
      ["occurred_at", "date", { label: "When" }],
      ["source", "text", { label: "Where it came from", max: 200 }],
      ["medium", "text", { label: "How they arrived", max: 200 }],
      ["campaign_id", "uuid", { label: "Campaign (optional)" }],
      ["lead_id", "uuid", { label: "Lead (optional)" }],
      ["attribution_model", "choice", { label: "How you are crediting it", values: ["unattributed", "first_touch", "last_touch", "linear", "position_based", "data_driven", "provider_reported", "custom"], fallback: "unattributed" }],
      ["attribution_confidence", "choice", { label: "How sure are you", values: ["unknown", "low", "medium", "high", "provider_reported"], fallback: "unknown" }]
    ],
    safetyNote: "Both credit fields default to the honest answer. A recorded sale with no established source is more useful than one credited to a campaign on a hunch."
  },
  // Touchpoints deliberately have no form, and this is the second time that
  // call has been made rather than an oversight carried forward.
  //
  // tests/form-reachability.test.js already excluded the endpoint with a
  // reason: "a hand-entry form is a form for fabricating the evidence the
  // totals rest on." Building the record page made it tempting to add one
  // anyway, since the page and the endpoint both exist now.
  //
  // What settles it is a column. growth_conversions carries attribution_model
  // and attribution_confidence, so a sale typed in by hand can be recorded as
  // not established -- the form above defaults to exactly that, which is the
  // "own design" the original note asked for. growth_touchpoints has no such
  // field. A typed-in touchpoint is indistinguishable from a tracked one, and
  // it feeds the trail every attribution figure is matched against.
  //
  // /growth-studio/touchpoints therefore lists contact history and offers no
  // way to add to it by hand. If offline touchpoints are wanted later, the
  // honest version starts with a column recording that a person entered it.
]);

function getGrowthCreateSpec(tableKey) {
  return GROWTH_CREATE_SPECS.find((spec) => spec.tableKey === String(tableKey || "")) || null;
}

module.exports = {
  CONSENT_CHANNELS, GROWTH_CREATE_SPECS, getGrowthCreateSpec };
