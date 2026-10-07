// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const { summarizeBusinessOperations } = require("../lib/sonara-business-analytics.cjs");
const { buildMapSnapshot } = require("../lib/sonara-location-map.cjs");
const { templates: workflowTemplates, validateWorkflow } = require("../lib/sonara-workflow-planner.cjs");
const pages = require("../lib/sonara-waitlist-pages.cjs");

const TABLES = Object.freeze({
  bookings: "business_bookings",
  assets: "business_assets",
  time: "employee_time_entries",
  inventory: "inventory_items",
  invoicePayments: "customer_invoice_payments",
  invoices: "customer_invoices",
  shopOrders: "merchant_orders",
  workOrders: "business_work_orders",
  workOrderMaterials: "business_work_order_materials",
  locations: "location_events"
});
const BUSINESS_ASSET_TYPES = new Set(pages.RESOURCE_TYPES);
const WAITLIST_PAGE = "/business-builder/owner/waitlist";
const OPERATIONS_PAGE = "/business-builder/owner/operations";
const READ_LIMIT = 1000;
const operationsPages = require("../lib/sonara-operations-pages.cjs");

function registerOperationsExpansionRoutes(app, deps = {}) {
  const {
    requireBusinessManager,
    getCustomerPrimaryOrganization,
    getSupabaseServerConfig,
    supabaseHeaders,
    layout,
    linkAction,
    escapeHtml
  } = deps;
  if (typeof requireBusinessManager !== "function") throw new TypeError("operations expansion requires requireBusinessManager");
  if (typeof getCustomerPrimaryOrganization !== "function") throw new TypeError("operations expansion requires getCustomerPrimaryOrganization");
  if (typeof getSupabaseServerConfig !== "function") throw new TypeError("operations expansion requires getSupabaseServerConfig");
  if (typeof supabaseHeaders !== "function") throw new TypeError("operations expansion requires supabaseHeaders");
  if (typeof layout !== "function" || typeof linkAction !== "function" || typeof escapeHtml !== "function") {
    throw new TypeError("operations expansion requires layout, linkAction and escapeHtml for the waitlist page");
  }

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

  // The two reads the waitlist page and its JSON twins share, so the page and
  // the API cannot disagree about what is bookable or who is waiting.
  async function readResources(scope) {
    const rows = await list(scope.config, TABLES.assets, scope.organizationId,
      "id,location_id,name,asset_type,status,metadata,created_at,updated_at", "&status=eq.active", 1000);
    if (!rows.ok) return { ok: false, code: rows.code, rows: [] };
    return { ok: true, rows: rows.rows.filter((row) => row?.metadata?.bookable === true) };
  }

  async function readWaitlist(scope) {
    const rows = await list(scope.config, TABLES.bookings, scope.organizationId,
      "id,location_id,service_id,assigned_employee_id,customer_id,customer_name,customer_email,customer_phone,starts_at,ends_at,status,notes,metadata,created_at,updated_at",
      "&status=eq.requested&order=created_at.asc", 1000);
    if (!rows.ok) return { ok: false, code: rows.code, rows: [] };
    return { ok: true, rows: rows.rows.filter((row) => row?.metadata?.waitlist === true && row?.metadata?.waitlist_state !== "booked" && row?.metadata?.waitlist_state !== "cancelled") };
  }

  app.get(WAITLIST_PAGE, requireBusinessManager, async (req, res) => {
    const page = (sections, status = 200) => res.status(status).type("html").send(layout({
      title: "Waiting list", eyebrow: "Business Builder", heading: "Waiting list",
      body: "Who is waiting for a place, and the rooms, tables and equipment they can book.",
      sections,
      actions: [linkAction("/business-builder/owner/bookings", "Bookings"), linkAction("/business-builder/dashboard", "Back to your workspace")]
    }));
    const scope = await context(req);
    if (!scope.ok) {
      return page([`<article class="card" role="alert"><h2>Your workspace could not be read</h2><p>${escapeHtml(pages.PROBLEMS[scope.code] || "This page cannot say who is waiting.")} It is not saying nobody is.</p></article>`], scope.status);
    }
    const [waitlist, resources] = await Promise.all([readWaitlist(scope), readResources(scope)]);
    const options = { back: WAITLIST_PAGE, escape: escapeHtml };
    return page([
      pages.notice(req.query, escapeHtml),
      pages.waitlistCard(waitlist, resources, options),
      pages.addToWaitlistForm(resources, options),
      pages.resourcesCard(resources, options)
    ].filter(Boolean));
  });

  // One reader for the page and the JSON, so they cannot disagree. A source
  // that could not be read is named rather than counted as zero, and a source
  // whose read came back at the limit is named too: a total over the first
  // thousand rows is a lower bound, and the page says so rather than presenting
  // it as the figure.
  async function readOperations(scope, days) {
    const end = new Date();
    const start = new Date(end.getTime() - days * 86400000);
    const floor = start.toISOString();
    const floorDay = floor.slice(0, 10);
    const org = scope.organizationId;
    const [bookings, time, inventory, invoicePayments, shopOrders, locations, workOrders] = await Promise.all([
      list(scope.config, TABLES.bookings, org, "id,status,starts_at,ends_at,created_at", `&or=(starts_at.gte.${encodeURIComponent(floor)},created_at.gte.${encodeURIComponent(floor)})`, READ_LIMIT),
      list(scope.config, TABLES.time, org, "id,clock_in_at,clock_out_at,break_minutes,created_at", `&clock_in_at=gte.${encodeURIComponent(floor)}`, READ_LIMIT),
      list(scope.config, TABLES.inventory, org, "id,quantity,cost_cents,reorder_level,status", "", READ_LIMIT),
      list(scope.config, TABLES.invoicePayments, org, "id,invoice_id,amount_cents,received_on", `&received_on=gte.${encodeURIComponent(floorDay)}`, READ_LIMIT),
      list(scope.config, TABLES.shopOrders, org, "id,payment_state,amount_paid_cents,refunded_cents,currency,paid_at", `&paid_at=gte.${encodeURIComponent(floor)}`, READ_LIMIT),
      list(scope.config, TABLES.locations, org, "id,event_type,captured_at,created_at", `&captured_at=gte.${encodeURIComponent(floor)}`, READ_LIMIT),
      list(scope.config, TABLES.workOrders, org, "id,status,completed_at,agreed_amount_cents,labor_cost_cents,travel_cost_cents,other_cost_cents,currency", `&status=in.(completed,invoiced,closed)&completed_at=gte.${encodeURIComponent(floor)}`, READ_LIMIT)
    ]);

    // An invoice payment carries no currency; its invoice does. Read in small
    // batches so the address stays short, and a batch that fails makes the
    // whole money figure unreadable rather than silently smaller.
    const invoiceIds = [...new Set((invoicePayments.rows || []).map((row) => row.invoice_id).filter(validUuid))];
    const currencyByInvoice = new Map();
    let invoices = { ok: true };
    for (let index = 0; invoicePayments.ok && index < invoiceIds.length; index += 100) {
      const batch = invoiceIds.slice(index, index + 100);
      const read = await request(scope.config, TABLES.invoices,
        `organization_id=eq.${enc(org)}&id=in.(${batch.map(enc).join(",")})&select=id,currency&limit=100`);
      if (!read.ok) { invoices = read; break; }
      for (const row of read.rows) currencyByInvoice.set(row.id, row.currency);
    }

    // A finished job's materials, in small batches. A batch that fails, or comes
    // back at its limit, makes the job figures unreadable rather than quietly
    // cheaper: a material line that was not read is a cost left out, and a
    // profit missing a cost is overstated.
    const jobIds = workOrders.ok ? workOrders.rows.map((row) => row.id).filter(validUuid) : [];
    const workOrderMaterials = { ok: true, rows: [] };
    for (let index = 0; workOrders.ok && index < jobIds.length; index += 20) {
      const batch = jobIds.slice(index, index + 20);
      const read = await request(scope.config, TABLES.workOrderMaterials,
        `organization_id=eq.${enc(org)}&work_order_id=in.(${batch.map(enc).join(",")})&select=work_order_id,quantity_planned,quantity_used,unit_cost_cents&limit=${READ_LIMIT}`);
      if (!read.ok || read.rows.length >= READ_LIMIT) { workOrderMaterials.ok = false; break; }
      workOrderMaterials.rows.push(...read.rows);
    }

    const sources = { bookings, time, inventory, invoicePayments, invoices, shopOrders, locations, workOrders, workOrderMaterials };
    const unreadableSources = Object.entries(sources).filter(([, result]) => !result.ok).map(([name]) => name);
    if (unreadableSources.length) return { ok: false, code: "analytics_sources_unreadable", unreadableSources };
    const truncatedSources = Object.entries({ bookings, time, inventory, invoicePayments, shopOrders, locations, workOrders })
      .filter(([, result]) => result.rows.length >= READ_LIMIT)
      .map(([name]) => name);

    const summary = summarizeBusinessOperations({
      periodStart: start.toISOString(), periodEnd: end.toISOString(),
      bookings: bookings.rows, timeEntries: time.rows, inventoryItems: inventory.rows,
      invoicePayments: invoicePayments.rows.map((row) => ({ ...row, currency: currencyByInvoice.get(row.invoice_id) || null })),
      shopOrders: shopOrders.rows,
      workOrders: workOrders.rows,
      workOrderMaterials: workOrderMaterials.rows,
      locationEvents: locations.rows
    });
    return { ...summary, days, truncatedSources };
  }

  const daysFrom = (value) => Math.min(366, Math.max(1, Number(value) || 30));

  app.get("/api/business/operations/analytics", requireBusinessManager, async (req, res) => {
    const scope = await context(req);
    if (!scope.ok) return res.status(scope.status).json(scope);
    const result = await readOperations(scope, daysFrom(req.query.days));
    if (result.code === "analytics_sources_unreadable") {
      return res.status(503).json({ ...result, reason: "The dashboard refuses to convert failed reads into zeroes." });
    }
    return res.status(result.ok ? 200 : 400).json({ ...result, source: "organization_scoped_operational_rows" });
  });

  app.get(OPERATIONS_PAGE, requireBusinessManager, async (req, res) => {
    const days = operationsPages.PERIODS.includes(Number(req.query.days)) ? Number(req.query.days) : 30;
    const page = (sections, status = 200) => res.status(status).type("html").send(layout({
      title: "How the business is doing", eyebrow: "Business Builder", heading: "How the business is doing",
      body: "Money received, bookings, hours worked and stock, from what you have recorded.",
      sections,
      actions: [linkAction("/business-builder/owner/receivables", "Money owed to you"), linkAction("/business-builder/owner/work-orders", "Work orders"), linkAction("/business-builder/dashboard", "Back to your workspace")]
    }));
    const scope = await context(req);
    if (!scope.ok) return page([operationsPages.unreadableCard(["workspace"], escapeHtml)], scope.status);
    const result = await readOperations(scope, days);
    if (!result.ok) return page([operationsPages.periodForm(days, OPERATIONS_PAGE, escapeHtml), operationsPages.unreadableCard(result.unreadableSources || [], escapeHtml)], 503);
    return page(operationsPages.sections(result, { path: OPERATIONS_PAGE, escape: escapeHtml }));
  });

  app.get("/api/business/reservation-resources", requireBusinessManager, async (req, res) => {
    const scope = await context(req);
    if (!scope.ok) return res.status(scope.status).json(scope);
    const resources = await readResources(scope);
    if (!resources.ok) return res.status(503).json({ ok: false, code: resources.code });
    return res.status(200).json({ ok: true, resources: resources.rows });
  });

  app.post("/api/business/reservation-resources", requireBusinessManager, async (req, res) => {
    const scope = await context(req);
    if (!scope.ok) return respond(req, res, scope.status, scope, "resource");
    const name = clean(req.body?.name, 160);
    if (!name) return respond(req, res, 400, { ok: false, code: "resource_name_required" }, "resource");
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
    return respond(req, res, created.ok ? 201 : 502, { ok: created.ok, resource: created.rows[0] || null, code: created.code }, "resource");
  });

  app.get("/api/business/waitlist", requireBusinessManager, async (req, res) => {
    const scope = await context(req);
    if (!scope.ok) return res.status(scope.status).json(scope);
    const waitlist = await readWaitlist(scope);
    if (!waitlist.ok) return res.status(503).json({ ok: false, code: waitlist.code });
    return res.status(200).json({ ok: true, waitlist: waitlist.rows });
  });

  app.post("/api/business/waitlist", requireBusinessManager, async (req, res) => {
    const scope = await context(req);
    if (!scope.ok) return respond(req, res, scope.status, scope, "waitlist");
    const customerName = clean(req.body?.customer_name || req.body?.customerName, 200);
    const customerEmail = clean(req.body?.customer_email || req.body?.customerEmail, 320);
    const customerPhone = clean(req.body?.customer_phone || req.body?.customerPhone, 80);
    if (!customerName && !customerEmail && !customerPhone) {
      return respond(req, res, 400, { ok: false, code: "waitlist_contact_required" }, "waitlist");
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
          // A form posts one ticked box as a string and several as an array.
          resource_ids: listOf(req.body?.resource_ids ?? req.body?.resourceIds).filter(validUuid).slice(0, 50)
        }
      }
    });
    return respond(req, res, created.ok ? 201 : 502, { ok: created.ok, entry: created.rows[0] || null, code: created.code }, "waitlist");
  });

  app.post("/api/business/waitlist/:bookingId/offer", requireBusinessManager, async (req, res) => {
    const scope = await context(req);
    if (!scope.ok) return respond(req, res, scope.status, scope, "offer");
    if (!validUuid(req.params.bookingId)) return respond(req, res, 400, { ok: false, code: "invalid_booking_id" }, "offer");
    const found = await request(scope.config, TABLES.bookings,
      `organization_id=eq.${enc(scope.organizationId)}&id=eq.${enc(req.params.bookingId)}&select=id,metadata,status&limit=1`);
    const booking = found.rows[0];
    if (!found.ok) return respond(req, res, 502, { ok: false, code: "database_request_failed" }, "offer");
    if (!booking || booking?.metadata?.waitlist !== true) return respond(req, res, 404, { ok: false, code: "waitlist_entry_not_found" }, "offer");
    const metadata = { ...(booking.metadata || {}), waitlist_state: "offered", offered_at: new Date().toISOString() };
    const updated = await request(scope.config, TABLES.bookings,
      `organization_id=eq.${enc(scope.organizationId)}&id=eq.${enc(req.params.bookingId)}`, {
        method: "PATCH", body: { metadata, updated_at: new Date().toISOString() }
      });
    return respond(req, res, updated.ok ? 200 : 502, { ok: updated.ok, entry: updated.rows[0] || null, code: updated.code, customerNotified: false }, "offer");
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

// A browser posting the waitlist page's forms is sent back to the page with a
// named notice; an API client gets the JSON it always got. Only an address on
// this site is a place to send somebody back to.
function wantsHtml(req) {
  const accept = String(req.headers?.accept || "");
  return accept.includes("text/html") && !/^application\/json/.test(accept);
}

function backFrom(req) {
  const back = String(req.body?.back || "");
  return /^\/[a-z0-9/-]*$/.test(back) && back.length <= 200 ? back : WAITLIST_PAGE;
}

function respond(req, res, status, body, doneKey) {
  if (!wantsHtml(req)) return res.status(status).json(body);
  const back = backFrom(req);
  if (status < 300 && body?.ok !== false) return res.redirect(303, `${back}?done=${doneKey}`);
  return res.redirect(303, `${back}?problem=${encodeURIComponent(String(body?.code || "database_request_failed"))}`);
}

function listOf(value) {
  if (Array.isArray(value)) return value;
  return value === undefined || value === null || value === "" ? [] : [value];
}

function clean(value, max = 240) {
  return String(value ?? "").trim().slice(0, max);
}

function validUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

module.exports = registerOperationsExpansionRoutes;
