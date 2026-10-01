// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// What a business owner can switch on and off inside their own business.
//
// The operator console at /admin was removed on 1 October 2026. It was SONARA
// Industries' own screens -- 58 registered routes behind a staff session -- and
// none of it was a control a customer could reach. Removing it left a real gap
// on the customer side, because the thing an owner actually needs is not the
// platform's console: it is a page that says which parts of their business are
// running and lets them pause one.
//
// This is that page. It is organization-scoped, and that is the whole design.
//
// ## The tables under it
//
// `business_sub_apps` holds the record types an owner designed themselves --
// kennels, boat slips, rehearsal rooms. `business_sub_app_modules` holds the
// parts of one. Both are organization-scoped and have been since migration
// 20260530120000.
//
// `business_sub_app_modules` **had no reader**. Nothing in routes/, lib/ or
// server.js selected from it or wrote to it; it was registered in
// lib/sonara-tenant-scoped-tables.cjs and lib/sonara-subsystem-registry.cjs and
// then never queried. A table with no way in is the defect
// .claude/skills/adding-a-record-page warns about in its first paragraph, and
// this is the way in.
//
// ## Why every write carries the organization id
//
// An id arriving in a form body is a number the caller chose. Filtering the
// update by `id` alone would let somebody paste another business's sub-app id
// and change its status. Every statement below filters on
// `organization_id=eq.<the caller's own>` as well, so an id from outside the
// caller's business matches no row and the write reports nothing changed rather
// than succeeding somewhere it should not.
//
// ## Status is an allow-list, not free text
//
// The column is `text` with a `draft` default, which means the database will
// accept anything. Three values are offered and anything else is refused before
// it reaches PostgREST -- otherwise this page is a way to write arbitrary
// strings into a column other screens read.

const ADMINISTRATION_PATH = "/owner/administration";

// The three states an owner is offered, and the only three this page will
// write. `paused` is the one that matters: an owner winding something down
// needs it to stop without losing the records under it.
const STATUSES = Object.freeze(["draft", "active", "paused"]);

const STATUS_LABELS = Object.freeze({
  draft: "Not started",
  active: "Running",
  paused: "Paused"
});

module.exports = function registerOwnerAdministrationRoutes(app, deps = {}) {
  const layout = deps.layout || basicLayout;
  const brandCard = deps.brandCard || card;
  const linkAction = deps.linkAction || link;
  const escape = deps.escapeHtml || escapeHtml;
  const requireBusinessManager = typeof deps.requireBusinessManager === "function"
    ? deps.requireBusinessManager
    : failClosed;
  const getConfig = typeof deps.getSupabaseServerConfig === "function"
    ? deps.getSupabaseServerConfig
    : () => ({ ok: false });
  const ui = { layout, card: brandCard, link: linkAction, escape };

  async function scope(req) {
    const config = getConfig();
    if (!config.ok) {
      return { ok: false, message: "Your account database is not connected yet, so there is nothing to show." };
    }
    const user = req.sonaraUser || req.sonaraAccess?.user || null;
    if (typeof deps.getCustomerPrimaryOrganization !== "function") {
      return { ok: false, message: "We could not tell which business you are signed in to." };
    }
    const organization = await deps.getCustomerPrimaryOrganization(user);
    if (!organization?.ok) {
      return { ok: false, message: "We could not tell which business you are signed in to. Sign in again and this will fill up." };
    }
    return { ok: true, config, organizationId: organization.organizationId };
  }

  // ---------------------------------------------------------------------------
  // The page
  // ---------------------------------------------------------------------------

  app.get(ADMINISTRATION_PATH, requireBusinessManager, async (req, res) => {
    const where = await scope(req);
    if (!where.ok) {
      return res.status(200).type("html").send(render(ui, [ui.card("Not available right now", where.message)]));
    }

    // enc() inlined at each interpolation rather than hoisted into a variable.
    // scripts/verify-postgrest-filter-encoding.mjs reads the call site and
    // cannot follow a local, so a hoisted `const organization = enc(...)` reads
    // to it as an unencoded tenant filter -- and it flagged both of these lines.
    // Being legible to that check is worth the repetition: PostgREST treats
    // & = , and . as syntax and these requests carry the service-role key.
    const subApps = await rest(where.config, "business_sub_apps", `select=id,name,status,updated_at&organization_id=eq.${enc(where.organizationId)}&order=name.asc&limit=200`);
    const modules = await rest(where.config, "business_sub_app_modules", `select=id,sub_app_id,module_key,status,updated_at&organization_id=eq.${enc(where.organizationId)}&order=module_key.asc&limit=500`);

    const sections = [];

    // A read that failed and an empty result are different facts. Telling an
    // owner they have nothing, on the strength of a request that did not
    // happen, is how somebody concludes their work was lost.
    if (!subApps.ok) {
      sections.push(ui.card(
        "We could not read your parts list",
        "The database did not answer just now. Nothing has changed and nothing has been lost. Try again shortly."
      ));
    } else if (!subApps.rows.length) {
      sections.push(ui.card(
        "Nothing to control yet",
        "This page lists the record types you have built for your business and lets you pause or restart one. You have not built any yet."
      ));
    } else {
      const running = subApps.rows.filter((row) => row.status === "active").length;
      const paused = subApps.rows.filter((row) => row.status === "paused").length;
      sections.push(ui.card(
        "Your business, in one line",
        `${count(subApps.rows.length, "record type")}: ${running} running, ${paused} paused, ${subApps.rows.length - running - paused} not started.`
      ));
      sections.push(subAppTable(ui, subApps.rows));
      for (const row of subApps.rows) sections.push(statusForm(ui, "sub-app-status", "subAppId", row.id, row.name, row.status));
    }

    if (!modules.ok) {
      sections.push(ui.card(
        "We could not read the parts inside them",
        "The list above is accurate; the parts inside each record type did not load. Nothing has changed."
      ));
    } else if (subApps.ok && subApps.rows.length && !modules.rows.length) {
      sections.push(ui.card(
        "No parts recorded yet",
        "A record type can be split into parts you switch on separately. None of yours has parts yet, so each is controlled as a whole above."
      ));
    } else if (modules.rows.length) {
      const names = new Map(subApps.ok ? subApps.rows.map((row) => [row.id, row.name]) : []);
      sections.push(ui.card("The parts inside them", count(modules.rows.length, "part") + " across your record types."));
      sections.push(moduleTable(ui, modules.rows, names));
      for (const row of modules.rows) {
        sections.push(statusForm(ui, "module-status", "moduleId", row.id, `${names.get(row.sub_app_id) || "Record type"} / ${row.module_key}`, row.status));
      }
    }

    sections.push(ui.card(
      "What this page does not do",
      "It controls your own business only. It cannot see or change another business, it does not change what you are billed, and it does not delete anything -- pausing a record type leaves every record inside it where it is."
    ));

    return res.status(200).type("html").send(render(ui, sections, problemFrom(req)));
  });

  // ---------------------------------------------------------------------------
  // The two writes
  // ---------------------------------------------------------------------------

  // Both the table AND the filter are written at each call site.
  // scripts/report-tenant-scoped-queries.mjs resolves each from the call site and
  // follows neither a variable table nor a variable query. Two earlier shapes
  // were refused, each time correctly: passing the table name down as a
  // parameter grew the unresolvable-table count, and passing a `write` closure
  // resolved the table but put the filter out of view -- which it calls "the one
  // combination this script must never wave past", because a tenant-scoped table
  // with an invisible filter is exactly how a cross-tenant write hides. So the
  // two handlers repeat the statement rather than share it.
  //
  // This note is deliberately written without spelling the rejected call out.
  // Its first draft did, and that script counts a bare `rest(` anywhere in a
  // runtime file: it skips the helper's own declaration but not a comment, so
  // the sentence describing the blind spot became the forty-first entry in it.
  // That is the twelfth shape in .claude/skills/checks-that-cannot-lie, hit for
  // the third time in this change.
  app.post(`${ADMINISTRATION_PATH}/sub-app-status`, requireBusinessManager, async (req, res) => {
    const checked = await checkStatusRequest(req, res, "subAppId", "record type");
    if (!checked.ok) return checked.sent;
    const written = await rest(
      checked.where.config,
      "business_sub_apps",
      `id=eq.${enc(checked.id)}&organization_id=eq.${enc(checked.where.organizationId)}`,
      { method: "PATCH", prefer: "return=representation", body: { status: checked.status, updated_at: new Date().toISOString() } }
    );
    return finish(checked, written, "subAppId", "record type");
  });

  app.post(`${ADMINISTRATION_PATH}/module-status`, requireBusinessManager, async (req, res) => {
    const checked = await checkStatusRequest(req, res, "moduleId", "part");
    if (!checked.ok) return checked.sent;
    const written = await rest(
      checked.where.config,
      "business_sub_app_modules",
      `id=eq.${enc(checked.id)}&organization_id=eq.${enc(checked.where.organizationId)}`,
      { method: "PATCH", prefer: "return=representation", body: { status: checked.status, updated_at: new Date().toISOString() } }
    );
    return finish(checked, written, "moduleId", "part");
  });

  // Everything before the statement: the organization, the id, the status.
  async function checkStatusRequest(req, res, idField, label) {
    const answer = answerer(req, res);
    const where = await scope(req);
    if (!where.ok) return { ok: false, sent: answer(503, { ok: false, code: "setup_required", message: where.message }) };

    const id = String(req.body?.[idField] || "").trim();
    const status = String(req.body?.status || "").trim().toLowerCase();

    if (!isUuid(id)) {
      return { ok: false, sent: answer(400, { ok: false, code: "unknown_target", message: `That ${label} was not recognised.` }) };
    }
    if (!STATUSES.includes(status)) {
      return {
        ok: false,
        sent: answer(400, { ok: false, code: "unknown_status", message: `A ${label} can be set to not started, running, or paused.` })
      };
    }
    return { ok: true, answer, where, id, status };
  }

  // Everything after it. A write that matched no row answers exactly as a bad id
  // does: a caller probing ids must not be able to tell "exists, but not yours"
  // from "does not exist".
  function finish(checked, written, idField, label) {
    if (!written.ok) {
      return checked.answer(502, { ok: false, code: "not_saved", message: "The database did not accept that change. Nothing has changed." });
    }
    if (!written.rows.length) {
      return checked.answer(404, { ok: false, code: "unknown_target", message: `That ${label} was not recognised.` });
    }
    return checked.answer(200, {
      ok: true,
      status: checked.status,
      [idField]: checked.id,
      message: `Saved. That ${label} is now ${STATUS_LABELS[checked.status].toLowerCase()}.`
    });
  }

  function render(frame, sections, problem) {
    const body = "Switch the parts of your business on, pause one, or see what is running. This page covers your business only.";
    const all = problem ? [frame.card("That did not save", problem), ...sections] : sections;
    return frame.layout({
      title: "Business controls",
      eyebrow: "Your business",
      heading: "Business controls",
      body,
      sections: all.length ? all : [frame.card("Not available right now", body)],
      actions: [frame.link("/dashboard", "Dashboard"), frame.link("/business-builder/dashboard", "Business Builder")]
    });
  }
};

// -----------------------------------------------------------------------------
// Rendering
// -----------------------------------------------------------------------------

function subAppTable(ui, rows) {
  return `<table><caption>Your record types</caption><thead><tr><th>Name</th><th>State</th><th>Last change</th></tr></thead><tbody>${
    rows.map((row) => `<tr><td>${ui.escape(row.name)}</td><td>${ui.escape(label(row.status))}</td><td>${ui.escape(when(row.updated_at))}</td></tr>`).join("")
  }</tbody></table>`;
}

function moduleTable(ui, rows, names) {
  return `<table><caption>Parts inside your record types</caption><thead><tr><th>Record type</th><th>Part</th><th>State</th><th>Last change</th></tr></thead><tbody>${
    rows.map((row) => `<tr><td>${ui.escape(names.get(row.sub_app_id) || "Not recorded")}</td><td>${ui.escape(row.module_key)}</td><td>${ui.escape(label(row.status))}</td><td>${ui.escape(when(row.updated_at))}</td></tr>`).join("")
  }</tbody></table>`;
}

function statusForm(ui, action, idField, id, name, current) {
  const options = STATUSES.map((value) => `<option value="${value}"${value === current ? " selected" : ""}>${escapeHtml(STATUS_LABELS[value])}</option>`).join("");
  return `<article class="card">
      <h2>${ui.escape(name)}</h2>
      <form method="post" action="${ADMINISTRATION_PATH}/${action}">
        <input type="hidden" name="${idField}" value="${ui.escape(id)}">
        <label>State<select name="status" required>${options}</select></label>
        <button type="submit">Save state</button>
      </form>
    </article>`;
}

function label(status) {
  return STATUS_LABELS[String(status || "").toLowerCase()] || "Not recorded";
}

function count(total, noun) {
  return `${total} ${noun}${total === 1 ? "" : "s"}`;
}

function problemFrom(req) {
  const code = String(req.query?.problem || "").trim();
  if (!code) return "";
  if (code === "unknown_status") return "A record type can be set to not started, running, or paused.";
  if (code === "unknown_target") return "That item was not recognised, so nothing was changed.";
  if (code === "setup_required") return "Your account database is not connected yet.";
  return "Nothing was changed. Try again shortly.";
}

// -----------------------------------------------------------------------------
// Plumbing, matching routes/sonara-sub-app-routes.cjs rather than inventing a
// second shape for the same job.
// -----------------------------------------------------------------------------

function answerer(req, res) {
  const html = String(req.get?.("accept") || "").includes("text/html")
    || String(req.get?.("content-type") || "").includes("application/x-www-form-urlencoded");
  return (status, payload) => {
    if (!html) return res.status(status).json(payload);
    if (payload.ok) return res.redirect(303, `${ADMINISTRATION_PATH}?saved=1`);
    return res.redirect(303, `${ADMINISTRATION_PATH}?problem=${encodeURIComponent(payload.code || "not_saved")}`);
  };
}

async function rest(config, table, query = "", options = {}) {
  const response = await fetch(`${config.url}/rest/v1/${table}${query ? `?${query}` : ""}`, {
    method: options.method || "GET",
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": "application/json",
      ...(options.prefer ? { Prefer: options.prefer } : {})
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  }).catch(() => undefined);
  if (!response) return { ok: false, status: 503, rows: [] };
  const rows = response.status === 204 ? [] : await response.json().catch(() => []);
  return { ok: response.ok, status: response.status, rows: Array.isArray(rows) ? rows : [] };
}

// Fails closed. A missing gate here would publish an owner's controls, and the
// module this replaced shipped with `|| ((req, res, next) => next())` and no
// gate passed, which served a write endpoint to anybody who asked.
function failClosed(req, res) {
  if (String(req.get?.("accept") || "").includes("text/html")) return res.redirect(303, "/login");
  return res.status(503).json({ ok: false, code: "setup_required", service: "owner_administration" });
}

function enc(value) { return encodeURIComponent(String(value || "")); }
function isUuid(value) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || "")); }
function when(value) {
  if (!value) return "Not recorded";
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : "Not recorded";
}
function basicLayout(data) { return `<!doctype html><html><head><title>${escapeHtml(data.title)}</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main><h1>${escapeHtml(data.heading)}</h1><p>${escapeHtml(data.body)}</p><nav>${(data.actions || []).join("")}</nav><section>${(data.sections || []).join("")}</section></main></body></html>`; }
function card(title, body) { return `<article class="card"><h2>${escapeHtml(title)}</h2><p>${escapeHtml(body)}</p></article>`; }
function link(href, label2) { return `<a class="action" href="${escapeHtml(href)}">${escapeHtml(label2)}</a>`; }
function escapeHtml(value) { return String(value === 0 ? 0 : value || "").replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[char])); }

module.exports.ADMINISTRATION_PATH = ADMINISTRATION_PATH;
module.exports.STATUSES = STATUSES;
