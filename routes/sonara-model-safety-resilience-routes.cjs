"use strict";

const {
  OBLITERATUS_SAFETY_REFERENCE,
  MODEL_SAFETY_CONTROL_AREAS
} = require("../data/obliteratus-safety-reference.cjs");
const {
  getModelSafetyReferenceSummary,
  reviewModelSafetyProposal
} = require("../lib/sonara-model-safety-resilience.cjs");

module.exports = function registerSonaraModelSafetyResilienceRoutes(app, deps = {}) {
  const layout = deps.layout || basicLayout;
  const brandCard = deps.brandCard || card;
  const linkAction = deps.linkAction || link;
  const requireAdmin = typeof deps.requireAdmin === "function" ? deps.requireAdmin : pass;
  const recordAdminAuditEvent = typeof deps.recordAdminAuditEvent === "function"
    ? deps.recordAdminAuditEvent
    : async () => undefined;

  app.get("/api/admin/model-safety-resilience", requireAdmin, async (req, res) => {
    const summary = getModelSafetyReferenceSummary();
    await recordAdminAuditEvent(req, "admin.model_safety_resilience.view", {
      sourceId: OBLITERATUS_SAFETY_REFERENCE.id,
      integrationMode: OBLITERATUS_SAFETY_REFERENCE.integrationMode,
      controlAreaCount: MODEL_SAFETY_CONTROL_AREAS.length,
      path: req.path
    });

    return res.status(200).json({
      ok: true,
      status: "quarantined_reference_only",
      summary
    });
  });

  app.post("/api/admin/model-safety-resilience/review", requireAdmin, async (req, res) => {
    const review = reviewModelSafetyProposal(req.body || {});
    if (!review.ok) return res.status(review.status || 400).json(review);

    await recordAdminAuditEvent(req, "admin.model_safety_resilience.review", {
      proposalName: review.proposal.name,
      product: review.proposal.product,
      environment: review.proposal.environment,
      decision: review.decision,
      reviewFingerprint: review.reviewFingerprint,
      blockedReasonCount: review.blockedReasons.length
    });

    return res.status(200).json(review);
  });

  app.get("/admin/model-safety-resilience", requireAdmin, async (req, res) => {
    await recordAdminAuditEvent(req, "admin.model_safety_resilience.dashboard", {
      sourceId: OBLITERATUS_SAFETY_REFERENCE.id,
      path: req.path
    });

    const controlCards = MODEL_SAFETY_CONTROL_AREAS.map((control) => brandCard(
      control.title,
      `${control.purpose} Required evidence: ${control.evidence.join(", ")}.`
    ));

    return res.status(200).type("html").send(layout({
      title: "Model Safety Resilience",
      eyebrow: "Founder AI governance",
      heading: "Defensive model-safety review",
      body: "OBLITERATUS is cataloged as a quarantined research reference because its stated purpose includes removing model refusal behavior. SONARA does not install or run it, modify model weights, export altered models, enable telemetry, or expose it to customers. The local policy engine only reviews proposed work for safety, licensing, privacy, provenance, and deployment risk.",
      sections: [
        brandCard("Source boundary", `${OBLITERATUS_SAFETY_REFERENCE.repository} is pinned to ${OBLITERATUS_SAFETY_REFERENCE.pinnedCommit.slice(0, 12)}. License: ${OBLITERATUS_SAFETY_REFERENCE.upstreamLicense}. Status: ${display(OBLITERATUS_SAFETY_REFERENCE.status)}.`),
        brandCard("Permitted use", OBLITERATUS_SAFETY_REFERENCE.allowedUses.join(" ")),
        brandCard("Blocked production use", OBLITERATUS_SAFETY_REFERENCE.blockedUses.join(" ")),
        brandCard("Review endpoint", "POST a name, product, summary, requestedAction, dataTypes, outputs, controls, and environment to /api/admin/model-safety-resilience/review. The endpoint cannot execute models or change infrastructure."),
        ...controlCards
      ],
      actions: [
        linkAction("/api/admin/model-safety-resilience", "Safety reference JSON"),
        linkAction("/admin/system-design-intelligence", "System Design Intelligence"),
        linkAction("/admin/ai-integrations", "AI integrations"),
        linkAction("/admin/ecosystem", "Ecosystem"),
        linkAction("/admin", "Founder operations")
      ]
    }));
  });
};

function display(value) {
  return String(value || "unknown").replace(/_/g, " ");
}

function pass(req, res, next) { next(); }
function esc(value) { return String(value || "").replace(/[&<>\"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[char])); }
function card(title, body) { return `<article class="card"><h2>${esc(title)}</h2><p>${esc(body)}</p></article>`; }
function link(href, label) { return `<a class="action" href="${esc(href)}">${esc(label)}</a>`; }
function basicLayout(data) { return `<!doctype html><html><head><title>${esc(data.title)}</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main><p>${esc(data.eyebrow)}</p><h1>${esc(data.heading)}</h1><p>${esc(data.body)}</p><nav>${(data.actions || []).join("")}</nav><section>${(data.sections || []).join("")}</section></main></body></html>`; }
