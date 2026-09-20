// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const {
  getInventionSystemsIntelligence
} = require("../lib/sonara-invention-systems-2026.cjs");

module.exports = function registerInventionSystemsRoutes(app, deps = {}) {
  const requireCustomer = deps.requireCustomer || passthrough;
  const ui = {
    layout: deps.layout || basicLayout,
    card: deps.brandCard || card,
    link: deps.linkAction || link
  };

  app.get("/api/invention-systems/catalog", requireCustomer, (req, res) => {
    return res.status(200).json(getInventionSystemsIntelligence());
  });


  app.get("/market-intelligence/invention-systems", requireCustomer, (req, res) => {
    const catalog = getInventionSystemsIntelligence();
    const sections = [
      ui.card(
        "System foundry",
        String(catalog.counts.inventionSystems) + " SONARA-owned system concepts map " + String(catalog.counts.domainCoverage) + " requested domain families into reusable platform primitives. None are marked live or granted runtime authority by this catalog."
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

function passthrough(req, res, next) { next(); }
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
