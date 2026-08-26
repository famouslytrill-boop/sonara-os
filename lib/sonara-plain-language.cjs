"use strict";

// Customer-facing vocabulary.
//
// The data model uses precise internal names -- lifecycleStatus, planFloor,
// entitlementIntegrationVerified, readiness -- and for a long time those names
// were printed straight onto the pages a customer reads. Somebody deciding
// whether to pay $15 a month should not have to learn what an "entitlement"
// is, or that "validation_required" means "we are still checking this one".
//
// This module is the single place that decides how an internal concept is
// spoken to a customer. Renderers should ask it for a label rather than
// interpolating a raw field, and tests/plain-language.test.js renders every
// customer-facing page and fails when a banned term reaches the screen.
//
// Technical pages are deliberately exempt. /infrastructure, /research-lab/*
// and /admin/* are read by operators who need the real names, and the legal
// pages must name subprocessors precisely to be accurate.

// ---------------------------------------------------------------------------
// Availability -- what the customer can actually do with a product today.
// ---------------------------------------------------------------------------

const AVAILABILITY = Object.freeze({
  active: { label: "Ready to use", detail: "Available now on your plan." },
  beta: { label: "Early access", detail: "Usable now, still being refined." },
  setup_required: { label: "Needs setup", detail: "A few setup steps first." },
  validation_required: { label: "In review", detail: "We are still checking this one before opening it up." },
  planned: { label: "Coming soon", detail: "On the roadmap, not open yet." }
});

const AVAILABILITY_FALLBACK = Object.freeze({ label: "Check availability", detail: "Ask us and we will confirm." });

function availability(status) {
  return AVAILABILITY[String(status || "").toLowerCase()] || AVAILABILITY_FALLBACK;
}

function availabilityLabel(status) {
  return availability(status).label;
}

// ---------------------------------------------------------------------------
// Generation work -- the state of a piece of media a customer asked for.
//
// The job table stores the states the dispatch code needs: "queued",
// "submitted", "manual_required". A customer waiting on a song does not need
// to know which of those they are in, only whether anything is expected of
// them. So each label answers "is it my turn?" and the detail says what to do.
// ---------------------------------------------------------------------------

const GENERATION_STATUS = Object.freeze({
  queued: { label: "Waiting to start", detail: "In line. Nothing needed from you." },
  submitted: { label: "Sent off", detail: "Handed to the service that makes it. Nothing needed from you." },
  running: { label: "Being made", detail: "Work is under way. Nothing needed from you." },
  completed: { label: "Finished", detail: "Ready to download." },
  failed: { label: "Did not finish", detail: "Something went wrong. You can start it again." },
  cancelled: { label: "Cancelled", detail: "Stopped before it finished." },
  setup_required: { label: "Needs setup", detail: "The service this needs has not been connected yet." },
  review_required: { label: "Held for review", detail: "We check this kind of request by hand before it runs." },
  manual_required: { label: "Needs a manual step", detail: "This service is run by hand. We will pick it up." }
});

const GENERATION_STATUS_FALLBACK = Object.freeze({ label: "In progress", detail: "Check back shortly." });

function generationStatus(status) {
  return GENERATION_STATUS[String(status || "").toLowerCase()] || GENERATION_STATUS_FALLBACK;
}

function generationStatusLabel(status) {
  return generationStatus(status).label;
}

// Why a generation job failed, said to the person waiting for it.
//
// The job page rendered job.error_message straight onto the screen, so a
// customer whose work did not arrive read "storage_upload_failed_413". That is
// the code the handler stores, and it is the right thing to keep in the record;
// it is not a sentence, and it does not tell somebody their file was too big or
// what to do next.
//
// 413 is the case worth naming precisely. Storage buckets carry a size limit
// per plan -- 50 MiB on the free plan -- and a long piece of generated audio
// passes it easily. Somebody in that position needs to know the size was the
// problem, not that "something went wrong".
const GENERATION_FAILURE = Object.freeze({
  // 50 MB is the real limit and saying so is the point. An earlier version of
  // this told people to "ask us to raise your storage limit", which was a
  // promise nobody was going to keep -- the limit is a plan the business has
  // decided not to buy, not a setting somebody can turn up on request. Naming
  // the number lets a customer act on it; an invitation to ask does not.
  storage_upload_failed_413: "The finished file was over the 50 MB limit, so it could not be saved. A shorter piece will fit.",
  storage_upload_failed_402: "The finished file was over the 50 MB limit, so it could not be saved. A shorter piece will fit.",
  storage_upload_failed_401: "We could not save the finished file because our storage rejected the request. Nothing is wrong with your work — tell us and we will look.",
  storage_upload_failed_403: "We could not save the finished file because our storage refused it. Tell us and we will look.",
  storage_upload_failed_unreachable: "We made the file but could not reach our storage to save it. Tell us and we will look — your request is recorded.",
  output_storage_failed: "The work finished but we could not save the result. Tell us and we will look.",
  provider_unreachable: "The service that does this work did not answer. Nothing was charged for it.",
  active_voice_consent_required: "This needs a current voice permission on file before it can run.",
  // Deliberately not the same sentence as the one above. "Record a permission"
  // would have somebody create a second one exactly like the first; what they
  // need is to pick a different permission or widen the one they have.
  voice_consent_scope_mismatch: "The permission you chose was given for something else, so it does not cover this. Pick one that does, or record a new one."
});

function generationFailureText(code, fallback = "") {
  const known = GENERATION_FAILURE[String(code || "").trim()];
  if (known) return known;
  // An unrecognised code is still better than nothing, but it is not shown
  // raw -- a customer reading "storage_upload_failed_502" learns less than
  // they do from being told plainly that we do not know yet.
  const message = String(fallback || "").trim();
  if (message && !/^[a-z0-9_]+$/i.test(message)) return message;
  return "The service did not say what went wrong. Tell us and we will look.";
}

// What the customer asked for, said as a thing rather than a capability key.
const GENERATION_CAPABILITY = Object.freeze({
  text_to_speech: "Spoken audio",
  speech_to_speech: "Voice conversion",
  voice_clone: "Voice copy",
  singing_voice: "Singing voice",
  sound_effects: "Sound effects",
  text_to_audio: "Audio",
  text_to_music: "Music",
  music_plan: "Music plan",
  video_to_music: "Music from video",
  song_cover: "Song cover",
  song_mashup: "Song mashup",
  music_voice_profile: "Voice profile",
  text_to_video: "Video",
  image_to_video: "Video from an image",
  video_to_video: "Video restyle",
  video_extend: "Longer video",
  first_last_frame_video: "Video between two frames",
  native_audio_video: "Video with sound",
  talking_avatar: "Talking presenter",
  explainer_video: "Explainer video",
  ad_video: "Advert video",
  scene_orchestration: "Multi-scene video",
  reference_analysis: "Reference breakdown"
});

function generationCapabilityLabel(capability) {
  const key = String(capability || "").toLowerCase();
  return GENERATION_CAPABILITY[key] || (key ? key.replaceAll("_", " ") : "Generation");
}

// ---------------------------------------------------------------------------
// Growth records -- the state of an audience group, a test, a connected
// service, a permission record, or work sent out on the customer's behalf.
//
// These come from six different tables with overlapping vocabularies, so they
// share one map. Where a word already means the right thing to a customer
// ("running", "connected") it is kept rather than reworded for the sake of it.
// ---------------------------------------------------------------------------

const GROWTH_STATUS = Object.freeze({
  draft: "Not started",
  active: "In use",
  paused: "Paused",
  archived: "Archived",
  planned: "Not started yet",
  running: "Running",
  won: "This one worked",
  lost: "This one did not work",
  inconclusive: "No clear answer",
  granted: "Agreed",
  denied: "Declined",
  withdrawn: "Withdrawn",
  expired: "Ran out",
  unknown: "Not known",
  setup_required: "Needs setup",
  connected: "Connected",
  disconnected: "Disconnected",
  error: "Not working",
  revoked: "Access removed",
  queued: "Waiting to start",
  submitted: "Sent off",
  completed: "Finished",
  failed: "Did not finish",
  cancelled: "Cancelled",
  approval_required: "Waiting on your approval"
});

function growthStatusLabel(status) {
  const key = String(status || "").trim().toLowerCase();
  if (!key) return "Not recorded";
  return GROWTH_STATUS[key] || key.replaceAll("_", " ");
}

// ---------------------------------------------------------------------------
// Plans -- "planFloor" is the lowest plan that includes a thing.
// ---------------------------------------------------------------------------

const PLAN_LABELS = Object.freeze({
  free: "Free",
  starter: "Starter",
  core: "Core",
  pro: "Pro"
});

function planLabel(planFloor) {
  return PLAN_LABELS[String(planFloor || "").toLowerCase()] || "Paid";
}

function includedFrom(planFloor) {
  const key = String(planFloor || "").toLowerCase();
  if (key === "free") return "Included free.";
  return `Included from ${planLabel(key)}.`;
}

// ---------------------------------------------------------------------------
// Whether the customer can open something, and why not when they cannot.
// "entitlementIntegrationVerified" became "we have not finished testing paid
// access for this yet", which is the thing a customer actually needs to know.
// ---------------------------------------------------------------------------

const ACCESS_REASONS = Object.freeze({
  open: "You can use this now.",
  awaiting_review: "Not open yet — we are still checking this one.",
  awaiting_paid_access: "Not open yet — paid access for this is still being tested.",
  awaiting_setup: "Not open yet — setup has to be finished first."
});

function accessNote(reason) {
  return ACCESS_REASONS[reason] || ACCESS_REASONS.awaiting_setup;
}

// What /service-catalog has to say out loud about a product that is not open,
// and how to ask about it. This is a promise to customers, so the production
// deploy gate enforces it against the live page -- see
// scripts/verify-production-product-catalog.mjs.
//
// It lives here rather than in the gate because the gate used to carry its own
// copy of this list, written in the old vocabulary ("execution: restricted until
// lifecycle evidence and launch approval are complete"). When the copy was
// rewritten for customers, the gate kept demanding the retired wording and
// failed a deploy over a page that stated the boundary perfectly well. One
// definition, read by both the gate and its test, cannot drift like that.
//
// The three action labels are literals because they are written inline in
// routes/sonara-service-lifecycle-routes.cjs.
// What to say when something is not set up yet.
//
// This used to be built by gluing two humanised codes into one sentence:
//
//   `Setup required: ${displayStatus(service)} is ${displayStatus(reason)}.`
//
// displayStatus turns a code into a readable PHRASE, not a noun, so the slots
// received things like "Workspace not ready" and the page rendered
//
//   "Setup required: Customer organization is Workspace not ready."
//   "Saving needs Workspace not ready to be ready."
//
// Both shipped to customers. The template assumed its inputs were short nouns
// and nothing checked, because a template that produces grammatical nonsense
// still produces a string.
//
// Each service gets a whole sentence instead. The reason code stays in the JSON
// payload, where a developer can read it, and out of the prose, where it could
// only ever be a guess at grammar.
const SETUP_REQUIRED_SENTENCES = Object.freeze({
  customer_organization: "Your workspace has not been set up yet.",
  organization: "Your workspace has not been set up yet.",
  account_database: "Your records are not connected yet.",
  service_requests: "Your request records are not ready yet.",
  service_deliverables: "Your delivery records are not ready yet.",
  supabase: "Your records are not connected yet.",
  stripe_secret_key: "Payments are not connected yet.",
  stripe_customer: "Your billing profile is not ready yet.",
  stripe_customer_portal: "The billing portal is not available right now.",
  stripe_webhook: "Payment updates are not connected yet.",
  supabase_auth: "Sign-in is not connected yet."
});

// Falls back to a sentence that still reads. displayStatus("customer_records")
// gives "Customer records", and "Customer records is not ready yet." would be
// wrong, so the fallback keeps the subject plural-agnostic.
function setupRequiredSentence(service) {
  const known = SETUP_REQUIRED_SENTENCES[String(service || "").trim()];
  if (known) return known;
  return "Part of this is not set up yet.";
}

// ---------------------------------------------------------------------------
// Which box on the form is empty.
//
// Nine form endpoints share sendValidationFailure, which said
//
//   `Please complete: ${validation.missing.join(", ")}.`
//
// and validation.missing holds the request-body keys. So a customer who left a
// box blank was told
//
//   "Please complete: productKey, serviceName, summary, details."
//   "Please complete: consentStatus."
//   "Please complete: rightsNotes."
//
// which are variable names. Nothing on the screen is called productKey -- that
// field is labelled "Product area" -- so the message named something the
// customer could not find.
//
// Each entry is the text of the field's own <label> in the markup, not a fresh
// description of it. That is the whole point: the error has to say the same
// words the screen says, or it sends somebody looking for a box that is not
// there. tests/field-labels.test.js reads the labels out of the renderers and
// fails when one of these disagrees with its form.
const FIELD_LABELS = Object.freeze({
  audience: "Audience",
  channel: "Channel",
  consentStatus: "Consent status",
  deliverables: "Deliverables",
  details: "Details",
  email: "Email",
  goal: "Goal",
  id: "Record ID",
  message: "Message",
  name: "Name",
  offer: "Offer",
  offerType: "Offer type",
  organizationId: "Organization ID",
  platform: "Platform",
  priceIdea: "Price idea",
  productKey: "Product area",
  rightsNotes: "Rights notes",
  serviceInterest: "Service interest",
  serviceName: "Service name",
  serviceType: "Service type",
  source: "Source",
  status: "Status",
  summary: "Summary",
  timeline: "Timeline",
  title: "Title",
  type: "Type"
});

function fieldLabel(field) {
  const key = String(field || "").trim();
  const known = FIELD_LABELS[key];
  if (known) return known;
  // Falls back to something readable rather than the raw key: "rightsNotes"
  // becomes "Rights notes". A missing entry is a bug the test catches, and
  // this is what ships in the meantime.
  if (!key) return "A required field";
  return key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").replace(/^./, (char) => char.toUpperCase());
}

// "Please complete: Product area, Service name and Details." reads as a
// sentence; joining with commas throughout does not, and a single missing
// field should not be punctuated like a list.
function missingFieldsSentence(fields) {
  const labels = (Array.isArray(fields) ? fields : []).map(fieldLabel).filter(Boolean);
  if (!labels.length) return "Please fill in the fields marked required.";
  if (labels.length === 1) return `Please fill in ${labels[0]}.`;
  const last = labels[labels.length - 1];
  return `Please fill in ${labels.slice(0, -1).join(", ")} and ${last}.`;
}

const CATALOG_BOUNDARY_TEXT = Object.freeze([
  ACCESS_REASONS.awaiting_review,
  ACCESS_REASONS.awaiting_paid_access,
  "Ask about this one",
  "Ask us to open access",
  "See what is ready now"
]);

// ---------------------------------------------------------------------------
// Prose. Ordered: longer phrases first so "lifecycle stage" is not half-eaten
// by the shorter "lifecycle" rule.
// ---------------------------------------------------------------------------

const PROSE_REPLACEMENTS = Object.freeze([
  [/\bproduction entitlement verification\b/gi, "paid access testing"],
  [/\bpaid[- ]entitlement test\b/gi, "paid access test"],
  [/\bentitlement verification\b/gi, "plan access checks"],
  [/\brequired entitlements\b/gi, "the right plan"],
  [/\bentitlements\b/gi, "plan access"],
  [/\bentitlement\b/gi, "plan access"],
  [/\blifecycle stages?\b/gi, "availability"],
  [/\blifecycle states?\b/gi, "availability"],
  [/\blifecycle status\b/gi, "availability"],
  [/\blifecycle evidence\b/gi, "our own checks"],
  [/\blaunch readiness\b/gi, "launch checklist"],
  [/\breadiness checklist\b/gi, "setup checklist"],
  [/\breadiness\b/gi, "setup status"],
  [/\bprovider configuration\b/gi, "connected services"],
  [/\bproduction configuration\b/gi, "final setup"],
  [/\bconfiguration\b/gi, "setup"],
  [/\bsupport queue\b/gi, "priority support"],
  [/\bexecution enabled\b/gi, "ready to use"],
  [/\bexecution restricted\b/gi, "not open yet"]
]);

function toPlainLanguage(text) {
  let output = String(text == null ? "" : text);
  for (const [pattern, replacement] of PROSE_REPLACEMENTS) output = output.replace(pattern, replacement);
  return output;
}

// ---------------------------------------------------------------------------
// What the test enforces, and where it does not.
// ---------------------------------------------------------------------------

// Words that read as engineering vocabulary to somebody who is deciding
// whether to pay for this. Each one has an entry above, or a rewritten
// sentence, so there is always something to say instead.
const BANNED_ON_CUSTOMER_PAGES = Object.freeze([
  "entitlement",
  "lifecycle",
  "readiness",
  "plan floor",
  "execution enabled",
  "execution restricted",
  "webhook",
  "endpoint",
  "schema",
  "middleware",
  "idempotent",
  "service-role",
  "service role",
  "row level security",
  "provider gateway",
  "openapi",
  "postgrest",
  "supabase",
  "postgres"
]);

// Operator and legal surfaces. /infrastructure and /research-lab exist to show
// engineers the real names; /admin is staff-only; the legal pages have to name
// subprocessors and data stores exactly to be truthful.
const TECHNICAL_ROUTE_PREFIXES = Object.freeze([
  "/admin",
  "/infrastructure",
  "/research-lab",
  "/ecosystem",
  "/legal",
  "/formulas",
  "/prompt-library",
  "/product-lifecycle",
  "/route-registry",
  "/system-design",
  "/database",

  // The legal aliases.
  //
  // Every /legal/* page is exempt because a policy has to be able to name the
  // companies that process customer data -- a privacy policy that cannot say
  // "Supabase" cannot disclose its sub-processors, which is the one thing it
  // exists to do. The aliases serve that identical text at a second URL by
  // design, and were not exempt, so the same sentence passed at /legal/privacy
  // and failed at /privacy.
  //
  // Listed rather than derived because server.js cannot be imported from here.
  // tests/plain-language.test.js asserts this list still covers every alias
  // legalAliasPages() defines, so adding one without adding it here fails.
  "/terms",
  "/privacy",
  "/refund-policy",
  "/cookies",
  "/acceptable-use",
  "/accessibility",
  "/earnings-disclaimer",
  "/subprocessor-notice"
]);

function isTechnicalRoute(routePath) {
  const route = String(routePath || "");
  return TECHNICAL_ROUTE_PREFIXES.some((prefix) => route === prefix || route.startsWith(`${prefix}/`));
}

// A voice permission, in the words the person recording it used.
//
// These three lived in routes/creator-generation-routes.cjs and were used by one
// of the two pages that show consent records. /creator-studio/rights showed the
// same rows and printed `consent_scope` with its underscores swapped for spaces
// -- so the same permission read "Voice copying" on one page and "voice clone"
// on the other -- and dropped `subject_type` entirely, heading a card "Consent
// record" whenever `subject_name` was blank. subject_name is nullable and
// subject_type is not null, so the page discarded the fact that was guaranteed
// to be there in favour of the one that might not be.
//
// Here because this file is already where the product's words live, and because
// two vocabularies for one table is how they drift.
const VOICE_SUBJECT = Object.freeze({
  self: "My own voice",
  authorized_person: "A person who gave permission",
  licensed_voice: "A licensed voice",
  synthetic_voice: "A synthetic voice"
});

const VOICE_SCOPE = Object.freeze({
  all_voice_generation: "All voice work",
  text_to_speech: "Spoken audio",
  speech_to_speech: "Voice conversion",
  voice_clone: "Voice copying",
  singing_voice: "Singing"
});

const VOICE_EVIDENCE = Object.freeze({
  signed_release: "Signed release",
  license_record: "Licence record",
  provider_voice_id: "Provider voice id",
  self_attestation: "Own attestation",
  other: "Other"
});

// How precisely a check-in recorded where somebody was.
//
// `location_events.privacy_mode` allows precise, approximate, masked and manual.
// The column is `not null default 'precise'`, nothing client-side has ever set
// it, and /staff/location selected it and rendered nothing -- so a person
// looking at their own location history was not told which of the four applied
// to them. The most precise setting, chosen by the database, shown to nobody.
//
// The default is deliberately NOT changed here. A job-site check-in exists to
// record that somebody was there, and quietly degrading it to "approximate"
// would damage a business record on my judgement rather than the owner's. The
// fix is that the person is told, not that the fact is altered.
const LOCATION_PRECISION = Object.freeze({
  precise: "Exact position",
  approximate: "Approximate area",
  masked: "Position hidden",
  manual: "Entered by hand"
});

function locationPrecisionLabel(value) {
  return LOCATION_PRECISION[String(value || "")] || "Not recorded";
}

// "Not recorded" rather than the raw value, and never an empty string. A column
// carrying something these maps do not know about is a schema change nobody
// updated here, and printing it raw would put a database value in front of a
// customer.
function voiceSubjectLabel(value) {
  return VOICE_SUBJECT[String(value || "")] || "Not recorded";
}

function voiceScopeLabel(value) {
  return VOICE_SCOPE[String(value || "")] || "Not recorded";
}

function voiceEvidenceLabel(value) {
  return VOICE_EVIDENCE[String(value || "")] || "Not recorded";
}

module.exports = {
  LOCATION_PRECISION,
  locationPrecisionLabel,
  VOICE_SUBJECT,
  VOICE_SCOPE,
  VOICE_EVIDENCE,
  voiceSubjectLabel,
  voiceScopeLabel,
  voiceEvidenceLabel,
  SETUP_REQUIRED_SENTENCES,
  setupRequiredSentence,
  FIELD_LABELS,
  fieldLabel,
  missingFieldsSentence,
  AVAILABILITY,
  GENERATION_STATUS,
  GENERATION_CAPABILITY,
  GROWTH_STATUS,
  PLAN_LABELS,
  ACCESS_REASONS,
  CATALOG_BOUNDARY_TEXT,
  PROSE_REPLACEMENTS,
  BANNED_ON_CUSTOMER_PAGES,
  TECHNICAL_ROUTE_PREFIXES,
  availability,
  availabilityLabel,
  generationStatus,
  generationStatusLabel,
  generationFailureText,
  GENERATION_FAILURE,
  generationCapabilityLabel,
  growthStatusLabel,
  planLabel,
  includedFrom,
  accessNote,
  toPlainLanguage,
  isTechnicalRoute
};
