"use strict";

// The pages a customer builds their own record types on.
//
// Every business has something the fifteen built-in record pages do not model.
// A kennel has kennels, a marina has slips, a rehearsal studio has rooms. Until
// now the answer was to wait for somebody here to build a page for it.
//
// What this is not: a deployed application at its own address. See the note at
// the top of lib/sonara-sub-apps.cjs, and the one at the bottom of
// supabase/migrations/20260819040000_sub_app_records.sql. A sub-app lives
// inside SONARA, at a path, under the customer's own workspace.

const subApps = require("../lib/sonara-sub-apps.cjs");

const SUB_APPS_PATH = "/business-builder/owner/sub-apps";

module.exports = function registerSubAppRoutes(app, deps = {}) {
  const layout = deps.layout || basicLayout;
  const brandCard = deps.brandCard || card;
  const linkAction = deps.linkAction || link;
  const escape = deps.escapeHtml || escapeHtml;
  const requireBusinessManager = typeof deps.requireBusinessManager === "function" ? deps.requireBusinessManager : pass;
  const ui = { layout, card: brandCard, link: linkAction, escape };

  // ---------------------------------------------------------------------------
  // Pages
  // ---------------------------------------------------------------------------

  app.get(SUB_APPS_PATH, requireBusinessManager, async (req, res) => {
    const scope = await workspace(req, deps);
    if (!scope.ok) return res.status(200).type("html").send(page(ui, "Your own record types", scope.message, [], SUB_APPS_PATH));

    const listed = await rest(scope.config, "business_sub_apps", `select=id,name,slug,status,created_at&organization_id=eq.${enc(scope.organizationId)}&order=created_at.desc&limit=200`);
    const sections = [];
    if (!listed.ok) {
      // Not "you have none". A read that failed and an empty list are different
      // facts, and telling somebody they have nothing when the database did not
      // answer is how a customer concludes their work was lost.
      sections.push(ui.card("We could not read your record types", "The database did not answer just now. Nothing has changed, and nothing has been lost. Try again shortly."));
    } else if (!listed.rows.length) {
      sections.push(ui.card("You have not built one yet", "A sub-app is a set of records you design yourself — kennels, boat slips, rehearsal rooms, anything this product does not already have a page for. Add the first one below."));
    } else {
      sections.push(ui.card("What you have built", listed.rows.map((row) => `${row.name} (${row.status.replace(/_/g, " ")})`).join(". ") + "."));
      sections.push(`<table><thead><tr><th>Name</th><th>Status</th><th>Added</th><th>Open</th></tr></thead><tbody>${
        listed.rows.map((row) => `<tr><td>${ui.escape(row.name)}</td><td>${ui.escape(String(row.status || "").replace(/_/g, " "))}</td><td>${ui.escape(when(row.created_at))}</td><td>${ui.link(`${SUB_APPS_PATH}/${encodeURIComponent(row.id)}`, "Open")}</td></tr>`).join("")
      }</tbody></table>`);
    }

    sections.push(createSubAppForm());
    sections.push(ui.card(
      "Where a sub-app lives",
      "Inside SONARA, at a page under your workspace, rather than at its own web address. This product serves every page from one place and cannot publish a separate site, so you will never be offered one."
    ));

    return res.status(200).type("html").send(page(ui, "Your own record types", "Design a set of records this product does not already have a page for, and start filling it in.", sections, SUB_APPS_PATH));
  });

  app.get(`${SUB_APPS_PATH}/:subAppId`, requireBusinessManager, async (req, res) => {
    const scope = await workspace(req, deps);
    if (!scope.ok) return res.status(200).type("html").send(page(ui, "Record type", scope.message, [], SUB_APPS_PATH));
    const subAppId = String(req.params.subAppId || "");
    if (!isUuid(subAppId)) return res.status(404).type("html").send(page(ui, "Not found", "That is not a record type we can find.", [], SUB_APPS_PATH));

    const found = await loadSubApp(scope, subAppId);
    if (!found.ok) return res.status(found.status).type("html").send(page(ui, found.title, found.message, [], SUB_APPS_PATH));
    const subApp = found.row;

    const schemas = await rest(scope.config, "business_sub_app_database_schemas", `select=id,schema_key,fields,status,created_at&organization_id=eq.${enc(scope.organizationId)}&sub_app_id=eq.${enc(subAppId)}&order=created_at.asc&limit=100`);

    const sections = [];
    if (!schemas.ok) {
      sections.push(ui.card("We could not read the record types", "The database did not answer just now. Nothing has changed."));
    } else if (!schemas.rows.length) {
      sections.push(ui.card("No record types yet", `"${subApp.name}" has no record types, so there is nothing to fill in. Describe one below — its name, and the fields each record needs.`));
    } else {
      sections.push(`<table><thead><tr><th>Record type</th><th>Fields</th><th>Status</th><th>Open</th></tr></thead><tbody>${
        schemas.rows.map((row) => {
          const fields = Array.isArray(row.fields) ? row.fields : [];
          return `<tr><td>${ui.escape(row.schema_key.replace(/_/g, " "))}</td><td>${ui.escape(fields.map((field) => field.label).join(", ") || "None")}</td><td>${ui.escape(String(row.status || "").replace(/_/g, " "))}</td><td>${ui.link(`${SUB_APPS_PATH}/${encodeURIComponent(subAppId)}/${encodeURIComponent(row.schema_key)}`, "Open")}</td></tr>`;
        }).join("")
      }</tbody></table>`);
    }

    sections.push(schemaForm(ui, subAppId));
    return res.status(200).type("html").send(page(ui, subApp.name, "The record types inside this sub-app, and what each one holds.", sections, SUB_APPS_PATH, [ui.link(SUB_APPS_PATH, "All your record types")]));
  });

  app.get(`${SUB_APPS_PATH}/:subAppId/:schemaKey`, requireBusinessManager, async (req, res) => {
    const scope = await workspace(req, deps);
    if (!scope.ok) return res.status(200).type("html").send(page(ui, "Records", scope.message, [], SUB_APPS_PATH));
    const subAppId = String(req.params.subAppId || "");
    if (!isUuid(subAppId)) return res.status(404).type("html").send(page(ui, "Not found", "That is not a record type we can find.", [], SUB_APPS_PATH));

    const found = await loadSubApp(scope, subAppId);
    if (!found.ok) return res.status(found.status).type("html").send(page(ui, found.title, found.message, [], SUB_APPS_PATH));

    const schemaKey = subApps.toKey(req.params.schemaKey);
    const schemas = await rest(scope.config, "business_sub_app_database_schemas", `select=id,schema_key,fields,status&organization_id=eq.${enc(scope.organizationId)}&sub_app_id=eq.${enc(subAppId)}&schema_key=eq.${enc(schemaKey || "")}&limit=1`);
    if (!schemas.ok) return res.status(200).type("html").send(page(ui, "Records", "We could not read this record type just now. Nothing has changed.", [], SUB_APPS_PATH));
    const schema = schemas.rows[0];
    if (!schema) return res.status(404).type("html").send(page(ui, "Not found", "That record type does not exist in this sub-app.", [], SUB_APPS_PATH));

    const fields = Array.isArray(schema.fields) ? schema.fields : [];
    const records = await rest(scope.config, "business_sub_app_records", `select=id,data,created_at&organization_id=eq.${enc(scope.organizationId)}&schema_id=eq.${enc(schema.id)}&order=created_at.desc&limit=200`);

    const sections = [];
    if (!records.ok) {
      sections.push(ui.card("We could not read your records", "The database did not answer just now. Nothing has changed, and nothing has been lost."));
    } else if (!records.rows.length) {
      sections.push(ui.card("Nothing recorded yet", "Add the first one below."));
    } else {
      const head = fields.map((field) => `<th>${ui.escape(field.label)}</th>`).join("") + "<th>Added</th>";
      const body = records.rows.map((row) => {
        const data = row.data && typeof row.data === "object" ? row.data : {};
        return `<tr>${fields.map((field) => `<td>${ui.escape(subApps.displayValue(field, data[field.key]))}</td>`).join("")}<td>${ui.escape(when(row.created_at))}</td></tr>`;
      }).join("");
      sections.push(`<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`);
    }

    sections.push(recordForm(ui, schema, fields));
    return res.status(200).type("html").send(page(
      ui,
      schema.schema_key.replace(/_/g, " "),
      `Records inside ${found.row.name}.`,
      sections,
      SUB_APPS_PATH,
      [ui.link(`${SUB_APPS_PATH}/${encodeURIComponent(subAppId)}`, found.row.name), ui.link(SUB_APPS_PATH, "All your record types")]
    ));
  });

  // ---------------------------------------------------------------------------
  // Writes
  // ---------------------------------------------------------------------------

  app.post("/api/business/sub-apps", requireBusinessManager, async (req, res) => {
    const respond = answerer(req, res, SUB_APPS_PATH);
    const scope = await workspace(req, deps);
    if (!scope.ok) return respond(scope.status || 503, { ok: false, code: scope.code || "workspace_unavailable" });

    const name = text(req.body?.name, 120);
    if (!name) return respond(400, { ok: false, code: "name_required" });
    const slug = subApps.toKey(req.body?.slug || name);
    if (!slug) return respond(400, { ok: false, code: "name_unusable" });

    const created = await insert(scope.config, "business_sub_apps", {
      organization_id: scope.organizationId,
      created_by: scope.userId || null,
      name,
      slug,
      status: "draft"
    });
    // The unique index on (organization_id, slug) is what makes this a real
    // answer rather than a guess: PostgREST returns 409 and the customer is
    // told the name is taken, instead of a second sub-app appearing with the
    // same address as the first.
    if (created.status === 409) return respond(409, { ok: false, code: "name_already_used" });
    if (!created.ok) return respond(502, { ok: false, code: "not_saved" });
    const id = created.rows[0]?.id;
    return respond(201, { ok: true, subAppId: id }, id ? `${SUB_APPS_PATH}/${encodeURIComponent(id)}` : SUB_APPS_PATH);
  });

  app.post("/api/business/sub-app-schemas", requireBusinessManager, async (req, res) => {
    const subAppId = String(req.body?.sub_app_id || req.body?.subAppId || "");
    const back = isUuid(subAppId) ? `${SUB_APPS_PATH}/${encodeURIComponent(subAppId)}` : SUB_APPS_PATH;
    const respond = answerer(req, res, back);
    const scope = await workspace(req, deps);
    if (!scope.ok) return respond(scope.status || 503, { ok: false, code: scope.code || "workspace_unavailable" });
    if (!isUuid(subAppId)) return respond(400, { ok: false, code: "sub_app_required" });

    // Scoped by organization as well as by id: the service key bypasses row
    // level security, so a guessed id would otherwise add a record type to
    // another business's sub-app.
    const found = await loadSubApp(scope, subAppId);
    if (!found.ok) return respond(found.status, { ok: false, code: found.code });

    const schemaKey = subApps.toKey(req.body?.schema_key || req.body?.schemaKey || req.body?.name);
    if (!schemaKey) return respond(400, { ok: false, code: "record_type_name_required" });

    const parsed = subApps.normalizeFields(readFields(req.body));
    if (!parsed.ok) return respond(400, { ok: false, code: parsed.code, message: parsed.message });

    const created = await insert(scope.config, "business_sub_app_database_schemas", {
      organization_id: scope.organizationId,
      sub_app_id: subAppId,
      schema_key: schemaKey,
      fields: parsed.fields,
      status: "draft"
    });
    if (created.status === 409) return respond(409, { ok: false, code: "record_type_already_exists" });
    if (!created.ok) return respond(502, { ok: false, code: "not_saved" });
    return respond(201, { ok: true, schemaKey }, `${back}/${encodeURIComponent(schemaKey)}`);
  });

  app.post("/api/business/sub-app-records", requireBusinessManager, async (req, res) => {
    const schemaId = String(req.body?.schema_id || req.body?.schemaId || "");
    const respond = answerer(req, res, SUB_APPS_PATH);
    const scope = await workspace(req, deps);
    if (!scope.ok) return respond(scope.status || 503, { ok: false, code: scope.code || "workspace_unavailable" });
    if (!isUuid(schemaId)) return respond(400, { ok: false, code: "record_type_required" });

    const schemas = await rest(scope.config, "business_sub_app_database_schemas", `select=id,sub_app_id,schema_key,fields&organization_id=eq.${enc(scope.organizationId)}&id=eq.${enc(schemaId)}&limit=1`);
    if (!schemas.ok) return respond(503, { ok: false, code: "record_type_unreadable" });
    const schema = schemas.rows[0];
    if (!schema) return respond(404, { ok: false, code: "record_type_not_yours" });

    // The schema's own field list is what the record is checked against, read
    // fresh from the row rather than taken from the form. A form can be edited
    // in a browser; the stored schema cannot.
    const coerced = subApps.coerceRecord(schema.fields, req.body || {});
    const back = `${SUB_APPS_PATH}/${encodeURIComponent(schema.sub_app_id)}/${encodeURIComponent(schema.schema_key)}`;
    if (!coerced.ok) return answerer(req, res, back)(400, { ok: false, code: coerced.code, field: coerced.field, message: coerced.message });

    const created = await insert(scope.config, "business_sub_app_records", {
      organization_id: scope.organizationId,
      sub_app_id: schema.sub_app_id,
      schema_id: schema.id,
      created_by: scope.userId || null,
      data: coerced.data
    });
    if (!created.ok) return answerer(req, res, back)(502, { ok: false, code: "not_saved" });
    return answerer(req, res, back)(201, { ok: true, recordId: created.rows[0]?.id }, back);
  });

  // ---------------------------------------------------------------------------

  async function workspace(req, deps2) {
    const config = getConfig(deps2 || deps);
    if (!config.ok) {
      return { ok: false, status: 503, code: "setup_required", message: "Your account database is not connected yet, so there is nothing to show." };
    }
    const user = req.sonaraUser || req.sonaraAccess?.user || req.sonaraCustomer?.user || null;
    if (typeof (deps2 || deps).getCustomerPrimaryOrganization !== "function") {
      return { ok: false, status: 503, code: "organization_resolver_unavailable", message: "We could not tell which business you are signed in to." };
    }
    const organization = await (deps2 || deps).getCustomerPrimaryOrganization(user);
    if (!organization?.ok) {
      return { ok: false, status: 409, code: organization?.code || "workspace_not_ready", message: "We could not tell which business you are signed in to. Sign in again and this will fill up." };
    }
    return { ok: true, config, organizationId: organization.organizationId, userId: user?.id || null };
  }

  async function loadSubApp(scope, subAppId) {
    const found = await rest(scope.config, "business_sub_apps", `select=id,name,slug,status&organization_id=eq.${enc(scope.organizationId)}&id=eq.${enc(subAppId)}&limit=1`);
    // A read that failed is not a sub-app belonging to somebody else. Both
    // refuse; only one of them should say "not yours".
    if (!found.ok) return { ok: false, status: 503, code: "sub_app_unreadable", title: "We could not check", message: "The database did not answer just now. Nothing has changed." };
    if (!found.rows[0]) return { ok: false, status: 404, code: "sub_app_not_yours", title: "Not found", message: "That is not a record type we can find in your business." };
    return { ok: true, row: found.rows[0] };
  }
};

// -----------------------------------------------------------------------------
// Forms
// -----------------------------------------------------------------------------

function createSubAppForm() {
  return `<form class="card" method="post" action="/api/business/sub-apps"><fieldset><legend>Build one</legend>`
    + `<label>What is it called<input name="name" required maxlength="120"></label>`
    + `<p>A name for the whole set — "Kennels", "Boat slips", "Rehearsal rooms". You describe the fields on the next screen.</p>`
    + `<button type="submit">Create</button></fieldset></form>`;
}

function schemaForm(ui, subAppId) {
  const types = subApps.FIELD_TYPE_KEYS
    .map((key) => `<option value="${ui.escape(key)}">${ui.escape(subApps.FIELD_TYPES[key].label)}</option>`)
    .join("");
  // Five field rows rather than an add-a-row button, because this form posts as
  // an ordinary HTML form and there is no JavaScript on these pages. Blank rows
  // are ignored; five is enough to describe most things and another record type
  // can always be added.
  const rows = [0, 1, 2, 3, 4].map((index) => `<fieldset><legend>Field ${index + 1}${index === 0 ? "" : " (optional)"}</legend>`
    + `<label>Name<input name="field_label_${index}" maxlength="120"${index === 0 ? " required" : ""}></label>`
    + `<label>Kind<select name="field_type_${index}">${types}</select></label>`
    + `<label>Options, one per line, if you chose "One of a list"<textarea name="field_choices_${index}" maxlength="2000"></textarea></label>`
    + `<label><input type="checkbox" name="field_required_${index}"> Needed on every record</label>`
    + `</fieldset>`).join("");
  return `<form class="card" method="post" action="/api/business/sub-app-schemas">`
    + `<input type="hidden" name="sub_app_id" value="${ui.escape(subAppId)}">`
    + `<fieldset><legend>Describe a record type</legend>`
    + `<label>What is one of them called<input name="schema_key" required maxlength="60"></label>`
    + `<p>Singular reads best — "kennel", "slip", "room".</p>`
    + rows
    + `<button type="submit">Create record type</button></fieldset></form>`;
}

function recordForm(ui, schema, fields) {
  if (!fields.length) {
    return ui.card("Nothing to fill in", "This record type has no fields, so there is no form to show.");
  }
  const inputs = fields.map((field) => {
    const spec = subApps.FIELD_TYPES[field.type] || subApps.FIELD_TYPES.text;
    const required = field.required ? " required" : "";
    const name = ui.escape(field.key);
    const label = ui.escape(field.label);
    if (spec.input === "textarea") return `<label>${label}<textarea name="${name}" maxlength="4000"${required}></textarea></label>`;
    if (spec.input === "checkbox") return `<label><input type="checkbox" name="${name}"> ${label}</label>`;
    if (spec.input === "select") {
      const options = (field.choices || []).map((choice) => `<option value="${ui.escape(choice)}">${ui.escape(choice)}</option>`).join("");
      return `<label>${label}<select name="${name}"${required}><option value="">Choose one</option>${options}</select></label>`;
    }
    const step = field.type === "money" ? ' step="0.01" min="0"' : field.type === "number" ? ' step="any"' : "";
    return `<label>${label}<input type="${ui.escape(spec.input)}" name="${name}"${step}${required}></label>`;
  }).join("");
  return `<form class="card" method="post" action="/api/business/sub-app-records">`
    + `<input type="hidden" name="schema_id" value="${ui.escape(schema.id)}">`
    + `<fieldset><legend>Add one</legend>${inputs}<button type="submit">Save</button></fieldset></form>`;
}

// The five field rows, read out of a flat form body. Blank rows drop out here
// rather than reaching normalizeFields, which would refuse them by name.
function readFields(body = {}) {
  if (Array.isArray(body.fields)) return body.fields;
  const rows = [];
  for (let index = 0; index < 20; index += 1) {
    const label = body[`field_label_${index}`];
    if (label === undefined || !String(label).trim()) continue;
    rows.push({
      label,
      type: body[`field_type_${index}`],
      choices: body[`field_choices_${index}`],
      required: body[`field_required_${index}`]
    });
  }
  return rows;
}

// -----------------------------------------------------------------------------

function page(ui, heading, body, sections, current, extraActions = []) {
  return ui.layout({
    title: heading,
    eyebrow: "Business Builder operations",
    heading,
    body,
    sections: sections.length ? sections : [ui.card("Not available right now", body)],
    actions: [...extraActions, ui.link("/business-builder/dashboard", "Business Builder"), ui.link(current === SUB_APPS_PATH ? "/dashboard" : SUB_APPS_PATH, current === SUB_APPS_PATH ? "Dashboard" : "Your own record types")]
  });
}

// A browser gets its page back; a JSON caller gets the answer. The same shape
// every other write in this product uses.
function answerer(req, res, back) {
  const html = String(req.get?.("accept") || "").includes("text/html")
    || String(req.get?.("content-type") || "").includes("application/x-www-form-urlencoded");
  return (status, payload, target) => {
    if (!html) return res.status(status).json(payload);
    if (payload.ok) return res.redirect(303, target || back);
    return res.redirect(303, `${back}?problem=${encodeURIComponent(payload.code || "not_saved")}`);
  };
}

function getConfig(deps) {
  if (typeof deps.getSupabaseServerConfig === "function") return deps.getSupabaseServerConfig();
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && serviceRoleKey ? { ok: true, url: String(url).replace(/\/$/, ""), serviceRoleKey } : { ok: false };
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

function insert(config, table, body) {
  return rest(config, table, "", { method: "POST", prefer: "return=representation", body });
}

function enc(value) { return encodeURIComponent(String(value || "")); }
function text(value, max) { return String(value || "").trim().slice(0, max); }
function isUuid(value) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || "")); }
function when(value) {
  if (!value) return "Not recorded";
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : "Not recorded";
}
function pass(req, res, next) { next(); }
function basicLayout(data) { return `<!doctype html><html><head><title>${escapeHtml(data.title)}</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main><h1>${escapeHtml(data.heading)}</h1><p>${escapeHtml(data.body)}</p><nav>${(data.actions || []).join("")}</nav><section>${(data.sections || []).join("")}</section></main></body></html>`; }
function card(title, body) { return `<article class="card"><h2>${escapeHtml(title)}</h2><p>${escapeHtml(body)}</p></article>`; }
function link(href, label) { return `<a class="action" href="${escapeHtml(href)}">${escapeHtml(label)}</a>`; }
function escapeHtml(value) { return String(value === 0 ? 0 : value || "").replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[char])); }

module.exports.SUB_APPS_PATH = SUB_APPS_PATH;
