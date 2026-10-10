// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const {
  FORMULA_TABLES,
  evaluateFormula,
  getFormulaDefinition,
  listFormulaDefinitions,
  productAreaToWorkspace
} = require("../lib/sonara-formula-library.cjs");
const {
  getFinancialIntelligenceFormulaCatalog
} = require("../lib/sonara-financial-intelligence-formulas.cjs");
const pages = require("../lib/sonara-formula-pages.cjs");

const SAVED_RESULTS_SHOWN = 50;


const FORMULA_GROUP_LABELS = {
  business_revenue: "Business and revenue",
  restaurant_margin: "Restaurant and service margin",
  employee_payroll: "Employee payroll",
  inventory_operations: "Inventory and operations",
  growth_marketing: "Growth and marketing",
  creator_music: "Creator music and release",
  ui_device_experience: "Device and interface experience",
  operating_twin: "Operating twin and decision support",
  stem_mathematics: "Mathematics and probability",
  stem_physical_science: "Physics and applied science",
  social_studies: "Geography, populations and civics",
  language_arts: "Language and reading analysis",
  creative_arts: "Visual arts, music and animation",
  physical_education: "Physical activity and pacing",
  cad_geometry: "CAD drawing and geometry",
  motion_capture: "Motion capture analysis",
  labor_economics: "Labor and opportunity costs",
  building_economics: "Construction investment economics",
  construction_trades: "Construction and trade estimates",
  trade_electrical: "Electrical estimates",
  trade_plumbing: "Plumbing and pipe flow",
  measurement_science: "Measurement and unit conversions",
  computing_engineering: "Computing and processing costs",
  space_science: "Satellites and telescopes",
  quantum_research: "Quantum learning and simulations"
};

module.exports = function registerSonaraFormulaRoutes(app, deps = {}) {
  const layout = deps.layout || basicLayout;
  const brandCard = deps.brandCard || card;
  const linkAction = deps.linkAction || link;
  const requireWorkspaceAccess = typeof deps.requireWorkspaceAccess === "function"
    ? deps.requireWorkspaceAccess
    : () => (_req, res) => res.status(503).json({
        ok: false, code: "workspace_guard_not_configured",
        message: "Private formula records are not available."
      });
  const getSupabaseServerConfig = typeof deps.getSupabaseServerConfig === "function" ? deps.getSupabaseServerConfig : undefined;
  const getCustomerPrimaryOrganization = typeof deps.getCustomerPrimaryOrganization === "function" ? deps.getCustomerPrimaryOrganization : undefined;
  const supabaseHeaders = typeof deps.supabaseHeaders === "function" ? deps.supabaseHeaders : undefined;
  const insertActivityEvent = typeof deps.insertActivityEvent === "function" ? deps.insertActivityEvent : async () => ({ ok: false });
  const escapeHtml = typeof deps.escapeHtml === "function" ? deps.escapeHtml : esc;

  app.get("/formulas", (req, res) => {
    const groups = groupDefinitions(listFormulaDefinitions());
    const financialIntelligence = getFinancialIntelligenceFormulaCatalog();
    return res.status(200).type("html").send(layout({
      title: "Formula Library",
      eyebrow: "SONARA formulas",
      heading: "Formula Library",
      body: "Business, creator, growth, education, STEM, CAD, motion capture, device and operating-twin calculations. You can evaluate locally supplied measurements, and save results only after signing in and database setup." ,
      sections: [
        brandCard("Financial intelligence", `${financialIntelligence.count} deterministic decision-support formulas are available as a supplemental catalog; they cannot move money, post accounting entries, trade, or approve credit.`),
        ...Object.entries(groups).map(([group, definitions]) => `<article class="card"><h2>${escapeHtml(formatLabel(group))}</h2><ul>${definitions.map((definition) => `<li><a href="/formulas/${escapeHtml(definition.formulaKey)}">${escapeHtml(definition.publicLabel)}</a></li>`).join("")}</ul></article>`)
      ],
      actions: [
        linkAction("/api/formulas/readiness", "Readiness JSON"),
        linkAction("/api/formulas/definitions", "Definitions JSON"),
        linkAction("/dashboard", "Dashboard")
      ]
    }));
  });

    // Public readiness describes the required formula-table contract without
  // contacting production Supabase. Live bounded probes remain admin-only.
  app.get("/api/formulas/readiness", (req, res) => {
    return res.status(200).json(getStaticFormulaReadiness());
  });

  app.get("/api/formulas/definitions", (req, res) => {
    return res.status(200).json({
      ok: true,
      count: listFormulaDefinitions().length,
      formulas: listFormulaDefinitions(),
      supplementalFinancialIntelligence: getFinancialIntelligenceFormulaCatalog()
    });
  });

  // One formula, worked out on the page. Public, like /formulas and the
  // evaluate endpoint it posts to: nothing here reads or writes a business's
  // records until the person chooses to save.
  app.get("/formulas/:formulaKey", (req, res) => {
    const definition = pages.definitionFor(req.params.formulaKey);
    if (!definition) return res.status(404).type("html").send(unknownFormulaPage());
    return res.status(200).type("html").send(calculatorPage(definition, {}, null));
  });

  // The saved results for one formula, for the signed-in person's business.
  // Gated on the workspace the formula belongs to, as saving one is.
  app.get("/formulas/:formulaKey/results", (req, res, next) => {
    const definition = pages.definitionFor(req.params.formulaKey);
    if (!definition) return res.status(404).type("html").send(unknownFormulaPage());
    return requireWorkspaceAccess(productAreaToWorkspace(definition.productArea))(req, res, next);
  }, async (req, res) => {
    if (!req.sonaraUser?.id) return res.status(403).json({
      ok: false, code: "workspace_identity_missing",
      message: "Sign in to view private formula results."
    });
    const definition = pages.definitionFor(req.params.formulaKey);
    const outcome = await readSavedResults(definition, req);
    const saved = req.query?.saved === "1" ? brandCard("Saved", "The answer and the figures it came from are kept with your business.") : "";
    return res.status(200).type("html").send(layout({
      title: `${definition.publicLabel} results`,
      eyebrow: "Formula Library",
      heading: `${definition.publicLabel}: saved results`,
      body: `Each row is an answer worked out from the figures beside it, as ${definition.expressionText}.`,
      sections: [saved, pages.savedResultsCard(definition, outcome, escapeHtml)].filter(Boolean),
      actions: [linkAction(`/formulas/${definition.formulaKey}`, "Work out another"), linkAction("/formulas", "All formulas")]
    }));
  });

  app.post("/api/formulas/evaluate", (req, res) => {
    const formulaKey = req.body?.formulaKey || req.body?.formula_key;
    if (wantsHtml(req)) {
      const definition = pages.definitionFor(formulaKey);
      if (!definition) return res.status(404).type("html").send(unknownFormulaPage());
      const values = pages.valuesFromForm(definition, req.body);
      const result = evaluateFormula(definition.formulaKey, values);
      return res.status(result.ok ? 200 : 400).type("html").send(calculatorPage(definition, values, result));
    }
    const result = evaluateFormula(formulaKey, req.body?.inputValues || req.body?.input_values || req.body || {});
    return res.status(result.ok ? 200 : 400).json(result);
  });

  app.post("/api/formulas/results", selectFormulaWorkspace(requireWorkspaceAccess), async (req, res) => {
    const formulaKey = req.body?.formulaKey || req.body?.formula_key;
    const definition = pages.definitionFor(formulaKey);
    const html = wantsHtml(req) && definition;
    const inputValues = html ? pages.valuesFromForm(definition, req.body) : (req.body?.inputValues || req.body?.input_values || {});
    const evaluated = evaluateFormula(formulaKey, inputValues);
    if (!evaluated.ok) {
      return html ? res.status(400).type("html").send(calculatorPage(definition, inputValues, evaluated)) : res.status(400).json(evaluated);
    }
    const saved = await saveFormulaResult({
      evaluated,
      req,
      getSupabaseServerConfig,
      getCustomerPrimaryOrganization,
      supabaseHeaders,
      insertActivityEvent
    });
    if (html) {
      if (saved.ok) return res.redirect(303, `/formulas/${definition.formulaKey}/results?saved=1`);
      return res.status(saved.status || 503).type("html").send(layout({
        title: "Not saved",
        eyebrow: "Formula Library",
        heading: "Not saved",
        body: SAVE_REFUSALS[saved.code] || SAVE_REFUSALS.database_unavailable,
        sections: [pages.resultCard(definition, evaluated, escapeHtml)],
        actions: [linkAction(`/formulas/${definition.formulaKey}`, "Back")]
      }));
    }
    return res.status(saved.status || (saved.ok ? 200 : 503)).json(saved);
  });

  function calculatorPage(definition, values, result) {
    const sections = [];
    if (result?.ok) sections.push(pages.resultCard(definition, result, escapeHtml));
    else if (result) sections.push(pages.refusalCard(result, escapeHtml));
    sections.push(pages.calculatorCard(definition, values, escapeHtml));
    return layout({
      title: definition.publicLabel,
      eyebrow: `Formula Library / ${formatLabel(definition.groupKey)}`,
      heading: definition.publicLabel,
      body: `Worked out as ${definition.expressionText}. Nothing is saved unless you choose to save it.`,
      sections,
      actions: [linkAction(`/formulas/${definition.formulaKey}/results`, "Saved results"), linkAction("/formulas", "All formulas")]
    });
  }

  function unknownFormulaPage() {
    return layout({
      title: "Formula not found",
      eyebrow: "Formula Library",
      heading: "Formula not found",
      body: "There is no formula by that name.",
      sections: [],
      actions: [linkAction("/formulas", "All formulas")]
    });
  }

  async function readSavedResults(definition, req) {
    if (!req.sonaraUser?.id) return { ok: false, rows: [] };
    if (!getSupabaseServerConfig || !supabaseHeaders || !getCustomerPrimaryOrganization) return { ok: false, rows: [] };
    const config = getSupabaseServerConfig();
    if (!config.ok) return { ok: false, rows: [] };
    const organization = await getCustomerPrimaryOrganization(req.sonaraUser);
    if (!organization.ok) return { ok: false, rows: [] };
    const url = `${config.url}/rest/v1/sonara_formula_results?select=created_at,input_values,result_value,result_unit&organization_id=eq.${encodeURIComponent(organization.organizationId)}&formula_key=eq.${encodeURIComponent(definition.formulaKey)}&order=created_at.desc&limit=${SAVED_RESULTS_SHOWN + 1}`;
    const response = await fetch(url, { headers: supabaseHeaders(config) }).catch(() => undefined);
    if (!response?.ok) return { ok: false, rows: [] };
    const rows = await response.json().catch(() => null);
    if (!Array.isArray(rows)) return { ok: false, rows: [] };
    return { ok: true, rows: rows.slice(0, SAVED_RESULTS_SHOWN), truncated: rows.length > SAVED_RESULTS_SHOWN };
  }
};

const SAVE_REFUSALS = {
  setup_required: "Saving is not set up for this site yet, so nothing was kept.",
  workspace_guard_not_configured: "Saving is unavailable because a signed-in workspace was not verified. Nothing was kept.",
  formula_not_in_database: "This formula is not yet recorded in the database, so a result for it cannot be kept. Nothing was saved.",
  database_unavailable: "The records could not be reached, so nothing was kept. Try again shortly."
};

function wantsHtml(req) {
  const accept = String(req.headers?.accept || "");
  return accept.includes("text/html") && !/^application\/json/.test(accept);
}

function selectFormulaWorkspace(requireWorkspaceAccess) {
  return (req, res, next) => {
    const definition = getFormulaDefinition(req.body?.formulaKey || req.body?.formula_key);
    const workspace = productAreaToWorkspace(definition?.productArea || "Business Builder");
    return requireWorkspaceAccess(workspace)(req, res, next);
  };
}

function getStaticFormulaReadiness() {
  return {
    ok: true,
    mode: "static",
    tables: FORMULA_TABLES.map((table) => ({ table, ok: false, status: "setup_required", count: null })),
    formulaCount: listFormulaDefinitions().length
  };
}

async function saveFormulaResult({ evaluated, req, getSupabaseServerConfig, getCustomerPrimaryOrganization, supabaseHeaders, insertActivityEvent }) {
  if (!req.sonaraUser?.id) return { ok: false, code: "workspace_guard_not_configured", status: 403 };
  if (!getSupabaseServerConfig || !supabaseHeaders) return { ok: false, code: "setup_required", service: "supabase" };
  const config = getSupabaseServerConfig();
  if (!config.ok) return { ok: false, code: "setup_required", service: "supabase" };
  if (!getCustomerPrimaryOrganization) return { ok: false, code: "setup_required", service: "organization" };
  const organization = await getCustomerPrimaryOrganization(req.sonaraUser);
  if (!organization.ok) return { ok: false, code: "setup_required", service: "customer_organization", reason: organization.code };
  const record = {
    formula_key: evaluated.formulaKey,
    organization_id: organization.organizationId,
    user_id: req.sonaraUser?.id || null,
    source_table: normalizeSourceTable(req.body?.sourceTable || req.body?.source_table),
    source_record_id: normalizeUuid(req.body?.sourceRecordId || req.body?.source_record_id),
    input_values: evaluated.inputValues,
    result_value: evaluated.resultValue,
    result_unit: evaluated.resultUnit,
    result_payload: {
      publicLabel: evaluated.publicLabel,
      expressionText: evaluated.expressionText
    },
    status: "computed"
  };
  const response = await fetch(`${config.url}/rest/v1/sonara_formula_results`, {
    method: "POST",
    headers: supabaseHeaders(config, { prefer: "return=representation" }),
    body: JSON.stringify(record)
  }).catch(() => undefined);
  if (!response?.ok) return { ok: false, ...saveFailure(response, await response?.json().catch(() => null)) };
  const rows = await response.json().catch(() => []);
  await insertActivityEvent(organization.organizationId, req.sonaraUser?.id, "sonara.formula_result_saved", { formula_key: evaluated.formulaKey, formula_result_id: rows[0]?.id || null });
  return { ok: true, saved: true, code: "saved", formulaKey: evaluated.formulaKey, result: rows[0] || record };
}

// What a refused insert means. Every failure used to read "setup_required",
// including the foreign-key refusal for a formula with no definition row --
// which told the owner to finish a setup that was already finished, while the
// actual cause was a seed missing from the migrations.
function saveFailure(response, body) {
  if (!response) return { code: "database_unavailable", service: "sonara_formula_results", status: 503 };
  if (body?.code === "23503") return { code: "formula_not_in_database", service: "sonara_formula_definitions", status: 409 };
  if (response.status === 404 || body?.code === "PGRST205" || body?.code === "42P01") return { code: "setup_required", service: "sonara_formula_results", status: 503 };
  return { code: "database_unavailable", service: "sonara_formula_results", status: 503 };
}

function normalizeSourceTable(value) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, 120) : "manual_formula_input";
}

function normalizeUuid(value) {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleaned) ? cleaned : null;
}

function groupDefinitions(definitions) {
  return definitions.reduce((groups, definition) => {
    groups[definition.groupKey] = groups[definition.groupKey] || [];
    groups[definition.groupKey].push(definition);
    return groups;
  }, {});
}

function formatLabel(value) {
  return FORMULA_GROUP_LABELS[value] || String(value || "").replace(/[_-]/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function esc(value) { return String(value || "").replace(/[&<>\"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[char])); }
function card(title, body) { return `<article class="card"><h2>${esc(title)}</h2><p>${esc(body)}</p></article>`; }
function link(href, label) { return `<a class="action" href="${esc(href)}">${esc(label)}</a>`; }
function basicLayout(data) { return `<!doctype html><html><head><title>${esc(data.title)}</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main><p>${esc(data.eyebrow)}</p><h1>${esc(data.heading)}</h1><p>${esc(data.body)}</p><nav>${(data.actions || []).join("")}</nav><section>${(data.sections || []).join("")}</section></main></body></html>`; }
