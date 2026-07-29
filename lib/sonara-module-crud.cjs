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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Editable columns and permitted statuses per resource, mirroring the check
// constraints in supabase/migrations. Anything not named here cannot be written
// through this module.
const RESOURCES = Object.freeze({
  "creator_studio:assets": {
    table: "creator_assets",
    select: "id,title,asset_type,url,status,created_at,updated_at",
    editable: ["title", "asset_type", "url", "status"],
    statuses: ["draft", "ready", "published", "archived"],
    activeStatus: "draft",
    order: "updated_at.desc"
  },
  "growth_studio:campaigns": {
    table: "growth_campaigns",
    select: "id,name,goal,channel,status,created_at,updated_at",
    editable: ["name", "goal", "channel", "status"],
    statuses: ["draft", "active", "paused", "completed", "archived"],
    activeStatus: "draft",
    order: "updated_at.desc"
  },
  "growth_studio:leads": {
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
    return { ok: true, status: 200, body: { ok: true, records: await response.json().catch(() => []) } };
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

module.exports = { createModuleCrud, RESOURCES, REQUIRED };
