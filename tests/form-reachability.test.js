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
  // Posted by client scripts, not by a person filling anything in.
  "/api/motion/events": "Interface telemetry, posted by public/sonara-one.js.",
  "/api/location/events": "Location telemetry, posted by client script.",
  "/api/business-builder/checklist": "Driven by the checklist page's own controls rather than a form submit.",

  // A JSON twin of an endpoint that does have a form. The customer-facing
  // create path for both is /api/growth-studio/<type>, rendered on the
  // campaigns and leads pages; these are the API surface for the same records.
  "/api/growth/campaigns": "JSON twin of /api/growth-studio/campaigns, which has a form.",
  "/api/growth/leads": "JSON twin of /api/growth-studio/leads, which has a form.",

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
  "/api/growth/touchpoints": "Records that something happened, with no field marking a row as hand-entered. A form would put fabricated evidence beside tracked evidence with nothing to tell them apart.",
  "/api/formulas/results": "Written when a formula is evaluated, not composed by hand.",

  // Endpoints with no page to put a form on. These are the actual work queue.
  "/api/creator/reference-analyses": "NOT YET EXAMINED: Creator Studio endpoint with no form found.",
  "/api/business/waste": "NOT YET EXAMINED: Business Builder resource with no owner page entry.",
  "/api/location/zones": "NOT YET EXAMINED: resource in RESOURCE_MAP with no page.",
  "/api/integrations/jobs": "NOT YET EXAMINED: resource in RESOURCE_MAP with no page.",
  "/api/sensory/profiles": "NOT YET EXAMINED: resource in RESOURCE_MAP with no page.",
  "/api/sensory/haptic-patterns": "NOT YET EXAMINED: resource in RESOURCE_MAP with no page.",
  // Examined, unlike the four below it. This one creates nothing at all -- it
  // fetches the text of a page so it does not have to be pasted, and returns
  // it. The create-shaped scan matches it on the POST, which is the right
  // default and the wrong answer here.
  "/api/market-intelligence/fetch-source": "Creates no record. It returns page text for a person to read, and the signal form is still the only way anything is written.",
  "/api/market-intelligence/competitors": "NOT YET EXAMINED: research record, no form found.",
  "/api/market-intelligence/opportunities": "NOT YET EXAMINED: research record, no form found.",
  "/api/market-intelligence/segments": "NOT YET EXAMINED: research record, no form found.",
  "/api/market-intelligence/signals": "NOT YET EXAMINED: research record, no form found.",
  "/api/prompt-library/collections": "NOT YET EXAMINED: prompt library record, no form found.",
  "/api/prompt-library/connections": "NOT YET EXAMINED: prompt library record, no form found.",
  "/api/prompt-library/runs": "NOT YET EXAMINED: prompt library record, no form found.",
  "/api/prompt-library/templates": "NOT YET EXAMINED: prompt library record, no form found."
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
