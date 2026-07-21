"use strict";

const { getManifest, getAllManifestTables } = require("../lib/sonara-ecosystem-manifest.cjs");

const LIVE_PROBE_TIMEOUT_MS = 800;

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
        brandCard("Governed AI integrations", `${manifest.externalInspirationAndAdapters.governedAIIntegrations.length} tools classified by runtime, risk, license, and product fit; all optional and disabled by default.`),
        brandCard("UI direction", manifest.uiExperience.direction),
        brandCard("Launch priority", manifest.launchPriorities.slice(0, 5).join(" / "))
      ],
      actions: [
        linkAction("/api/ecosystem/manifest", "Manifest JSON"),
        linkAction("/api/ecosystem/readiness", "Readiness JSON"),
        linkAction("/api/ecosystem/ai-integrations", "AI integration catalog"),
        linkAction("/formulas", "Formulas"),
        linkAction("/dashboard", "Dashboard")
      ]
    }));
  });

  app.get("/admin/ecosystem", requireAdmin, async (req, res) => {
    const manifest = getManifest();
    const readiness = await getEcosystemReadiness(safeListTable, { probe: true });
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
        brandCard("AI integration control plane", `${manifest.externalInspirationAndAdapters.governedAIIntegrations.length} classified tools with admin-only, read-only service probes.`),
        brandCard("UI layer", manifest.uiExperience.layers.join(" / ")),
        brandCard("Next priorities", manifest.launchPriorities.slice(0, 8).join(" / ")),
        ...manifest.currentCompanies.map((company) => brandCard(company.name, company.modules.slice(0, 14).join(" / ")))
      ],
      actions: [
        linkAction("/admin", "Admin"),
        linkAction("/admin/formulas", "Formulas"),
        linkAction("/api/ecosystem/manifest", "Manifest JSON"),
        linkAction("/api/ecosystem/readiness", "Readiness JSON"),
        linkAction("/admin/ai-integrations", "AI integrations")
      ]
    }));
  });

  app.get("/api/ecosystem/manifest", (req, res) => {
    res.status(200).json({ ok: true, manifest: getManifest() });
  });

  // Public readiness is intentionally static and fast. It describes the
  // required contract without making a request fan-out to production Supabase.
  // Live table probes remain available only inside the protected admin view.
  app.get("/api/ecosystem/readiness", (req, res) => {
    res.status(200).json(getStaticEcosystemReadiness());
  });
};

function getStaticEcosystemReadiness() {
  const manifest = getManifest();
  const tableNames = unique(getAllManifestTables()).filter((table) => !table.includes("."));
  return {
    ok: true,
    mode: "static",
    companies: manifest.currentCompanies.map((company) => ({
      key: company.key,
      name: company.name,
      appCount: company.apps.length,
      moduleCount: company.modules.length
    })),
    serviceCount: manifest.infrastructure.requiredServices.length,
    aiIntegrationCount: manifest.externalInspirationAndAdapters.governedAIIntegrations.length,
    tables: tableNames.map((table) => ({ table, ok: false, status: "setup_required" }))
  };
}

async function getEcosystemReadiness(safeListTable, options = {}) {
  if (!safeListTable || options.probe !== true) return getStaticEcosystemReadiness();

  const manifest = getManifest();
  const tableNames = unique(getAllManifestTables()).filter((table) => !table.includes("."));
  const tables = await Promise.all(tableNames.map(async (table) => {
    const result = await boundedProbe(() => safeListTable(table, "?select=id&limit=1"), LIVE_PROBE_TIMEOUT_MS);
    return {
      table,
      ok: Boolean(result.ok),
      status: result.ok ? "ready" : "setup_required",
      reason: result.code === "timeout" ? "timeout" : undefined
    };
  }));

  return {
    ok: true,
    mode: "live_bounded",
    probeTimeoutMs: LIVE_PROBE_TIMEOUT_MS,
    companies: manifest.currentCompanies.map((company) => ({
      key: company.key,
      name: company.name,
      appCount: company.apps.length,
      moduleCount: company.modules.length
    })),
    serviceCount: manifest.infrastructure.requiredServices.length,
    aiIntegrationCount: manifest.externalInspirationAndAdapters.governedAIIntegrations.length,
    tables
  };
}

async function boundedProbe(run, timeoutMs) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(run).catch(() => ({ ok: false, code: "unavailable" })),
      new Promise((resolve) => {
        timer = setTimeout(() => resolve({ ok: false, code: "timeout" }), timeoutMs);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function unique(values) {
  return Array.from(new Set(values));
}

function pass(req, res, next) { next(); }
function esc(value) { return String(value || "").replace(/[&<>\"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[char])); }
function card(title, body) { return `<article class="card"><h2>${esc(title)}</h2><p>${esc(body)}</p></article>`; }
function link(href, label) { return `<a class="action" href="${esc(href)}">${esc(label)}</a>`; }
function basicLayout(data) { return `<!doctype html><html><head><title>${esc(data.title)}</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main><p>${esc(data.eyebrow)}</p><h1>${esc(data.heading)}</h1><p>${esc(data.body)}</p><nav>${(data.actions || []).join("")}</nav><section>${(data.sections || []).join("")}</section></main></body></html>`; }
