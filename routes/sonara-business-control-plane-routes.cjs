"use strict";

const { randomUUID } = require("node:crypto");

const BUSINESS_SELECT = "id,organization_id,created_by,owner_user_id,name,business_type,acquisition_mode,legal_name,public_name,industry,description,website_url,timezone,currency_code,status,metadata,created_at,updated_at,archived_at,deleted_at,version";

const RESOURCES = Object.freeze({
  locations: {
    table: "business_locations",
    label: "Locations",
    select: "id,business_id,name,location_type,address_line1,address_line2,city,region,postal_code,country,phone,email,status,metadata,created_at,updated_at",
    fields: {
      name: { required: true }, location_type: { values: ["storefront","mobile","food_truck","vehicle","home_service","event","online","other"], fallback: "storefront" },
      address_line1: {}, address_line2: {}, city: {}, region: {}, postal_code: {}, country: { fallback: "US" }, phone: {}, email: {},
      status: { values: ["active","inactive","archived"], fallback: "active" }, metadata: { type: "json" }
    }
  },
  channels: {
    table: "business_channels",
    label: "Physical and online channels",
    select: "id,business_id,channel_type,name,url,status,settings,created_at,updated_at,archived_at",
    actorColumn: "created_by",
    fields: {
      channel_type: { required: true, values: ["website","online_store","marketplace","social","phone","email","physical_location","mobile","other"] },
      name: { required: true }, url: {}, status: { values: ["active","inactive","setup_required","archived"], fallback: "active" }, settings: { type: "json" }
    }
  },
  employees: {
    table: "business_employee_profiles",
    label: "Team",
    select: "id,business_id,location_id,user_id,employee_number,display_name,email,phone,job_title,employment_type,status,hire_date,metadata,created_at,updated_at",
    fields: {
      location_id: { type: "uuid" }, employee_number: {}, display_name: { required: true }, email: {}, phone: {}, job_title: {},
      employment_type: { values: ["employee","contractor","seasonal","temporary","owner"], fallback: "employee" },
      status: { values: ["active","invited","disabled","terminated","archived"], fallback: "active" }, hire_date: { type: "date" }, metadata: { type: "json" }
    }
  },
  services: {
    table: "business_service_catalog",
    label: "Products and services",
    select: "id,business_id,location_id,name,category,description,price_cents,currency,duration_minutes,status,metadata,created_at,updated_at",
    fields: {
      location_id: { type: "uuid" }, name: { required: true }, category: {}, description: {}, price_cents: { type: "integer", fallback: 0 },
      currency: { fallback: "usd" }, duration_minutes: { type: "integer" }, status: { values: ["active","inactive","archived"], fallback: "active" }, metadata: { type: "json" }
    }
  },
  customers: {
    table: "customer_records",
    label: "Customers",
    select: "id,business_id,name,email,phone,status,notes,metadata,created_at,updated_at",
    actorColumn: "user_id",
    fields: {
      name: { required: true }, email: {}, phone: {}, status: { values: ["lead","active","inactive","archived"], fallback: "lead" }, notes: {}, metadata: { type: "json" }
    }
  },
  inventory: {
    table: "inventory_items",
    label: "Inventory",
    select: "id,business_id,location_id,name,sku,category,quantity,unit,reorder_level,cost_cents,price_cents,status,metadata,created_at,updated_at",
    fields: {
      location_id: { type: "uuid" }, name: { required: true }, sku: {}, category: {}, quantity: { type: "number", fallback: 0 }, unit: { fallback: "each" },
      reorder_level: { type: "number" }, cost_cents: { type: "integer" }, price_cents: { type: "integer" }, status: { values: ["active","inactive","archived"], fallback: "active" }, metadata: { type: "json" }
    }
  },
  assets: {
    table: "business_assets",
    label: "Assets and equipment",
    select: "id,business_id,location_id,name,asset_type,serial_number,purchase_date,purchase_cost_cents,status,metadata,created_at,updated_at",
    fields: {
      location_id: { type: "uuid" }, name: { required: true }, asset_type: { values: ["equipment","vehicle","trailer","appliance","tool","device","furniture","other"], fallback: "equipment" },
      serial_number: {}, purchase_date: { type: "date" }, purchase_cost_cents: { type: "integer" }, status: { values: ["active","maintenance","retired","lost","archived"], fallback: "active" }, metadata: { type: "json" }
    }
  },
  orders: {
    table: "order_records",
    label: "Orders",
    select: "id,business_id,customer_id,title,amount_cents,currency,status,metadata,created_at,updated_at",
    actorColumn: "user_id",
    fields: {
      customer_id: { type: "uuid" }, title: { required: true }, amount_cents: { type: "integer", fallback: 0 }, currency: { fallback: "usd" },
      status: { values: ["draft","pending","paid","fulfilled","cancelled","refunded"], fallback: "draft" }, metadata: { type: "json" }
    }
  },
  integrations: {
    table: "business_integration_connections",
    label: "Connected providers",
    select: "id,business_id,provider_key,display_name,connection_mode,connection_status,capabilities,settings,last_checked_at,created_at,updated_at",
    actorColumn: "created_by",
    ownerOnly: true,
    fields: {
      provider_key: { required: true }, display_name: {}, connection_mode: { values: ["api","oauth","manual","webhook","export"], fallback: "manual" },
      connection_status: { values: ["not_connected","connected","setup_required","error","disabled"], fallback: "setup_required" },
      capabilities: { type: "json" }, settings: { type: "json" }, last_checked_at: { type: "datetime" }
    }
  },
  permissions: {
    table: "business_permission_grants",
    label: "Permissions",
    select: "id,business_id,user_id,role_key,permission_key,location_id,status,expires_at,metadata,created_at,updated_at",
    actorColumn: "granted_by",
    ownerOnly: true,
    fields: {
      user_id: { required: true, type: "uuid" }, role_key: { values: ["owner","administrator","manager","employee","accountant","marketing","contractor","viewer"], fallback: "viewer" },
      permission_key: { required: true }, location_id: { type: "uuid" }, status: { values: ["active","revoked","expired"], fallback: "active" }, expires_at: { type: "datetime" }, metadata: { type: "json" }
    }
  }
});

module.exports = function registerSonaraBusinessControlPlaneRoutes(app, deps = {}) {
  const layout = deps.layout;
  const brandCard = deps.brandCard;
  const linkAction = deps.linkAction;
  const escapeHtml = deps.escapeHtml;
  const requirePaidOrOwnerAccess = deps.requirePaidOrOwnerAccess;
  const getCustomerPrimaryOrganization = deps.getCustomerPrimaryOrganization;
  const getSupabaseServerConfig = deps.getSupabaseServerConfig;
  const supabaseHeaders = deps.supabaseHeaders;
  const access = requirePaidOrOwnerAccess("business_builder");

  const configFor = () => getSupabaseServerConfig();

  async function rest(table, query = "", options = {}) {
    const config = configFor();
    if (!config?.ok) return { ok: false, status: 503, code: "supabase_setup_required", rows: [] };
    const response = await fetch(`${config.url}/rest/v1/${table}${query ? `?${query}` : ""}`, {
      method: options.method || "GET",
      headers: supabaseHeaders(config, options.prefer ? { prefer: options.prefer } : undefined),
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    }).catch(() => undefined);
    if (!response) return { ok: false, status: 503, code: "database_unreachable", rows: [] };
    const rows = response.status === 204 ? [] : await response.json().catch(() => []);
    return { ok: response.ok, status: response.status, code: response.ok ? "ok" : "database_operation_failed", rows };
  }

  async function context(req) {
    const organization = await getCustomerPrimaryOrganization(req.sonaraUser);
    if (!organization?.ok) return { ok: false, status: 409, code: organization?.code || "organization_setup_required" };
    return { ok: true, organizationId: organization.organizationId, userId: req.sonaraUser?.id || null };
  }

  async function loadBusiness(ctx, businessId, includeDeleted = false) {
    if (!isUuid(businessId)) return { ok: false, status: 400, code: "invalid_business_id" };
    const deletedFilter = includeDeleted ? "" : "&deleted_at=is.null";
    const result = await rest("business_workspaces", `select=${encodeURIComponent(BUSINESS_SELECT)}&id=eq.${encodeURIComponent(businessId)}&organization_id=eq.${encodeURIComponent(ctx.organizationId)}${deletedFilter}&limit=1`);
    if (!result.ok) return { ok: false, status: 502, code: result.code };
    if (!result.rows[0]) return { ok: false, status: 404, code: "business_not_found" };
    return { ok: true, business: result.rows[0] };
  }

  async function permission(req, ctx, businessId, permissionKey, ownerOnly = false) {
    const roles = Array.isArray(req.sonaraAccess?.roles) ? req.sonaraAccess.roles : [];
    const owner = Boolean(req.sonaraAccess?.ownerOverride || roles.some((role) => ["owner", "admin", "founder"].includes(role)));
    if (owner) return { ok: true, source: "owner" };
    if (ownerOnly) return { ok: false, status: 403, code: "business_owner_required" };
    const grants = await rest("business_permission_grants", `select=permission_key,status,expires_at&organization_id=eq.${encodeURIComponent(ctx.organizationId)}&business_id=eq.${encodeURIComponent(businessId)}&user_id=eq.${encodeURIComponent(ctx.userId)}&status=eq.active&limit=100`);
    if (!grants.ok) return { ok: false, status: 403, code: "business_permission_denied" };
    const now = Date.now();
    const allowed = grants.rows.some((grant) => {
      if (grant.expires_at && Date.parse(grant.expires_at) <= now) return false;
      const key = String(grant.permission_key || "");
      const family = `${permissionKey.split(".")[0]}.*`;
      return ["*", "business.*", family, permissionKey].includes(key);
    });
    return allowed ? { ok: true, source: "grant" } : { ok: false, status: 403, code: "business_permission_denied" };
  }

  async function audit(ctx, businessId, action, resourceType, resourceId, outcome = "success", metadata = {}) {
    await rest("business_control_audit_events", "", {
      method: "POST",
      prefer: "return=minimal",
      body: { organization_id: ctx.organizationId, business_id: businessId || null, actor_user_id: ctx.userId, action, resource_type: resourceType, resource_id: isUuid(resourceId) ? resourceId : null, outcome, metadata }
    });
  }

  async function listBusinesses(ctx) {
    return rest("business_workspaces", `select=${encodeURIComponent(BUSINESS_SELECT)}&organization_id=eq.${encodeURIComponent(ctx.organizationId)}&deleted_at=is.null&order=created_at.desc&limit=100`);
  }

  app.get("/api/business-builder/control-plane", access, async (req, res) => {
    const ctx = await context(req);
    if (!ctx.ok) return res.status(ctx.status).json(ctx);
    const businesses = await listBusinesses(ctx);
    const totals = {};
    for (const key of Object.keys(RESOURCES)) totals[key] = null;
    return res.status(businesses.ok ? 200 : 502).json({ ok: businesses.ok, status: businesses.ok ? "operational" : "setup_required", organizationId: ctx.organizationId, businesses: businesses.rows, resourceTypes: Object.keys(RESOURCES), totals });
  });

  app.get("/api/business-builder/businesses", access, async (req, res) => {
    const ctx = await context(req);
    if (!ctx.ok) return res.status(ctx.status).json(ctx);
    const result = await listBusinesses(ctx);
    return res.status(result.ok ? 200 : 502).json({ ok: result.ok, businesses: result.rows, code: result.code });
  });

  app.post("/api/business-builder/businesses", access, async (req, res) => {
    const ctx = await context(req);
    if (!ctx.ok) return send(req, res, ctx, "/business-builder/control-center");
    const allowed = await permission(req, ctx, randomUUID(), "business.create");
    if (!allowed.ok && !req.sonaraAccess?.ownerOverride) return send(req, res, allowed, "/business-builder/control-center");
    const name = text(req.body.name, 160);
    if (!name) return send(req, res, { ok: false, status: 400, code: "name_required" }, "/business-builder/control-center");
    const businessType = oneOf(req.body.business_type || req.body.businessType, ["physical","online","hybrid","service","restaurant","retail","creator","other"], "other");
    const acquisitionMode = oneOf(req.body.acquisition_mode || req.body.acquisitionMode, ["created","connected","imported"], "created");
    const record = {
      organization_id: ctx.organizationId,
      created_by: ctx.userId,
      owner_user_id: ctx.userId,
      name,
      business_type: businessType,
      acquisition_mode: acquisitionMode,
      legal_name: nullableText(req.body.legal_name || req.body.legalName, 200),
      public_name: nullableText(req.body.public_name || req.body.publicName, 200) || name,
      industry: nullableText(req.body.industry, 120),
      description: nullableText(req.body.description, 2000),
      website_url: safeUrl(req.body.website_url || req.body.websiteUrl),
      timezone: text(req.body.timezone, 80) || "America/New_York",
      currency_code: text(req.body.currency_code || req.body.currencyCode, 3).toLowerCase() || "usd",
      status: "active",
      metadata: parseJson(req.body.metadata, {})
    };
    const result = await rest("business_workspaces", "", { method: "POST", prefer: "return=representation", body: record });
    const business = result.rows[0];
    await audit(ctx, business?.id, "business.created", "business", business?.id, result.ok ? "success" : "failed", { acquisition_mode: acquisitionMode, business_type: businessType });
    return send(req, res, { ok: result.ok, status: result.ok ? 201 : 502, code: result.code, business }, business?.id ? `/business-builder/businesses/${business.id}` : "/business-builder/control-center");
  });

  app.get("/api/business-builder/businesses/:businessId", access, async (req, res) => {
    const ctx = await context(req);
    if (!ctx.ok) return res.status(ctx.status).json(ctx);
    const business = await loadBusiness(ctx, req.params.businessId);
    if (!business.ok) return res.status(business.status).json(business);
    const allowed = await permission(req, ctx, business.business.id, "business.read");
    if (!allowed.ok) return res.status(allowed.status).json(allowed);
    const resources = {};
    for (const [key, definition] of Object.entries(RESOURCES)) {
      const result = await listResource(ctx, business.business.id, definition, 25);
      resources[key] = result.ok ? result.rows : [];
    }
    return res.status(200).json({ ok: true, business: business.business, resources });
  });

  app.patch("/api/business-builder/businesses/:businessId", access, async (req, res) => updateBusiness(req, res));
  app.post("/api/business-builder/businesses/:businessId", access, async (req, res) => updateBusiness(req, res));

  async function updateBusiness(req, res) {
    const ctx = await context(req);
    if (!ctx.ok) return send(req, res, ctx, "/business-builder/control-center");
    const loaded = await loadBusiness(ctx, req.params.businessId, true);
    if (!loaded.ok) return send(req, res, loaded, "/business-builder/control-center");
    const allowed = await permission(req, ctx, loaded.business.id, "business.update");
    if (!allowed.ok) return send(req, res, allowed, `/business-builder/businesses/${loaded.business.id}`);
    const patch = {};
    const textFields = ["name","legal_name","public_name","industry","description","timezone","currency_code"];
    for (const field of textFields) if (req.body[field] !== undefined) patch[field] = nullableText(req.body[field], field === "description" ? 2000 : 200);
    if (req.body.website_url !== undefined) patch.website_url = safeUrl(req.body.website_url);
    if (req.body.business_type !== undefined) patch.business_type = oneOf(req.body.business_type, ["physical","online","hybrid","service","restaurant","retail","creator","other"], loaded.business.business_type || "other");
    if (req.body.status !== undefined) patch.status = oneOf(req.body.status, ["active","inactive","setup_required","archived"], loaded.business.status);
    if (req.body.metadata !== undefined) patch.metadata = parseJson(req.body.metadata, loaded.business.metadata || {});
    patch.updated_at = new Date().toISOString();
    patch.version = Number(loaded.business.version || 1) + 1;
    const result = await rest("business_workspaces", `id=eq.${encodeURIComponent(loaded.business.id)}&organization_id=eq.${encodeURIComponent(ctx.organizationId)}`, { method: "PATCH", prefer: "return=representation", body: patch });
    await audit(ctx, loaded.business.id, "business.updated", "business", loaded.business.id, result.ok ? "success" : "failed", { fields: Object.keys(patch) });
    return send(req, res, { ok: result.ok, status: result.ok ? 200 : 502, code: result.code, business: result.rows[0] }, `/business-builder/businesses/${loaded.business.id}`);
  }

  app.post("/api/business-builder/businesses/:businessId/archive", access, async (req, res) => businessState(req, res, "archive"));
  app.post("/api/business-builder/businesses/:businessId/restore", access, async (req, res) => businessState(req, res, "restore"));
  app.delete("/api/business-builder/businesses/:businessId", access, async (req, res) => businessState(req, res, "delete"));

  async function businessState(req, res, action) {
    const ctx = await context(req);
    if (!ctx.ok) return send(req, res, ctx, "/business-builder/control-center");
    const loaded = await loadBusiness(ctx, req.params.businessId, true);
    if (!loaded.ok) return send(req, res, loaded, "/business-builder/control-center");
    const allowed = await permission(req, ctx, loaded.business.id, `business.${action}`, action === "delete");
    if (!allowed.ok) return send(req, res, allowed, `/business-builder/businesses/${loaded.business.id}`);
    const now = new Date().toISOString();
    const patch = action === "restore"
      ? { status: "active", archived_at: null, deleted_at: null, updated_at: now }
      : action === "delete"
        ? { status: "archived", archived_at: loaded.business.archived_at || now, deleted_at: now, updated_at: now }
        : { status: "archived", archived_at: now, updated_at: now };
    const result = await rest("business_workspaces", `id=eq.${encodeURIComponent(loaded.business.id)}&organization_id=eq.${encodeURIComponent(ctx.organizationId)}`, { method: "PATCH", prefer: "return=representation", body: patch });
    await audit(ctx, loaded.business.id, `business.${action}d`, "business", loaded.business.id, result.ok ? "success" : "failed");
    return send(req, res, { ok: result.ok, status: result.ok ? 200 : 502, code: result.code }, action === "delete" ? "/business-builder/control-center" : `/business-builder/businesses/${loaded.business.id}`);
  }

  app.post("/api/business-builder/businesses/:businessId/ownership-transfers", access, async (req, res) => {
    const ctx = await context(req);
    if (!ctx.ok) return send(req, res, ctx, "/business-builder/control-center");
    const loaded = await loadBusiness(ctx, req.params.businessId);
    if (!loaded.ok) return send(req, res, loaded, "/business-builder/control-center");
    const allowed = await permission(req, ctx, loaded.business.id, "ownership.transfer", true);
    if (!allowed.ok) return send(req, res, allowed, `/business-builder/businesses/${loaded.business.id}`);
    const toEmail = text(req.body.to_email || req.body.toEmail, 320).toLowerCase();
    if (!emailLike(toEmail)) return send(req, res, { ok: false, status: 400, code: "valid_recipient_email_required" }, `/business-builder/businesses/${loaded.business.id}`);
    const result = await rest("business_ownership_transfers", "", { method: "POST", prefer: "return=representation", body: { organization_id: ctx.organizationId, business_id: loaded.business.id, from_user_id: ctx.userId, to_email: toEmail, status: "pending", metadata: { initiated_from: "business_builder_control_plane" } } });
    await audit(ctx, loaded.business.id, "ownership.transfer_requested", "ownership_transfer", result.rows[0]?.id, result.ok ? "success" : "failed", { to_email_domain: toEmail.split("@")[1] });
    return send(req, res, { ok: result.ok, status: result.ok ? 201 : 502, code: result.code, transfer: result.rows[0] }, `/business-builder/businesses/${loaded.business.id}`);
  });

  app.get("/api/business-builder/businesses/:businessId/:resource", access, async (req, res) => {
    const definition = RESOURCES[req.params.resource];
    if (!definition) return res.status(404).json({ ok: false, code: "resource_not_found" });
    const ctx = await context(req);
    if (!ctx.ok) return res.status(ctx.status).json(ctx);
    const loaded = await loadBusiness(ctx, req.params.businessId);
    if (!loaded.ok) return res.status(loaded.status).json(loaded);
    const allowed = await permission(req, ctx, loaded.business.id, `${req.params.resource}.read`, definition.ownerOnly);
    if (!allowed.ok) return res.status(allowed.status).json(allowed);
    const result = await listResource(ctx, loaded.business.id, definition, clamp(req.query.limit, 1, 200, 50));
    return res.status(result.ok ? 200 : 502).json({ ok: result.ok, resource: req.params.resource, records: result.rows, code: result.code });
  });

  app.post("/api/business-builder/businesses/:businessId/:resource", access, async (req, res) => {
    const definition = RESOURCES[req.params.resource];
    if (!definition) return res.status(404).json({ ok: false, code: "resource_not_found" });
    const ctx = await context(req);
    if (!ctx.ok) return send(req, res, ctx, "/business-builder/control-center");
    const loaded = await loadBusiness(ctx, req.params.businessId);
    if (!loaded.ok) return send(req, res, loaded, "/business-builder/control-center");
    const allowed = await permission(req, ctx, loaded.business.id, `${req.params.resource}.create`, definition.ownerOnly);
    if (!allowed.ok) return send(req, res, allowed, `/business-builder/businesses/${loaded.business.id}`);
    const normalized = normalizeFields(req.body, definition.fields, false);
    if (!normalized.ok) return send(req, res, normalized, `/business-builder/businesses/${loaded.business.id}`);
    const record = { organization_id: ctx.organizationId, business_id: loaded.business.id, ...normalized.value };
    if (definition.actorColumn) record[definition.actorColumn] = ctx.userId;
    const result = await rest(definition.table, "", { method: "POST", prefer: "return=representation", body: record });
    await audit(ctx, loaded.business.id, `${req.params.resource}.created`, req.params.resource, result.rows[0]?.id, result.ok ? "success" : "failed");
    return send(req, res, { ok: result.ok, status: result.ok ? 201 : 502, code: result.code, record: result.rows[0] }, `/business-builder/businesses/${loaded.business.id}`);
  });

  app.patch("/api/business-builder/businesses/:businessId/:resource/:id", access, async (req, res) => mutateResource(req, res, "update"));
  app.post("/api/business-builder/businesses/:businessId/:resource/:id", access, async (req, res) => mutateResource(req, res, "update"));
  app.delete("/api/business-builder/businesses/:businessId/:resource/:id", access, async (req, res) => mutateResource(req, res, "archive"));

  async function mutateResource(req, res, action) {
    const definition = RESOURCES[req.params.resource];
    if (!definition || !isUuid(req.params.id)) return res.status(404).json({ ok: false, code: "resource_not_found" });
    const ctx = await context(req);
    if (!ctx.ok) return send(req, res, ctx, "/business-builder/control-center");
    const loaded = await loadBusiness(ctx, req.params.businessId);
    if (!loaded.ok) return send(req, res, loaded, "/business-builder/control-center");
    const allowed = await permission(req, ctx, loaded.business.id, `${req.params.resource}.${action}`, definition.ownerOnly);
    if (!allowed.ok) return send(req, res, allowed, `/business-builder/businesses/${loaded.business.id}`);
    const patch = action === "archive"
      ? { status: "archived", updated_at: new Date().toISOString() }
      : normalizeFields(req.body, definition.fields, true).value;
    patch.updated_at = new Date().toISOString();
    const result = await rest(definition.table, `id=eq.${encodeURIComponent(req.params.id)}&organization_id=eq.${encodeURIComponent(ctx.organizationId)}&business_id=eq.${encodeURIComponent(loaded.business.id)}`, { method: "PATCH", prefer: "return=representation", body: patch });
    await audit(ctx, loaded.business.id, `${req.params.resource}.${action}d`, req.params.resource, req.params.id, result.ok ? "success" : "failed", { fields: Object.keys(patch) });
    return send(req, res, { ok: result.ok, status: result.ok ? 200 : 502, code: result.code, record: result.rows[0] }, `/business-builder/businesses/${loaded.business.id}`);
  }

  app.get("/business-builder/control-center", access, async (req, res) => {
    const ctx = await context(req);
    if (!ctx.ok) return res.status(ctx.status).type("html").send(page("Business setup required", "Create or repair your organization before opening Business Builder.", []));
    const result = await listBusinesses(ctx);
    const cards = result.rows.map((business) => `<article class="card"><h2>${escapeHtml(business.public_name || business.name)}</h2><p>${escapeHtml(business.business_type || "business")} · ${escapeHtml(business.status || "active")} · ${escapeHtml(business.acquisition_mode || "created")}</p><div class="card-actions"><a class="action" href="/business-builder/businesses/${encodeURIComponent(business.id)}">Manage business</a></div></article>`).join("") || brandCard("No businesses yet", "Create a physical, online, or hybrid business below.");
    const createForm = `<article class="card"><h2>Create or add a business</h2><form method="post" action="/api/business-builder/businesses"><label>Business name<input name="name" required maxlength="160"></label><label>Public name<input name="public_name" maxlength="200"></label><label>Business type<select name="business_type"><option value="physical">Physical</option><option value="online">Online</option><option value="hybrid">Physical and online</option><option value="service">Service</option><option value="restaurant">Restaurant</option><option value="retail">Retail</option><option value="other">Other</option></select></label><label>How it enters SONARA<select name="acquisition_mode"><option value="created">Create with SONARA</option><option value="connected">Add an existing business</option><option value="imported">Import an existing business</option></select></label><label>Industry<input name="industry" maxlength="120"></label><label>Website<input name="website_url" type="url"></label><label>Description<textarea name="description" rows="4" maxlength="2000"></textarea></label><button type="submit">Create business workspace</button></form></article>`;
    return res.status(200).type("html").send(layout({ title: "Business Builder Control Center", eyebrow: "Business ownership", heading: "Control every business from one workspace", body: "Create or add physical and online businesses, then manage locations, channels, people, customers, catalog, inventory, assets, orders, integrations, permissions, ownership, and audit evidence.", sections: [createForm, `<section class="grid">${cards}</section>`, brandCard("Ownership boundary", "Customers control their business records and operations. SONARA controls platform security, billing enforcement, and audited support intervention.")], actions: [linkAction("/business-builder/dashboard", "Business Builder"), linkAction("/pricing", "Billing"), linkAction("/support", "Support")] }));
  });

  app.get("/business-builder/businesses", access, (req, res) => res.redirect(302, "/business-builder/control-center"));

  app.get("/business-builder/businesses/:businessId", access, async (req, res) => {
    const ctx = await context(req);
    if (!ctx.ok) return res.status(ctx.status).type("html").send(page("Business setup required", "Organization setup is incomplete.", []));
    const loaded = await loadBusiness(ctx, req.params.businessId);
    if (!loaded.ok) return res.status(loaded.status).type("html").send(page("Business not found", "The requested business is unavailable or outside your organization.", [linkAction("/business-builder/control-center", "Control center")]));
    const allowed = await permission(req, ctx, loaded.business.id, "business.read");
    if (!allowed.ok) return res.status(allowed.status).type("html").send(page("Access denied", "Your role does not allow this business.", [linkAction("/business-builder/control-center", "Control center")]));
    const sections = [businessSummary(loaded.business, escapeHtml)];
    for (const [key, definition] of Object.entries(RESOURCES)) {
      const permissionResult = await permission(req, ctx, loaded.business.id, `${key}.read`, definition.ownerOnly);
      if (!permissionResult.ok) continue;
      const result = await listResource(ctx, loaded.business.id, definition, 10);
      sections.push(resourceSection(loaded.business.id, key, definition, result.rows, escapeHtml));
    }
    sections.push(ownershipSection(loaded.business.id, escapeHtml));
    return res.status(200).type("html").send(layout({ title: `${loaded.business.public_name || loaded.business.name} · Business Builder`, eyebrow: "Customer-controlled business", heading: loaded.business.public_name || loaded.business.name, body: "Every action is organization-scoped, permission-checked, and written to the business audit trail.", sections, actions: [linkAction("/business-builder/control-center", "All businesses"), linkAction(`/api/business-builder/businesses/${loaded.business.id}`, "Business JSON"), linkAction("/business-builder/dashboard", "Dashboard")] }));
  });

  function page(title, body, actions) {
    return layout({ title, eyebrow: "Business Builder", heading: title, body, sections: [], actions });
  }
};

async function listResource(ctx, businessId, definition, limit) {
  const config = globalThis.__sonaraBusinessControlRest;
  if (typeof config === "function") return config(definition.table, `select=${encodeURIComponent(definition.select)}&organization_id=eq.${encodeURIComponent(ctx.organizationId)}&business_id=eq.${encodeURIComponent(businessId)}&order=created_at.desc&limit=${limit}`);
  return { ok: false, rows: [], code: "runtime_not_bound" };
}

function normalizeFields(body, fields, partial) {
  const value = {};
  const missing = [];
  for (const [name, rules] of Object.entries(fields)) {
    const supplied = body[name] !== undefined;
    if (!supplied && partial) continue;
    let input = supplied ? body[name] : rules.fallback;
    if ((input === undefined || input === null || String(input).trim() === "") && rules.required) { missing.push(name); continue; }
    if (input === undefined || input === null || String(input).trim() === "") { if (!partial && rules.fallback !== undefined) value[name] = rules.fallback; continue; }
    if (rules.type === "uuid") { if (!isUuid(input)) return { ok: false, status: 400, code: `invalid_${name}`, value: {} }; value[name] = String(input); continue; }
    if (rules.type === "integer") { const parsed = Number.parseInt(String(input), 10); if (!Number.isFinite(parsed)) return { ok: false, status: 400, code: `invalid_${name}`, value: {} }; value[name] = parsed; continue; }
    if (rules.type === "number") { const parsed = Number(String(input)); if (!Number.isFinite(parsed)) return { ok: false, status: 400, code: `invalid_${name}`, value: {} }; value[name] = parsed; continue; }
    if (rules.type === "json") { value[name] = parseJson(input, {}); continue; }
    if (rules.type === "date" || rules.type === "datetime") { const date = new Date(String(input)); if (Number.isNaN(date.getTime())) return { ok: false, status: 400, code: `invalid_${name}`, value: {} }; value[name] = rules.type === "date" ? date.toISOString().slice(0, 10) : date.toISOString(); continue; }
    const cleaned = text(input, name === "description" || name === "notes" ? 4000 : 500);
    value[name] = rules.values ? oneOf(cleaned, rules.values, rules.fallback) : cleaned;
  }
  if (missing.length) return { ok: false, status: 400, code: "required_fields_missing", missing, value: {} };
  return { ok: true, value };
}

function businessSummary(business, escapeHtml) {
  return `<section class="grid"><article class="card"><h2>Business profile</h2><p>${escapeHtml(business.business_type || "business")} · ${escapeHtml(business.acquisition_mode || "created")} · ${escapeHtml(business.status || "active")}</p><p>${escapeHtml(business.description || "No description yet.")}</p></article><article class="card"><h2>Online identity</h2><p>${business.website_url ? `<a href="${escapeHtml(business.website_url)}" rel="noreferrer">${escapeHtml(business.website_url)}</a>` : "No website connected."}</p><p>${escapeHtml(business.timezone || "America/New_York")} · ${escapeHtml(String(business.currency_code || "usd").toUpperCase())}</p></article><article class="card"><h2>Lifecycle</h2><form method="post" action="/api/business-builder/businesses/${encodeURIComponent(business.id)}/archive"><button type="submit">Archive business</button></form><form method="post" action="/api/business-builder/businesses/${encodeURIComponent(business.id)}/restore"><button type="submit">Restore business</button></form></article></section>`;
}

function resourceSection(businessId, key, definition, rows, escapeHtml) {
  const recordRows = rows.map((row) => `<tr><td>${escapeHtml(String(row.name || row.display_name || row.title || row.provider_key || row.permission_key || row.id))}</td><td>${escapeHtml(String(row.status || row.connection_status || row.role_key || "active"))}</td><td><code>${escapeHtml(String(row.id))}</code></td></tr>`).join("") || '<tr><td colspan="3">No records yet.</td></tr>';
  const inputs = Object.entries(definition.fields).filter(([, rules]) => !["json"].includes(rules.type)).map(([name, rules]) => `<label>${escapeHtml(name.replaceAll("_", " "))}<input name="${escapeHtml(name)}"${rules.required ? " required" : ""}></label>`).join("");
  return `<section class="card"><h2>${escapeHtml(definition.label)}</h2><table><thead><tr><th>Record</th><th>Status</th><th>ID</th></tr></thead><tbody>${recordRows}</tbody></table><details><summary>Add ${escapeHtml(definition.label.toLowerCase())}</summary><form method="post" action="/api/business-builder/businesses/${encodeURIComponent(businessId)}/${encodeURIComponent(key)}">${inputs}<button type="submit">Save record</button></form></details><p><a href="/api/business-builder/businesses/${encodeURIComponent(businessId)}/${encodeURIComponent(key)}">Open complete JSON list</a></p></section>`;
}

function ownershipSection(businessId, escapeHtml) {
  return `<section class="card"><h2>Ownership transfer</h2><p>Creates a seven-day pending transfer request. Ownership is not changed until the recipient is authenticated and acceptance is explicitly completed.</p><form method="post" action="/api/business-builder/businesses/${encodeURIComponent(businessId)}/ownership-transfers"><label>Recipient email<input name="to_email" type="email" required></label><button type="submit">Request ownership transfer</button></form></section>`;
}

function send(req, res, result, redirectTo) {
  const status = Number(result.status || (result.ok ? 200 : 400));
  if (acceptsHtml(req)) return result.ok ? res.redirect(303, redirectTo) : res.status(status).type("html").send(`<h1>Business action not completed</h1><p>${String(result.code || "request_failed")}</p><p><a href="${redirectTo}">Return</a></p>`);
  return res.status(status).json(result);
}

function acceptsHtml(req) { return String(req.get("accept") || "").includes("text/html") || String(req.get("content-type") || "").includes("application/x-www-form-urlencoded"); }
function isUuid(value) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || "")); }
function text(value, max = 500) { return String(value || "").trim().slice(0, max); }
function nullableText(value, max = 500) { const cleaned = text(value, max); return cleaned || null; }
function oneOf(value, allowed, fallback) { const cleaned = String(value || "").trim().toLowerCase(); return allowed.includes(cleaned) ? cleaned : fallback; }
function parseJson(value, fallback) { if (value && typeof value === "object") return value; if (!String(value || "").trim()) return fallback; try { const parsed = JSON.parse(String(value)); return parsed && typeof parsed === "object" ? parsed : fallback; } catch { return fallback; } }
function safeUrl(value) { const cleaned = text(value, 1000); if (!cleaned) return null; try { const parsed = new URL(cleaned); return ["http:","https:"].includes(parsed.protocol) ? parsed.toString() : null; } catch { return null; } }
function emailLike(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "")); }
function clamp(value, min, max, fallback) { const parsed = Number.parseInt(String(value || ""), 10); return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback; }
