"use strict";

// /research-lab/subsystems -- the five subsystems that exist as schema only.
//
// Fifty-one tables were created with row level security and indexes, and no
// code ever read or wrote one of them. That is not a stray table here and there;
// it is five designed subsystems with nothing behind them, and until now the
// only way to know they existed was to read the migrations.
//
// Thirty-eight of the fifty-one can now be written to. Thirteen cannot, and the
// split is not about safety -- everything here is admin-only -- but about
// whether a hand-entered row would be a decision or a fabrication.
//
// A registry, a catalog, a watchlist, a blocklist, a review, a note, a setting:
// somebody deciding something, where typing it in is how the decision gets
// recorded. A run, an event, a log, a job, a deployment, a memory, an approval:
// a record that something happened, where typing it in does not make it have
// happened. lib/sonara-subsystem-registry.cjs holds the rule; it is the same
// call made for growth_touchpoints, for the same reason.
//
// Nothing here executes anything. Adding a row to entity_agent_tool_registry
// registers a tool; it does not run one, and no code in this product runs
// agents. scripts/verify-supabase-contract.mjs still reports the agent
// foundation as approval-gated with autonomous execution disabled, and that
// wording was corrected in the same change -- it used to say "schema-only",
// which stopped being true the moment these forms existed.
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
  formFields,
  isWritable,
  selectFor
} = require("../lib/sonara-subsystem-registry.cjs");
const { describedColumns } = require("../lib/sonara-migration-columns.cjs");

module.exports = function registerSonaraSubsystemRoutes(app, deps = {}) {
  const layout = deps.layout || basicLayout;
  const brandCard = deps.brandCard || card;
  const linkAction = deps.linkAction || link;
  const escape = deps.escapeHtml || esc;
  const requireAdmin = deps.requireAdmin || ((req, res, next) => next());
  const getConfig = deps.getSupabaseServerConfig || (() => ({ ok: false }));
  const headers = deps.supabaseHeaders || (() => ({}));
  const primaryOrganization = deps.getCustomerPrimaryOrganization || (async () => ({ ok: false }));

  // One endpoint, and the table has to be one of the 38 the registry says may
  // be written. A path parameter reaching PostgREST unchecked would be a way to
  // write to any table in the database.
  app.post("/api/research-lab/subsystems/:table", requireAdmin, async (req, res) => {
    const table = String(req.params.table || "").toLowerCase();
    const subsystem = SUBSYSTEMS.find((entry) => entry.tables.includes(table));
    const back = subsystem ? `/research-lab/subsystems/${subsystem.slug}` : "/research-lab/subsystems";
    const respond = (status, payload) => {
      if (!acceptsHtml(req)) return res.status(status).json(payload);
      if (payload.ok) return res.redirect(303, `${back}#${encodeURIComponent(table)}`);
      return res.redirect(303, `${back}?problem=${encodeURIComponent(payload.code || "not_saved")}&table=${encodeURIComponent(table)}`);
    };

    if (!subsystem) return respond(404, { ok: false, code: "unknown_table" });
    // The read-only thirteen. These record that something happened, and a
    // hand-written row would be a fabricated fact sitting beside real ones.
    if (!isWritable(table)) return respond(403, { ok: false, code: "records_a_fact_not_an_intention" });

    const fields = formFields(table);
    const missing = fields.filter((field) => field.required && !String(req.body[field.name] || "").trim()).map((field) => field.name);
    if (missing.length) return respond(400, { ok: false, code: "missing_required", missing });

    const config = getConfig();
    if (!config.ok) return respond(503, { ok: false, code: "setup_required", service: "supabase" });

    const payload = {};
    for (const field of fields) {
      const raw = String(req.body[field.name] ?? "").trim();
      if (!raw) continue;
      // A choice outside the check constraint would be rejected by the
      // database; saying so here names the field instead of returning a
      // constraint violation.
      if (field.type === "choice" && !field.values.includes(raw)) return respond(400, { ok: false, code: `invalid_${field.name}` });
      if (field.type === "uuid" && !isUuid(raw)) return respond(400, { ok: false, code: `invalid_${field.name}` });
      if (field.type === "number") {
        const parsed = Number(raw);
        if (!Number.isFinite(parsed)) return respond(400, { ok: false, code: `invalid_${field.name}` });
        payload[field.name] = parsed;
        continue;
      }
      if (field.type === "boolean") {
        payload[field.name] = ["1", "true", "yes", "on"].includes(raw.toLowerCase());
        continue;
      }
      payload[field.name] = raw;
    }

    // Columns the form does not offer and the server owns. Eight of these
    // tables declare organization_id or user_id NOT NULL, so an insert without
    // them is rejected -- and taking either from the body would let one be set
    // to anything.
    const columns = describedColumns(table);
    const needsUser = columns.some((column) => column.name === "user_id");
    const needsOrganization = columns.some((column) => column.name === "organization_id");
    const adminUserId = req.sonaraAdmin?.user?.id || null;
    if (needsUser && adminUserId) payload.user_id = adminUserId;
    if (needsOrganization) {
      const organization = adminUserId ? await primaryOrganization({ id: adminUserId }) : { ok: false };
      if (organization.ok) payload.organization_id = organization.organizationId;
      else if (columns.some((column) => column.name === "organization_id" && column.required)) {
        return respond(409, { ok: false, code: "no_organization_for_this_account" });
      }
    }

    const response = await fetch(`${config.url}/rest/v1/${encodeURIComponent(table)}`, {
      method: "POST",
      headers: { ...headers(config), Prefer: "return=representation" },
      body: JSON.stringify(payload)
    }).catch(() => undefined);
    if (!response?.ok) return respond(502, { ok: false, code: `insert_failed_${response?.status || "unreachable"}` });
    const rows = await response.json().catch(() => []);
    return respond(200, { ok: true, row: Array.isArray(rows) ? rows[0] : rows });
  });

  // Counted from the registry rather than written down. The copy this replaced
  // said "Five designed subsystems" against nine, and "Nothing here can be
  // changed from these pages" against fifty tables with a Save button on them.
  // A page telling an operator it is read-only while offering forms is the
  // failure this repository keeps finding, and it was in the safety sentence.
  const totalTables = SUBSYSTEMS.reduce((total, subsystem) => total + subsystem.tables.length, 0);
  const writableTables = SUBSYSTEMS.flatMap((subsystem) => subsystem.tables).filter(isWritable).length;
  const readOnlyTables = totalTables - writableTables;

  app.get("/research-lab/subsystems", requireAdmin, (req, res) => {
    const sections = [
      brandCard(
        "What these are",
        `${totalTables} tables across ${SUBSYSTEMS.length} subsystems were created with row level security and indexes, and for a long time nothing in the application read or wrote one of them. These pages are what changed that: they are listed here so the design is visible rather than buried in migration files.`
      ),
      brandCard(
        `${writableTables} of these tables can be added to from here. ${readOnlyTables} cannot.`,
        `A registry, a catalog, a watchlist, a review, a note, a setting: somebody deciding something, where typing it in is how the decision gets recorded. Those have a form. A run, an event, a log, a job, a deployment, an approval: a record that something happened, where typing it in does not make it have happened. Those have none, and the page says so where the form would be. Nothing here executes anything -- registering an agent tool records that it exists; no code in this product runs agents.`
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
      body: `${SUBSYSTEMS.length} designed subsystems, ${totalTables} tables. What each one is, what is actually in it, and which of them you can add a row to.`,
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
        // Up to eighteen tables on one subsystem, each read independently and
        // previously awaited one at a time. Built in parallel and flattened, so
        // each table still renders its table card followed by its create card
        // -- the interleaving is what made the serial version look necessary.
        const cards = await Promise.all(subsystem.tables.map(async (table) => {
          const card = await tableCard(table, config, headers, escape);
          return isWritable(table) ? [card, createCard(table, escape)] : [card];
        }));
        sections.push(...cards.flat());
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

  // The form, built from the schema rather than listed beside it.
  function createCard(table, escapeHtml) {
    const fields = formFields(table);
    if (!fields.length) return "";
    const inputs = fields.map((field) => {
      const required = field.required ? " required" : "";
      const label = escapeHtml(field.label);
      const name = escapeHtml(field.name);
      if (field.type === "choice") {
        const options = field.values
          .map((value) => `<option value="${escapeHtml(value)}"${value === field.fallback ? " selected" : ""}>${escapeHtml(String(value).replaceAll("_", " "))}</option>`)
          .join("");
        return `<label>${label}<select name="${name}"${required}>${field.required ? "" : "<option value=\"\">Not set</option>"}${options}</select></label>`;
      }
      if (field.type === "boolean") return `<label class="choice"><input name="${name}" type="checkbox" value="on"${required}> ${label}</label>`;
      const inputType = field.type === "number" ? "number" : field.type === "date" ? "date" : field.type === "timestamp" ? "datetime-local" : "text";
      const hint = field.type === "uuid" ? ` <span class="fine">${escapeHtml("Identifier of an existing record.")}</span>` : "";
      return `<label>${label}<input name="${name}" type="${escapeHtml(inputType)}"${required}></label>${hint}`;
    }).join("");
    return `<article class="card" id="${escapeHtml(table)}"><h2>Add to ${escapeHtml(table)}</h2><form method="post" action="/api/research-lab/subsystems/${escapeHtml(table)}">${inputs}<button type="submit">Save</button></form></article>`;
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

function acceptsHtml(req) {
  const accept = String(req.get("accept") || "");
  return accept.includes("text/html") && !accept.includes("application/json");
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

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
