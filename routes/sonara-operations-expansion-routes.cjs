// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const { summarizeBusinessOperations } = require("../lib/sonara-business-analytics.cjs");
const { buildMapSnapshot } = require("../lib/sonara-location-map.cjs");
const { templates: workflowTemplates, validateWorkflow } = require("../lib/sonara-workflow-planner.cjs");
const pages = require("../lib/sonara-waitlist-pages.cjs");
const { createReservationPages, RESOURCE_PAGE } = require("../lib/sonara-reservation-pages.cjs");
const { looksLikeEmail } = require("../lib/sonara-email-shape.cjs");

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
const trainingPages = require("../lib/sonara-training-lab-pages.cjs");

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
  const resourcePages = createReservationPages({ layout, linkAction, escapeHtml });

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
    const payload = response.status === 204 ? [] : await response.json().catch(() => null);
    if (!response.ok) return { ok: false, status: 503, code: "database_request_failed", rows: [] };
    // PostgREST representation must be an array. A 200 with malformed JSON
    // is a failed read, not evidence that the tenant has zero records.
    if (!Array.isArray(payload)) return { ok: false, status: 503, code: "database_response_invalid", rows: [] };
    return { ok: true, status: response.status, rows: payload };
  }

  async function list(config, table, organizationId, select, extra = "", limit = 1000) {
    return request(config, table,
      `organization_id=eq.${enc(organizationId)}&select=${select}${extra}&limit=${Math.min(2000, Math.max(1, Number(limit) || 1000))}`);
  }

  // The two reads the waitlist page and its JSON twins share, so the page and
  // the API cannot disagree about what is bookable or who is waiting.
  async function readResources(scope, limit = 1000) {
    const rows = await list(scope.config, TABLES.assets, scope.organizationId,
      "id,location_id,name,asset_type,status,metadata,created_at,updated_at", "&status=eq.active", limit);
    if (!rows.ok) return { ok: false, code: rows.code, rows: [], partial: false };
    return { ok: true, rows: rows.rows.filter((row) => row?.metadata?.bookable === true), partial: rows.rows.length >= limit };
  }

  async function readWaitlist(scope) {
    const rows = await list(scope.config, TABLES.bookings, scope.organizationId,
      "id,location_id,service_id,assigned_employee_id,customer_id,customer_name,customer_email,customer_phone,starts_at,ends_at,status,notes,metadata,created_at,updated_at",
      "&status=eq.requested&order=created_at.asc", 1000);
    if (!rows.ok) return { ok: false, code: rows.code, rows: [], partial: false };
    return { ok: true, rows: rows.rows.filter((row) =>
      row?.metadata?.waitlist === true && row?.metadata?.waitlist_state !== "booked"
      && row?.metadata?.waitlist_state !== "cancelled"), partial: rows.rows.length >= 1000 };
  }


  // The HTML and JSON views share the same organization-scoped readers.
  async function renderReservationPage(req, res, kind, status = null, input = {}, problem = "", readers = { readResources, readWaitlist }) {
    res.set("Cache-Control", "private, no-store");
    const scope = await context(req);
    const workspaceId = req.sonaraBusinessMembership?.workspace_id || "";
    const success = String(req.query?.saved || req.query?.done || "");
    const issue = problem || String(req.query?.problem || "");
    const errors = {
      invalid_capacity: "Capacity must be a whole number between 1 and 1000.",
      invalid_location_id: "Choose a valid location for this business.",
      location_not_yours: "The selected location is not part of this business.",
      resource_not_available: "The selected resource is not available.",
      invalid_party_size: "Party size must be a whole number between 1 and 1000.",
      database_request_failed: "The save could not be confirmed. Check the list before trying to add it again.",
      database_response_invalid: "Records could not be read. Please check again.",
      waitlist_contact_required: "Add a name, email or phone number.",
      invalid_contact: "Check the customer email address.",
      invalid_time_window: "Enter real UTC times in chronological order."
    };
    const [resources, locations, waitlist] = scope.ok ? await Promise.all([
      readers.readResources(scope, 201),
      kind === "resources" ? list(scope.config, "business_locations", scope.organizationId,
        "id,name", "&status=eq.active&order=name.asc,id.asc", 201) : Promise.resolve({ ok: true, rows: [] }),
      kind === "waitlist" ? readers.readWaitlist(scope) : Promise.resolve({ ok: true, rows: [] })
    ]) : [{ ok: false, rows: [] }, { ok: false, rows: [] }, { ok: false, rows: [] }];
    const unreadable = !scope.ok || !resources.ok || (kind === "resources" ? !locations.ok : !waitlist.ok);
    const error = Boolean(issue || !scope.ok);
    const message = error ? (errors[issue] || (scope.ok ? "Your changes were not saved." : "Your workspace could not be read."))
      : success ? "Saved. Your records were updated." : "";
    if (kind === "resources") {
      return res.status(status ?? (unreadable ? (scope.status || 503) : 200)).type("html").send(resourcePages.resources({
        rows: (resources.rows || []).slice(0, 200), locations: (locations.rows || []).slice(0, 200),
        workspaceId, input, unreadable, truncated: resources.partial || (locations.rows || []).length >= 201,
        error, message, createAction: "/api/business/reservation-resources"
      }));
    }
    // The original manager-only combined page remains usable when the session
    // has no selected business workspace. New workspace-selected screens use
    // the dedicated accessible reservation UI above instead.
    if (!workspaceId) {
      const options = { back: WAITLIST_PAGE, escape: escapeHtml };
      return res.status(status ?? (unreadable ? (scope.status || 503) : 200)).type("html").send(layout({
        title: "Waiting list", eyebrow: "Business Builder", heading: "Waiting list",
        body: "Who is waiting and what resources they can book.",
        sections: [
          pages.notice(req.query || {}, escapeHtml),
          pages.waitlistCard(waitlist, resources, options),
          pages.addToWaitlistForm(resources, options),
          pages.resourcesCard(resources, options)
        ].filter(Boolean),
        actions: [linkAction("/business-builder/owner/bookings", "Bookings"),
          linkAction(RESOURCE_PAGE, "Reservation resources")]
      }));
    }
    return res.status(status ?? (unreadable ? (scope.status || 503) : 200)).type("html").send(resourcePages.waitlist({
      rows: waitlist.rows || [], resources: resources.rows || [], workspaceId, input,
      unreadable, truncated: Boolean(resources.partial || waitlist.partial),
      error, message, createAction: "/api/business/waitlist",
      offerAction: "/api/business/waitlist/:bookingId/offer"
    }));
  }


  function sendReservation(req, res, status, body, doneKey) {
    if (!wantsHtml(req)) return res.status(status).json(body);
    const destination = doneKey === "resource" ? RESOURCE_PAGE : WAITLIST_PAGE;
    const workspaceId = req.sonaraBusinessMembership?.workspace_id;
    // Legacy browser forms explicitly name the combined waitlist page and
    // predate workspace selection. Restrict the destination to this known route;
    // never let an arbitrary `back` URL redirect a browser off-site.
    if (!workspaceId && req.body?.back === WAITLIST_PAGE) {
      const key = status < 300 && body?.ok !== false ? "done" : "problem";
      const value = key === "done" ? doneKey : body?.code || "database_request_failed";
      return res.redirect(303, WAITLIST_PAGE + "?" + key + "=" + encodeURIComponent(value));
    }
    if (status < 300 && body?.ok !== false) {
      const query = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}&saved=${doneKey}` : `?saved=${doneKey}`;
      return res.redirect(303, destination + query);
    }
    return renderReservationPage(req, res, doneKey === "resource" ? "resources" : "waitlist",
      status, req.body || {}, body?.code || "database_request_failed");
  }

  // The registered page passes the SAME tenant-scoped reader functions that
  // serve its JSON twins. Explicit thunk calls make the shared read chain
  // independently auditable without reading private state or querying twice.
  app.get(WAITLIST_PAGE, requireBusinessManager, (req, res) => renderReservationPage(req, res,
    "waitlist", null, {}, "", {
      readResources: (scope, limit) => readResources(scope, limit),
      readWaitlist: (scope) => readWaitlist(scope)
    }));
  app.get(RESOURCE_PAGE, requireBusinessManager, (req, res) => renderReservationPage(req, res, "resources"));

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
    // Reuse the authenticated owner/manager route. Training reads no database,
    // provider, customer record or financial data. Do not let a query preview
    // become a new authority or a write path.
    if (req.query?.view === "training") {
      res.set("Cache-Control", "private, no-store");
      return res.status(200).type("html").send(layout({
        title: "Practice a business decision",
        eyebrow: "Business Builder",
        heading: "Practice a business decision",
        body: "An original, one-turn fictional training exercise. Nothing is saved or sent.",
        sections: trainingPages.sections(req.query, escapeHtml),
        actions: [
          linkAction(OPERATIONS_PAGE, "Back to business operations"),
          linkAction("/business-builder/dashboard", "Back to your workspace")
        ]
      }));
    }
    const days = operationsPages.PERIODS.includes(Number(req.query.days)) ? Number(req.query.days) : 30;
    const page = (sections, status = 200) => res.status(status).type("html").send(layout({
      title: "How the business is doing", eyebrow: "Business Builder", heading: "How the business is doing",
      body: "Money received, bookings, hours worked and stock, from what you have recorded.",
      sections,
      actions: [linkAction("/business-builder/owner/receivables", "Money owed to you"), linkAction("/business-builder/owner/work-orders", "Work orders"), linkAction(OPERATIONS_PAGE + "?view=training", "Practice fictional decisions"), linkAction("/business-builder/dashboard", "Back to your workspace")]
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
    return res.status(200).json({ ok: true, resources: resources.rows, partial: resources.partial });
  });

  app.post("/api/business/reservation-resources", requireBusinessManager, async (req, res) => {
    const scope = await context(req);
    if (!scope.ok) return sendReservation(req, res, scope.status, scope, "resource");
    const name = clean(req.body?.name, 160);
    if (!name) return sendReservation(req, res, 400, { ok: false, code: "resource_name_required" }, "resource");
    const requestedType = clean(req.body?.resource_type || req.body?.resourceType || req.body?.asset_type, 40) || "equipment";
    const assetType = BUSINESS_ASSET_TYPES.has(requestedType) ? requestedType : "other";
    const rawCapacity = req.body?.capacity ?? 1;
    const capacity = typeof rawCapacity === "number" || typeof rawCapacity === "string"
      ? Number(rawCapacity) : NaN;
    if (String(rawCapacity).trim() === "" || !Number.isSafeInteger(capacity) || capacity < 1 || capacity > 1000) {
      return sendReservation(req, res, 400, { ok: false, code: "invalid_capacity" }, "resource");
    }
    const locationId = req.body?.location_id || req.body?.locationId || null;
    if (locationId) {
      if (!validUuid(locationId)) return sendReservation(req, res, 400, { ok: false, code: "invalid_location_id" }, "resource");
      const owned = await list(scope.config, "business_locations", scope.organizationId,
        "id", `&id=eq.${enc(locationId)}`, 1);
      if (!owned.ok) return sendReservation(req, res, 503, { ok: false, code: "database_request_failed" }, "resource");
      if (!owned.rows.some((row) => row.id === locationId)) {
        return sendReservation(req, res, 404, { ok: false, code: "location_not_yours" }, "resource");
      }
    }
    const created = await request(scope.config, TABLES.assets, "", {
      method: "POST",
      body: {
        organization_id: scope.organizationId,
        location_id: locationId,
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
    const confirmed = created.ok && Boolean(created.rows[0]?.id);
    return sendReservation(req, res, confirmed ? 201 : 502, {
      ok: confirmed, resource: created.rows[0] || null,
      code: confirmed ? null : created.code || "database_request_failed"
    }, "resource");
  });

  app.get("/api/business/waitlist", requireBusinessManager, async (req, res) => {
    const scope = await context(req);
    if (!scope.ok) return res.status(scope.status).json(scope);
    const waitlist = await readWaitlist(scope);
    if (!waitlist.ok) return res.status(503).json({ ok: false, code: waitlist.code });
    return res.status(200).json({ ok: true, waitlist: waitlist.rows, partial: waitlist.partial });
  });


  async function ownedReference(scope, table, id, options = "") {
    const found = await list(scope.config, table, scope.organizationId, "id", `&id=eq.${enc(id)}${options}`, 1);
    return !found.ok ? { ok: false, status: 503, code: "database_request_failed" }
      : found.rows.some((row) => row.id === id) ? { ok: true }
        : { ok: false, status: 404, code: table === TABLES.assets ? "resource_not_available" : "reference_not_found" };
  }

  function utcFormTime(value) {
    if (value === undefined || value === null || value === "") return { ok: true, iso: null };
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return { ok: false };
    const iso = value + ":00.000Z";
    const date = new Date(iso);
    return Number.isFinite(date.getTime()) && date.toISOString() === iso
      ? { ok: true, iso } : { ok: false };
  }

  app.post("/api/business/waitlist", requireBusinessManager, async (req, res) => {
    const scope = await context(req);
    if (!scope.ok) return sendReservation(req, res, scope.status, scope, "waitlist");
    const body = req.body || {};
    const customerName = clean(body.customer_name || body.customerName, 200);
    const customerEmail = clean(body.customer_email || body.customerEmail, 320);
    const customerPhone = clean(body.customer_phone || body.customerPhone, 80);
    if (!customerName && !customerEmail && !customerPhone) {
      return sendReservation(req, res, 400, { ok: false, code: "waitlist_contact_required" }, "waitlist");
    }
    if (customerEmail && !looksLikeEmail(customerEmail)) {
      return sendReservation(req, res, 400, { ok: false, code: "invalid_contact" }, "waitlist");
    }
    const partyValue = body.party_size ?? body.partySize ?? 1;
    const partySize = typeof partyValue === "number" || typeof partyValue === "string" ? Number(partyValue) : NaN;
    if (String(partyValue).trim() === "" || !Number.isSafeInteger(partySize) || partySize < 1 || partySize > 1000) {
      return sendReservation(req, res, 400, { ok: false, code: "invalid_party_size" }, "waitlist");
    }
    const start = utcFormTime(body.preferred_start ?? body.preferredStart);
    const end = utcFormTime(body.preferred_end ?? body.preferredEnd);
    if (!start.ok || !end.ok || (start.iso && end.iso && end.iso <= start.iso)) {
      return sendReservation(req, res, 400, { ok: false, code: "invalid_time_window" }, "waitlist");
    }
    const rawResourceIds = body.resource_ids ?? body.resourceIds;
    if (rawResourceIds !== undefined && rawResourceIds !== null && !Array.isArray(rawResourceIds)
      && typeof rawResourceIds !== "string") {
      return sendReservation(req, res, 400, { ok: false, code: "invalid_resource_ids" }, "waitlist");
    }
    const resourceIds = listOf(rawResourceIds);
    if (resourceIds.length > 50 || resourceIds.some((id) => !validUuid(id)) || new Set(resourceIds).size !== resourceIds.length) {
      return sendReservation(req, res, 400, { ok: false, code: "invalid_resource_ids" }, "waitlist");
    }
    for (const id of resourceIds) {
      const owned = await ownedReference(scope, TABLES.assets, id, "&status=eq.active");
      if (!owned.ok) return sendReservation(req, res, owned.status, { ok: false, code: owned.code }, "waitlist");
      const read = await list(scope.config, TABLES.assets, scope.organizationId, "id,metadata",
        `&id=eq.${enc(id)}&status=eq.active`, 1);
      if (!read.ok) return sendReservation(req, res, 503, { ok: false, code: read.code }, "waitlist");
      if (read.rows[0]?.metadata?.bookable !== true) {
        return sendReservation(req, res, 404, { ok: false, code: "resource_not_available" }, "waitlist");
      }
    }
    const refs = [
      ["location_id", "business_locations"],
      ["service_id", "business_service_catalog"],
      ["assigned_employee_id", "business_employee_profiles"],
      ["customer_id", "customers"]
    ];
    const linked = {};
    for (const [column, table] of refs) {
      const camel = column.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      const supplied = body[column] ?? body[camel] ?? null;
      if (supplied === "" || supplied === null) { linked[column] = null; continue; }
      if (!validUuid(supplied)) return sendReservation(req, res, 400, { ok: false, code: "invalid_" + column }, "waitlist");
      const owned = await ownedReference(scope, table, supplied);
      if (!owned.ok) return sendReservation(req, res, owned.status, { ok: false, code: owned.code }, "waitlist");
      linked[column] = supplied;
    }
    const created = await request(scope.config, TABLES.bookings, "", {
      method: "POST",
      body: {
        organization_id: scope.organizationId,
        ...linked,
        customer_name: customerName || null,
        customer_email: customerEmail || null,
        customer_phone: customerPhone || null,
        status: "requested",
        notes: clean(body.notes, 2000) || null,
        metadata: {
          waitlist: true, waitlist_state: "waiting",
          preferred_start: start.iso, preferred_end: end.iso,
          party_size: partySize, resource_ids: resourceIds
        }
      }
    });
    const confirmed = created.ok && Boolean(created.rows[0]?.id);
    return sendReservation(req, res, confirmed ? 201 : 502, {
      ok: confirmed, entry: created.rows[0] || null,
      code: confirmed ? null : created.code || "database_request_failed"
    }, "waitlist");
  });


  app.post("/api/business/waitlist/:bookingId/offer", requireBusinessManager, async (req, res) => {
    const scope = await context(req);
    if (!scope.ok) return sendReservation(req, res, scope.status, scope, "offer");
    const bookingId = req.params.bookingId;
    if (!validUuid(bookingId)) return sendReservation(req, res, 400, { ok: false, code: "invalid_booking_id" }, "offer");
    const found = await request(scope.config, TABLES.bookings,
      `organization_id=eq.${enc(scope.organizationId)}&id=eq.${enc(bookingId)}&select=id,metadata,status&limit=1`);
    if (!found.ok) return sendReservation(req, res, 503, { ok: false, code: found.code }, "offer");
    const booking = found.rows[0];
    if (!booking || booking.metadata?.waitlist !== true) {
      return sendReservation(req, res, 404, { ok: false, code: "waitlist_entry_not_found" }, "offer");
    }
    if (booking.status !== "requested") {
      return sendReservation(req, res, 409, { ok: false, code: "waitlist_closed" }, "offer");
    }
    if (booking.metadata?.waitlist_state === "offered") {
      return sendReservation(req, res, 200, { ok: true, entry: booking, alreadyOffered: true,
        customerNotified: false }, "offer");
    }
    if (booking.metadata?.waitlist_state !== "waiting") {
      return sendReservation(req, res, 409, { ok: false, code: "waitlist_closed" }, "offer");
    }
    // Compare-and-swap using BOTH source status and complete original metadata.
    // This rejects a concurrent booking confirmation/cancellation or a change
    // to the customer's party/resources rather than overwriting it with stale data.
    const nextMetadata = { ...booking.metadata,
      waitlist_state: "offered", offered_at: new Date().toISOString(), offered_by: scope.userId };
    const original = JSON.stringify(booking.metadata);
    const updated = await request(scope.config, TABLES.bookings,
      `organization_id=eq.${enc(scope.organizationId)}&id=eq.${enc(bookingId)}&status=eq.requested&metadata=eq.${enc(original)}`, {
        method: "PATCH",
        body: { metadata: nextMetadata, updated_at: new Date().toISOString() }
      });
    if (!updated.ok) return sendReservation(req, res, 503, { ok: false, code: updated.code }, "offer");
    if (updated.rows.length !== 1) {
      return sendReservation(req, res, 409, { ok: false, code: "waitlist_entry_changed" }, "offer");
    }
    return sendReservation(req, res, 200, { ok: true, entry: updated.rows[0],
      customerNotified: false, alreadyOffered: false }, "offer");
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
  const accept = String(req.get?.("accept") || req.headers?.accept || "").toLowerCase();
  return accept.includes("text/html") && !accept.startsWith("application/json");
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
