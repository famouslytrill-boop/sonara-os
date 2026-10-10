// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const {
  getInventionSystemsIntelligence
} = require("../lib/sonara-invention-systems-2026.cjs");
const { getStudioSimulationCatalog, evaluateInternalSimulation } = require("../lib/sonara-simulation-integration.cjs");
const { renderResearchWorkbench } = require("../lib/sonara-research-workbench.cjs");

module.exports = function registerInventionSystemsRoutes(app, deps = {}) {
  // Fail closed when upstream authorization is missing or misconfigured.
  const requireCustomer = typeof deps.requireCustomer === "function"
    ? deps.requireCustomer : denyWhenCustomerGuardMissing;
  const ui = {
    layout: deps.layout || basicLayout,
    card: deps.brandCard || card,
    link: deps.linkAction || link
  };

  app.get("/api/invention-systems/catalog", requireCustomer, (req, res) => {
    // Catalog only: no exposed mathematical execution or new privilege grants.
    return res.status(200).json({
      ...getInventionSystemsIntelligence(),
      researchSimulations: getStudioSimulationCatalog()
    });
  });


  app.get("/market-intelligence/invention-systems", requireCustomer, (req, res) => {
    // User-supplied study parameters live in GET URLs; never cache or refer them to a third party.
    if (typeof res.set === "function") {
      res.set("Cache-Control", "private, no-store");
      res.set("Referrer-Policy", "no-referrer");
    }
    const catalog = getInventionSystemsIntelligence();
    // Fixed, public-domain mathematical inputs only. No req-derived inputs,
    // account data, storage, payment, trade, user-run job, or external action.
    const area = evaluateInternalSimulation({
      studio: "business_builder", key: "layout_area",
      parameters: { vertices: [[0, 0], [4, 0], [4, 3], [0, 3]] }
    }).result.absoluteArea;
    const chord = evaluateInternalSimulation({
      studio: "creator_studio", key: "chord_harmony",
      parameters: { rootMidi: 60, quality: "major" }
    }).result.notes.map((note) => note.midi).join(", ");
    const game = evaluateInternalSimulation({
      studio: "growth_studio", key: "strategy_payoffs",
      parameters: { matrix: [[1, -1], [-1, 1]] }
    }).result;
    const sections = [
      renderResearchWorkbench(req && req.query),
      ui.card(
        "System foundry",
        String(catalog.counts.inventionSystems) + " SONARA-owned system concepts map " + String(catalog.counts.domainCoverage) + " requested domain families into reusable platform primitives. None are marked live or granted runtime authority by this catalog."
      ),
      ui.card(
        "Simulation and creative mathematics — research only",
        String(getStudioSimulationCatalog().capabilities.length) + " bounded educational prototypes are mapped across SONARA One, Business Builder, Creator Studio and Growth Studio. Includes geometry, calculus, probability, game theory, card-hand classification, film timing, music notes, 2D motion and hypothetical trading. No casino, betting, trading or money execution; no public simulation runner, customer results, provider access or licensed-engine activation."
      ),
      ui.card(
        "Read-only mathematical examples",
        "Fixed-input reference examples: a 4-by-3 rectangle has area " +
        String(area) + " square units; a C major triad has MIDI notes " + chord +
        "; the matching-pennies game has a mixed-strategy row probability " +
        String(game.rowProbabilities[0]) + ". Separate small educational forms accept bounded input but never change records, money or production workflows."
      ),
      ui.card(
        "Promotion model",
        "Research → design → sandbox → validated → canary → production. Each transition requires explicit evidence; production additionally requires exact-SHA release, rollback, production-health and owner-authorization evidence."
      ),
      ui.card(
        "Core architecture",
        "Governed agents + deterministic workflows + evidence RAG + business digital twins + provider-neutral commerce, communications, media, field and vertical-operation modules."
      ),
      ui.card(
        "Reality ↔ model loop",
        "Observe permitted real-world evidence → update the twin/evidence graph → rehearse in simulation → generate options → authorize deterministically → execute a bounded action → measure the outcome. Sensing and prediction never grant action authority."
      ),
      ui.card(
        "2026 market signal",
        "Current research favors governed workflow redesign, explicit agent identity/authority, stateless interoperable tool protocols, machine-readable commerce, realtime coordination, simulation-first physical/digital twins, durable creative continuity, adaptive media delivery, passkeys, agent observability, and progressive WebGPU/WebXR interfaces."
      )
    ];

    return res.status(200).type("html").send(ui.layout({
      title: "SONARA Invention Systems",
      eyebrow: "Research-to-runtime foundry",
      heading: "SONARA invention systems",
      body: "Turn market, repository, standards, academic, and operational research into testable SONARA-owned engines and modules without confusing research evidence with production capability.",
      sections,
      actions: [
        ui.link("/business-builder/market-intelligence", "Market intelligence"),
        ui.link("/product-lifecycle", "Roadmap"),
        ui.link("/", "SONARA home")
      ]
    }));
  });
};

function denyWhenCustomerGuardMissing(req, res) {
  return res.status(503).json({ ok: false, code: "customer_guard_unavailable" });
}
function basicLayout(data) {
  return '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>' +
    escapeHtml(data.title) +
    '</title></head><body><main><p>' +
    escapeHtml(data.eyebrow) +
    '</p><h1>' +
    escapeHtml(data.heading) +
    '</h1><p>' +
    escapeHtml(data.body) +
    '</p><nav>' +
    (data.actions || []).join("") +
    '</nav><section>' +
    (data.sections || []).join("") +
    '</section></main></body></html>';
}
function card(title, body) { return '<article><h2>' + escapeHtml(title) + '</h2><p>' + escapeHtml(body) + '</p></article>'; }
function link(href, label) { return '<a href="' + escapeHtml(href) + '">' + escapeHtml(label) + '</a>'; }
function escapeHtml(value) {
  return String(value || "").replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));
}
