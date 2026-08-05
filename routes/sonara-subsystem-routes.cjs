"use strict";

// /research-lab/subsystems -- the five subsystems that exist as schema only.
//
// Fifty-one tables were created with row level security and indexes, and no
// code ever read or wrote one of them. That is not a stray table here and there;
// it is five designed subsystems with nothing behind them, and until now the
// only way to know they existed was to read the migrations.
//
// These pages read. There is no create, edit or delete anywhere in this file,
// and that is the point rather than a first increment. The data model for these
// subsystems was decided; the behaviour was not. A page offering to create a
// repository review would be inventing the review process, and a page offering
// to start an agent run would break the guarantee that
// scripts/verify-supabase-contract.mjs asserts on every release -- that the
// agent foundation stays schema-only with autonomous execution disabled. That
// gate covers seven of the eleven agent tables; the page names the other four
// rather than implying the promise stretches to them.
//
// Operator surface, so it sits under /research-lab, which
// lib/sonara-plain-language.cjs exempts from the customer-vocabulary rules.
// It is admin-gated: these tables cross every organization, so there is no
// tenant filter that would make them safe for a customer to open.

const {
  SUBSYSTEMS,
  cellText,
  columnLabel,
  displayColumns,
  selectFor
} = require("../lib/sonara-subsystem-registry.cjs");

module.exports = function registerSonaraSubsystemRoutes(app, deps = {}) {
  const layout = deps.layout || basicLayout;
  const brandCard = deps.brandCard || card;
  const linkAction = deps.linkAction || link;
  const escape = deps.escapeHtml || esc;
  const requireAdmin = deps.requireAdmin || ((req, res, next) => next());
  const getConfig = deps.getSupabaseServerConfig || (() => ({ ok: false }));
  const headers = deps.supabaseHeaders || (() => ({}));

  app.get("/research-lab/subsystems", requireAdmin, (req, res) => {
    const sections = [
      brandCard(
        "What these are",
        `${SUBSYSTEMS.reduce((total, subsystem) => total + subsystem.tables.length, 0)} tables across ${SUBSYSTEMS.length} subsystems were created with row level security and indexes, and nothing in the application has ever read or written one of them. They are listed here so the design is visible rather than buried in migration files.`
      ),
      brandCard(
        "Nothing here can be changed from these pages",
        "Every page under this one reads. The data model for these subsystems was decided and the behaviour was not, so offering a form would be inventing the process rather than exposing it. Nothing in this product executes agents, and most of the agent tables are gated schema-only on every release -- the agent page names the four that gate does not cover."
      ),
      ...SUBSYSTEMS.map((subsystem) => brandCard(
        `${subsystem.title} — ${subsystem.tables.length} tables`,
        `${subsystem.body} ${subsystem.status}`
      ))
    ];

    return res.status(200).type("html").send(layout({
      title: "Subsystems with no code",
      eyebrow: "Research Lab",
      heading: "Subsystems that exist as schema only",
      body: "Five designed subsystems whose tables have never been read or written by the application. What each one is, and what is actually in it.",
      sections,
      actions: [
        ...SUBSYSTEMS.map((subsystem) => linkAction(`/research-lab/subsystems/${subsystem.slug}`, subsystem.title)),
        linkAction("/research-lab/open-source", "Open-source register")
      ]
    }));
  });

  for (const subsystem of SUBSYSTEMS) {
    app.get(`/research-lab/subsystems/${subsystem.slug}`, requireAdmin, async (req, res) => {
      const config = getConfig();
      const sections = [brandCard("Status", subsystem.status)];
      // Where a release gate covers only part of a subsystem, say so on the
      // page. A status line implying the whole thing is gated would be a
      // guarantee nobody actually made.
      if (subsystem.ungatedTables && subsystem.ungatedTables.length) {
        sections.push(brandCard(
          `Not covered by the release gate (${subsystem.ungatedTables.length})`,
          `${subsystem.ungatedTables.join(", ")}. ${subsystem.ungatedNote}`
        ));
      }

      if (!config.ok) {
        sections.push(brandCard("Not connected", "The account database is not configured in this environment, so these tables cannot be read. The structure below is still accurate -- it comes from the migrations."));
        sections.push(...subsystem.tables.map((table) => structureCard(table, escape)));
      } else {
        for (const table of subsystem.tables) {
          sections.push(await tableCard(table, config, headers, escape));
        }
      }

      return res.status(200).type("html").send(layout({
        title: subsystem.title,
        eyebrow: "Research Lab · schema only",
        heading: subsystem.heading,
        body: subsystem.body,
        sections,
        actions: [
          linkAction("/research-lab/subsystems", "All subsystems"),
          linkAction("/research-lab/open-source", "Open-source register")
        ]
      }));
    });
  }

  // One table, with whatever is in it. A table nobody has written to shows a
  // sentence saying so, not an empty grid that reads like a loading failure.
  async function tableCard(table, config, buildHeaders, escapeHtml) {
    const select = selectFor(table);
    if (!select) {
      return card(`${table}`, "This table is not in the migrations this build can read, so its structure is unknown.");
    }
    const url = `${config.url}/rest/v1/${encodeURIComponent(table)}?select=${encodeURIComponent(select)}&limit=25`;
    const response = await fetch(url, { headers: buildHeaders(config) }).catch(() => undefined);
    if (!response || !response.ok) {
      return `<article class="card"><h2>${escapeHtml(table)}</h2><p>Could not be read just now. The table may not exist in this project yet.</p></article>`;
    }
    const rows = await response.json().catch(() => []);
    if (!Array.isArray(rows) || !rows.length) {
      return `<article class="card"><h2>${escapeHtml(table)}</h2><p>No rows. Nothing has ever written to this table.</p>${structureList(table, escapeHtml)}</article>`;
    }
    return `<article class="card"><h2>${escapeHtml(table)}</h2><p>${rows.length} row${rows.length === 1 ? "" : "s"}${rows.length === 25 ? " (first 25)" : ""}.</p>${rowsTable(table, rows, escapeHtml)}</article>`;
  }

  function structureCard(table, escapeHtml) {
    return `<article class="card"><h2>${escapeHtml(table)}</h2>${structureList(table, escapeHtml)}</article>`;
  }

  function structureList(table, escapeHtml) {
    const columns = displayColumns(table);
    if (!columns.length) return "<p>Structure unknown in this build.</p>";
    return `<p>Columns: ${columns.map((column) => escapeHtml(column)).join(", ")}.</p>`;
  }

  function rowsTable(table, rows, escapeHtml) {
    const columns = displayColumns(table);
    const head = columns.map((column) => `<th>${escapeHtml(columnLabel(column))}</th>`).join("");
    const body = rows.map((row) => `<tr>${columns.map((column) => `<td>${escapeHtml(cellText(row[column]))}</td>`).join("")}</tr>`).join("");
    return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
  }
};

function esc(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function card(title, body) { return `<article class="card"><h2>${esc(title)}</h2><p>${esc(body)}</p></article>`; }
function link(href, label) { return `<a class="action" href="${esc(href)}">${esc(label)}</a>`; }
function basicLayout(data) {
  return `<!doctype html><html><head><title>${esc(data.title)}</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main><h1>${esc(data.heading)}</h1><p>${esc(data.body)}</p>${(data.sections || []).join("")}<nav>${(data.actions || []).join("")}</nav></main></body></html>`;
}
