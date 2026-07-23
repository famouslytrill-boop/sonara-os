"use strict";

const fs = require("node:fs");
const path = require("node:path");

const DATABASE_MANAGEMENT_RPC = "sonara_database_management_snapshot";
const DATABASE_MANAGEMENT_MIGRATION = "20260723033000_database_management_catalog.sql";
const MAX_RENDERED_ROWS = 250;

const SECTION_DEFINITIONS = Object.freeze([
  { key: "schema-visualizer", label: "Schema Visualizer", snapshotKey: "schemaGraph", type: "graph" },
  { key: "tables", label: "Tables", snapshotKey: "tables", type: "list" },
  { key: "functions", label: "Functions", snapshotKey: "functions", type: "list" },
  { key: "triggers", label: "Triggers", snapshotKey: "triggers", type: "list" },
  { key: "enumerated-types", label: "Enumerated Types", snapshotKey: "enumTypes", type: "list" },
  { key: "extensions", label: "Extensions", snapshotKey: "extensions", type: "list" },
  { key: "indexes", label: "Indexes", snapshotKey: "indexes", type: "list" },
  { key: "publications", label: "Publications", snapshotKey: "publications", type: "list" },
  { key: "access-control", label: "Access Control", snapshotKey: "accessControl", type: "object" },
  { key: "policies", label: "Policies", snapshotKey: "policies", type: "list" },
  { key: "roles", label: "Roles", snapshotKey: "roles", type: "list" },
  { key: "configuration", label: "Configuration", snapshotKey: "configuration", type: "object" },
  { key: "settings", label: "Settings", snapshotKey: "settings", type: "list" },
  { key: "platform", label: "Platform", snapshotKey: "platform", type: "object" },
  { key: "replication", label: "Replication", snapshotKey: "replication", type: "object" },
  { key: "backups", label: "Backups", snapshotKey: "backups", type: "object" },
  { key: "migrations", label: "Migrations", snapshotKey: "migrations", type: "object" }
]);

module.exports = function registerSonaraDatabaseManagementRoutes(app, deps = {}) {
  const layout = deps.layout || basicLayout;
  const brandCard = deps.brandCard || card;
  const linkAction = deps.linkAction || link;
  const escapeHtml = deps.escapeHtml || esc;
  const requireAdmin = typeof deps.requireAdmin === "function" ? deps.requireAdmin : pass;
  const recordAdminAuditEvent = typeof deps.recordAdminAuditEvent === "function"
    ? deps.recordAdminAuditEvent
    : async () => undefined;
  const getSupabaseServerConfig = typeof deps.getSupabaseServerConfig === "function"
    ? deps.getSupabaseServerConfig
    : () => ({ ok: false });
  const supabaseHeaders = typeof deps.supabaseHeaders === "function"
    ? deps.supabaseHeaders
    : defaultSupabaseHeaders;

  const getSnapshot = async () => {
    const config = getSupabaseServerConfig();
    if (!config?.ok) {
      return {
        ok: false,
        status: 503,
        code: "supabase_setup_required",
        message: "The production Supabase service-role connection is not configured."
      };
    }

    const response = await fetch(`${config.url}/rest/v1/rpc/${DATABASE_MANAGEMENT_RPC}`, {
      method: "POST",
      headers: supabaseHeaders(config, { prefer: "return=representation" }),
      body: "{}"
    }).catch(() => undefined);

    if (!response) {
      return {
        ok: false,
        status: 503,
        code: "database_catalog_unreachable",
        message: "The database metadata catalog could not be reached."
      };
    }

    if (!response.ok) {
      const errorBody = await readJson(response);
      const missingFunction = [404, 406].includes(response.status)
        || String(errorBody?.code || "").includes("PGRST202")
        || String(errorBody?.message || "").toLowerCase().includes(DATABASE_MANAGEMENT_RPC);
      return {
        ok: false,
        status: missingFunction ? 503 : 502,
        code: missingFunction ? "database_catalog_migration_required" : "database_catalog_failed",
        message: missingFunction
          ? `Apply ${DATABASE_MANAGEMENT_MIGRATION} before using Database Management.`
          : "The database metadata catalog returned an error.",
        providerStatus: response.status
      };
    }

    const snapshot = await readJson(response);
    if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
      return {
        ok: false,
        status: 502,
        code: "database_catalog_invalid",
        message: "The database metadata catalog returned an invalid response."
      };
    }

    return {
      ok: true,
      status: 200,
      snapshot: reconcileMigrations(snapshot)
    };
  };

  app.get("/api/admin/database-management", requireAdmin, async (req, res) => {
    const result = await getSnapshot();
    const section = normalizeSection(req.query.section);

    await recordAdminAuditEvent(req, "admin.database_management.api", {
      path: req.path,
      section: section || "all",
      ok: result.ok
    });

    if (!result.ok) {
      return res.status(result.status).json({
        ok: false,
        code: result.code,
        message: result.message,
        migration: DATABASE_MANAGEMENT_MIGRATION
      });
    }

    if (!section) {
      return res.status(200).json({
        ok: true,
        status: "live_read_only",
        generatedAt: result.snapshot.generatedAt || null,
        sections: SECTION_DEFINITIONS.map(({ key, label }) => ({ key, label })),
        snapshot: result.snapshot
      });
    }

    const definition = SECTION_DEFINITIONS.find((item) => item.key === section);
    return res.status(200).json({
      ok: true,
      status: "live_read_only",
      generatedAt: result.snapshot.generatedAt || null,
      section: { key: definition.key, label: definition.label },
      data: result.snapshot[definition.snapshotKey] ?? emptyFor(definition.type)
    });
  });

  app.get("/admin/database-management", requireAdmin, async (req, res) => {
    const result = await getSnapshot();
    const requestedSection = normalizeSection(req.query.section);
    const activeSection = requestedSection || "schema-visualizer";

    await recordAdminAuditEvent(req, "admin.database_management.dashboard", {
      path: req.path,
      section: activeSection,
      ok: result.ok
    });

    if (!result.ok) {
      return res.status(result.status).type("html").send(layout({
        title: "Database Management",
        eyebrow: "Founder operations",
        heading: "Database Management needs setup",
        body: result.message,
        sections: [
          brandCard("Required migration", DATABASE_MANAGEMENT_MIGRATION),
          brandCard("Safety boundary", "The web application exposes no arbitrary SQL editor, secret values, destructive schema controls, or backup deletion controls.")
        ],
        actions: [
          linkAction("/admin", "Founder operations"),
          linkAction("/admin/deployments", "Deployments")
        ]
      }));
    }

    const snapshot = result.snapshot;
    const definition = SECTION_DEFINITIONS.find((item) => item.key === activeSection);
    const nav = renderSectionNavigation(activeSection, escapeHtml);
    const summary = renderSummary(snapshot, brandCard);
    const sectionHtml = renderSection(definition, snapshot[definition.snapshotKey], escapeHtml);

    return res.status(200).type("html").send(layout({
      title: `Database Management · ${definition.label}`,
      eyebrow: "Founder operations",
      heading: "Database Management",
      body: "Live, read-only PostgreSQL and Supabase metadata. Every section is generated from the connected production database catalog; unavailable provider-managed capabilities remain explicitly marked for verification.",
      sections: [
        nav,
        summary,
        sectionHtml,
        brandCard("Safety boundary", "This console is intentionally read-only. Schema changes, SQL execution, role mutation, backup deletion, and replication changes remain restricted to approved deployment and provider workflows.")
      ],
      actions: [
        linkAction("/api/admin/database-management", "Database JSON"),
        linkAction("/admin/reference-intelligence", "Reference Intelligence"),
        linkAction("/admin", "Founder operations")
      ]
    }));
  });

  app.get("/admin/database", requireAdmin, (req, res) => {
    const section = normalizeSection(req.query.section);
    const destination = section
      ? `/admin/database-management?section=${encodeURIComponent(section)}`
      : "/admin/database-management";
    return res.redirect(302, destination);
  });

  app.get("/admin/migrations", requireAdmin, (req, res) => {
    return res.redirect(302, "/admin/database-management?section=migrations");
  });
};

function normalizeSection(value) {
  const key = String(value || "").trim().toLowerCase();
  if (!key) return null;
  return SECTION_DEFINITIONS.some((item) => item.key === key) ? key : null;
}

function reconcileMigrations(snapshot) {
  const local = listLocalMigrationFiles();
  const applied = Array.isArray(snapshot?.migrations?.applied) ? snapshot.migrations.applied : [];
  const appliedVersions = new Set(applied.map((row) => String(row.version || "")));
  const localVersions = new Set(local.map((row) => row.version));

  snapshot.migrations = {
    ...(snapshot.migrations || {}),
    applied,
    local,
    pending: local.filter((row) => !appliedVersions.has(row.version)),
    remoteOnly: applied.filter((row) => !localVersions.has(String(row.version || ""))),
    synchronized: local.every((row) => appliedVersions.has(row.version))
  };

  return snapshot;
}

function listLocalMigrationFiles() {
  const directory = path.join(__dirname, "..", "supabase", "migrations");
  try {
    return fs.readdirSync(directory)
      .filter((name) => /^\d+_.+\.sql$/.test(name))
      .sort()
      .map((name) => ({
        version: name.split("_", 1)[0],
        name,
        path: `supabase/migrations/${name}`
      }));
  } catch {
    return [];
  }
}

function renderSectionNavigation(activeSection, escapeHtml) {
  const links = SECTION_DEFINITIONS.map((item) => {
    const current = item.key === activeSection ? ' aria-current="page"' : "";
    return `<a class="action" href="/admin/database-management?section=${encodeURIComponent(item.key)}"${current}>${escapeHtml(item.label)}</a>`;
  }).join("");

  return `<section class="card" aria-label="Database management sections"><h2>Management sections</h2><div class="card-actions">${links}</div></section>`;
}

function renderSummary(snapshot, brandCard) {
  const counts = {
    schemas: lengthOf(snapshot.schemas),
    tables: lengthOf(snapshot.tables),
    functions: lengthOf(snapshot.functions),
    triggers: lengthOf(snapshot.triggers),
    indexes: lengthOf(snapshot.indexes),
    policies: lengthOf(snapshot.policies),
    migrations: lengthOf(snapshot?.migrations?.applied),
    pendingMigrations: lengthOf(snapshot?.migrations?.pending)
  };

  const state = snapshot?.migrations?.synchronized ? "synchronized" : "review required";
  return `<section class="nexus-product-grid" aria-label="Database summary">
    ${brandCard("Schemas", String(counts.schemas))}
    ${brandCard("Tables and views", String(counts.tables))}
    ${brandCard("Functions", String(counts.functions))}
    ${brandCard("Triggers", String(counts.triggers))}
    ${brandCard("Indexes", String(counts.indexes))}
    ${brandCard("RLS policies", String(counts.policies))}
    ${brandCard("Applied migrations", String(counts.migrations))}
    ${brandCard("Migration state", `${state}; pending local migrations: ${counts.pendingMigrations}`)}
  </section>`;
}

function renderSection(definition, data, escapeHtml) {
  if (definition.type === "graph") return renderGraph(data, escapeHtml);
  if (definition.type === "list") return renderList(definition.label, data, escapeHtml);
  return renderObject(definition.label, data, escapeHtml);
}

function renderGraph(graph, escapeHtml) {
  const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
  const edges = Array.isArray(graph?.edges) ? graph.edges : [];
  const edgeMap = new Map();
  for (const edge of edges) {
    const key = `${edge.sourceSchema}.${edge.sourceTable}`;
    const list = edgeMap.get(key) || [];
    list.push(edge);
    edgeMap.set(key, list);
  }

  const rendered = nodes.slice(0, MAX_RENDERED_ROWS).map((node) => {
    const key = `${node.schema}.${node.name}`;
    const outgoing = edgeMap.get(key) || [];
    const relationships = outgoing.length
      ? `<ul>${outgoing.map((edge) => `<li>${escapeHtml(edge.sourceColumns?.join(", ") || "")} → ${escapeHtml(`${edge.targetSchema}.${edge.targetTable}`)} (${escapeHtml(edge.targetColumns?.join(", ") || "")})</li>`).join("")}</ul>`
      : "<p>No outbound foreign keys.</p>";
    return `<article class="card"><h3>${escapeHtml(key)}</h3><p>${escapeHtml(node.kind || "table")} · columns: ${escapeHtml(String(node.columnCount || 0))} · RLS: ${escapeHtml(node.rlsEnabled ? "enabled" : "disabled")}</p>${relationships}</article>`;
  }).join("");

  const note = nodes.length > MAX_RENDERED_ROWS
    ? `<p>Showing ${MAX_RENDERED_ROWS} of ${nodes.length} nodes. Use the JSON endpoint for the complete graph.</p>`
    : `<p>${nodes.length} nodes and ${edges.length} foreign-key relationships.</p>`;

  return `<section aria-labelledby="database-schema-graph"><h2 id="database-schema-graph">Schema Visualizer</h2>${note}<div class="nexus-product-grid">${rendered || "<p>No schema graph nodes returned.</p>"}</div></section>`;
}

function renderList(label, rows, escapeHtml) {
  const list = Array.isArray(rows) ? rows : [];
  const rendered = list.slice(0, MAX_RENDERED_ROWS).map((row) => {
    const title = recordTitle(row);
    return `<details class="card"><summary>${escapeHtml(title)}</summary><dl>${renderKeyValues(row, escapeHtml)}</dl></details>`;
  }).join("");
  const note = list.length > MAX_RENDERED_ROWS
    ? `<p>Showing ${MAX_RENDERED_ROWS} of ${list.length} records. Use the JSON endpoint for the complete result.</p>`
    : `<p>${list.length} records returned.</p>`;
  return `<section><h2>${escapeHtml(label)}</h2>${note}<div class="nexus-product-grid">${rendered || "<p>No records returned.</p>"}</div></section>`;
}

function renderObject(label, value, escapeHtml) {
  const object = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const rendered = Object.entries(object).map(([key, item]) => {
    if (Array.isArray(item)) {
      return `<details class="card"><summary>${escapeHtml(displayKey(key))} (${item.length})</summary>${renderList(displayKey(key), item, escapeHtml)}</details>`;
    }
    if (item && typeof item === "object") {
      return `<details class="card"><summary>${escapeHtml(displayKey(key))}</summary><dl>${renderKeyValues(item, escapeHtml)}</dl></details>`;
    }
    return `<article class="card"><h3>${escapeHtml(displayKey(key))}</h3><p>${escapeHtml(formatValue(item))}</p></article>`;
  }).join("");
  return `<section><h2>${escapeHtml(label)}</h2><div class="nexus-product-grid">${rendered || "<p>No metadata returned.</p>"}</div></section>`;
}

function renderKeyValues(record, escapeHtml) {
  return Object.entries(record || {}).map(([key, value]) => {
    const rendered = value && typeof value === "object"
      ? JSON.stringify(value)
      : formatValue(value);
    return `<div><dt>${escapeHtml(displayKey(key))}</dt><dd>${escapeHtml(rendered)}</dd></div>`;
  }).join("");
}

function recordTitle(record) {
  return [
    record?.schema && record?.name ? `${record.schema}.${record.name}` : null,
    record?.tableSchema && record?.tableName ? `${record.tableSchema}.${record.tableName}` : null,
    record?.schema && record?.table ? `${record.schema}.${record.table}` : null,
    record?.name,
    record?.role,
    record?.version
  ].find(Boolean) || "Database record";
}

function displayKey(value) {
  return String(value || "").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatValue(value) {
  if (value === null || value === undefined || value === "") return "not returned";
  if (typeof value === "boolean") return value ? "yes" : "no";
  return String(value);
}

function lengthOf(value) {
  return Array.isArray(value) ? value.length : 0;
}

function emptyFor(type) {
  return type === "list" ? [] : {};
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function defaultSupabaseHeaders(config, extra = {}) {
  return {
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${config.serviceRoleKey}`,
    "Content-Type": "application/json",
    ...extra
  };
}

function pass(req, res, next) { next(); }
function esc(value) { return String(value || "").replace(/[&<>\"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[char])); }
function card(title, body) { return `<article class="card"><h2>${esc(title)}</h2><p>${esc(body)}</p></article>`; }
function link(href, label) { return `<a class="action" href="${esc(href)}">${esc(label)}</a>`; }
function basicLayout(data) { return `<!doctype html><html><head><title>${esc(data.title)}</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main><p>${esc(data.eyebrow)}</p><h1>${esc(data.heading)}</h1><p>${esc(data.body)}</p><nav>${(data.actions || []).join("")}</nav><section>${(data.sections || []).join("")}</section></main></body></html>`; }

module.exports.SECTION_DEFINITIONS = SECTION_DEFINITIONS;
module.exports.DATABASE_MANAGEMENT_RPC = DATABASE_MANAGEMENT_RPC;
module.exports.DATABASE_MANAGEMENT_MIGRATION = DATABASE_MANAGEMENT_MIGRATION;
