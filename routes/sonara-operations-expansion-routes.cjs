"use strict";

const { summarizeBusinessOperations } = require("../lib/sonara-business-analytics.cjs");
const { buildMapSnapshot } = require("../lib/sonara-location-map.cjs");
const { templates: workflowTemplates, validateWorkflow } = require("../lib/sonara-workflow-planner.cjs");

const TABLES = Object.freeze({
  bookings: "business_bookings",
  assets: "business_assets",
  time: "employee_time_entries",
  inventory: "inventory_items",
  payments: "payments",
  locations: "location_events"
});
const BUSINESS_ASSET_TYPES = new Set(["equipment", "vehicle", "trailer", "appliance", "tool", "device", "furniture", "other"]);

function registerOperationsExpansionRoutes(app, deps = {}) {
  const {
    requireBusinessManager,
    getCustomerPrimaryOrganization,
    getSupabaseServerConfig,
    supabaseHeaders
  } = deps;
  if (typeof requireBusinessManager !== "function") throw new TypeError("operations expansion requires requireBusinessManager");
  if (typeof getCustomerPrimaryOrganization !== "function") throw new TypeError("operations expansion requires getCustomerPrimaryOrganization");
  if (typeof getSupabaseServerConfig !== "function") throw new TypeError("operations expansion requires getSupabaseServerConfig");
  if (typeof supabaseHeaders !== "function") throw new TypeError("operations expansion requires supabaseHeaders");

  const enc = encodeURIComponent;

  async function context(req) {
    const config = getSupabaseServerConfig();
    const user = req.sonaraUser || req.sonaraCustomer?.user || req.sonaraAccess?.user || req.user || null;
    const org = await getCustomerPrimaryOrganization(user, { autoBootstrap: false }).catch(() => null);
    if (!config?.ok) return { ok: false, status: 503, code: "supabase_setup_required" };
    if (!org?.ok || !org.organizationId) return { ok: false, status: 403, code: "business_workspace_required" };
    return { ok: true, config, organizationId: org.organizationId, userId: user?.id || null };
  }

  async function request(config, table, query, options = {}) {
    const method = options.method || "GET";
    const headers = { ...supabaseHeaders(config), ...(options.headers || {}) };
    if (method !== "GET") {
      headers["content-type"] = "application/json";
      headers.prefer = options.prefer || "return=representation";
    }
    const response = await fetch(`${config.url}/rest/v1/${table}${query ? `?${query}` : ""}`, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    }).catch(() => null);
    if (!response) return { ok: false, status: 502, code: "database_unreachable", rows: [] };
    const payload = await response.json().catch(() => []);
    if (!response.ok) return { ok: false, status: 502, code: "database_request_failed", rows: [] };
    return { ok: true, status: response.status, rows: Array.isArray(payload) ? payload : [] };
  }

  async function list(config, table, organizationId, select, extra = "", limit = 1000) {
    return request(config, table,
      `organization_id=eq.${enc(organizationId)}&select=${select}${extra}&limit=${Math.min(2000, Math.max(1, Number(limit) || 1000))}`);
  }

  app.get("/api/business/operations/analytics", requireBusinessManager, async (req, res) => {
    const scope = await context(req);
    if (!scope.ok) return res.status(scope.status).json(scope);
    const days = Math.min(366, Math.max(1, Number(req.query.days) || 30));
    const end = new Date();
    const start = new Date(end.getTime() - days * 86400000);
    const floor = enc(start.toISOString());
    const org = scope.organizationId;
    const [bookings, time, inventory, payments, locations] = await Promise.all([
      list(scope.config, TABLES.bookings, org, "id,status,starts_at,ends_at,created_at", `&or=(starts_at.gte.${floor},created_at.gte.${floor})`),
      list(scope.config, TABLES.time, org, "id,clock_in_at,clock_out_at,break_minutes,created_at", `&clock_in_at=gte.${floor}`),
      list(scope.config, TABLES.inventory, org, "id,quantity,cost_cents,reorder_level,status"),
      list(scope.config, TABLES.payments, org, "id,status,amount_cents,created_at", `&created_at=gte.${floor}`),
      list(scope.config, TABLES.locations, org, "id,event_type,captured_at,created_at", `&captured_at=gte.${floor}`)
    ]);

    const unreadableSources = Object.entries({ bookings, time, inventory, payments, locations })
      .filter(([, result]) => !result.ok)
      .map(([name]) => name);
    if (unreadableSources.length) {
      return res.status(503).json({
        ok: false,
        code: "analytics_sources_unreadable",
        unreadableSources,
        reason: "The dashboard refuses to convert failed reads into zeroes."
      });
    }

    const summary = summarizeBusinessOperations({
      periodStart: start.toISOString(), periodEnd: end.toISOString(),
      bookings: bookings.rows, timeEntries: time.rows, inventoryItems: inventory.rows,
      payments: payments.rows, locationEvents: locations.rows
    });
    return res.status(summary.ok ? 200 : 400).json({ ...summary, source: "organization_scoped_operational_rows" });
  });

  app.get("/api/business/reservation-resources", requireBusinessManager, async (req, res) => {
    const scope = await context(req);
    if (!scope.ok) return res.status(scope.status).json(scope);
    const rows = await list(scope.config, TABLES.assets, scope.organizationId,
      "id,location_id,name,asset_type,status,metadata,created_at,updated_at", "&status=eq.active", 1000);
    if (!rows.ok) return res.status(503).json({ ok: false, code: rows.code });
    const resources = rows.rows.filter((row) => row?.metadata?.bookable === true);
    return res.status(200).json({ ok: true, resources });
  });

  app.post("/api/business/reservation-resources", requireBusinessManager, async (req, res) => {
    const scope = await context(req);
    if (!scope.ok) return res.status(scope.status).json(scope);
    const name = clean(req.body?.name, 160);
    if (!name) return res.status(400).json({ ok: false, code: "resource_name_required" });
    const requestedType = clean(req.body?.resource_type || req.body?.resourceType || req.body?.asset_type, 40) || "equipment";
    const assetType = BUSINESS_ASSET_TYPES.has(requestedType) ? requestedType : "other";
    const capacity = Math.min(1000, Math.max(1, Number(req.body?.capacity) || 1));
    const created = await request(scope.config, TABLES.assets, "", {
      method: "POST",
      body: {
        organization_id: scope.organizationId,
        location_id: validUuid(req.body?.location_id || req.body?.locationId) ? (req.body.location_id || req.body.locationId) : null,
        name,
        asset_type: assetType,
        status: "active",
        metadata: {
          bookable: true,
          resource_type: requestedType,
          capacity,
          notes: clean(req.body?.notes, 1000) || null
        }
      }
    });
    return res.status(created.ok ? 201 : 502).json({ ok: created.ok, resource: created.rows[0] || null, code: created.code });
  });

  app.get("/api/business/waitlist", requireBusinessManager, async (req, res) => {
    const scope = await context(req);
    if (!scope.ok) return res.status(scope.status).json(scope);
    const rows = await list(scope.config, TABLES.bookings, scope.organizationId,
      "id,location_id,service_id,assigned_employee_id,customer_id,customer_name,customer_email,customer_phone,starts_at,ends_at,status,notes,metadata,created_at,updated_at",
      "&status=eq.requested&order=created_at.asc", 1000);
    if (!rows.ok) return res.status(503).json({ ok: false, code: rows.code });
    const waitlist = rows.rows.filter((row) => row?.metadata?.waitlist === true && row?.metadata?.waitlist_state !== "booked" && row?.metadata?.waitlist_state !== "cancelled");
    return res.status(200).json({ ok: true, waitlist });
  });

  app.post("/api/business/waitlist", requireBusinessManager, async (req, res) => {
    const scope = await context(req);
    if (!scope.ok) return res.status(scope.status).json(scope);
    const customerName = clean(req.body?.customer_name || req.body?.customerName, 200);
    const customerEmail = clean(req.body?.customer_email || req.body?.customerEmail, 320);
    const customerPhone = clean(req.body?.customer_phone || req.body?.customerPhone, 80);
    if (!customerName && !customerEmail && !customerPhone) {
      return res.status(400).json({ ok: false, code: "waitlist_contact_required" });
    }
    const created = await request(scope.config, TABLES.bookings, "", {
      method: "POST",
      body: {
        organization_id: scope.organizationId,
        location_id: validUuid(req.body?.location_id || req.body?.locationId) ? (req.body.location_id || req.body.locationId) : null,
        service_id: validUuid(req.body?.service_id || req.body?.serviceId) ? (req.body.service_id || req.body.serviceId) : null,
        assigned_employee_id: validUuid(req.body?.assigned_employee_id || req.body?.assignedEmployeeId) ? (req.body.assigned_employee_id || req.body.assignedEmployeeId) : null,
        customer_id: validUuid(req.body?.customer_id || req.body?.customerId) ? (req.body.customer_id || req.body.customerId) : null,
        customer_name: customerName || null,
        customer_email: customerEmail || null,
        customer_phone: customerPhone || null,
        status: "requested",
        notes: clean(req.body?.notes, 2000) || null,
        metadata: {
          waitlist: true,
          waitlist_state: "waiting",
          preferred_start: clean(req.body?.preferred_start || req.body?.preferredStart, 80) || null,
          preferred_end: clean(req.body?.preferred_end || req.body?.preferredEnd, 80) || null,
          party_size: Math.min(1000, Math.max(1, Number(req.body?.party_size || req.body?.partySize) || 1)),
          resource_ids: Array.isArray(req.body?.resource_ids || req.body?.resourceIds)
            ? (req.body.resource_ids || req.body.resourceIds).filter(validUuid).slice(0, 50)
            : []
        }
      }
    });
    return res.status(created.ok ? 201 : 502).json({ ok: created.ok, entry: created.rows[0] || null, code: created.code });
  });

  app.post("/api/business/waitlist/:bookingId/offer", requireBusinessManager, async (req, res) => {
    const scope = await context(req);
    if (!scope.ok) return res.status(scope.status).json(scope);
    if (!validUuid(req.params.bookingId)) return res.status(400).json({ ok: false, code: "invalid_booking_id" });
    const found = await request(scope.config, TABLES.bookings,
      `organization_id=eq.${enc(scope.organizationId)}&id=eq.${enc(req.params.bookingId)}&select=id,metadata,status&limit=1`);
    const booking = found.rows[0];
    if (!found.ok || !booking || booking?.metadata?.waitlist !== true) return res.status(404).json({ ok: false, code: "waitlist_entry_not_found" });
    const metadata = { ...(booking.metadata || {}), waitlist_state: "offered", offered_at: new Date().toISOString() };
    const updated = await request(scope.config, TABLES.bookings,
      `organization_id=eq.${enc(scope.organizationId)}&id=eq.${enc(req.params.bookingId)}`, {
        method: "PATCH", body: { metadata, updated_at: new Date().toISOString() }
      });
    return res.status(updated.ok ? 200 : 502).json({ ok: updated.ok, entry: updated.rows[0] || null, code: updated.code, customerNotified: false });
  });

  app.get("/api/business/map/snapshot", requireBusinessManager, async (req, res) => {
    const scope = await context(req);
    if (!scope.ok) return res.status(scope.status).json(scope);
    const rows = await list(scope.config, TABLES.locations, scope.organizationId,
      "id,employee_id,event_type,latitude,longitude,accuracy_meters,captured_at,privacy_mode,created_at",
      "&order=captured_at.asc", Math.min(1000, Math.max(1, Number(req.query.limit) || 250)));
    if (!rows.ok) return res.status(503).json({ ok: false, code: rows.code });
    return res.status(200).json(buildMapSnapshot(rows.rows, { limit: req.query.limit }));
  });

  app.get("/api/business/automations/templates", requireBusinessManager, (req, res) => {
    return res.status(200).json({
      ok: true,
      templates: workflowTemplates().filter((item) => item.product === "business_builder"),
      arbitraryCodeAllowed: false
    });
  });

  app.post("/api/business/automations/validate", requireBusinessManager, (req, res) => {
    const validated = validateWorkflow(req.body || {});
    return res.status(validated.ok ? 200 : 400).json(validated);
  });
}

function clean(value, max = 240) {
  return String(value ?? "").trim().slice(0, max);
}

function validUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

module.exports = registerOperationsExpansionRoutes;
