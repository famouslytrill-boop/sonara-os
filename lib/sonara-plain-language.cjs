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
  AVAILABILITY,
  PLAN_LABELS,
  ACCESS_REASONS,
  PROSE_REPLACEMENTS,
  BANNED_ON_CUSTOMER_PAGES,
  TECHNICAL_ROUTE_PREFIXES,
  availability,
  availabilityLabel,
  planLabel,
  includedFrom,
  accessNote,
  toPlainLanguage,
  isTechnicalRoute
};
