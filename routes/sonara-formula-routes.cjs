"use strict";

const {
  FORMULA_TABLES,
  evaluateFormula,
  getFormulaDefinition,
  listFormulaDefinitions,
  productAreaToWorkspace
} = require("../lib/sonara-formula-library.cjs");

const FORMULA_GROUP_LABELS = {
  business_revenue: "Business and revenue",
  restaurant_margin: "Restaurant and service margin",
  employee_payroll: "Employee payroll",
  inventory_operations: "Inventory and operations",
  growth_marketing: "Growth and marketing",
  creator_music: "Creator music and release",
  ui_device_experience: "Device and interface experience",
  operating_twin: "Operating twin and decision support"
};

module.exports = function registerSonaraFormulaRoutes(app, deps = {}) {
  const layout = deps.layout || basicLayout;
  const brandCard = deps.brandCard || card;
  const linkAction = deps.linkAction || link;
  const requireAdmin = typeof deps.requireAdmin === "function" ? deps.requireAdmin : pass;
  const requireWorkspaceAccess = typeof deps.requireWorkspaceAccess === "function" ? deps.requireWorkspaceAccess : () => pass;
  const safeListTable = typeof deps.safeListTable === "function" ? deps.safeListTable : undefined;
  const getSupabaseServerConfig = typeof deps.getSupabaseServerConfig === "function" ? deps.getSupabaseServerConfig : undefined;
  const getCustomerPrimaryOrganization = typeof deps.getCustomerPrimaryOrganization === "function" ? deps.getCustomerPrimaryOrganization : undefined;
  const supabaseHeaders = typeof deps.supabaseHeaders === "function" ? deps.supabaseHeaders : undefined;
  const insertActivityEvent = typeof deps.insertActivityEvent === "function" ? deps.insertActivityEvent : async () => ({ ok: false });

  app.get("/formulas", (req, res) => {
    const groups = groupDefinitions(listFormulaDefinitions());
    return res.status(200).type("html").send(layout({
      title: "Formula Library",
      eyebrow: "SONARA formulas",
      heading: "Formula Library",
      body: "Business, creator, growth, device, and operating-twin formulas that produce real saved results when database setup is complete.",
      sections: Object.entries(groups).map(([group, definitions]) => brandCard(formatLabel(group), definitions.map((definition) => definition.publicLabel).join(" / "))),
      actions: [
        linkAction("/api/formulas/readiness", "Readiness JSON"),
        linkAction("/api/formulas/definitions", "Definitions JSON"),
        linkAction("/dashboard", "Dashboard")
      ]
    }));
  });

  app.get("/admin/formulas", requireAdmin, async (req, res) => {
    const readiness = await getFormulaReadiness(safeListTable);
    const definitions = listFormulaDefinitions();
    const statusText = readiness.tables.map((item) => `${item.table}: ${item.ok ? "ready" : "setup required"}`).join(" / ");
    return res.status(200).type("html").send(layout({
      title: "Formula control plane",
      eyebrow: "Founder operations",
      heading: "Formula control plane",
      body: "Admin visualizer for formula tables, runtime evaluator, templates, and saved formula results.",
      sections: [
        brandCard("Formula tables", statusText),
        brandCard("Runtime evaluator", `${definitions.length} allowlisted formulas are registered. Formula strings are not executed with eval.`),
        brandCard("Write API", "POST /api/formulas/results stores evaluated formula results after workspace access and Supabase setup are ready."),
        ...definitions.slice(0, 12).map((definition) => brandCard(definition.publicLabel, `${definition.formulaKey} -> ${definition.expressionText}`))
      ],
      actions: [
        linkAction("/admin", "Admin"),
        linkAction("/api/formulas/readiness", "Readiness JSON"),
        linkAction("/api/formulas/definitions", "Definitions JSON")
      ]
    }));
  });

  app.get("/api/formulas/readiness", async (req, res) => {
    return res.status(200).json(await getFormulaReadiness(safeListTable));
  });

  app.get("/api/formulas/definitions", (req, res) => {
    return res.status(200).json({ ok: true, count: listFormulaDefinitions().length, formulas: listFormulaDefinitions() });
  });

  app.post("/api/formulas/evaluate", (req, res) => {
    const result = evaluateFormula(req.body?.formulaKey || req.body?.formula_key, req.body?.inputValues || req.body?.input_values || req.body || {});
    return res.status(result.ok ? 200 : 400).json(result);
  });

  app.post("/api/formulas/results", selectFormulaWorkspace(requireWorkspaceAccess), async (req, res) => {
    const formulaKey = req.body?.formulaKey || req.body?.formula_key;
    const inputValues = req.body?.inputValues || req.body?.input_values || {};
    const evaluated = evaluateFormula(formulaKey, inputValues);
    if (!evaluated.ok) return res.status(400).json(evaluated);
    const saved = await saveFormulaResult({
      evaluated,
      req,
      getSupabaseServerConfig,
      getCustomerPrimaryOrganization,
      supabaseHeaders,
      insertActivityEvent
    });
    return res.status(saved.ok ? 200 : 503).json(saved);
  });
};

function selectFormulaWorkspace(requireWorkspaceAccess) {
  return (req, res, next) => {
    const definition = getFormulaDefinition(req.body?.formulaKey || req.body?.formula_key);
    const workspace = productAreaToWorkspace(definition?.productArea || "Business Builder");
    return requireWorkspaceAccess(workspace)(req, res, next);
  };
}

async function getFormulaReadiness(safeListTable) {
  if (!safeListTable) {
    return {
      ok: true,
      mode: "static",
      tables: FORMULA_TABLES.map((table) => ({ table, ok: false, status: "setup_required" })),
      formulaCount: listFormulaDefinitions().length
    };
  }
  const tables = await Promise.all(FORMULA_TABLES.map(async (table) => {
    const result = await safeListTable(table, "?select=id&limit=1");
    return { table, ok: Boolean(result.ok), status: result.ok ? "ready" : "setup_required", count: Array.isArray(result.rows) ? result.rows.length : null };
  }));
  return { ok: true, tables, formulaCount: listFormulaDefinitions().length };
}

async function saveFormulaResult({ evaluated, req, getSupabaseServerConfig, getCustomerPrimaryOrganization, supabaseHeaders, insertActivityEvent }) {
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
    source_table: String(req.body?.sourceTable || req.body?.source_table || "manual_formula_input").slice(0, 120),
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
  if (!response?.ok) return { ok: false, code: "setup_required", service: "sonara_formula_results", status: response?.status || "unavailable" };
  const rows = await response.json().catch(() => []);
  await insertActivityEvent(organization.organizationId, req.sonaraUser?.id, "sonara.formula_result_saved", { formula_key: evaluated.formulaKey, formula_result_id: rows[0]?.id || null });
  return { ok: true, saved: true, code: "saved", formulaKey: evaluated.formulaKey, result: rows[0] || record };
}

function normalizeUuid(value) {
  const cleaned = String(value || "").trim();
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

function pass(req, res, next) { next(); }
function esc(value) { return String(value || "").replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[char])); }
function card(title, body) { return `<article class="card"><h2>${esc(title)}</h2><p>${esc(body)}</p></article>`; }
function link(href, label) { return `<a class="action" href="${esc(href)}">${esc(label)}</a>`; }
function basicLayout(data) { return `<!doctype html><html><head><title>${esc(data.title)}</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main><p>${esc(data.eyebrow)}</p><h1>${esc(data.heading)}</h1><p>${esc(data.body)}</p><nav>${(data.actions || []).join("")}</nav><section>${(data.sections || []).join("")}</section></main></body></html>`; }
