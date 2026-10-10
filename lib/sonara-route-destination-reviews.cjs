// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Routes whose "screen" is not a page a person opens, recorded with the evidence
// that says so.
//
// scripts/generate-capability-inventory.cjs gives every route a destination:
// the page that renders its form, the page it is the JSON form of, or -- when it
// finds nothing -- the workspace home, flagged as a fallback for review. Some
// routes are fallbacks because nobody has built their screen. Others have no
// screen because they should not: a deploy check calls /api/health, a scheduled
// workflow calls the agent tick. Reporting those as "screen missing" hides the
// ones that are.
//
// An entry here is a claim, so each kind carries evidence the generator checks
// rather than takes on trust, and map.validation.routeDestinationReviewsNotHeld
// fails the build when it does not hold:
//
//   monitor, scheduler   every file named in `consumers` exists and calls the
//                        route. A workflow that stopped calling it is a consumer
//                        that is not one.
//   linked_evidence      the same, and `page` is a file in public/.
//   json_form_of_page    `page` is a registered page, and `evidence` holds on
//                        both: the route and the page read the same table, or
//                        both handlers call the same function. "It is the JSON
//                        form of that page" is checked, not asserted.
//   json_form_of_action  `action` is a registered route a page's form posts to,
//                        it resolves to that page, and both handlers call the
//                        function named in `evidence`. For a JSON endpoint that
//                        does what a form does with the input shaped
//                        differently -- a slug in the body rather than the path.
//   method_refusal       lib/sonara-route-data-reviews.cjs records the route as
//                        one that only refuses a method.
//
// And from the other side: an entry for a route the generator would have placed
// on a page anyway is refused as not needed, and an entry for a route that is
// not registered is refused. The register cannot grow stale quietly in either
// direction.

const KINDS = Object.freeze({
  monitor: "Called by a deploy check, smoke test or uptime probe rather than from a page.",
  scheduler: "Called on a schedule by a workflow rather than from a page.",
  linked_evidence: "Linked from a published research page in public/ as the evidence behind it.",
  json_form_of_page: "Answers as JSON what a page already renders, from the same table or function.",
  json_form_of_action: "Does as JSON what a page's own form does, through the same function.",
  method_refusal: "Exists only to refuse a method, so it has no screen by design."
});

const ROUTE_DESTINATION_REVIEWS = Object.freeze([
  {
    route: "GET /api/health",
    kind: "monitor",
    consumers: [".github/workflows/reliability-performance-smoke.yml", ".github/workflows/controlled-production-deploy.yml"]
  },
  {
    route: "GET /api/support/status",
    kind: "monitor",
    consumers: ["scripts/smoke-live-routes.mjs"]
  },
  {
    route: "GET /api/product-lifecycle/framework",
    kind: "monitor",
    consumers: [".github/workflows/controlled-production-deploy.yml"]
  },
  {
    route: "POST /api/agents/schedule/tick",
    kind: "scheduler",
    consumers: [".github/workflows/agent-schedule-tick.yml"]
  },
  {
    route: "GET /api/infrastructure/manifest",
    kind: "linked_evidence",
    page: "/research-2026-commerce-store-operations.html",
    consumers: ["public/research-2026-commerce-store-operations.html", "public/research-2026-ecosystem-adoption-enterprise.html"]
  },
  {
    route: "GET /api/integrations/providers",
    kind: "json_form_of_page",
    page: "/account/integrations",
    evidence: { table: "integration_providers" }
  },
  {
    route: "GET /api/integrations/jobs",
    kind: "json_form_of_page",
    page: "/account/integrations",
    evidence: { table: "integration_jobs" }
  },
  {
    route: "GET /api/checkout/session",
    kind: "method_refusal"
  },
  {
    route: "GET /api/product-lifecycle/initiatives/:initiativeId/summary",
    kind: "json_form_of_page",
    page: "/product-lifecycle/initiatives/:initiativeId",
    evidence: { table: "product_lifecycle_iterations" }
  },
  {
    route: "GET /api/market-intelligence/segments",
    kind: "json_form_of_page",
    page: "/market-intelligence",
    evidence: { table: "market_intelligence_segments" }
  },
  {
    route: "GET /api/market-intelligence/competitors",
    kind: "json_form_of_page",
    page: "/market-intelligence",
    evidence: { table: "market_intelligence_competitors" }
  },
  {
    route: "GET /api/market-intelligence/signals",
    kind: "json_form_of_page",
    page: "/market-intelligence",
    evidence: { table: "market_intelligence_signals" }
  },
  {
    route: "GET /api/market-intelligence/portfolio",
    kind: "json_form_of_page",
    page: "/market-intelligence",
    evidence: { table: "market_intelligence_opportunities" }
  },
  {
    route: "GET /api/market-intelligence/framework",
    kind: "json_form_of_page",
    page: "/market-intelligence",
    evidence: { function: "getMarketIntelligenceFramework" }
  },
  {
    route: "GET /api/business/waitlist",
    kind: "json_form_of_page",
    page: "/business-builder/owner/waitlist",
    evidence: { function: "readWaitlist" }
  },
  {
    route: "GET /api/business/reservation-resources",
    kind: "json_form_of_page",
    page: "/business-builder/owner/waitlist",
    evidence: { function: "readResources" }
  },
  {
    route: "GET /api/business/operations/analytics",
    kind: "json_form_of_page",
    page: "/business-builder/owner/operations",
    evidence: { function: "readOperations" }
  },
  {
    route: "POST /api/prompt-library/render",
    kind: "json_form_of_action",
    action: "POST /prompt-library/:slug/render",
    evidence: { function: "renderPrompt" }
  },
  {
    route: "POST /api/prompt-library/collections/:id/items",
    kind: "json_form_of_action",
    action: "POST /business-builder/prompts/:templateId/collections",
    evidence: { function: "addCollectionItem" }
  },
  {
    route: "GET /api/business-builder/control-plane",
    kind: "json_form_of_page",
    page: "/business-builder/control-center",
    evidence: { function: "listBusinesses" }
  },
  {
    route: "GET /api/prompt-library/templates",
    kind: "json_form_of_page",
    page: "/business-builder/prompts",
    evidence: { table: "sonara_prompt_templates" }
  },
  {
    route: "GET /api/prompt-library/collections",
    kind: "json_form_of_page",
    page: "/business-builder/prompts",
    evidence: { table: "sonara_prompt_collections" }
  }
].map((entry) => Object.freeze({ ...entry, reason: KINDS[entry.kind] })));

module.exports = { KINDS, ROUTE_DESTINATION_REVIEWS };
