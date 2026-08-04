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
  "/database"
]);

function isTechnicalRoute(routePath) {
  const route = String(routePath || "");
  return TECHNICAL_ROUTE_PREFIXES.some((prefix) => route === prefix || route.startsWith(`${prefix}/`));
}

module.exports = {
  SETUP_REQUIRED_SENTENCES,
  setupRequiredSentence,
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
  generationCapabilityLabel,
  growthStatusLabel,
  planLabel,
  includedFrom,
  accessNote,
  toPlainLanguage,
  isTechnicalRoute
};
