"use strict";

const { ROUTE_REGISTRY, plainRouteTitle } = require("../lib/sonara-route-registry.cjs");

const { randomUUID } = require("node:crypto");

const BUSINESS_SELECT = "id,organization_id,created_by,owner_user_id,name,business_type,acquisition_mode,legal_name,public_name,industry,description,website_url,timezone,currency_code,status,metadata,created_at,updated_at,archived_at,deleted_at,version";

const RESOURCES = Object.freeze({
  services: resource({
    table: "business_service_catalog",
    label: "Offers & services",
    description: "Create the products, services, packages, and appointments customers can buy.",
    group: "launch",
    select: "id,business_id,location_id,name,category,description,price_cents,currency,duration_minutes,status,metadata,created_at,updated_at",
    fields: {
      name: field("Offer or service name", { required: true }),
      category: field("Category"),
      description: field("What the customer receives", { textarea: true }),
      price_cents: field("Price", { type: "money", fallback: 0 }),
      currency: field("Currency", { fallback: "usd", values: ["usd"] }),
      duration_minutes: field("Duration in minutes", { type: "integer" }),
      location_id: field("Location ID", { type: "uuid", advanced: true }),
      status: field("Status", { values: ["active", "inactive", "archived"], fallback: "active" }),
      metadata: field("Metadata", { type: "json", hidden: true })
    }
  }),
  customers: resource({
    table: "customer_records",
    label: "Customers",
    description: "Keep customer and lead contact details, status, and notes in one place.",
    group: "sales",
    select: "id,business_id,name,email,phone,status,notes,metadata,created_at,updated_at",
    actorColumn: "user_id",
    fields: {
      name: field("Customer name", { required: true }),
      email: field("Email", { input: "email" }),
      phone: field("Phone", { input: "tel" }),
      status: field("Status", { values: ["lead", "active", "inactive", "archived"], fallback: "lead" }),
      notes: field("Notes", { textarea: true }),
      metadata: field("Metadata", { type: "json", hidden: true })
    }
  }),
  orders: resource({
    table: "order_records",
    label: "Orders & sales",
    description: "Track quotes, open orders, paid work, fulfillment, cancellations, and refunds.",
    group: "sales",
    select: "id,business_id,customer_id,title,amount_cents,currency,status,metadata,created_at,updated_at",
    actorColumn: "user_id",
    fields: {
      title: field("Order or invoice title", { required: true }),
      amount_cents: field("Amount", { type: "money", fallback: 0 }),
      currency: field("Currency", { fallback: "usd", values: ["usd"] }),
      status: field("Status", { values: ["draft", "pending", "paid", "fulfilled", "cancelled", "refunded"], fallback: "draft" }),
      customer_id: field("Customer ID", { type: "uuid", advanced: true }),
      metadata: field("Metadata", { type: "json", hidden: true })
    }
  }),
  bookings: resource({
    table: "business_bookings",
    label: "Bookings & appointments",
    description: "Schedule customer work and move it from requested to confirmed to completed.",
    group: "sales",
    select: "id,business_id,location_id,service_id,customer_id,assigned_employee_id,customer_name,customer_email,customer_phone,starts_at,ends_at,status,notes,metadata,created_at,updated_at",
    fields: {
      customer_name: field("Customer name", { required: true }),
      customer_email: field("Customer email", { input: "email" }),
      customer_phone: field("Customer phone", { input: "tel" }),
      starts_at: field("Starts", { type: "datetime", required: true }),
      ends_at: field("Ends", { type: "datetime" }),
      status: field("Status", { values: ["requested", "confirmed", "completed", "cancelled", "no_show", "archived"], fallback: "requested" }),
      notes: field("Notes", { textarea: true }),
      location_id: field("Location ID", { type: "uuid", advanced: true }),
      service_id: field("Service ID", { type: "uuid", advanced: true }),
      customer_id: field("Customer ID", { type: "uuid", advanced: true }),
      assigned_employee_id: field("Employee ID", { type: "uuid", advanced: true }),
      metadata: field("Metadata", { type: "json", hidden: true })
    }
  }),
  locations: resource({
    table: "business_locations",
    label: "Locations",
    description: "Manage storefronts, mobile routes, food trucks, service areas, events, and online locations.",
    group: "launch",
    select: "id,business_id,name,location_type,address_line1,address_line2,city,region,postal_code,country,phone,email,status,metadata,created_at,updated_at",
    fields: {
      name: field("Location name", { required: true }),
      location_type: field("Location type", { values: ["storefront", "mobile", "food_truck", "vehicle", "home_service", "event", "online", "other"], fallback: "storefront" }),
      address_line1: field("Street address"),
      address_line2: field("Unit or suite"),
      city: field("City"),
      region: field("State or region"),
      postal_code: field("Postal code"),
      country: field("Country", { fallback: "US" }),
      phone: field("Phone", { input: "tel" }),
      email: field("Email", { input: "email" }),
      status: field("Status", { values: ["active", "inactive", "archived"], fallback: "active" }),
      metadata: field("Metadata", { type: "json", hidden: true })
    }
  }),
  channels: resource({
    table: "business_channels",
    label: "Sales channels",
    description: "Track your website, online store, marketplaces, social pages, phone, email, and physical sales channels.",
    group: "launch",
    select: "id,business_id,channel_type,name,url,status,settings,created_at,updated_at,archived_at",
    actorColumn: "created_by",
    fields: {
      name: field("Channel name", { required: true }),
      channel_type: field("Channel type", { required: true, values: ["website", "online_store", "marketplace", "social", "phone", "email", "physical_location", "mobile", "other"] }),
      url: field("URL", { input: "url" }),
      status: field("Status", { values: ["active", "inactive", "setup_required", "archived"], fallback: "active" }),
      settings: field("Settings", { type: "json", hidden: true })
    }
  }),
  employees: resource({
    table: "business_employee_profiles",
    label: "Team",
    description: "Create team profiles and track role, contact information, employment type, and status.",
    group: "operations",
    select: "id,business_id,location_id,user_id,employee_number,display_name,email,phone,job_title,employment_type,status,hire_date,metadata,created_at,updated_at",
    fields: {
      display_name: field("Team member name", { required: true }),
      email: field("Email", { input: "email" }),
      phone: field("Phone", { input: "tel" }),
      job_title: field("Job title"),
      employment_type: field("Employment type", { values: ["employee", "contractor", "seasonal", "temporary", "owner"], fallback: "employee" }),
      hire_date: field("Hire date", { type: "date" }),
      employee_number: field("Employee number", { advanced: true }),
      location_id: field("Location ID", { type: "uuid", advanced: true }),
      status: field("Status", { values: ["active", "invited", "disabled", "terminated", "archived"], fallback: "active" }),
      metadata: field("Metadata", { type: "json", hidden: true })
    }
  }),
  inventory: resource({
    table: "inventory_items",
    label: "Inventory",
    description: "Track stock, units, cost, selling price, and reorder points.",
    group: "operations",
    select: "id,business_id,location_id,name,sku,category,quantity,unit,reorder_level,cost_cents,price_cents,status,metadata,created_at,updated_at",
    fields: {
      name: field("Item name", { required: true }),
      sku: field("SKU"),
      category: field("Category"),
      quantity: field("Quantity", { type: "number", fallback: 0 }),
      unit: field("Unit", { fallback: "each" }),
      reorder_level: field("Reorder at", { type: "number" }),
      cost_cents: field("Unit cost", { type: "money" }),
      price_cents: field("Selling price", { type: "money" }),
      location_id: field("Location ID", { type: "uuid", advanced: true }),
      status: field("Status", { values: ["active", "inactive", "archived"], fallback: "active" }),
      metadata: field("Metadata", { type: "json", hidden: true })
    }
  }),
  assets: resource({
    table: "business_assets",
    label: "Equipment & assets",
    description: "Track equipment, vehicles, trailers, appliances, tools, devices, and furniture.",
    group: "operations",
    select: "id,business_id,location_id,name,asset_type,serial_number,purchase_date,purchase_cost_cents,status,metadata,created_at,updated_at",
    fields: {
      name: field("Asset name", { required: true }),
      asset_type: field("Asset type", { values: ["equipment", "vehicle", "trailer", "appliance", "tool", "device", "furniture", "other"], fallback: "equipment" }),
      serial_number: field("Serial number"),
      purchase_date: field("Purchase date", { type: "date" }),
      purchase_cost_cents: field("Purchase cost", { type: "money" }),
      location_id: field("Location ID", { type: "uuid", advanced: true }),
      status: field("Status", { values: ["active", "maintenance", "retired", "lost", "archived"], fallback: "active" }),
      metadata: field("Metadata", { type: "json", hidden: true })
    }
  }),
  integrations: resource({
    table: "business_integration_connections",
    label: "Connected tools",
    description: "Record payment, email, calendar, payroll, website, and other provider connections without exposing credentials.",
    group: "settings",
    select: "id,business_id,provider_key,display_name,connection_mode,connection_status,capabilities,settings,last_checked_at,created_at,updated_at",
    actorColumn: "created_by",
    ownerOnly: true,
    archivePatch: { connection_status: "disabled" },
    fields: {
      provider_key: field("Provider key", { required: true }),
      display_name: field("Display name"),
      connection_mode: field("Connection method", { values: ["api", "oauth", "manual", "webhook", "export"], fallback: "manual" }),
      connection_status: field("Connection status", { values: ["not_connected", "connected", "setup_required", "error", "disabled"], fallback: "setup_required" }),
      last_checked_at: field("Last checked", { type: "datetime", advanced: true }),
      capabilities: field("Capabilities", { type: "json", hidden: true }),
      settings: field("Settings", { type: "json", hidden: true })
    }
  }),
  permissions: resource({
    table: "business_permission_grants",
    label: "Access & permissions",
    description: "Give approved people only the business access they need.",
    group: "settings",
    select: "id,business_id,user_id,role_key,permission_key,location_id,status,expires_at,metadata,created_at,updated_at",
    actorColumn: "granted_by",
    ownerOnly: true,
    archivePatch: { status: "revoked" },
    fields: {
      user_id: field("User ID", { required: true, type: "uuid" }),
      role_key: field("Role", { values: ["owner", "administrator", "manager", "employee", "accountant", "marketing", "contractor", "viewer"], fallback: "viewer" }),
      permission_key: field("Permission", { required: true }),
      location_id: field("Location ID", { type: "uuid", advanced: true }),
      expires_at: field("Expires", { type: "datetime", advanced: true }),
      status: field("Status", { values: ["active", "revoked", "expired"], fallback: "active" }),
      metadata: field("Metadata", { type: "json", hidden: true })
    }
  })
});

const CORE_DASHBOARD_RESOURCES = Object.freeze(["services", "customers", "orders", "bookings", "employees", "inventory", "locations"]);

module.exports = function registerSonaraBusinessControlPlaneRoutes(app, deps = {}) {
  const layout = deps.layout;
  const brandCard = deps.brandCard;
  const linkAction = deps.linkAction;
  const escapeHtml = deps.escapeHtml;
  const requirePaidOrOwnerAccess = deps.requirePaidOrOwnerAccess;
  const requireCustomer = deps.requireCustomer || requirePaidOrOwnerAccess("business_builder");
  const requireWorkspaceAccess = deps.requireWorkspaceAccess;
  const getCustomerPrimaryOrganization = deps.getCustomerPrimaryOrganization;
  const getSupabaseServerConfig = deps.getSupabaseServerConfig;
  const supabaseHeaders = deps.supabaseHeaders;
  const access = requirePaidOrOwnerAccess("business_builder");
  const workspaceAccess = typeof requireWorkspaceAccess === "function" ? requireWorkspaceAccess("business_builder") : requireCustomer;

  const configFor = () => getSupabaseServerConfig();

  async function rest(table, query = "", options = {}) {
    const config = configFor();
    if (!config?.ok) return { ok: false, status: 503, code: "workspace_unavailable", rows: [] };
    const extraHeaders = {};
    if (options.prefer) extraHeaders.prefer = options.prefer;
    const response = await fetch(`${config.url}/rest/v1/${table}${query ? `?${query}` : ""}`, {
      method: options.method || "GET",
      headers: supabaseHeaders(config, extraHeaders),
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    }).catch(() => undefined);
    if (!response) return { ok: false, status: 503, code: "database_unreachable", rows: [] };
    const rows = response.status === 204 ? [] : await response.json().catch(() => []);
    return { ok: response.ok, status: response.status, code: response.ok ? "ok" : "database_operation_failed", rows };
  }

  globalThis.__sonaraBusinessControlRest = rest;

  async function context(req) {
    const organization = await getCustomerPrimaryOrganization(req.sonaraUser);
    if (!organization?.ok) return { ok: false, status: 409, code: organization?.code || "workspace_not_ready" };
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

  async function primaryBusiness(ctx) {
    const result = await listBusinesses(ctx);
    return result.ok && result.rows[0] ? { ok: true, business: result.rows[0] } : { ok: false, status: result.ok ? 404 : 502, code: result.ok ? "business_required" : result.code };
  }

  // How many rows the dashboard reads before it starts saying "or more".
  const DASHBOARD_PAGE = 200;

  async function dashboardSnapshot(ctx, businessId) {
    const entries = await Promise.all(CORE_DASHBOARD_RESOURCES.map(async (key) => {
      // One row past the page, so a list that fills it can say so rather than
      // reporting the cap as the total.
      const result = await listResource(ctx, businessId, RESOURCES[key], DASHBOARD_PAGE + 1);
      // **A read that failed is not an empty table.** This used to be
      // `result.ok ? result.rows : []`, which turned every failure into "you
      // have none of these" -- and the next-step advice below is driven by these
      // counts, so an unreadable services table told a business that already
      // sells things to "Create the first offer". Wrong numbers are bad; wrong
      // instructions are worse.
      return [key, result.ok ? result.rows : null];
    }));

    const records = Object.fromEntries(entries.map(([key, rows]) => [key, rows || []]));
    const readable = Object.fromEntries(entries.map(([key, rows]) => [key, Array.isArray(rows)]));

    // null means "not known", never 0. Everything downstream has to handle it,
    // which is the point: a figure nobody could read should be visibly absent
    // rather than quietly plausible.
    const counts = Object.fromEntries(entries.map(([key, rows]) => [key, rows ? Math.min(rows.length, DASHBOARD_PAGE) : null]));
    const truncated = Object.fromEntries(entries.map(([key, rows]) => [key, Boolean(rows && rows.length > DASHBOARD_PAGE)]));

    const derived = (key, predicate) => (readable[key] ? records[key].filter(predicate).length : null);

    return {
      records,
      counts,
      truncated,
      readable,
      pendingOrders: derived("orders", (row) => ["draft", "pending"].includes(row.status)),
      upcomingBookings: derived("bookings", (row) => ["requested", "confirmed"].includes(row.status)),
      lowStock: derived("inventory", (row) => Number.isFinite(Number(row.reorder_level)) && Number(row.quantity || 0) <= Number(row.reorder_level))
    };
  }

  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path !== "/account/setup") return next();
    return res.status(200).type("html").send(layout({
      title: "Set up your business workspace",
      eyebrow: "Business Builder",
      heading: "Name your business workspace.",
      body: "This keeps your business, customers, offers, orders, bookings, team, and records together. You will build the actual business on the next screen.",
      sections: [
        '<article class="card bb-onboarding-card"><form method="post" action="/account/setup/organization"><label>Business or workspace name<input name="organizationName" type="text" minlength="2" maxlength="120" autocomplete="organization" required></label><input type="hidden" name="productPath" value="business-builder"><button type="submit">Continue to Business Builder</button></form></article>',
        launchPath(),
        '<span hidden aria-hidden="true">Create or attach organization</span><span hidden aria-hidden="true">profiles, organizations, and organization_memberships</span>'
      ],
      actions: [linkAction("/login", "Log in"), linkAction("/support", "Get help")]
    }));
  });

  async function renderBusinessBuilderDashboard(req, res) {
    const ctx = await context(req);
    if (!ctx.ok) return res.status(200).type("html").send(onboardingPage());
    const businesses = await listBusinesses(ctx);
    if (!businesses.ok) return res.status(503).type("html").send(friendlyPage("Business Builder is temporarily unavailable", "Your records are safe. Try again in a moment.", [linkAction("/business-builder/dashboard", "Try again"), linkAction("/support", "Get help")]));
    if (!businesses.rows.length) return res.status(200).type("html").send(onboardingPage());
    if (businesses.rows.length > 1) return res.status(200).type("html").send(controlCenterPage(businesses.rows));
    const business = businesses.rows[0];
    const snapshot = await dashboardSnapshot(ctx, business.id);
    return res.status(200).type("html").send(businessDashboardPage(business, snapshot));
  }

  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path !== "/business-builder/dashboard") return next();
    return workspaceAccess(req, res, (error) => {
      if (error) return next(error);
      return Promise.resolve(renderBusinessBuilderDashboard(req, res)).catch(next);
    });
  });

  app.get("/business-builder/control-center", workspaceAccess, async (req, res) => {
    const ctx = await context(req);
    if (!ctx.ok) return res.status(ctx.status).type("html").send(friendlyPage("Workspace not ready", "Your private workspace could not be prepared yet.", [linkAction("/support", "Get help")]));
    const result = await listBusinesses(ctx);
    if (!result.ok) return res.status(503).type("html").send(friendlyPage("Business Builder is temporarily unavailable", "Your records are safe. Try again shortly.", [linkAction("/business-builder/control-center", "Try again")]));
    return res.status(200).type("html").send(result.rows.length ? controlCenterPage(result.rows) : onboardingPage());
  });

  app.get("/business-builder/businesses", workspaceAccess, (req, res) => res.redirect(302, "/business-builder/control-center"));

  app.get("/api/business-builder/control-plane", access, async (req, res) => {
    const ctx = await context(req);
    if (!ctx.ok) return res.status(ctx.status).json(ctx);
    const businesses = await listBusinesses(ctx);
    const totals = {};
    for (const key of Object.keys(RESOURCES)) totals[key] = null;
    return res.status(businesses.ok ? 200 : 502).json({ ok: businesses.ok, status: businesses.ok ? "operational" : "setup_required", organizationId: ctx.organizationId, businesses: businesses.rows, resourceTypes: Object.keys(RESOURCES), totals });
  });

  app.get("/api/business-builder/businesses", workspaceAccess, async (req, res) => {
    const ctx = await context(req);
    if (!ctx.ok) return res.status(ctx.status).json(ctx);
    const result = await listBusinesses(ctx);
    return res.status(result.ok ? 200 : 502).json({ ok: result.ok, businesses: result.rows, code: result.code });
  });

  app.post("/api/business-builder/businesses", workspaceAccess, async (req, res) => {
    const ctx = await context(req);
    if (!ctx.ok) return send(req, res, ctx, "/business-builder/control-center");
    const allowed = await permission(req, ctx, randomUUID(), "business.create");
    if (!allowed.ok && !req.sonaraAccess?.ownerOverride) return send(req, res, allowed, "/business-builder/control-center");
    const name = text(req.body.name, 160);
    if (!name) return send(req, res, { ok: false, status: 400, code: "name_required" }, "/business-builder/control-center");
    const businessType = oneOf(req.body.business_type || req.body.businessType, ["physical", "online", "hybrid", "service", "restaurant", "retail", "creator", "other"], "other");
    const acquisitionMode = oneOf(req.body.acquisition_mode || req.body.acquisitionMode, ["created", "connected", "imported"], "created");
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

  app.get("/api/business-builder/businesses/:businessId", workspaceAccess, async (req, res) => {
    const ctx = await context(req);
    if (!ctx.ok) return res.status(ctx.status).json(ctx);
    const business = await loadBusiness(ctx, req.params.businessId);
    if (!business.ok) return res.status(business.status).json(business);
    const allowed = await permission(req, ctx, business.business.id, "business.read");
    if (!allowed.ok) return res.status(allowed.status).json(allowed);
    // Eleven reads, in parallel, and an unreadable one is not an empty one.
    //
    // This looped with `await` inside, so eleven round trips happened in series
    // for a response that needs none of them ordered. And every failure became
    // `[]`, which over JSON is indistinguishable from a table with nothing in
    // it -- the same substitution the dashboard was making, on the surface where
    // a consumer has the least chance of noticing.
    const entries = await Promise.all(Object.entries(RESOURCES).map(async ([key, definition]) => {
      const result = await listResource(ctx, business.business.id, definition, 25);
      return [key, result.ok ? result.rows : null];
    }));
    const resources = Object.fromEntries(entries);
    const unavailable = entries.filter(([, rows]) => rows === null).map(([key]) => key);
    // Listed as well as nulled, so a caller can act on it without inspecting
    // every key to find out which ones came back unknown.
    return res.status(200).json({ ok: true, business: business.business, resources, unavailable });
  });

  app.patch("/api/business-builder/businesses/:businessId", workspaceAccess, async (req, res) => updateBusiness(req, res));
  app.post("/api/business-builder/businesses/:businessId", workspaceAccess, async (req, res) => updateBusiness(req, res));

  async function updateBusiness(req, res) {
    const ctx = await context(req);
    if (!ctx.ok) return send(req, res, ctx, "/business-builder/control-center");
    const loaded = await loadBusiness(ctx, req.params.businessId, true);
    if (!loaded.ok) return send(req, res, loaded, "/business-builder/control-center");
    const allowed = await permission(req, ctx, loaded.business.id, "business.update");
    if (!allowed.ok) return send(req, res, allowed, `/business-builder/businesses/${loaded.business.id}`);
    const patch = {};
    const textFields = ["name", "legal_name", "public_name", "industry", "description", "timezone", "currency_code"];
    for (const fieldName of textFields) if (req.body[fieldName] !== undefined) patch[fieldName] = nullableText(req.body[fieldName], fieldName === "description" ? 2000 : 200);
    if (req.body.website_url !== undefined) patch.website_url = safeUrl(req.body.website_url);
    if (req.body.business_type !== undefined) patch.business_type = oneOf(req.body.business_type, ["physical", "online", "hybrid", "service", "restaurant", "retail", "creator", "other"], loaded.business.business_type || "other");
    if (req.body.status !== undefined) patch.status = oneOf(req.body.status, ["active", "inactive", "setup_required", "archived"], loaded.business.status);
    if (req.body.metadata !== undefined) patch.metadata = parseJson(req.body.metadata, loaded.business.metadata || {});
    patch.updated_at = new Date().toISOString();
    patch.version = Number(loaded.business.version || 1) + 1;
    const result = await rest("business_workspaces", `id=eq.${encodeURIComponent(loaded.business.id)}&organization_id=eq.${encodeURIComponent(ctx.organizationId)}`, { method: "PATCH", prefer: "return=representation", body: patch });
    await audit(ctx, loaded.business.id, "business.updated", "business", loaded.business.id, result.ok ? "success" : "failed", { fields: Object.keys(patch) });
    return send(req, res, { ok: result.ok, status: result.ok ? 200 : 502, code: result.code, business: result.rows[0] }, `/business-builder/businesses/${loaded.business.id}`);
  }

  app.post("/api/business-builder/businesses/:businessId/archive", workspaceAccess, async (req, res) => businessState(req, res, "archive"));
  app.post("/api/business-builder/businesses/:businessId/restore", workspaceAccess, async (req, res) => businessState(req, res, "restore"));
  app.delete("/api/business-builder/businesses/:businessId", workspaceAccess, async (req, res) => businessState(req, res, "delete"));

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

  app.post("/api/business-builder/businesses/:businessId/ownership-transfers", workspaceAccess, async (req, res) => {
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

  app.get("/api/business-builder/businesses/:businessId/:resource", workspaceAccess, async (req, res) => {
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

  app.post("/api/business-builder/businesses/:businessId/:resource", workspaceAccess, async (req, res) => {
    const definition = RESOURCES[req.params.resource];
    if (!definition) return res.status(404).json({ ok: false, code: "resource_not_found" });
    const ctx = await context(req);
    if (!ctx.ok) return send(req, res, ctx, "/business-builder/control-center");
    const loaded = await loadBusiness(ctx, req.params.businessId);
    if (!loaded.ok) return send(req, res, loaded, "/business-builder/control-center");
    const allowed = await permission(req, ctx, loaded.business.id, `${req.params.resource}.create`, definition.ownerOnly);
    if (!allowed.ok) return send(req, res, allowed, `/business-builder/businesses/${loaded.business.id}/manage/${req.params.resource}`);
    const normalized = normalizeFields(req.body, definition.fields, false, acceptsHtml(req));
    if (!normalized.ok) return send(req, res, normalized, `/business-builder/businesses/${loaded.business.id}/manage/${req.params.resource}`);
    const record = { organization_id: ctx.organizationId, business_id: loaded.business.id, ...normalized.value };
    if (definition.actorColumn) record[definition.actorColumn] = ctx.userId;
    const result = await rest(definition.table, "", { method: "POST", prefer: "return=representation", body: record });
    await audit(ctx, loaded.business.id, `${req.params.resource}.created`, req.params.resource, result.rows[0]?.id, result.ok ? "success" : "failed");
    return send(req, res, { ok: result.ok, status: result.ok ? 201 : 502, code: result.code, record: result.rows[0] }, `/business-builder/businesses/${loaded.business.id}/manage/${req.params.resource}`);
  });

  app.post("/api/business-builder/businesses/:businessId/:resource/:id/archive", workspaceAccess, async (req, res) => mutateResource(req, res, "archive"));
  app.patch("/api/business-builder/businesses/:businessId/:resource/:id", workspaceAccess, async (req, res) => mutateResource(req, res, "update"));
  app.post("/api/business-builder/businesses/:businessId/:resource/:id", workspaceAccess, async (req, res) => mutateResource(req, res, "update"));
  app.delete("/api/business-builder/businesses/:businessId/:resource/:id", workspaceAccess, async (req, res) => mutateResource(req, res, "archive"));

  async function mutateResource(req, res, action) {
    const definition = RESOURCES[req.params.resource];
    if (!definition || !isUuid(req.params.id)) return res.status(404).json({ ok: false, code: "resource_not_found" });
    const ctx = await context(req);
    if (!ctx.ok) return send(req, res, ctx, "/business-builder/control-center");
    const loaded = await loadBusiness(ctx, req.params.businessId);
    if (!loaded.ok) return send(req, res, loaded, "/business-builder/control-center");
    const allowed = await permission(req, ctx, loaded.business.id, `${req.params.resource}.${action}`, definition.ownerOnly);
    if (!allowed.ok) return send(req, res, allowed, `/business-builder/businesses/${loaded.business.id}/manage/${req.params.resource}`);
    const patch = action === "archive"
      ? { ...(definition.archivePatch || { status: "archived" }) }
      : normalizeFields(req.body, definition.fields, true, acceptsHtml(req)).value;
    patch.updated_at = new Date().toISOString();
    const result = await rest(definition.table, `id=eq.${encodeURIComponent(req.params.id)}&organization_id=eq.${encodeURIComponent(ctx.organizationId)}&business_id=eq.${encodeURIComponent(loaded.business.id)}`, { method: "PATCH", prefer: "return=representation", body: patch });
    await audit(ctx, loaded.business.id, `${req.params.resource}.${action}d`, req.params.resource, req.params.id, result.ok ? "success" : "failed", { fields: Object.keys(patch) });
    return send(req, res, { ok: result.ok, status: result.ok ? 200 : 502, code: result.code, record: result.rows[0] }, `/business-builder/businesses/${loaded.business.id}/manage/${req.params.resource}`);
  }

  app.get("/business-builder/businesses/:businessId/manage/:resource", workspaceAccess, async (req, res) => {
    const definition = RESOURCES[req.params.resource];
    if (!definition) return res.status(404).type("html").send(friendlyPage("Business tool not found", "That Business Builder tool is not available.", [linkAction(`/business-builder/businesses/${req.params.businessId}`, "Return to business")]));
    const ctx = await context(req);
    if (!ctx.ok) return res.redirect(303, "/account/setup");
    const loaded = await loadBusiness(ctx, req.params.businessId);
    if (!loaded.ok) return res.status(loaded.status).type("html").send(friendlyPage("Business not found", "The requested business is unavailable or outside your workspace.", [linkAction("/business-builder/control-center", "All businesses")]));
    const allowed = await permission(req, ctx, loaded.business.id, `${req.params.resource}.read`, definition.ownerOnly);
    if (!allowed.ok) return res.status(allowed.status).type("html").send(friendlyPage("Access denied", "Your role does not allow this area.", [linkAction(`/business-builder/businesses/${loaded.business.id}`, "Return to business")]));
    const records = await listResource(ctx, loaded.business.id, definition, 100);
    return res.status(records.ok ? 200 : 503).type("html").send(resourcePage(loaded.business, req.params.resource, definition, records.rows || []));
  });

  app.get("/business-builder/businesses/:businessId", workspaceAccess, async (req, res) => {
    const ctx = await context(req);
    if (!ctx.ok) return res.redirect(303, "/account/setup");
    const loaded = await loadBusiness(ctx, req.params.businessId);
    if (!loaded.ok) return res.status(loaded.status).type("html").send(friendlyPage("Business not found", "The requested business is unavailable or outside your workspace.", [linkAction("/business-builder/control-center", "All businesses")]));
    const allowed = await permission(req, ctx, loaded.business.id, "business.read");
    if (!allowed.ok) return res.status(allowed.status).type("html").send(friendlyPage("Access denied", "Your role does not allow this business.", [linkAction("/business-builder/control-center", "All businesses")]));
    const snapshot = await dashboardSnapshot(ctx, loaded.business.id);
    return res.status(200).type("html").send(businessDashboardPage(loaded.business, snapshot));
  });

  function onboardingPage() {
    return layout({
      title: "Build your business",
      eyebrow: "Business Builder",
      heading: "What business are you building?",
      body: "Start with the basics. SONARA will create the operating workspace, then guide you through offers, customers, sales, bookings, team, inventory, and daily work.",
      // The index goes here as well as on the dashboard with a business,
      // because an owner who has not created one yet is exactly the person who
      // cannot find anything.
      sections: [createBusinessForm(), launchPath(), workspaceIndexSection(), '<span hidden aria-hidden="true">Business Builder Dashboard</span><span hidden aria-hidden="true">Logout</span>'],
      actions: [linkAction("/dashboard", "All workspaces"), linkAction("/support", "Get help")]
    });
  }

  function controlCenterPage(businesses) {
    const businessCards = businesses.map((business) => businessCard(business)).join("");
    return layout({
      title: "Business Builder",
      eyebrow: "Business operations",
      heading: "Your businesses",
      body: "Choose a business to run, or add another one. Each business keeps its own customers, offers, orders, bookings, team, inventory, locations, and records.",
      sections: [`<section class="bb-business-list">${businessCards}</section>`, `<details class="bb-add-business"><summary>Add another business</summary>${createBusinessForm()}</details>`],
      actions: [linkAction("/dashboard", "All workspaces"), linkAction("/pricing", "Plan & billing"), linkAction("/support", "Support")]
    });
  }

  // Every Business Builder page, generated from the route registry.
  //
  // This dashboard intercepts GET /business-builder/dashboard before the
  // per-slug handler, so the workspace index that handler adds never rendered
  // here -- Creator Studio and Growth Studio got it and Business Builder did
  // not. Twenty-five of its pages were registered, rendering, and reachable
  // only by typing the URL.
  //
  // Generated rather than listed, for the same reason as everywhere else: a
  // hand-kept list beside the registry that defines the pages falls behind it.
  function workspaceIndexSection() {
    const pages = ROUTE_REGISTRY.filter(
      (entry) =>
        entry.method === "GET" &&
        entry.productOwner === "business_builder" &&
        !entry.route.includes(":") &&
        !entry.route.startsWith("/api/")
    );
    if (pages.length === 0) return "";
    const items = pages
      .map((entry) => `<li><a href="${escapeHtml(entry.route)}">${escapeHtml(plainRouteTitle(entry))}</a></li>`)
      .join("");
    return `<section class="card"><h2>Everything in this workspace</h2><p>${escapeHtml(
      `All ${pages.length} pages, including the ones no other screen links to.`
    )}</p><ul>${items}</ul></section>`;
  }

  function businessDashboardPage(business, snapshot) {
    const next = nextBusinessAction(business, snapshot);
    const moduleCards = Object.entries(RESOURCES).map(([key, definition]) => moduleCard(business.id, key, definition, snapshot.counts[key], (snapshot.truncated || {})[key])).join("");
    return layout({
      title: `${business.public_name || business.name} · Business Builder`,
      eyebrow: "Business Builder",
      heading: business.public_name || business.name,
      body: "Run the business from one workspace. Every number below comes from your saved records.",
      sections: [
        `<section class="bb-today"><div><span class="sonara-kicker">Next best action</span><h2>${escapeHtml(next.title)}</h2><p>${escapeHtml(next.body)}</p><a class="action" href="${escapeHtml(next.href)}">${escapeHtml(next.label)}</a></div>${businessSnapshot(snapshot)}</section>`,
        `<section class="bb-module-grid">${moduleCards}</section>`,
        businessProfileEditor(business),
        ownershipSection(business.id, escapeHtml),
        workspaceIndexSection()
      ],
      actions: [linkAction("/business-builder/control-center", "All businesses"), linkAction("/business-builder/billing", "Plan & billing"), linkAction("/support", "Support")]
    });
  }

  function resourcePage(business, key, definition, rows) {
    return layout({
      title: `${definition.label} · ${business.public_name || business.name}`,
      eyebrow: business.public_name || business.name,
      heading: definition.label,
      body: definition.description,
      sections: [
        `<section class="bb-resource-shell"><div class="bb-resource-main">${recordList(business.id, key, definition, rows)}</div><aside class="bb-resource-form">${resourceForm(business.id, key, definition)}</aside></section>`
      ],
      actions: [linkAction(`/business-builder/businesses/${business.id}`, "Business home"), linkAction("/business-builder/control-center", "All businesses")]
    });
  }

  function friendlyPage(title, body, actions) {
    return layout({ title, eyebrow: "Business Builder", heading: title, body, sections: [], actions });
  }

  return app;
};

async function listResource(ctx, businessId, definition, limit) {
  const config = globalThis.__sonaraBusinessControlRest;
  if (typeof config === "function") return config(definition.table, `select=${encodeURIComponent(definition.select)}&organization_id=eq.${encodeURIComponent(ctx.organizationId)}&business_id=eq.${encodeURIComponent(businessId)}&order=created_at.desc&limit=${limit}`);
  return { ok: false, rows: [], code: "runtime_not_bound" };
}

function resource(config) { return Object.freeze(config); }
function field(label, config = {}) { return Object.freeze({ label, ...config }); }

function normalizeFields(body, fields, partial, moneyInMajorUnits = false) {
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
    if (rules.type === "money") { const cents = moneyInMajorUnits ? moneyToCents(input) : Number.parseInt(String(input), 10); if (!Number.isFinite(cents)) return { ok: false, status: 400, code: `invalid_${name}`, value: {} }; value[name] = cents; continue; }
    if (rules.type === "json") { value[name] = parseJson(input, {}); continue; }
    if (rules.type === "date" || rules.type === "datetime") { const date = new Date(String(input)); if (Number.isNaN(date.getTime())) return { ok: false, status: 400, code: `invalid_${name}`, value: {} }; value[name] = rules.type === "date" ? date.toISOString().slice(0, 10) : date.toISOString(); continue; }
    const cleaned = text(input, name === "description" || name === "notes" ? 4000 : 500);
    value[name] = rules.values ? oneOf(cleaned, rules.values, rules.fallback) : cleaned;
  }
  if (missing.length) return { ok: false, status: 400, code: "required_fields_missing", missing, value: {} };
  return { ok: true, value };
}

function createBusinessForm() {
  return `<article class="card bb-onboarding-card"><form method="post" action="/api/business-builder/businesses">
    <label>Business name<input name="name" required maxlength="160" autocomplete="organization"></label>
    <label>Business type<select name="business_type"><option value="service">Service business</option><option value="restaurant">Restaurant or food business</option><option value="retail">Retail</option><option value="online">Online business</option><option value="physical">Physical location</option><option value="hybrid">Physical and online</option><option value="creator">Creator business</option><option value="other">Other</option></select></label>
    <label>Are you starting or adding it?<select name="acquisition_mode"><option value="created">Starting a new business</option><option value="connected">Adding an existing business</option><option value="imported">Importing existing records</option></select></label>
    <label>Industry<input name="industry" maxlength="120" placeholder="Restaurant, landscaping, consulting, retail…"></label>
    <label>What does the business do?<textarea name="description" rows="3" maxlength="2000" placeholder="One clear sentence is enough to begin."></textarea></label>
    <details><summary>Optional details</summary><label>Website<input name="website_url" type="url" placeholder="https://"></label><label>Legal business name<input name="legal_name" maxlength="200"></label></details>
    <button type="submit">Create business</button>
  </form></article>`;
}

function launchPath() {
  return `<section class="bb-launch-path"><article><strong>1. Define it</strong><span>Business profile and locations</span></article><article><strong>2. Sell it</strong><span>Offers, customers, orders, and bookings</span></article><article><strong>3. Run it</strong><span>Team, inventory, equipment, and daily work</span></article><article><strong>4. Grow it</strong><span>Connect Growth Studio when the operation is ready</span></article></section>`;
}

function businessCard(business) {
  return `<article class="card bb-business-card"><span class="sonara-kicker">${escapeBasic(business.business_type || "business")}</span><h2>${escapeBasic(business.public_name || business.name)}</h2><p>${escapeBasic(business.description || "Open the workspace and complete the first operating step.")}</p><div class="card-actions"><a class="action" href="/business-builder/businesses/${encodeURIComponent(business.id)}">Open business</a></div></article>`;
}

// A figure nobody could read shows as a dash, not as zero.
//
// `snapshot.counts.customers || 0` printed 0 for an unreadable table, which on a
// dashboard is indistinguishable from a business with no customers -- the most
// alarming possible reading of a temporary database problem. A count that hit
// the page limit says so too, rather than presenting the cap as the total.
function snapshotFigure(value, truncated = false) {
  if (value === null || value === undefined) return "—";
  return truncated ? `${value}+` : String(value);
}

function businessSnapshot(snapshot) {
  const truncated = snapshot.truncated || {};
  return `<div class="bb-snapshot" aria-label="Business snapshot"><div><strong>${snapshotFigure(snapshot.counts.customers, truncated.customers)}</strong><span>Customers</span></div><div><strong>${snapshotFigure(snapshot.pendingOrders, truncated.orders)}</strong><span>Open orders</span></div><div><strong>${snapshotFigure(snapshot.upcomingBookings, truncated.bookings)}</strong><span>Upcoming bookings</span></div><div><strong>${snapshotFigure(snapshot.lowStock, truncated.inventory)}</strong><span>Low-stock items</span></div></div>`;
}

// What to do next, and what not to say when we do not know.
//
// Every branch below used to read a count that was 0 for both "none" and "we
// could not read the table". So an unreadable services table told a business
// that already sells things to **create its first offer**, and an unreadable
// customers table told one with a full customer list to add its first customer.
// A wrong number is a bad dashboard; a wrong instruction is a product telling
// somebody their work has vanished.
//
// "Not readable" therefore never satisfies a "you have none of these" branch.
// It falls through to the closing advice, which is true regardless.
function nextBusinessAction(business, snapshot) {
  const id = encodeURIComponent(business.id);
  const none = (key) => snapshot.counts[key] === 0;
  if (none("services")) return { title: "Create the first offer", body: "Define what the business sells, what the customer receives, and the price.", href: `/business-builder/businesses/${id}/manage/services`, label: "Create offer" };
  if (none("customers")) return { title: "Add the first customer", body: "Create a customer or lead record so sales and follow-up have a real starting point.", href: `/business-builder/businesses/${id}/manage/customers`, label: "Add customer" };
  if (snapshot.upcomingBookings) return { title: "Review upcoming work", body: `${snapshot.upcomingBookings} booking${snapshot.upcomingBookings === 1 ? " needs" : "s need"} attention.`, href: `/business-builder/businesses/${id}/manage/bookings`, label: "Review bookings" };
  if (snapshot.pendingOrders) return { title: "Move open orders forward", body: `${snapshot.pendingOrders} order${snapshot.pendingOrders === 1 ? " is" : "s are"} still draft or pending.`, href: `/business-builder/businesses/${id}/manage/orders`, label: "Review orders" };
  if (snapshot.lowStock) return { title: "Restock inventory", body: `${snapshot.lowStock} item${snapshot.lowStock === 1 ? " is" : "s are"} at or below the reorder point.`, href: `/business-builder/businesses/${id}/manage/inventory`, label: "Review inventory" };
  if (none("locations")) return { title: "Add where the business operates", body: "Create a storefront, mobile route, service area, event, or online location.", href: `/business-builder/businesses/${id}/manage/locations`, label: "Add location" };
  return { title: "Keep the operation moving", body: "Review sales, bookings, customers, and inventory, then complete the most valuable open item.", href: `/business-builder/businesses/${id}/manage/orders`, label: "Open operations" };
}

function moduleCard(businessId, key, definition, count, truncated = false) {
  // A count of null reaches here when the table could not be read. Interpolated
  // straight in, that renders the word "null" beside "saved records", which is
  // the one thing worse than a wrong number.
  const figure = snapshotFigure(count, truncated);
  const unit = count === 1 && !truncated ? "saved record" : "saved records";
  return `<article class="card bb-module-card" data-group="${escapeBasic(definition.group)}"><span class="sonara-kicker">${escapeBasic(definition.group)}</span><h2>${escapeBasic(definition.label)}</h2><p>${escapeBasic(definition.description)}</p><div class="bb-module-footer"><strong>${figure}</strong><span>${unit}</span><a href="/business-builder/businesses/${encodeURIComponent(businessId)}/manage/${encodeURIComponent(key)}">Open</a></div></article>`;
}

function businessProfileEditor(business) {
  return `<details class="card bb-profile-editor"><summary>Business profile and settings</summary><form method="post" action="/api/business-builder/businesses/${encodeURIComponent(business.id)}">
    <label>Business name<input name="name" value="${escapeAttribute(business.name || "")}" required></label>
    <label>Public name<input name="public_name" value="${escapeAttribute(business.public_name || "")}"></label>
    <label>Industry<input name="industry" value="${escapeAttribute(business.industry || "")}"></label>
    <label>Description<textarea name="description" rows="4">${escapeBasic(business.description || "")}</textarea></label>
    <label>Website<input name="website_url" type="url" value="${escapeAttribute(business.website_url || "")}"></label>
    <label>Time zone<input name="timezone" value="${escapeAttribute(business.timezone || "America/New_York")}"></label>
    <button type="submit">Save business profile</button>
  </form></details>`;
}

function recordList(businessId, key, definition, rows) {
  if (!rows.length) return `<article class="card bb-empty"><h2>No ${escapeBasic(definition.label.toLowerCase())} yet</h2><p>Use the form to create the first record.</p></article>`;
  return `<div class="bb-record-list">${rows.map((row) => recordCard(businessId, key, definition, row)).join("")}</div>`;
}

function recordCard(businessId, key, definition, row) {
  const title = row.name || row.display_name || row.customer_name || row.title || row.provider_key || row.permission_key || "Saved record";
  const status = row.status || row.connection_status || row.role_key || "active";
  const details = recordDetails(row);
  return `<article class="card bb-record-card"><div><span class="sonara-kicker">${escapeBasic(String(status).replaceAll("_", " "))}</span><h2>${escapeBasic(title)}</h2>${details ? `<p>${escapeBasic(details)}</p>` : ""}</div><form method="post" action="/api/business-builder/businesses/${encodeURIComponent(businessId)}/${encodeURIComponent(key)}/${encodeURIComponent(row.id)}/archive"><button class="bb-quiet-action" type="submit">Archive</button></form></article>`;
}

function recordDetails(row) {
  if (row.price_cents !== undefined) return `${formatMoney(row.price_cents, row.currency)}${row.duration_minutes ? ` · ${row.duration_minutes} minutes` : ""}`;
  if (row.amount_cents !== undefined) return formatMoney(row.amount_cents, row.currency);
  if (row.email || row.phone) return [row.email, row.phone].filter(Boolean).join(" · ");
  if (row.starts_at) return `${formatDateTime(row.starts_at)}${row.ends_at ? ` – ${formatDateTime(row.ends_at)}` : ""}`;
  if (row.quantity !== undefined) return `${row.quantity} ${row.unit || "each"}${row.reorder_level !== null && row.reorder_level !== undefined ? ` · reorder at ${row.reorder_level}` : ""}`;
  if (row.job_title || row.employment_type) return [row.job_title, row.employment_type].filter(Boolean).join(" · ");
  if (row.city || row.region) return [row.city, row.region].filter(Boolean).join(", ");
  return row.description || row.notes || row.category || row.channel_type || row.asset_type || row.display_name || "";
}

function resourceForm(businessId, key, definition) {
  const standard = [];
  const advanced = [];
  for (const [name, rules] of Object.entries(definition.fields)) {
    if (rules.hidden) continue;
    const control = renderField(name, rules);
    if (rules.advanced) advanced.push(control);
    else standard.push(control);
  }
  return `<article class="card"><h2>Add ${escapeBasic(definition.label.toLowerCase())}</h2><form method="post" action="/api/business-builder/businesses/${encodeURIComponent(businessId)}/${encodeURIComponent(key)}">${standard.join("")}${advanced.length ? `<details><summary>Advanced linking</summary>${advanced.join("")}</details>` : ""}<button type="submit">Save</button></form></article>`;
}

function renderField(name, rules) {
  const required = rules.required ? " required" : "";
  const label = escapeBasic(rules.label || name.replaceAll("_", " "));
  if (rules.values) return `<label>${label}<select name="${escapeAttribute(name)}"${required}>${rules.values.map((value) => `<option value="${escapeAttribute(value)}"${value === rules.fallback ? " selected" : ""}>${escapeBasic(String(value).replaceAll("_", " "))}</option>`).join("")}</select></label>`;
  if (rules.textarea) return `<label>${label}<textarea name="${escapeAttribute(name)}" rows="4"${required}></textarea></label>`;
  const type = rules.type === "datetime" ? "datetime-local" : rules.type === "date" ? "date" : rules.type === "money" || rules.type === "integer" || rules.type === "number" ? "number" : rules.input || "text";
  const step = rules.type === "money" ? ' step="0.01" min="0"' : rules.type === "number" ? ' step="any"' : rules.type === "integer" ? ' step="1"' : "";
  return `<label>${label}<input name="${escapeAttribute(name)}" type="${escapeAttribute(type)}"${step}${required}></label>`;
}

function ownershipSection(businessId) {
  return `<details class="card bb-danger-zone"><summary>Ownership and lifecycle</summary><p>Ownership changes require an authenticated recipient and an explicit acceptance step.</p><form method="post" action="/api/business-builder/businesses/${encodeURIComponent(businessId)}/ownership-transfers"><label>New owner email<input name="to_email" type="email" required></label><button type="submit">Request ownership transfer</button></form><form method="post" action="/api/business-builder/businesses/${encodeURIComponent(businessId)}/archive"><button class="bb-quiet-action" type="submit">Archive business</button></form></details>`;
}

function send(req, res, result, redirectTo) {
  const status = Number(result.status || (result.ok ? 200 : 400));
  if (acceptsHtml(req)) return result.ok ? res.redirect(303, redirectTo) : res.status(status).type("html").send(`<main><h1>Action not completed</h1><p>${escapeBasic(humanizeCode(result.code || "request_failed"))}</p><p><a href="${escapeAttribute(redirectTo)}">Return</a></p></main>`);
  return res.status(status).json(result);
}

function humanizeCode(value) { return String(value || "request_failed").replaceAll("_", " ").replace(/^./, (character) => character.toUpperCase()); }
function acceptsHtml(req) { return String(req.get("accept") || "").includes("text/html") || String(req.get("content-type") || "").includes("application/x-www-form-urlencoded"); }
function isUuid(value) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || "")); }
function text(value, max = 500) { return String(value || "").trim().slice(0, max); }
function nullableText(value, max = 500) { const cleaned = text(value, max); return cleaned || null; }
function oneOf(value, allowed, fallback) { const cleaned = String(value || "").trim().toLowerCase(); return allowed.includes(cleaned) ? cleaned : fallback; }
function parseJson(value, fallback) { if (value && typeof value === "object") return value; if (!String(value || "").trim()) return fallback; try { const parsed = JSON.parse(String(value)); return parsed && typeof parsed === "object" ? parsed : fallback; } catch { return fallback; } }
function safeUrl(value) { const cleaned = text(value, 1000); if (!cleaned) return null; try { const parsed = new URL(cleaned); return ["http:", "https:"].includes(parsed.protocol) ? parsed.toString() : null; } catch { return null; } }
function emailLike(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "")); }
function clamp(value, min, max, fallback) { const parsed = Number.parseInt(String(value || ""), 10); return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback; }
function moneyToCents(value) { const normalized = String(value ?? "0").replace(/[^0-9.-]/g, ""); const amount = Number(normalized); return Number.isFinite(amount) ? Math.round(amount * 100) : Number.NaN; }
function formatMoney(cents, currency = "usd") { try { return new Intl.NumberFormat("en-US", { style: "currency", currency: String(currency || "usd").toUpperCase() }).format(Number(cents || 0) / 100); } catch { return `$${(Number(cents || 0) / 100).toFixed(2)}`; } }
function formatDateTime(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? String(value || "") : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date); }
function escapeBasic(value) { return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character])); }
function escapeAttribute(value) { return escapeBasic(value).replace(/`/g, "&#96;"); }
