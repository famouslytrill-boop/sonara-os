// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const { createReservationPages, RESOURCE_PAGE, WAITLIST_PAGE } = require("../lib/sonara-reservation-pages.cjs");
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
  const pages = createReservationPages(deps);

  async function context(req) {
    const config = getSupabaseServerConfig();
    const user = req.sonaraUser || req.sonaraCustomer?.user || req.sonaraAccess?.user || req.user || null;
    const org = await getCustomerPrimaryOrganization(user, { autoBootstrap: false }).catch(() => null);
    if (!config?.ok) return { ok: false, status: 503, code: "supabase_setup_required" };
    if (!org?.ok || !validUuid(org.organizationId)) return { ok: false, status: 403, code: "business_workspace_required" };
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
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: AbortSignal.timeout(5000)
    }).catch(() => null);
    if (!response) return { ok: false, status: 502, code: "database_unreachable", rows: [] };
    const payload = await response.json().catch(() => null);
    if (!response.ok) return { ok: false, status: 502, code: "database_request_failed", rows: [] };
    if (!Array.isArray(payload)) return { ok: false, status: 502, code: "database_response_unreadable", rows: [] };
    return { ok: true, status: response.status, rows: payload };
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
    const floor = start.toISOString();
    const org = scope.organizationId;
    const [bookings, time, inventory, payments, locations] = await Promise.all([
      list(scope.config, TABLES.bookings, org, "id,status,starts_at,ends_at,created_at", `&or=(starts_at.gte.${encodeURIComponent(floor)},created_at.gte.${encodeURIComponent(floor)})`),
      list(scope.config, TABLES.time, org, "id,clock_in_at,clock_out_at,break_minutes,created_at", `&clock_in_at=gte.${encodeURIComponent(floor)}`),
      list(scope.config, TABLES.inventory, org, "id,quantity,cost_cents,reorder_level,status"),
      list(scope.config, TABLES.payments, org, "id,status,amount_cents,created_at", `&created_at=gte.${encodeURIComponent(floor)}`),
      list(scope.config, TABLES.locations, org, "id,event_type,captured_at,created_at", `&captured_at=gte.${encodeURIComponent(floor)}`)
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

  const workspaceId = (req) => req.sonaraBusinessMembership?.workspace_id || "";
  const backTo = (page, req) => page + (workspaceId(req) ? "?workspaceId=" + enc(workspaceId(req)) : "");
  const htmlRequest = (req) => String(req.get?.("accept") || "").includes("text/html")
    && !String(req.get?.("accept") || "").includes("application/json");

  async function resourcesFor(scope, limit = 1000) {
    const found = await list(scope.config, TABLES.assets, scope.organizationId,
      "id,location_id,name,asset_type,status,metadata,created_at,updated_at", "&status=eq.active&order=name.asc,id.asc", limit + 1);
    return { ...found, truncated: found.rows.length > limit,
      rows: found.rows.slice(0, limit).filter((row) => row?.metadata?.bookable === true) };
  }

  async function waitlistFor(scope, limit = 1000) {
    const found = await list(scope.config, TABLES.bookings, scope.organizationId,
      "id,location_id,service_id,assigned_employee_id,customer_id,customer_name,customer_email,customer_phone,starts_at,ends_at,status,notes,metadata,created_at,updated_at",
      "&status=eq.requested&order=created_at.asc,id.asc", limit + 1);
    return { ...found, truncated: found.rows.length > limit, rows: found.rows.slice(0, limit)
      .filter((row) => row?.metadata?.waitlist === true && !["booked", "cancelled"].includes(row?.metadata?.waitlist_state)) };
  }

  async function showResources(req, res, options = {}) {
    res.set("Cache-Control", "private, no-store");
    const scope = options.scope || await context(req);
    const [resources, locations] = scope.ok ? await Promise.all([
      resourcesFor(scope, 200),
      list(scope.config, "business_locations", scope.organizationId, "id,name", "&status=eq.active&order=name.asc,id.asc", 201)
    ]) : [{ ok: false, rows: [] }, { ok: false, rows: [] }];
    const unreadable = !scope.ok || !resources.ok || !locations.ok;
    return res.status(unreadable ? 503 : options.status || 200).type("html").send(pages.resources({
      rows: resources.rows, locations: locations.rows.slice(0, 200), workspaceId: workspaceId(req),
      input: options.input || {}, unreadable, truncated: resources.truncated || locations.rows.length > 200,
      error: unreadable || options.error, message: options.message || (req.query?.saved === "resource" ? "Resource added." : ""),
      createAction: options.createAction || "/api/business/reservation-resources"
    }));
  }

  async function showWaitlist(req, res, options = {}) {
    res.set("Cache-Control", "private, no-store");
    const scope = options.scope || await context(req);
    const [waiting, resources] = scope.ok ? await Promise.all([waitlistFor(scope, 200), resourcesFor(scope, 200)])
      : [{ ok: false, rows: [] }, { ok: false, rows: [] }];
    const unreadable = !scope.ok || !waiting.ok || !resources.ok;
    const saved = req.query?.saved === "waitlist" ? "Customer added to the waitlist."
      : req.query?.saved === "offer" ? "Offer recorded for your team. Contact the customer to agree their booking." : "";
    return res.status(unreadable ? 503 : options.status || 200).type("html").send(pages.waitlist({
      rows: waiting.rows, resources: resources.rows, workspaceId: workspaceId(req), input: options.input || {},
      unreadable, truncated: waiting.truncated || resources.truncated, error: unreadable || options.error,
      message: options.message || saved, createAction: options.createAction || "/api/business/waitlist",
      offerAction: options.offerAction || "/api/business/waitlist/:bookingId/offer"
    }));
  }

  app.get("/business-builder/owner/reservation-resources", requireBusinessManager, async (req, res) =>
    showResources(req, res, { createAction: "/api/business/reservation-resources" }));
  app.get("/business-builder/owner/waitlist", requireBusinessManager, async (req, res) =>
    showWaitlist(req, res, { createAction: "/api/business/waitlist", offerAction: "/api/business/waitlist/:bookingId/offer" }));

  async function reference(scope, table, id) {
    const found = await request(scope.config, table,
      "organization_id=eq." + enc(scope.organizationId) + "&id=eq." + enc(id) + "&select=id&limit=1");
    if (!found.ok) return { ok: false, status: 503, code: "reference_unreadable" };
    return found.rows[0]?.id === id ? { ok: true } : { ok: false, status: 404, code: "reference_not_found" };
  }

  function inputFailure(req, res, show, scope, input, status, code, message) {
    if (htmlRequest(req)) return show(req, res, { scope, input, status, error: true, message });
    return res.status(status).json({ ok: false, code });
  }

  app.get("/api/business/reservation-resources", requireBusinessManager, async (req, res) => {
    const scope = await context(req);
    if (!scope.ok) return res.status(scope.status).json(scope);
    const found = await resourcesFor(scope);
    if (!found.ok) return res.status(503).json({ ok: false, code: found.code });
    res.set("Cache-Control", "private, no-store");
    return res.status(200).json({ ok: true, resources: found.rows, partial: found.truncated });
  });

  app.post("/api/business/reservation-resources", requireBusinessManager, async (req, res) => {
    const scope = await context(req);
    const input = { name: req.body?.name, resource_type: req.body?.resource_type || req.body?.resourceType || req.body?.asset_type,
      capacity: req.body?.capacity, location_id: req.body?.location_id || req.body?.locationId, notes: req.body?.notes };
    const fail = (status, code, message) => inputFailure(req, res, showResources, scope, input, status, code, message);
    if (!scope.ok) return fail(scope.status, scope.code, "We could not confirm your business. Sign in again and refresh this page.");
    const name = clean(input.name, 160);
    if (!name) return fail(400, "resource_name_required", "Enter a name for this resource.");
    const capacity = positiveInteger(input.capacity ?? 1);
    if (!capacity) return fail(400, "invalid_capacity", "Capacity must be a whole number from 1 to 1000.");
    if (input.location_id) {
      if (!validUuid(input.location_id)) return fail(400, "invalid_location_id", "Choose a location from this business.");
      const owned = await reference(scope, "business_locations", input.location_id);
      if (!owned.ok) return fail(owned.status, owned.code, "We could not confirm that location in this business. Choose a location from this business and try again.");
    }
    const requestedType = clean(input.resource_type, 40) || "equipment";
    const created = await request(scope.config, TABLES.assets, "", {
      method: "POST",
      body: { organization_id: scope.organizationId, location_id: input.location_id || null,
        name, asset_type: BUSINESS_ASSET_TYPES.has(requestedType) ? requestedType : "other", status: "active",
        metadata: { bookable: true, resource_type: requestedType, capacity, notes: clean(input.notes, 1000) || null } }
    });
    if (!created.ok || !created.rows[0]?.id) return fail(502, created.code || "resource_save_unconfirmed",
      "We could not confirm the saved resource. Check the list before trying to add it again.");
    if (htmlRequest(req)) return res.redirect(303, backTo(RESOURCE_PAGE, req) + (workspaceId(req) ? "&" : "?") + "saved=resource");
    return res.status(201).json({ ok: true, resource: created.rows[0] });
  });

  app.get("/api/business/waitlist", requireBusinessManager, async (req, res) => {
    const scope = await context(req);
    if (!scope.ok) return res.status(scope.status).json(scope);
    const found = await waitlistFor(scope);
    if (!found.ok) return res.status(503).json({ ok: false, code: found.code });
    res.set("Cache-Control", "private, no-store");
    return res.status(200).json({ ok: true, waitlist: found.rows, partial: found.truncated });
  });

  app.post("/api/business/waitlist", requireBusinessManager, async (req, res) => {
    const scope = await context(req);
    const input = { customer_name: req.body?.customer_name || req.body?.customerName,
      customer_email: req.body?.customer_email || req.body?.customerEmail,
      customer_phone: req.body?.customer_phone || req.body?.customerPhone,
      party_size: req.body?.party_size ?? req.body?.partySize, preferred_start: req.body?.preferred_start || req.body?.preferredStart,
      preferred_end: req.body?.preferred_end || req.body?.preferredEnd,
      resource_ids: req.body?.resource_ids ?? req.body?.resourceIds, notes: req.body?.notes };
    const fail = (status, code, message) => inputFailure(req, res, showWaitlist, scope, input, status, code, message);
    if (!scope.ok) return fail(scope.status, scope.code, "We could not confirm your business. Sign in again and refresh this page.");
    const customerName = clean(input.customer_name, 200), customerEmail = clean(input.customer_email, 320),
      customerPhone = clean(input.customer_phone, 80), partySize = positiveInteger(input.party_size ?? 1);
    if (!customerName && !customerEmail && !customerPhone) return fail(400, "waitlist_contact_required", "Enter a customer name, email or phone.");
    if (customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) return fail(400, "invalid_customer_email", "Check the customer's email address.");
    if (!partySize) return fail(400, "invalid_party_size", "Party size must be a whole number from 1 to 1000.");
    const preferredStart = parsedTime(input.preferred_start), preferredEnd = parsedTime(input.preferred_end);
    if (preferredStart === false || preferredEnd === false || (preferredStart && preferredEnd && preferredEnd <= preferredStart)) {
      return fail(400, "invalid_preferred_period", "Enter valid preferred times in UTC, with the end after the start.");
    }
    const rawResources = typeof input.resource_ids === "string" ? [input.resource_ids]
      : input.resource_ids === undefined ? [] : input.resource_ids;
    if (!Array.isArray(rawResources) || rawResources.length > 50 || !rawResources.every(validUuid)) {
      return fail(400, "invalid_resource_ids", "Choose up to 50 resources from this business.");
    }
    const resourceIds = [...new Set(rawResources)];
    if (resourceIds.length) {
      const found = await request(scope.config, TABLES.assets, "organization_id=eq." + enc(scope.organizationId)
        + "&id=in.(" + resourceIds.map(enc).join(",") + ")&status=eq.active&select=id,metadata&limit=50");
      if (!found.ok) return fail(503, "resources_unreadable", "We could not check the selected resources. Refresh and try again.");
      if (resourceIds.some((id) => !found.rows.some((row) => row.id === id && row.metadata?.bookable === true))) {
        return fail(404, "resource_not_available", "Choose bookable resources from this business.");
      }
    }
    const references = [
      ["location_id", req.body?.location_id || req.body?.locationId, "business_locations"],
      ["service_id", req.body?.service_id || req.body?.serviceId, "business_service_catalog"],
      ["assigned_employee_id", req.body?.assigned_employee_id || req.body?.assignedEmployeeId, "business_employee_profiles"],
      ["customer_id", req.body?.customer_id || req.body?.customerId, "customers"]
    ];
    const record = { organization_id: scope.organizationId, customer_name: customerName || null,
      customer_email: customerEmail || null, customer_phone: customerPhone || null, status: "requested",
      notes: clean(input.notes, 2000) || null, metadata: { waitlist: true, waitlist_state: "waiting",
        preferred_start: preferredStart || null, preferred_end: preferredEnd || null, party_size: partySize, resource_ids: resourceIds } };
    for (const [column, id, table] of references) {
      if (!id) { record[column] = null; continue; }
      if (!validUuid(id)) return fail(400, "invalid_reference", "Choose related records from this business.");
      const owned = await reference(scope, table, id);
      if (!owned.ok) return fail(owned.status, owned.code, "We could not confirm a related record in this business. Check your choices and try again.");
      record[column] = id;
    }
    const created = await request(scope.config, TABLES.bookings, "", { method: "POST", body: record });
    if (!created.ok || !created.rows[0]?.id) return fail(502, created.code || "waitlist_save_unconfirmed",
      "We could not confirm the saved entry. Check the waitlist before trying to add it again.");
    if (htmlRequest(req)) return res.redirect(303, backTo(WAITLIST_PAGE, req) + (workspaceId(req) ? "&" : "?") + "saved=waitlist");
    return res.status(201).json({ ok: true, entry: created.rows[0] });
  });

  app.post("/api/business/waitlist/:bookingId/offer", requireBusinessManager, async (req, res) => {
    const scope = await context(req);
    const fail = (status, code, message) => inputFailure(req, res, showWaitlist, scope, {}, status, code, message);
    if (!scope.ok) return fail(scope.status, scope.code, "We could not confirm your business. Sign in again and refresh this page.");
    if (!validUuid(req.params.bookingId)) return fail(400, "invalid_booking_id", "Open a saved waitlist entry to record an offer.");
    const found = await request(scope.config, TABLES.bookings,
      "organization_id=eq." + enc(scope.organizationId) + "&id=eq." + enc(req.params.bookingId) + "&select=id,metadata,status&limit=1");
    if (!found.ok) return fail(503, found.code, "We could not check this entry. Refresh the waitlist and try again.");
    const booking = found.rows[0];
    if (!booking || booking.metadata?.waitlist !== true) return fail(404, "waitlist_entry_not_found", "This waitlist entry is not available.");
    if (booking.status !== "requested" || !["waiting", "offered"].includes(booking.metadata.waitlist_state || "waiting")) {
      return fail(409, "waitlist_entry_closed", "This entry has moved on. Refresh the waitlist before recording an offer.");
    }
    if (booking.metadata.waitlist_state === "offered") {
      if (htmlRequest(req)) return res.redirect(303, backTo(WAITLIST_PAGE, req) + (workspaceId(req) ? "&" : "?") + "saved=offer");
      return res.status(200).json({ ok: true, entry: booking, alreadyOffered: true, customerNotified: false });
    }
    const now = new Date().toISOString();
    const metadata = { ...booking.metadata, waitlist_state: "offered", offered_at: now, offered_by: scope.userId };
    // Compare the complete metadata snapshot and current status in the same
    // write. A concurrent booking or metadata change must not be overwritten.
    const updated = await request(scope.config, TABLES.bookings,
      "organization_id=eq." + enc(scope.organizationId) + "&id=eq." + enc(req.params.bookingId)
        + "&status=eq.requested&metadata=eq." + enc(JSON.stringify(booking.metadata)), {
        method: "PATCH", body: { metadata, updated_at: now }
      });
    if (!updated.ok) return fail(502, updated.code, "We could not confirm the recorded offer. Refresh before trying again.");
    if (!updated.rows[0]?.id) return fail(409, "waitlist_entry_changed", "Someone changed this entry. Refresh the waitlist before recording an offer.");
    if (htmlRequest(req)) return res.redirect(303, backTo(WAITLIST_PAGE, req) + (workspaceId(req) ? "&" : "?") + "saved=offer");
    return res.status(200).json({ ok: true, entry: updated.rows[0], customerNotified: false });
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

function positiveInteger(value) {
  if (!["string", "number"].includes(typeof value) || String(value).trim() === "") return null;
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 && number <= 1000 ? number : null;
}

function parsedTime(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return false;
  const parts = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})?$/i);
  if (!parts) return false;
  const [year, month, day, hour, minute, second] = parts.slice(1, 7).map((part) => Number(part || 0));
  const calendar = new Date(0);
  calendar.setUTCFullYear(year, month - 1, day);
  if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day
    || hour > 23 || minute > 59 || second > 59) return false;
  // Native datetime-local inputs on these forms are labelled UTC. Make that
  // explicit even when the server runs in a different local timezone.
  const parsed = Date.parse(parts[8] ? value : value + "Z");
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : false;
}

function clean(value, max = 240) {
  return String(value ?? "").trim().slice(0, max);
}

function validUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ""));
}

module.exports = registerOperationsExpansionRoutes;
