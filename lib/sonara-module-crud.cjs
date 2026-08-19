"use strict";

// Listing, correcting and retiring the records a customer creates.
//
// Until now these six workspace tools were create-only. You could add a lead, a
// campaign or an asset and then had no way to open one, fix a typo in it, or
// take it out of your list. Everything was visible only through the aggregate
// /records feed. For a business tool that is a real gap: a customer who mistypes
// an email address on a lead has no way to correct it, and one who adds a record
// by mistake has no way to remove it.
//
// Three things this deliberately does not do.
//
// It does not hard-delete. Every one of these tables already carries an
// "archived" value in its status check constraint, and the businesses resource
// already uses archive/restore, so retiring a record is reversible and
// consistent with what is there. A customer who genuinely wants data erased is a
// support request, not a stray click.
//
// It does not accept a column it was not told about. An unknown field is a 400
// rather than being quietly dropped, because silently ignoring a misspelled
// field name looks exactly like a save that worked.
//
// It does not trust an id. Every read and write is filtered by organization_id
// as well, so an id belonging to another tenant matches nothing rather than
// matching a row.

const { escapeHtml } = require("./sonara-shell.cjs");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Editable columns and permitted statuses per resource, mirroring the check
// constraints in supabase/migrations. Anything not named here cannot be written
// through this module.
const RESOURCES = Object.freeze({
  "creator_studio:assets": {
    form: "creator_asset",
    noun: "asset",
    table: "creator_assets",
    select: "id,title,asset_type,url,status,created_at,updated_at",
    editable: ["title", "asset_type", "url", "status"],
    statuses: ["draft", "ready", "published", "archived"],
    activeStatus: "draft",
    order: "updated_at.desc"
  },
  "growth_studio:campaigns": {
    form: "growth_campaign",
    noun: "campaign",
    table: "growth_campaigns",
    select: "id,name,goal,channel,status,created_at,updated_at",
    editable: ["name", "goal", "channel", "status"],
    statuses: ["draft", "active", "paused", "completed", "archived"],
    activeStatus: "draft",
    order: "updated_at.desc"
  },
  "growth_studio:leads": {
    form: "growth_lead",
    noun: "lead",
    table: "growth_leads",
    select: "id,name,email,phone,source,status,created_at,updated_at",
    editable: ["name", "email", "phone", "source", "status"],
    statuses: ["new", "contacted", "qualified", "won", "lost", "archived"],
    activeStatus: "new",
    order: "updated_at.desc"
  }
});

const REQUIRED = ["getSupabaseServerConfig", "supabaseHeaders", "getCustomerPrimaryOrganization"];

function createModuleCrud(deps = {}) {
  for (const name of REQUIRED) {
    if (typeof deps[name] !== "function") throw new TypeError(`createModuleCrud requires ${name}`);
  }
  const { getSupabaseServerConfig, supabaseHeaders, getCustomerPrimaryOrganization } = deps;

  function resourceFor(productKey, resource) {
    return RESOURCES[`${productKey}:${resource}`] || null;
  }

  // Everything below needs the same three things: a configured database, a
  // resource this module owns, and the caller's organization. Resolving them in
  // one place keeps every handler's failure modes identical.
  async function context(req, productKey, resource) {
    const spec = resourceFor(productKey, resource);
    if (!spec) return { ok: false, status: 404, body: { ok: false, code: "unknown_resource" } };
    const config = getSupabaseServerConfig();
    if (!config.ok) return { ok: false, status: 503, body: { ok: false, code: "setup_required", service: "account_database" } };
    const organization = await getCustomerPrimaryOrganization(req.sonaraAccess?.user);
    if (!organization.ok) {
      return { ok: false, status: 503, body: { ok: false, code: organization.code || "organization_membership_missing" } };
    }
    return { ok: true, spec, config, organizationId: organization.organizationId };
  }

  function tenantQuery(organizationId, extra = "") {
    return `organization_id=eq.${encodeURIComponent(organizationId)}${extra}`;
  }

  async function list(req, productKey, resource) {
    const ctx = await context(req, productKey, resource);
    if (!ctx.ok) return ctx;

    const includeArchived = String(req.query?.include_archived || "") === "true";
    const filter = includeArchived ? "" : "&status=neq.archived";
    const limit = Math.min(Math.max(Number(req.query?.limit) || 50, 1), 200);
    const url = `${ctx.config.url}/rest/v1/${ctx.spec.table}?select=${ctx.spec.select}&${tenantQuery(ctx.organizationId, filter)}&order=${ctx.spec.order}&limit=${limit}`;

    const response = await fetch(url, { headers: supabaseHeaders(ctx.config) }).catch(() => undefined);
    if (!response?.ok) return { ok: false, status: 502, body: { ok: false, code: "read_failed" } };
    // A 200 carrying something that is not an array is a PostgREST error shape,
    // not an empty list. Passing it on as `records` used to reach `.map` in the
    // renderers, and before the route safety net that hung the request.
    const records = await response.json().catch(() => null);
    if (!Array.isArray(records)) return { ok: false, status: 502, body: { ok: false, code: "read_failed" } };
    return { ok: true, status: 200, body: { ok: true, records } };
  }

  async function getOne(req, productKey, resource, id) {
    if (!UUID.test(String(id || ""))) return { ok: false, status: 400, body: { ok: false, code: "invalid_id" } };
    const ctx = await context(req, productKey, resource);
    if (!ctx.ok) return ctx;

    const url = `${ctx.config.url}/rest/v1/${ctx.spec.table}?select=${ctx.spec.select}&${tenantQuery(ctx.organizationId, `&id=eq.${encodeURIComponent(id)}`)}&limit=1`;
    const response = await fetch(url, { headers: supabaseHeaders(ctx.config) }).catch(() => undefined);
    if (!response?.ok) return { ok: false, status: 502, body: { ok: false, code: "read_failed" } };
    const rows = await response.json().catch(() => []);
    // A record belonging to another organization is not found, not forbidden --
    // "forbidden" would confirm the id exists.
    if (!rows.length) return { ok: false, status: 404, body: { ok: false, code: "not_found" } };
    return { ok: true, status: 200, body: { ok: true, record: rows[0] } };
  }

  function cleanPatch(spec, body) {
    const patch = {};
    const rejected = [];
    for (const [key, value] of Object.entries(body || {})) {
      if (!spec.editable.includes(key)) {
        rejected.push(key);
        continue;
      }
      if (key === "status" && !spec.statuses.includes(String(value))) {
        return { ok: false, code: "invalid_status", detail: `status must be one of ${spec.statuses.join(", ")}` };
      }
      patch[key] = typeof value === "string" ? value.trim() : value;
    }
    if (rejected.length) return { ok: false, code: "unknown_fields", detail: `not editable: ${rejected.join(", ")}` };
    if (!Object.keys(patch).length) return { ok: false, code: "empty_update", detail: "nothing to change" };
    return { ok: true, patch };
  }

  async function update(req, productKey, resource, id, body) {
    if (!UUID.test(String(id || ""))) return { ok: false, status: 400, body: { ok: false, code: "invalid_id" } };
    const ctx = await context(req, productKey, resource);
    if (!ctx.ok) return ctx;

    const cleaned = cleanPatch(ctx.spec, body);
    if (!cleaned.ok) return { ok: false, status: 400, body: { ok: false, code: cleaned.code, message: cleaned.detail } };

    const url = `${ctx.config.url}/rest/v1/${ctx.spec.table}?${tenantQuery(ctx.organizationId, `&id=eq.${encodeURIComponent(id)}`)}`;
    const response = await fetch(url, {
      method: "PATCH",
      headers: supabaseHeaders(ctx.config, { prefer: "return=representation" }),
      body: JSON.stringify({ ...cleaned.patch, updated_at: new Date().toISOString() })
    }).catch(() => undefined);
    if (!response?.ok) return { ok: false, status: 502, body: { ok: false, code: "update_failed" } };
    const rows = await response.json().catch(() => []);
    if (!rows.length) return { ok: false, status: 404, body: { ok: false, code: "not_found" } };
    return { ok: true, status: 200, body: { ok: true, record: rows[0] } };
  }

  // Archive and restore are the same write with a different target status, so
  // they share a path rather than drifting apart.
  async function setStatus(req, productKey, resource, id, status) {
    return update(req, productKey, resource, id, { status });
  }

  async function archive(req, productKey, resource, id) {
    return setStatus(req, productKey, resource, id, "archived");
  }

  async function restore(req, productKey, resource, id) {
    const spec = resourceFor(productKey, resource);
    if (!spec) return { ok: false, status: 404, body: { ok: false, code: "unknown_resource" } };
    return setStatus(req, productKey, resource, id, spec.activeStatus);
  }

  return { list, getOne, update, archive, restore, resourceFor };
}


// Find the resource a workspace tool page edits, by the form it renders.
function resourceForForm(formKey) {
  for (const [key, spec] of Object.entries(RESOURCES)) {
    if (spec.form === formKey) {
      const [productKey, resource] = key.split(":");
      return { productKey, resource, spec };
    }
  }
  return null;
}

// One card per saved record, each with the fields filled in and a way to change
// or retire it.
//
// These are HTML forms rather than fetch() calls because the rest of this
// application is server-rendered and works without JavaScript, and somebody
// correcting a mistyped customer email should not be the one screen that needs
// it. HTML forms cannot send PATCH, which is why the update route accepts POST
// as well.
function renderRecordCards({ records, spec, basePath }) {
  if (!records.length) {
    return `<article class="card"><h2>Your saved ${escapeHtml(spec.noun)}s</h2><p>Nothing saved yet. Use the form above and it will appear here.</p></article>`;
  }

  const cards = records.map((record) => {
    const fields = spec.editable.map((field) => {
      const value = record[field] == null ? "" : String(record[field]);
      if (field === "status") {
        const options = spec.statuses
          .map((status) => `<option value="${escapeHtml(status)}"${status === record.status ? " selected" : ""}>${escapeHtml(status.replace(/_/g, " "))}</option>`)
          .join("");
        return `<label>Status<select name="status">${options}</select></label>`;
      }
      return `<label>${escapeHtml(field.replace(/_/g, " "))}<input name="${escapeHtml(field)}" type="text" value="${escapeHtml(value)}"></label>`;
    }).join("");

    const title = escapeHtml(String(record.title || record.name || record.email || spec.noun));
    const archived = record.status === "archived";
    return `<article class="card">
      <h3>${title}</h3>
      <form method="post" action="${escapeHtml(`${basePath}/${record.id}`)}">
        ${fields}
        <button type="submit">Save changes</button>
      </form>
      <form method="post" action="${escapeHtml(`${basePath}/${record.id}/${archived ? "restore" : "archive"}`)}">
        <button type="submit">${archived ? "Put back on the list" : "Take off the list"}</button>
      </form>
    </article>`;
  }).join("");

  return `<article class="card"><h2>Your saved ${escapeHtml(spec.noun)}s</h2><p>Change anything that is wrong, or take a record off your list. Nothing is deleted -- you can put it back.</p></article>${cards}`;
}


// A customer's saved tool results, on the page named after them.
//
// The three "Free records" pages said "recent results appear in your private
// workspace after they are saved" and then listed nothing -- a page called
// Records showing no records. The results were already being fetched; nothing
// rendered them.
//
// These rows are generated outputs rather than records a customer types, so
// there is nothing here to edit. They are shown, not made editable, and there is
// no archive control: module_outputs has no status column, and inventing a hard
// delete for derived artifacts is a bigger decision than this fix.
// What a records list shows when it could not be read.
//
// Both callers in server.js returned "" here, on the reasoning -- written into
// the comment above `workspaceRecordCards` -- that a list which cannot load
// should leave the tool usable rather than take the page down. That half is
// right and is kept. What was wrong is that "" is also what a page with no
// records section looks like, so a customer who had twenty invoices saw the
// form and nothing under it. On a page titled Records, an empty page is a
// sentence: it says the records are gone.
//
// Setup codes stay silent. A customer with no workspace yet is not looking at a
// failure, and the page has its own setup card for that.
const SILENT_CODES = new Set(["setup_required", "organization_setup_required", "customer_auth_required", "unknown_resource"]);

function renderRecordsUnavailable({ noun, code } = {}) {
  if (SILENT_CODES.has(String(code || ""))) return "";
  const what = noun ? `your saved ${escapeHtml(noun)}s` : "your saved records";
  return `<article class="card"><h2>We could not load ${what}</h2><p>This is on our side, and nothing has been deleted. Everything you have saved is still there. Try again shortly.</p></article>`;
}

// The control that turns one saved result into a link, and takes it back.
//
// A form rather than a button with script behind it, like every other write on
// these pages -- the whole application is server-rendered and works without
// JavaScript, and "share" is not the screen to make the exception on.
//
// The link is rendered as text as well as a link, because the point of it is
// that somebody copies it into a message. A bare <a> gives them nothing to copy
// but the words.
//
// `shared` is a map of record id to its live link, or **null when the link table
// could not be read**. Those are different facts and the page says so: a Share
// button shown because a read failed invites somebody to publish something that
// is already public, and a Stop sharing button that is missing for the same
// reason leaves them believing it is private.
function renderShareControl({ record, shared, backHref }) {
  const id = escapeHtml(String(record.id || ""));
  const back = `<input type="hidden" name="back" value="${escapeHtml(backHref || "/dashboard")}">`;
  const base = `/api/shared-links/module_output/${id}`;

  if (shared === null || shared === undefined) {
    return `<p class="fine">We could not check whether this one is shared. Nothing has changed either way -- open it again shortly.</p>`;
  }

  const live = shared[String(record.id)];
  if (live?.token) {
    const href = `/shared/${encodeURIComponent(live.token)}`;
    return `<p class="fine">Anyone with this link can read this result: <a href="${escapeHtml(href)}">${escapeHtml(href)}</a></p>
      <form method="post" action="${escapeHtml(`${base}/revoke`)}">${back}<button type="submit">Stop sharing this</button></form>`;
  }
  return `<form method="post" action="${escapeHtml(`${base}/share`)}">${back}<button type="submit">Share this result</button></form>`;
}

function renderSavedOutputCards({ records, shared, productLabel, backHref }) {
  if (!records.length) {
    return `<article class="card"><h2>Your saved results</h2><p>Nothing saved yet. Results from the ${escapeHtml(productLabel)} tools will be listed here.</p></article>`;
  }

  const cards = records.map((record) => {
    const when = record.created_at ? new Date(record.created_at) : null;
    const saved = when && !Number.isNaN(when.getTime())
      ? when.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
      : "recently";
    const tool = String(record.module_key || "result").replace(/_/g, " ");
    // The output is free-form JSON per tool. Show the short string values, which
    // is where the useful summary lines live, and skip nested structures rather
    // than printing objects at somebody.
    const details = Object.entries(record.output_payload || {})
      .filter(([, value]) => typeof value === "string" && value.trim() && value.length <= 400)
      .slice(0, 4)
      .map(([label, value]) => `<p><strong>${escapeHtml(label.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()))}:</strong> ${escapeHtml(value)}</p>`)
      .join("");

    return `<article class="card">
      <h3>${escapeHtml(tool.replace(/^./, (c) => c.toUpperCase()))}</h3>
      <p class="fine">Saved ${escapeHtml(saved)}</p>
      ${details || "<p>Saved, with no summary to show.</p>"}
      ${renderShareControl({ record, shared, backHref })}
    </article>`;
  }).join("");

  return `<article class="card"><h2>Your saved results</h2><p>Everything you have created with the ${escapeHtml(productLabel)} tools, newest first. Sharing one gives it a link anybody can open -- it shows the answer only, never the figures you typed in, and you can stop sharing it at any time.</p></article>${cards}`;
}

module.exports = { createModuleCrud, RESOURCES, REQUIRED, resourceForForm, renderRecordCards, renderSavedOutputCards, renderShareControl, renderRecordsUnavailable };
