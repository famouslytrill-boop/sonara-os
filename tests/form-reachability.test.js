"use strict";

// Can a customer reach this endpoint, or only somebody with curl?
//
// This file is the mechanism for a question I answered wrong six times in one
// investigation. Each attempt used a different static method and each missed a
// different way this application wires a form -- literal actions, computed
// actions from two separate record-page arrays, computed actions from create
// specs, and per-row actions built from a base path. Every wrong answer made
// the product look worse than it is.
//
// The measurement now lives in lib/sonara-form-reachability.cjs and runs
// against the booted router. What this file adds is the part that keeps it
// honest: every create-shaped POST endpoint must either be reachable from a
// rendered form, or appear below with a reason.
//
// Appearing below is not a failure. Some endpoints should not have a form --
// telemetry is posted by scripts, and some paths are JSON twins of an endpoint
// that already has one. What is not acceptable is an endpoint nobody has looked
// at, which is why "not yet examined" is a category here rather than a silence.
// The list is a work queue, and adding a POST route forces a decision about it.

const assert = require("node:assert/strict");
const app = require("../server");
const {
  literalFormActions,
  recordPageFormActions,
  growthSpecFormActions,
  reachableFormActions,
  createShapedRoutes
} = require("../lib/sonara-form-reachability.cjs");

// Reasons an endpoint has no form. Each key is an endpoint; each value says why.
const NO_FORM_NEEDED = {
  // Called by a scheduler, not a person. There is nobody signed in behind a
  // cron, so it takes a shared secret rather than a session and has no page to
  // render a form on. The customer-facing surface is /owner/agent-schedule,
  // where they set when it runs for them.
  "/api/agents/schedule/tick": "A scheduler calls this, not a customer. Customers set their schedule at /owner/agent-schedule.",

  // Posted by client scripts, not by a person filling anything in.
  "/api/motion/events": "Interface telemetry, posted by public/sonara-one.js.",
  "/api/location/events": "Location telemetry, posted by client script.",
  "/api/business-builder/checklist": "Driven by the checklist page's own controls rather than a form submit.",

  // There used to be two entries here calling /api/growth/campaigns and
  // /api/growth/leads "JSON twins" of /api/growth-studio/<type>. Neither was a
  // twin: those endpoints call saveModuleOutput and write guidance text into
  // module_outputs, not a growth_campaigns or growth_leads row. So the reason
  // said "covered elsewhere" about two tables nothing could write to, and the
  // lead-to-customer-to-quote-to-invoice chain began with a record no customer
  // could create. Both have create specs now.
  //
  // Worth keeping the scar: the reason was what hid the gap. It was plausible,
  // it was specific, it named a real endpoint, and it was wrong -- which is
  // exactly what a reason somebody reasoned their way to looks like.

  // Reachable from a page route rather than the /api path.
  "/api/product-lifecycle/initiatives": "The page posts to /product-lifecycle/initiatives, which has a form.",

  // Written by the system or an integration, not by hand. Same reasoning as the
  // growth records left out of lib/sonara-growth-create-specs.cjs.
  "/api/growth/provider-jobs": "Queued by the provider integration; a hand-entered job would describe work nobody sent.",
  // Still refused, and the reason has been sharpened rather than dropped.
  // /growth-studio/touchpoints now exists and lists contact history, so "no
  // page to put a form on" is no longer why. growth_touchpoints has no column
  // recording that a person typed a row in, so a hand-entered touchpoint is
  // indistinguishable from a tracked one in the trail every attribution figure
  // is matched against. Conversions got a form because attribution_confidence
  // lets a hand-entered sale say it is not established; this table has no
  // equivalent. An offline-touchpoint feature starts with that column.

  "/api/formulas/results": "Written when a formula is evaluated, not composed by hand.",

  // Examined, all of them. They divide into two kinds, and the distinction
  // matters more than the individual entries.
  //
  // **Listed somewhere, creatable nowhere** -- a page displays them and no form
  // makes one, so a customer sees an empty list with no way to fill it. That is
  // a dead end rather than a design.
  //
  // **Displayed nowhere at all** -- only the generic GET and POST in
  // routes/sonara-last9-routes.cjs exist, so a record written through them is
  // invisible from the moment it is created. That is the shape that made the
  // market-intelligence page worth fixing.
  // Listed at /creator-studio/generation/reference-analysis. The generation
  // form's capability picker does not offer reference_analysis, and the
  // validator special-cases it (`capability !== "reference_analysis"`), so only
  // a direct POST makes one.
  "/api/creator/reference-analyses": "Listed at /creator-studio/generation/reference-analysis and creatable only by direct POST; the generation form's capability picker does not offer reference_analysis. A form belongs on that page.",
  // Examined. integration_jobs is inserted here and read by nothing: no runner,
  // no page, no status transition anywhere in the repository. A form would let
  // somebody queue work that will never run, which is worse than no form. Its
  // default status is manual_required rather than queued for the same reason --
  // a row that says "queued" claims a worker this system does not have.
  "/api/integrations/jobs": "Nothing consumes integration_jobs: no runner, no page, no status transition. A form would let somebody queue work that will never run.",
  // Examined. This one creates nothing at all -- it fetches the text of a page
  // so it does not have to be pasted, and returns it. The create-shaped scan
  // matches it on the POST, which is the right default and the wrong answer
  // here.
  //
  // Its reason used to end "and the signal form is still the only way anything
  // is written". There is no signal form. Nothing in this repository posts to
  // any market-intelligence endpoint from a page -- grep finds no form action,
  // no create spec, nothing. The clause described a form that was never built,
  // which is the same defect as a page describing a capability it does not have,
  // sitting in the reason a check was excused.
  "/api/market-intelligence/fetch-source": "Creates no record. It returns page text for a person to read; nothing is written by it.",
  // The four below are examined now, and they share one answer.
  //
  // All four accept POSTs and no page offers a form for any of them. That is
  // deliberate rather than missing: /*/market-intelligence is guidance plus a
  // count of what the organization has recorded, and these are research records
  // whose fields are structured enough that a free-text form would produce
  // exactly the invented market data the page exists to refuse.
  //
  // What was genuinely wrong is now fixed and is worth stating here, because it
  // is why these were worth examining at all: the page claimed "the workspace
  // starts empty until organization-scoped evidence is recorded" while reading
  // nothing, so a record written through any of these four was invisible from
  // the moment it was created. The page counts them now.
  "/api/market-intelligence/competitors": "API-only research record. No form by design: the page counts what is recorded rather than offering free text, which is how invented market data gets in.",
  "/api/market-intelligence/opportunities": "API-only research record, scored and reviewed through their own endpoints rather than typed. The page counts what is recorded.",
  "/api/market-intelligence/segments": "API-only research record. No form by design; the page counts what is recorded.",
  "/api/market-intelligence/signals": "API-only research record. No form by design; the page counts what is recorded.",
  // Examined together. The prompt library has pages -- /prompt-library and
  // /prompt-library/:slug -- carrying exactly one form: "Fill the template",
  // which posts to /prompt-library/:slug/render, produces a preview to read,
  // and saves nothing. So none of these four is reachable from a page.
  //
  // Left without forms for a stated reason rather than as a gap: what these
  // pages render is curated content in data/prompts-chat-reference.cjs, and a
  // customer-authored row saved beside it would be indistinguishable from the
  // curated set on the page that lists them. That is the same objection
  // recorded for growth touchpoints above, and it wants the same answer first:
  // a column marking a row as customer-authored.
  "/api/prompt-library/collections": "Reachable only by API. The library's one form renders a preview and saves nothing, and a customer-authored row would be indistinguishable from the curated reference set beside it.",
  "/api/prompt-library/connections": "Reachable only by API, for the same reason as collections above.",
  "/api/prompt-library/runs": "Reachable only by API. A run records that a template was used; the form that would create one renders a preview instead.",
  "/api/prompt-library/templates": "Reachable only by API. Saving a customer's own template needs a column separating it from the curated reference set first."
};

describe("form reachability", () => {
  const reachable = reachableFormActions();
  const creates = createShapedRoutes(app);

  // The blindness guards. Every wrong answer I produced came from a source of
  // form actions going unseen, and the symptom is always the same: the reachable
  // set gets smaller and endpoints look abandoned. These fail loudly instead.
  it("sees all four ways this application renders a form", () => {
    assert.ok(literalFormActions().size >= 20, `only ${literalFormActions().size} literal form actions found`);
    assert.ok(recordPageFormActions().size >= 12, `only ${recordPageFormActions().size} record-page form actions found -- are both exported arrays being read?`);
    assert.ok(growthSpecFormActions().size >= 3, `only ${growthSpecFormActions().size} growth spec form actions found`);
  });

  it("sees the owner pages that were twice reported as having no forms", () => {
    // Business Builder's owner record pages render their form from page.api.
    // I reported these as unreachable twice; if that regresses, it fails here.
    const pages = recordPageFormActions();
    for (const endpoint of ["/api/business/locations", "/api/business/bookings", "/api/business/inventory", "/api/creator/music-projects"]) {
      assert.ok(pages.has(endpoint), `${endpoint} is rendered by a record page and this check cannot see it`);
    }
  });

  it("finds enough create endpoints to be measuring something", () => {
    assert.ok(creates.length >= 40, `only ${creates.length} create-shaped endpoints found; this check has gone blind`);
  });

  it("accounts for every create endpoint, either with a form or with a reason", () => {
    const unexplained = creates.filter((route) => !reachable.has(route) && !NO_FORM_NEEDED[route]);
    assert.deepEqual(
      unexplained,
      [],
      `these POST endpoints have no form and no stated reason:\n  ${unexplained.join("\n  ")}\n\n` +
        "Either render a form for it, or add it to NO_FORM_NEEDED saying why a customer does not need one."
    );
  });

  it("keeps no stale entry claiming an endpoint has no form when it does", () => {
    // The opposite drift: a form gets built and the exception stays, so the
    // list quietly overstates how much is missing.
    const stale = Object.keys(NO_FORM_NEEDED).filter((route) => reachable.has(route));
    assert.deepEqual(stale, [], `these are listed as having no form and now have one: ${stale.join(", ")}`);
  });

  it("keeps no entry for an endpoint that no longer exists", () => {
    const gone = Object.keys(NO_FORM_NEEDED).filter((route) => !creates.includes(route));
    assert.deepEqual(gone, [], `these are listed and are not registered POST routes any more: ${gone.join(", ")}`);
  });

  it("gives a real reason rather than a placeholder", () => {
    const empty = Object.entries(NO_FORM_NEEDED).filter(([, reason]) => String(reason).trim().length < 20);
    assert.deepEqual(empty.map(([route]) => route), [], "an endpoint is excused with no real explanation");
  });
});
