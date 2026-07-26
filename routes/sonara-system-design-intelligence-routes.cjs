"use strict";

const {
  SYSTEM_DESIGN_REFERENCE_SOURCE,
  SYSTEM_DESIGN_PATTERNS
} = require("../data/system-design-reference-catalog.cjs");
const {
  getSystemDesignSummary,
  reviewSystemDesign
} = require("../lib/sonara-system-design-engine.cjs");

module.exports = function registerSonaraSystemDesignIntelligenceRoutes(app, deps = {}) {
  const layout = deps.layout || basicLayout;
  const brandCard = deps.brandCard || card;
  const linkAction = deps.linkAction || link;
  const requireAdmin = typeof deps.requireAdmin === "function" ? deps.requireAdmin : pass;
  const recordAdminAuditEvent = typeof deps.recordAdminAuditEvent === "function"
    ? deps.recordAdminAuditEvent
    : async () => undefined;

  app.get("/api/admin/system-design-intelligence", requireAdmin, async (req, res) => {
    const summary = getSystemDesignSummary();
    await recordAdminAuditEvent(req, "admin.system_design_intelligence.view", {
      sourceId: SYSTEM_DESIGN_REFERENCE_SOURCE.id,
      patternCount: SYSTEM_DESIGN_PATTERNS.length,
      path: req.path
    });

    return res.status(200).json({
      ok: true,
      status: "reference_only",
      summary,
      source: SYSTEM_DESIGN_REFERENCE_SOURCE,
      patterns: SYSTEM_DESIGN_PATTERNS
    });
  });

  app.post("/api/admin/system-design-intelligence/review", requireAdmin, async (req, res) => {
    const review = reviewSystemDesign(req.body || {});
    if (!review.ok) return res.status(review.status || 400).json(review);

    await recordAdminAuditEvent(req, "admin.system_design_intelligence.review", {
      moduleKey: review.module.moduleKey,
      product: review.module.product,
      decision: review.decision,
      reviewFingerprint: review.reviewFingerprint,
      patternSlugs: review.recommendedPatterns.map((item) => item.slug),
      blockedPatterns: review.blockedPatterns
    });

    return res.status(200).json(review);
  });

  app.get("/admin/system-design-intelligence", requireAdmin, async (req, res) => {
    const summary = getSystemDesignSummary();
    await recordAdminAuditEvent(req, "admin.system_design_intelligence.dashboard", {
      sourceId: SYSTEM_DESIGN_REFERENCE_SOURCE.id,
      patternCount: SYSTEM_DESIGN_PATTERNS.length,
      path: req.path
    });

    const statusCards = Object.entries(summary.statusCounts).map(([status, count]) => brandCard(
      display(status),
      `${count} mapped architecture topic${count === 1 ? "" : "s"}.`
    ));

    const domainCards = Object.entries(summary.domainCounts).map(([domain, count]) => brandCard(
      display(domain),
      `${count} topic${count === 1 ? "" : "s"} mapped into SONARA systems and modules.`
    ));

    return res.status(200).type("html").send(layout({
      title: "System Design Intelligence",
      eyebrow: "Founder architecture",
      heading: "Architecture reference engine",
      body: "A deterministic, admin-only review engine maps 28 public system-design topic names into original SONARA architecture questions, module mappings, risk gates, and implementation sequences. No upstream chapter text, diagrams, or code are copied or executed.",
      sections: [
        brandCard("Source boundary", `${SYSTEM_DESIGN_REFERENCE_SOURCE.repository} is pinned to ${SYSTEM_DESIGN_REFERENCE_SOURCE.pinnedCommit.slice(0, 12)}. License status: ${display(SYSTEM_DESIGN_REFERENCE_SOURCE.licenseStatus)}. Integration mode: ${display(SYSTEM_DESIGN_REFERENCE_SOURCE.integrationMode)}.`),
        brandCard("Runtime boundary", "No remote fetch, package dependency, cloned repository, executable code, customer data access, or production decision automation is introduced."),
        brandCard("Review endpoint", "POST a moduleKey, product, summary, capabilities, risks, constraints, and scaleTier to /api/admin/system-design-intelligence/review. Results remain review-required and must become a separately tested pull request before implementation."),
        ...statusCards,
        ...domainCards
      ],
      actions: [
        linkAction("/api/admin/system-design-intelligence", "Architecture catalog JSON"),
        linkAction("/admin/reference-intelligence", "Reference intelligence"),
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
