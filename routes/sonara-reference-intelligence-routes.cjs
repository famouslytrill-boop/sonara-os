"use strict";

const {
  FACEBOOK_REFERENCE_CATALOG,
  REFERENCE_PRODUCT_FRAMEWORK
} = require("../data/facebook-reference-catalog.cjs");

const GOVERNANCE_POLICY = Object.freeze({
  sourceVerificationRequired: true,
  humanApprovalRequired: true,
  cloneOrRepublishAllowed: false,
  unknownRightsDefault: "blocked",
  productionActivationRule: "Only verified, rights-reviewed insights may become features, content briefs, campaigns, or automation rules.",
  requiredEvidence: Object.freeze([
    "accessible source or owner-supplied transcript",
    "creator/title attribution when available",
    "factual summary separated from interpretation",
    "rights and disclosure review",
    "product mapping with confidence and expected impact",
    "owner approval"
  ])
});

module.exports = function registerSonaraReferenceIntelligenceRoutes(app, deps = {}) {
  const layout = deps.layout || basicLayout;
  const brandCard = deps.brandCard || card;
  const linkAction = deps.linkAction || link;
  const requireAdmin = typeof deps.requireAdmin === "function" ? deps.requireAdmin : pass;
  const recordAdminAuditEvent = typeof deps.recordAdminAuditEvent === "function"
    ? deps.recordAdminAuditEvent
    : async () => undefined;

  app.get("/api/admin/reference-intelligence", requireAdmin, async (req, res) => {
    await recordAdminAuditEvent(req, "admin.reference_intelligence.view", {
      sourceCount: FACEBOOK_REFERENCE_CATALOG.length,
      path: req.path
    });

    return res.status(200).json({
      ok: true,
      status: "review_required",
      sourceCount: FACEBOOK_REFERENCE_CATALOG.length,
      verifiedSourceCount: 0,
      unverifiedSourceCount: FACEBOOK_REFERENCE_CATALOG.length,
      governance: GOVERNANCE_POLICY,
      productFramework: REFERENCE_PRODUCT_FRAMEWORK,
      sources: FACEBOOK_REFERENCE_CATALOG
    });
  });

  app.get("/admin/reference-intelligence", requireAdmin, async (req, res) => {
    await recordAdminAuditEvent(req, "admin.reference_intelligence.dashboard", {
      sourceCount: FACEBOOK_REFERENCE_CATALOG.length,
      path: req.path
    });

    const productCards = Object.values(REFERENCE_PRODUCT_FRAMEWORK).map((product) => brandCard(
      product.label,
      `Review dimensions: ${product.reviewDimensions.join(", ")}. Approved outputs: ${product.allowedOutputs.join(", ")}.`
    ));

    const sourceCards = FACEBOOK_REFERENCE_CATALOG.map((source) => brandCard(
      `${source.id}: ${display(source.sourceType)}`,
      `${source.sourceUrl} Status: ${display(source.verificationStatus)}. Rights: ${display(source.rightsStatus)}.`
    ));

    return res.status(200).type("html").send(layout({
      title: "Reference Intelligence",
      eyebrow: "Founder operations",
      heading: "Evidence-backed reference intake",
      body: "The supplied Facebook references are cataloged, but Facebook blocked unauthenticated inspection. They remain review-required and cannot silently become product features, copied content, campaigns, claims, or automations.",
      sections: [
        brandCard("Intake status", `${FACEBOOK_REFERENCE_CATALOG.length} unique Facebook references cataloged; 0 verified; ${FACEBOOK_REFERENCE_CATALOG.length} require authenticated source review or an owner-supplied transcript.`),
        brandCard("Activation gate", GOVERNANCE_POLICY.productionActivationRule),
        brandCard("Evidence contract", GOVERNANCE_POLICY.requiredEvidence.join("; ")),
        ...productCards,
        ...sourceCards
      ],
      actions: [
        linkAction("/api/admin/reference-intelligence", "Reference JSON"),
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
