"use strict";

// /research-lab/open-source
//
// Two pages linked here and it returned 404 in production:
// /research-lab/huggingface and /research-lab/requested-repositories both offer
// an "Open-source research" action, and it had no route behind it.
//
// The register itself was never the problem. data/open-source-tools.ts holds
// thirty-nine reviewed repositories and scripts/verify-open-source-registry.mjs
// gates it on every release. It simply had no page, so the work existed, the
// gate checked it, and nobody could look at it.
//
// This is an operator surface, not a customer one. It names licences,
// repositories and refusal reasons precisely, which is why it sits under
// /research-lab -- lib/sonara-plain-language.cjs exempts that prefix from the
// customer-vocabulary rules for exactly this kind of page.

const {
  readOpenSourceTools,
  displayName,
  integrationLabel,
  commercialLabel,
  riskLabel
} = require("../lib/sonara-open-source-registry.cjs");

module.exports = function registerSonaraOpenSourceRoutes(app, deps = {}) {
  const layout = deps.layout || basicLayout;
  const brandCard = deps.brandCard || card;
  const linkAction = deps.linkAction || link;
  const escape = deps.escapeHtml || esc;

  // The JSON carries the same substitution as the page. A retired product name
  // should not leave this application by either door, and a machine reader
  // gains nothing from the one name that is withheld -- every other field on
  // that record is present.
  app.get("/api/ecosystem/open-source", (req, res) => {
    const tools = readOpenSourceTools().map((tool) => ({ ...tool, name: displayName(tool) }));
    res.status(200).json({
      ok: true,
      status: "reviewed_register",
      toolCount: tools.length,
      counts: countBy(tools, "integrationStatus"),
      tools
    });
  });

  app.get("/research-lab/open-source", (req, res) => {
    const tools = readOpenSourceTools();
    const byIntegration = countBy(tools, "integrationStatus");
    const blocked = tools.filter((tool) => tool.integrationStatus === "blocked");

    const sections = [
      brandCard(
        "What this register is",
        `${tools.length} external repositories reviewed before use. Each records its licence, how far integration may go, and what is refused. scripts/verify-open-source-registry.mjs checks this file on every release.`
      ),
      brandCard(
        "Nothing here runs by default",
        "Being listed is not adoption. Reference-only entries are read, not installed; an optional adapter still needs review before it is wired to anything; blocked entries are recorded so the same question is not asked twice."
      )
    ];

    if (blocked.length) {
      sections.push(brandCard(
        `Blocked (${blocked.length})`,
        blocked.map((tool) => `${displayName(tool)} — ${tool.license}`).join(". ") + "."
      ));
    }

    sections.push(registerTable(tools, escape));

    res.status(200).type("html").send(layout({
      title: "Open-source register",
      eyebrow: "Research Lab",
      heading: "Reviewed open-source repositories",
      body: "Every external repository this project has looked at, with the licence it carries, how far it may be integrated, and why anything refused was refused.",
      sections,
      actions: [
        linkAction("/api/ecosystem/open-source", "Register JSON"),
        linkAction("/research-lab/huggingface", "Hugging Face catalog"),
        linkAction("/research-lab/requested-repositories", "Repository intake"),
        linkAction("/", "SONARA home")
      ]
    }));

    void byIntegration;
  });
};

// One row per repository. The repo URL is rendered as text rather than a link:
// several entries are unresolved placeholders that the release gate reports as
// warnings, and a link to https://github.com/ is a dead link of exactly the
// kind this page exists to stop shipping.
function registerTable(tools, escape) {
  const rows = tools.map((tool) => {
    const cells = [
      escape(displayName(tool)),
      escape(riskLabel(tool.licenseRisk)),
      escape(tool.license),
      escape(commercialLabel(tool.commercialUseStatus)),
      escape(integrationLabel(tool.integrationStatus)),
      escape(placement(tool)),
      escape(tool.blockedUses.length ? tool.blockedUses.join(", ") : "None recorded")
    ];
    return `<tr>${cells.map((cell) => `<td>${cell}</td>`).join("")}</tr>`;
  }).join("");
  const head = ["Repository", "Licence risk", "Licence", "Commercial use", "Integration", "Where it lands", "Refused uses"]
    .map((label) => `<th>${escape(label)}</th>`).join("");
  return `<article class="card"><h2>The register</h2><table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></article>`;
}

// Which part of the company a repository is for.
//
// The register listed licence, risk and refusals and never said where a
// repository actually goes, so the page answered "may we use this?" and not
// "what is it for?" -- and the second question is the one somebody opening this
// page is usually asking.
//
// An empty productFit is a real answer rather than a gap. Every record with one
// is either blocked, unresolved, or build-time tooling that never reaches a
// customer, and saying so is more useful than leaving the cell blank and
// letting the reader guess which.
function placement(tool) {
  const fit = (tool.productFit || []).filter((entry) => entry && entry !== "None");
  if (fit.length) return fit.join(", ");
  if (tool.integrationStatus === "blocked") return "Nowhere -- refused";
  if (tool.integrationStatus === "needs_license_review") return "Nowhere yet -- licence unresolved";
  return "Build-time only -- helps write SONARA, reaches no customer";
}

function countBy(items, key) {
  return items.reduce((totals, item) => {
    const value = item[key] || "unknown";
    totals[value] = (totals[value] || 0) + 1;
    return totals;
  }, {});
}

function esc(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function card(title, body) { return `<article class="card"><h2>${esc(title)}</h2><p>${esc(body)}</p></article>`; }
function link(href, label) { return `<a class="action" href="${esc(href)}">${esc(label)}</a>`; }
function basicLayout(data) {
  return `<!doctype html><html><head><title>${esc(data.title)}</title></head><body><main><h1>${esc(data.heading)}</h1><p>${esc(data.body)}</p>${(data.sections || []).join("")}<nav>${(data.actions || []).join("")}</nav></main></body></html>`;
}
