"use strict";

const { getManifest, getAllManifestTables } = require("../lib/sonara-ecosystem-manifest.cjs");

module.exports = function registerSonaraEcosystemRoutes(app, deps = {}) {
  const layout = deps.layout || basicLayout;
  const brandCard = deps.brandCard || card;
  const linkAction = deps.linkAction || link;
  const requireAdmin = typeof deps.requireAdmin === "function" ? deps.requireAdmin : pass;
  const safeListTable = typeof deps.safeListTable === "function" ? deps.safeListTable : undefined;

  app.get("/ecosystem", (req, res) => {
    const manifest = getManifest();
    return res.status(200).type("html").send(layout({
      title: "SONARA Ecosystem",
      eyebrow: "Operating blueprint",
      heading: "SONARA Ecosystem",
      body: manifest.parentCompany.publicPositioning,
      sections: [
        brandCard("Parent company", `${manifest.parentCompany.name}: ${manifest.parentCompany.legalRole}`),
        ...manifest.currentCompanies.map((company) => brandCard(company.name, `${company.purpose} Apps: ${company.apps.slice(0, 8).join(" / ")}`)),
        brandCard("Infrastructure", manifest.infrastructure.requiredServices.join(" / ")),
        brandCard("UI direction", manifest.uiExperience.direction),
        brandCard("Launch priority", manifest.launchPriorities.slice(0, 5).join(" / "))
      ],
      actions: [
        linkAction("/api/ecosystem/manifest", "Manifest JSON"),
        linkAction("/api/ecosystem/readiness", "Readiness JSON"),
        linkAction("/formulas", "Formulas"),
        linkAction("/dashboard", "Dashboard")
      ]
    }));
  });

  app.get("/admin/ecosystem", requireAdmin, async (req, res) => {
    const manifest = getManifest();
    const readiness = await getEcosystemReadiness(safeListTable);
    const missingCount = readiness.tables.filter((item) => !item.ok).length;
    return res.status(200).type("html").send(layout({
      title: "Ecosystem control plane",
      eyebrow: "Founder operations",
      heading: "Ecosystem control plane",
      body: "Admin source-of-truth view for SONARA companies, modules, integrations, infrastructure, database domains, and launch blockers.",
      sections: [
        brandCard("System model", `${manifest.currentCompanies.length} companies, ${manifest.requiredDatabaseDomains.length} database domains, ${getAllManifestTables().length} required table references.`),
        brandCard("Database readiness", `${readiness.tables.length - missingCount}/${readiness.tables.length} table references returned OK. ${missingCount} still need setup, migration, or read permission review.`),
        brandCard("Adapter policy", manifest.externalInspirationAndAdapters.adapterRules.join(" / ")),
        brandCard("UI layer", manifest.uiExperience.layers.join(" / ")),
        brandCard("Next priorities", manifest.launchPriorities.slice(0, 8).join(" / ")),
        ...manifest.currentCompanies.map((company) => brandCard(company.name, company.modules.slice(0, 14).join(" / ")))
      ],
      actions: [
        linkAction("/admin", "Admin"),
        linkAction("/admin/formulas", "Formulas"),
        linkAction("/api/ecosystem/manifest", "Manifest JSON"),
        linkAction("/api/ecosystem/readiness", "Readiness JSON")
      ]
    }));
  });

  app.get("/api/ecosystem/manifest", (req, res) => {
    res.status(200).json({ ok: true, manifest: getManifest() });
  });

  app.get("/api/ecosystem/readiness", async (req, res) => {
    res.status(200).json(await getEcosystemReadiness(safeListTable));
  });
};

async function getEcosystemReadiness(safeListTable) {
  const manifest = getManifest();
  const tableNames = unique(getAllManifestTables()).filter((table) => !table.includes("."));
  if (!safeListTable) {
    return {
      ok: true,
      mode: "static",
      companies: manifest.currentCompanies.map((company) => ({ key: company.key, name: company.name, moduleCount: company.modules.length })),
      tables: tableNames.map((table) => ({ table, ok: false, status: "setup_required" }))
    };
  }

  const tables = await Promise.all(tableNames.map(async (table) => {
    const result = await safeListTable(table, "?select=id&limit=1");
    return { table, ok: Boolean(result.ok), status: result.ok ? "ready" : "setup_required" };
  }));

  return {
    ok: true,
    companies: manifest.currentCompanies.map((company) => ({ key: company.key, name: company.name, appCount: company.apps.length, moduleCount: company.modules.length })),
    serviceCount: manifest.infrastructure.requiredServices.length,
    tables
  };
}

function unique(values) {
  return Array.from(new Set(values));
}

function pass(req, res, next) { next(); }
function esc(value) { return String(value || "").replace(/[&<>\"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[char])); }
function card(title, body) { return `<article class="card"><h2>${esc(title)}</h2><p>${esc(body)}</p></article>`; }
function link(href, label) { return `<a class="action" href="${esc(href)}">${esc(label)}</a>`; }
function basicLayout(data) { return `<!doctype html><html><head><title>${esc(data.title)}</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main><p>${esc(data.eyebrow)}</p><h1>${esc(data.heading)}</h1><p>${esc(data.body)}</p><nav>${(data.actions || []).join("")}</nav><section>${(data.sections || []).join("")}</section></main></body></html>`; }
