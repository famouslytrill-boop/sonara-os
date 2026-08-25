"use strict";

// The LeadForge landing page, as data.
//
// Content lives here rather than in the route so it can be checked: this page
// is a sales page, and a sales page is where a product is most tempted to say
// things it cannot back up.
//
// ## Why every proof item carries `sample` or `source`
//
// This application publishes, on its own home page, the sentence:
//
//   "SONARA does not publish fake testimonials, invented customer counts,
//    fictional awards, guaranteed revenue, false scarcity, or unsupported
//    compliance and security claims."
//
// tests/brand-routes.test.mjs asserts that sentence is live. So a landing page
// served from this application that carried an invented "2,400 teams" or a
// quote from a person who does not exist would make the product simultaneously
// promise not to do that and do it -- which is exactly the defect this codebase
// is built to hunt, wearing marketing copy instead of a passing test.
//
// The resolution is structural rather than a matter of care. Every stat, logo
// and quote is one of two things:
//
//   sample: true   -- placeholder for design, and the page SAYS so on the page
//   source: "..."  -- a real figure, and where it came from
//
// A proof item with neither is refused by `validate()`, which the test runs. So
// the page cannot quietly acquire an unsourced claim: somebody has to either
// supply the source or mark it a sample, and marking it a sample puts a notice
// in front of the reader.
//
// Replacing the samples is the whole publishing step. Until then this is a
// design preview that reads as one.

const BRAND = Object.freeze({
  name: "LeadForge",
  tagline: "The AI sales operating system for lean revenue teams",
  // The line the whole page argues for.
  promise: "Find, enrich, score, route and activate every lead in one system — instead of stitching five tools together and hoping they agree."
});

// Both point at /contact, which exists and reaches a person.
//
// A landing page whose primary call to action 404s is worse than one with a
// plainer destination, and tests/no-dead-links.test.js will not let a route be
// linked before it is built. When /leadforge/demo and /leadforge/chat exist,
// change these two hrefs and nothing else moves.
// Both used to point at /contact, because /leadforge/demo and /leadforge/chat
// did not exist and a button aimed at a 404 is worse than one aimed somewhere
// real. The secondary now points at the thing it names: Growth Studio's chat
// widget settings, where an address is chosen and an embed snippet handed over.
// It is behind a sign-in, which is the ordinary shape of a "get started" link
// rather than a dead end.
//
// The primary still points at /contact, and deliberately. A live demo is a
// person's time, and nothing in this application books one -- pointing it at a
// settings page would be answering "talk to somebody" with "here is a form",
// which is the kind of near-miss that reads as working software until somebody
// presses it.
const ACTIONS = Object.freeze({
  primary: { label: "Book Your Live ICP Demo", href: "/contact" },
  secondary: { label: "Add Chat to Your Site", href: "/growth-studio/owner/chat-widget" }
});

// ---------------------------------------------------------------------------
// Proof
// ---------------------------------------------------------------------------

function proof({ value, label, detail = "", sample = false, source = null }) {
  return { value, label, detail, sample, source };
}

// Sample figures. Deliberately round and deliberately labelled -- a number like
// "3.2x" reads as measured, and nothing here has measured it.
const STATS = Object.freeze([
  proof({ value: "5 tools", label: "replaced by one", detail: "Sourcing, enrichment, scoring, routing and outreach on a single record.", sample: true }),
  proof({ value: "< 60s", label: "from form fill to routed owner", detail: "Enrichment, score and assignment run before the tab closes.", sample: true }),
  proof({ value: "1 record", label: "per company, not five", detail: "One identity across every source, so nobody works the same account twice.", sample: true }),
  proof({ value: "Day 1", label: "to first routed lead", detail: "Connect a domain and a mailbox; the ICP builder does the rest.", sample: true })
]);

const LOGOS = Object.freeze([
  proof({ value: "Northwind Logistics", label: "Sample", sample: true }),
  proof({ value: "Atlas Freight", label: "Sample", sample: true }),
  proof({ value: "Fern & Co", label: "Sample", sample: true }),
  proof({ value: "Brightline Health", label: "Sample", sample: true }),
  proof({ value: "Verity Data", label: "Sample", sample: true })
]);

const TESTIMONIAL = Object.freeze({
  quote: "We were running sourcing in one tool, enrichment in another and routing in a spreadsheet. The spreadsheet was the system of record and nobody wanted to admit it. Putting all of it on one record is the thing that actually changed how the week runs.",
  name: "Sample Testimonial",
  role: "VP Revenue Operations",
  company: "Placeholder Co",
  sample: true,
  source: null
});

// ---------------------------------------------------------------------------
// The argument
// ---------------------------------------------------------------------------

// Define ICP -> close from pipeline. Six steps, because the pitch is that they
// are one system rather than five products with handoffs between them.
const WORKFLOW = Object.freeze([
  {
    step: "01",
    title: "Define your ICP",
    body: "Describe the companies worth your time in plain language. LeadForge turns it into firmographic and behavioural filters you can argue with, not a black box.",
    detail: "Industry, headcount, stack, funding, hiring signals, territory."
  },
  {
    step: "02",
    title: "Find matching accounts",
    body: "Search the market against that profile continuously, not once a quarter. New matches arrive as they appear rather than as a list somebody remembers to pull.",
    detail: "Continuous sourcing against a live profile."
  },
  {
    step: "03",
    title: "Enrich to one record",
    body: "Every source resolves onto a single company record. Conflicting fields are shown as conflicts rather than silently overwritten by whichever provider answered last.",
    detail: "One identity. Conflicts surfaced, not resolved behind your back."
  },
  {
    step: "04",
    title: "Score against real outcomes",
    body: "The score is fitted to the deals you actually closed, and every score opens to show what moved it. A number nobody can interrogate is a number nobody trusts.",
    detail: "Explainable scoring, refitted as outcomes land."
  },
  {
    step: "05",
    title: "Route to the right owner",
    body: "Territory, capacity, language, named accounts. Routing runs in seconds and writes down why it chose who it chose, so a disputed assignment has an answer.",
    detail: "Deterministic rules with a readable audit trail."
  },
  {
    step: "06",
    title: "Activate and close from pipeline",
    body: "Sequences, tasks and the chat widget all fire off the same record. Pipeline is the by-product of the system working, not a separate thing somebody maintains.",
    detail: "One record from first touch to closed won."
  }
]);

const FEATURES = Object.freeze([
  {
    key: "one-record",
    eyebrow: "One system",
    title: "Five tools collapse into one record",
    body: "Sourcing, enrichment, scoring, routing and activation stop being integrations. They are columns on the same row, which is why they cannot disagree.",
    points: [
      "No sync lag between sourcing and enrichment",
      "No second identity resolution step",
      "No CSV in the middle of the funnel"
    ]
  },
  {
    key: "scoring",
    eyebrow: "Scoring you can argue with",
    title: "Every score opens up",
    body: "Click any number and see the fields that moved it and by how much. A model nobody can question is a model nobody acts on, and unactioned scores are just decoration.",
    points: [
      "Per-field contribution on every score",
      "Refit against closed-won, not against a template",
      "Says when it has too little data to be confident"
    ]
  },
  {
    key: "routing",
    eyebrow: "Routing with a receipt",
    title: "Assignment that survives being questioned",
    body: "Territory, capacity, language and named-account rules resolve in order, and the record keeps the reason. When two reps both think a lead was theirs, there is an answer.",
    points: [
      "Ordered rules, not a scoring free-for-all",
      "Capacity aware, so your best rep is not buried",
      "Reassignment is logged with who and why"
    ]
  },
  {
    key: "chat",
    eyebrow: "Chat that qualifies",
    title: "Conversations become opportunities",
    body: "The widget asks the qualifying questions your reps would ask, enriches in the background, and hands over a routed opportunity rather than a transcript nobody reads.",
    points: [
      "Qualifies against your ICP, live",
      "Books straight into the owner's calendar",
      "Escalates to a human the moment it should"
    ]
  }
]);

const CHAT_STEPS = Object.freeze([
  { title: "Visitor arrives", body: "The widget reads the page and the referrer before it says anything, so the first question is not a form in disguise." },
  { title: "It qualifies", body: "Company size, use case, timing. The same three things a rep would establish in the first two minutes." },
  { title: "It enriches quietly", body: "Domain, firmographics and stack resolve in the background while the conversation carries on." },
  { title: "It scores and routes", body: "A qualified conversation becomes a routed opportunity with the transcript attached and the owner already notified." }
]);

const TRUST = Object.freeze([
  {
    title: "Onboarding measured in days",
    body: "Connect a domain and a mailbox and the ICP builder produces a first profile the same day. There is no professional services quote in the way.",
    points: ["Guided ICP in the first session", "Import your existing accounts as one record each", "A named person for the first thirty days"]
  },
  {
    title: "Your data stays yours",
    body: "Export every record and every score at any time, in the shape you put them in. A system you cannot leave is a system that stops having to earn the renewal.",
    points: ["Full export, no request needed", "Deletion that actually deletes", "No training on your customer data"]
  },
  {
    title: "Built for a real security review",
    body: "Role-based access, an audit trail on every routing decision, and regional data residency. What is certified and what is merely implemented are listed separately.",
    points: ["Audit trail on assignment and score changes", "Role-based access and SSO", "Certifications listed with their dates, or not claimed"]
  }
]);

// ---------------------------------------------------------------------------
// The rule that keeps the page honest
// ---------------------------------------------------------------------------

// Everything on the page that a reader would take as evidence.
function proofItems() {
  return [
    ...STATS.map((item) => ({ ...item, where: "stats" })),
    ...LOGOS.map((item) => ({ ...item, where: "logos" })),
    { value: TESTIMONIAL.quote, label: `${TESTIMONIAL.name}, ${TESTIMONIAL.company}`, sample: TESTIMONIAL.sample, source: TESTIMONIAL.source, where: "testimonial" }
  ];
}

/**
 * Every proof item must be a sample or carry a source. Returns the problems.
 *
 * Returned rather than thrown so a test can print all of them at once, and so
 * this can be run over a proposed change before it ships.
 */
function validate(items = proofItems()) {
  const problems = [];
  // Without this the check passes the day somebody empties the lists, which is
  // the failure mode a proof check has.
  if (!items.length) problems.push("there are no proof items at all, so this check is looking at nothing");

  for (const item of items) {
    const marked = item.sample === true;
    const sourced = typeof item.source === "string" && item.source.trim() !== "";
    if (marked && sourced) {
      problems.push(`${item.where}: "${item.value}" is marked as a sample AND carries a source -- it cannot be both, and a reader has no way to know which`);
      continue;
    }
    if (!marked && !sourced) {
      problems.push(`${item.where}: "${item.value}" is neither marked as a sample nor sourced. Add a source, or set sample: true and it will be labelled on the page.`);
    }
  }
  return problems;
}

// True when anything on the page is placeholder content. The route uses this to
// decide whether the page has to carry its notice, so the notice cannot be
// forgotten separately from the samples.
function hasSamples() {
  return proofItems().some((item) => item.sample === true);
}

const SAMPLE_NOTICE = Object.freeze({
  title: "Design preview",
  body: "The figures, company names and testimonial on this page are placeholders for layout. Replace them in lib/sonara-leadforge-content.cjs with real, sourced proof before this goes in front of anybody."
});

module.exports = {
  BRAND, ACTIONS, STATS, LOGOS, TESTIMONIAL,
  WORKFLOW, FEATURES, CHAT_STEPS, TRUST,
  SAMPLE_NOTICE,
  proof, proofItems, validate, hasSamples
};
