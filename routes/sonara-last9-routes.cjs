"use strict";

const RESOURCE_MAP = {
  "/api/business/locations": { table: "business_locations", required: ["name"], defaults: { location_type: "storefront", status: "active" } },
  "/api/business/services": { table: "business_service_catalog", required: ["name"], defaults: { status: "active" } },
  "/api/business/bookings": { table: "business_bookings", required: ["customer_name"], defaults: { status: "requested" } },
  "/api/business/staff": { table: "business_employee_profiles", required: ["display_name"], defaults: { status: "active", employment_type: "employee" } },
  "/api/business/schedules": { table: "employee_schedules", required: ["employee_id", "starts_at", "ends_at"], defaults: { status: "scheduled" } },
  "/api/business/vendors": { table: "vendor_accounts", required: ["name"], defaults: { status: "active" } },
  "/api/business/invoices": { table: "vendor_invoices", required: ["vendor_id"], defaults: { processing_status: "draft", payment_status: "unpaid" } },
  "/api/business/inventory": { table: "inventory_items", required: ["name"], defaults: { status: "active", unit: "each" } },
  "/api/business/recipes": { table: "recipe_cards", required: ["name"], defaults: { status: "active" } },
  "/api/business/menu-items": { table: "menu_items", required: ["name"], defaults: { status: "active", currency: "usd" } },
  "/api/business/vehicles": { table: "vehicle_records", required: ["vehicle_type"], defaults: { status: "active" } },
  "/api/business/maintenance": { table: "maintenance_logs", required: ["description"], defaults: { status: "completed", currency: "usd" } },
  "/api/business/waste": { table: "waste_logs", required: ["item_name"], defaults: {} },
  "/api/creator/music-projects": { table: "music_projects", required: ["title"], defaults: { status: "draft", project_type: "song" } },
  "/api/integrations/jobs": { table: "integration_jobs", required: ["provider_key", "job_type"], defaults: { status: "queued" } },
  "/api/sensory/profiles": { table: "sensory_feedback_profiles", required: ["name", "profile_key"], defaults: { status: "active" } },
  "/api/sensory/sound-cues": { table: "sound_cues", required: ["cue_key", "name", "event_name"], defaults: { status: "active", sound_type: "tone" } },
  "/api/sensory/haptic-patterns": { table: "haptic_patterns", required: ["pattern_key", "name", "event_name"], defaults: { status: "active" } },
  "/api/location/zones": { table: "location_zones", required: ["name"], defaults: { status: "active", zone_type: "business" } }
};

const PUBLIC_GETS = new Map([
  ["/api/integrations/providers", { table: "integration_providers", query: "?select=provider_key,name,category,connection_mode,capabilities,status&order=category.asc,provider_key.asc&limit=200" }]
]);

const OWNER_PAGES = [
  ["/business-builder/owner", "Owner Dashboard", "Run the business workspace: locations, staff, services, bookings, inventory, vendors, invoices, food costs, vehicles, and maintenance."],
  ["/business-builder/owner/locations", "Locations", "Manage storefronts, mobile stops, food trucks, trailers, job sites, and service areas."],
  ["/business-builder/owner/services", "Services", "Build the services, menu items, appointments, and customer offers your business sells."],
  ["/business-builder/owner/bookings", "Bookings", "Review requested, confirmed, completed, cancelled, and no-show bookings."],
  ["/business-builder/owner/staff", "Staff", "Create employee profiles, assign job information, and prepare staff access."],
  ["/business-builder/owner/schedules", "Schedule", "Plan shifts and staff coverage by location."],
  ["/business-builder/owner/time", "Time Clock", "Review staff time entries and clock activity."],
  ["/business-builder/owner/inventory", "Inventory", "Track items, counts, movement, waste, reorder levels, and value."],
  ["/business-builder/owner/vendors", "Vendors", "Manage vendors, account details, invoices, and purchasing."],
  ["/business-builder/owner/invoices", "Invoices", "Track vendor invoices, line items, approval state, bill status, and accounting export readiness."],
  ["/business-builder/owner/recipes", "Recipes", "Build recipes and ingredient costs for menu and product costing."],
  ["/business-builder/owner/menu", "Menu", "Connect selling prices, recipe costs, and menu margin."],
  ["/business-builder/owner/costs", "Food Costs", "Review sales, food cost, labor cost, waste, menu mix, and daily profit snapshots."],
  ["/business-builder/owner/vehicles", "Vehicles", "Track vehicles, trailers, food trucks, registrations, inspections, and assigned routes."],
  ["/business-builder/owner/maintenance", "Maintenance", "Log equipment, vehicle, trailer, and location maintenance records."]
];

const STAFF_PAGES = [
  ["/staff", "Staff Portal", "Staff can see schedule, tasks, announcements, time entries, and assigned job information."],
  ["/staff/schedule", "My Schedule", "View assigned shifts and locations."],
  ["/staff/time", "My Time", "Start and stop work entries when owner access rules allow it."],
  ["/staff/tasks", "My Tasks", "Review assigned tasks and due dates."],
  ["/staff/announcements", "Announcements", "Read business updates from the owner or manager."],
  ["/staff/location", "My Location", "Use approved location check-ins for job sites, routes, deliveries, and mobile vendors."]
];

const CREATOR_PAGES = [
  ["/creator-studio/music-projects", "Music Projects", "Create songs, albums, EPs, DAW sessions, audio assets, sound analysis records, and visual cue plans."],
  ["/creator-studio/device-cues", "Sound and Motion Cues", "Plan sound feedback, vibration cues, motion events, GPS cues, and animation timing for premium creator projects."]
];

module.exports = function registerLastNineHoursRoutes(app, deps = {}) {
  const ui = buildUi(deps);
  const requireCustomer = deps.requireCustomer || passthrough;
  const requireBusinessManager = deps.requireBusinessManager || requireCustomer;
  const requireWorkspaceAccess = typeof deps.requireWorkspaceAccess === "function" ? deps.requireWorkspaceAccess : () => requireCustomer;

  OWNER_PAGES.forEach(([path, title, body]) => {
    app.get(path, requireBusinessManager, async (req, res) => {
      const summary = await operationsSummary(getConfig(deps));
      return res.status(200).type("html").send(ui.layout({
        title,
        eyebrow: "Business Builder operations",
        heading: title,
        body,
        sections: [
          ui.card("Real business records", "This area is backed by Supabase operations tables. If a table is missing, the page reports setup required instead of pretending."),
          ui.card("Owner controlled", "Owners and managers control staff access, locations, services, invoices, inventory, vehicles, and business operations."),
          ...summary.map((item) => ui.card(item.label, item.value))
        ],
        actions: [
          ui.link("/business-builder/owner/locations", "Locations"),
          ui.link("/business-builder/owner/staff", "Staff"),
          ui.link("/business-builder/owner/time", "Time"),
          ui.link("/business-builder/owner/inventory", "Inventory"),
          ui.link("/business-builder/dashboard", "Dashboard")
        ]
      }));
    });
  });

  STAFF_PAGES.forEach(([path, title, body]) => {
    app.get(path, requireCustomer, (req, res) => {
      return res.status(200).type("html").send(ui.layout({
        title,
        eyebrow: "Staff portal",
        heading: title,
        body,
        sections: [
          ui.card("Limited access", "Staff users see only assigned schedule, tasks, announcements, time entries, and allowed job information."),
          ui.card("Owner controlled", "Business owners decide what staff can access. Staff users are not business administrators."),
          ui.card("Device support", "Location, sound, vibration, and motion features require user permission and compatible devices.")
        ],
        actions: [ui.link("/staff/schedule", "Schedule"), ui.link("/staff/time", "Time"), ui.link("/staff/tasks", "Tasks"), ui.link("/staff/location", "Location")]
      }));
    });
  });

  CREATOR_PAGES.forEach(([path, title, body]) => {
    app.get(path, requireWorkspaceAccess("creator_studio"), (req, res) => {
      return res.status(200).type("html").send(ui.layout({
        title,
        eyebrow: "Creator Studio",
        heading: title,
        body,
        sections: [
          ui.card("Music production records", "Track projects, DAW sessions, audio assets, sound analysis, cue timing, and export packages."),
          ui.card("AI/audio integrations", "Provider jobs are tracked as API, manual export, or setup-required records. The system does not fake provider access."),
          ui.card("Premium feel", "Sound, vibration, motion, and GPS are available only when the user enables supported browser features.")
        ],
        actions: [ui.link("/creator-studio/music-projects", "Music Projects"), ui.link("/creator-studio/device-cues", "Sound and Motion"), ui.link("/creator-studio/dashboard", "Dashboard")]
      }));
    });
  });

  app.get("/settings/device-feedback", requireCustomer, (req, res) => {
    return res.status(200).type("html").send(ui.layout({
      title: "Device Feedback",
      eyebrow: "Premium app feel",
      heading: "Sound, Vibration, Motion, and Location",
      body: "Test supported device features. Nothing starts automatically. Sounds, vibration, motion, and GPS need user action and browser permission.",
      sections: [
        `<div class="card"><h2>Test feedback</h2><p>Use this to verify browser support for sound and vibration.</p><button type="button" onclick="window.SONARA?.sensoryDevice?.feedback('success')">Test success feedback</button><p class="fine" id="deviceCaps"></p></div>`,
        ui.card("Privacy", "Location and motion data should be used only for clock-ins, job-site check-ins, routes, inspections, delivery stops, and approved creator cue workflows."),
        ui.card("Fallbacks", "If vibration, motion, or GPS is unsupported, the app must show a plain setup or unsupported message.")
      ],
      actions: [ui.link("/staff/location", "Staff Location"), ui.link("/creator-studio/device-cues", "Creator Cues"), ui.link("/settings", "Settings")]
    }).replace("</body>", `<script src="/sensory-device-client.js"></script><script>if(window.SONARA&&SONARA.sensoryDevice){document.getElementById('deviceCaps').textContent=JSON.stringify(SONARA.sensoryDevice.supports());}</script></body>`));
  });

  Object.entries(RESOURCE_MAP).forEach(([path, resource]) => registerRestResource(app, path, resource, deps, requireBusinessManager));

  PUBLIC_GETS.forEach((resource, path) => {
    app.get(path, async (req, res) => {
      const config = getConfig(deps);
      if (!config.ok) return res.status(503).json({ ok: false, code: "setup_required", service: "supabase" });
      return res.status(200).json(await supabaseList(config, resource.table, resource.query));
    });
  });

  app.post("/api/business/time-entries/start", requireCustomer, async (req, res) => {
    const config = getConfig(deps);
    if (!config.ok) return res.status(503).json({ ok: false, code: "setup_required", service: "supabase" });
    const org = await resolveOrganization(req, deps);
    if (!org.ok) return res.status(403).json(org);
    const payload = {
      organization_id: org.organizationId,
      employee_id: req.body.employee_id || null,
      location_id: req.body.location_id || null,
      clock_in_at: new Date().toISOString(),
      entry_source: "employee_portal",
      status: "open",
      notes: sanitizeText(req.body.notes)
    };
    return res.status(200).json(await supabaseInsert(config, "employee_time_entries", payload));
  });

  app.post("/api/business/time-entries/stop", requireCustomer, async (req, res) => {
    const config = getConfig(deps);
    if (!config.ok) return res.status(503).json({ ok: false, code: "setup_required", service: "supabase" });
    const id = sanitizeText(req.body.id);
    if (!id) return res.status(400).json({ ok: false, code: "validation_failed", message: "Missing time entry id." });
    const payload = { clock_out_at: new Date().toISOString(), status: "submitted", break_minutes: Number(req.body.break_minutes || 0) || 0 };
    return res.status(200).json(await supabasePatch(config, "employee_time_entries", id, payload));
  });

  app.post("/api/location/events", requireCustomer, async (req, res) => {
    const config = getConfig(deps);
    if (!config.ok) return res.status(503).json({ ok: false, code: "setup_required", service: "supabase" });
    const org = await resolveOrganization(req, deps);
    if (!org.ok) return res.status(403).json(org);
    const payload = {
      organization_id: org.organizationId,
      user_id: org.userId || null,
      employee_id: req.body.employee_id || null,
      location_zone_id: req.body.location_zone_id || null,
      event_type: sanitizeChoice(req.body.event_type, "position_update"),
      latitude: toNumberOrNull(req.body.latitude),
      longitude: toNumberOrNull(req.body.longitude),
      accuracy_meters: toNumberOrNull(req.body.accuracy_meters || req.body.accuracy),
      speed_mps: toNumberOrNull(req.body.speed_mps || req.body.speed),
      heading_degrees: toNumberOrNull(req.body.heading_degrees || req.body.heading),
      privacy_mode: sanitizeChoice(req.body.privacy_mode, "precise"),
      metadata: sanitizeObject(req.body.metadata)
    };
    return res.status(200).json(await supabaseInsert(config, "location_events", payload));
  });

  app.post("/api/motion/events", requireCustomer, async (req, res) => {
    const config = getConfig(deps);
    if (!config.ok) return res.status(503).json({ ok: false, code: "setup_required", service: "supabase" });
    const org = await resolveOrganization(req, deps);
    if (!org.ok) return res.status(403).json(org);
    const payload = {
      organization_id: org.organizationId,
      user_id: org.userId || null,
      event_type: sanitizeChoice(req.body.event_type, "device_motion"),
      alpha: toNumberOrNull(req.body.alpha),
      beta: toNumberOrNull(req.body.beta),
      gamma: toNumberOrNull(req.body.gamma),
      acceleration_x: toNumberOrNull(req.body.acceleration_x || req.body.accelerationX),
      acceleration_y: toNumberOrNull(req.body.acceleration_y || req.body.accelerationY),
      acceleration_z: toNumberOrNull(req.body.acceleration_z || req.body.accelerationZ),
      rotation_alpha: toNumberOrNull(req.body.rotation_alpha || req.body.rotationAlpha),
      rotation_beta: toNumberOrNull(req.body.rotation_beta || req.body.rotationBeta),
      rotation_gamma: toNumberOrNull(req.body.rotation_gamma || req.body.rotationGamma),
      gesture_label: sanitizeText(req.body.gesture_label),
      metadata: sanitizeObject(req.body.metadata)
    };
    return res.status(200).json(await supabaseInsert(config, "motion_sensor_events", payload));
  });

  app.get("/api/last9/readiness", async (req, res) => {
    const config = getConfig(deps);
    const tables = [
      "sonara_platforms", "business_employee_profiles", "employee_time_entries", "vendor_invoices", "inventory_items", "recipe_cards", "menu_items", "music_projects", "audio_assets", "location_events", "motion_sensor_events", "tactile_events"
    ];
    if (!config.ok) return res.status(503).json({ ok: false, code: "setup_required", service: "supabase", tables });
    const results = await Promise.all(tables.map((table) => supabaseCount(config, table).then((result) => ({ table, ...result }))));
    return res.status(200).json({ ok: true, tables: results });
  });
};

function registerRestResource(app, path, resource, deps, middleware) {
  app.get(path, middleware, async (req, res) => {
    const config = getConfig(deps);
    if (!config.ok) return res.status(503).json({ ok: false, code: "setup_required", service: "supabase" });
    const query = `?select=*&order=created_at.desc&limit=${Math.min(Number(req.query.limit || 50) || 50, 100)}`;
    return res.status(200).json(await supabaseList(config, resource.table, query));
  });

  app.post(path, middleware, async (req, res) => {
    const missing = resource.required.filter((key) => !String(req.body[key] || "").trim());
    if (missing.length) return res.status(400).json({ ok: false, code: "validation_failed", missing });
    const config = getConfig(deps);
    if (!config.ok) return res.status(503).json({ ok: false, code: "setup_required", service: "supabase" });
    const org = await resolveOrganization(req, deps);
    if (!org.ok) return res.status(403).json(org);
    const payload = sanitizeObject({ ...resource.defaults, ...req.body, organization_id: org.organizationId, user_id: org.userId || req.body.user_id || null });
    return res.status(200).json(await supabaseInsert(config, resource.table, payload));
  });
}

function buildUi(deps) {
  const escape = deps.escapeHtml || ((value) => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;"));
  return {
    layout: deps.layout || (({ title, eyebrow, heading, body, sections, actions }) => `<!doctype html><html><head><title>${escape(title)}</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"></head><body><main><p>${escape(eyebrow)}</p><h1>${escape(heading)}</h1><p>${escape(body)}</p><div>${(actions || []).join("")}</div><section>${(sections || []).join("")}</section></main></body></html>`),
    card: deps.brandCard || ((title, body) => `<article class="card"><h2>${escape(title)}</h2><p>${escape(body)}</p></article>`),
    link: deps.linkAction || ((href, label) => `<a class="action" href="${escape(href)}">${escape(label)}</a>`)
  };
}

async function operationsSummary(config) {
  if (!config.ok) return [{ label: "Database", value: "Setup required: Supabase service role is not configured." }];
  const tables = [
    ["Staff", "business_employee_profiles"],
    ["Time entries", "employee_time_entries"],
    ["Inventory", "inventory_items"],
    ["Vendors", "vendor_accounts"],
    ["Invoices", "vendor_invoices"],
    ["Recipes", "recipe_cards"],
    ["Menu", "menu_items"],
    ["Daily profit", "daily_profit_snapshots"],
    ["Music projects", "music_projects"],
    ["Location events", "location_events"]
  ];
  const results = await Promise.all(tables.map(async ([label, table]) => ({ label, result: await supabaseCount(config, table) })));
  return results.map(({ label, result }) => ({ label, value: result.ok ? `${result.count} records` : "Setup required: table not available." }));
}

async function resolveOrganization(req, deps) {
  const user = req.sonaraUser || req.sonaraCustomer?.user || req.sonaraAccess?.user || null;
  if (typeof deps.getCustomerPrimaryOrganization === "function" && user) {
    const org = await deps.getCustomerPrimaryOrganization(user);
    if (org?.ok) return { ok: true, organizationId: org.organizationId, userId: user.id };
  }
  const orgFromBody = sanitizeText(req.body.organization_id);
  if (orgFromBody && process.env.SONARA_ALLOW_MANUAL_ORG_ID === "true") return { ok: true, organizationId: orgFromBody, userId: user?.id || null };
  return { ok: false, code: "owner_access_required", message: "Business owner or staff session is required." };
}

function getConfig(deps) {
  if (typeof deps.getSupabaseServerConfig === "function") return deps.getSupabaseServerConfig();
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return { ok: false };
  return { ok: true, url: url.replace(/\/$/, ""), serviceRoleKey };
}

function headers(config, extra = {}) {
  return { apikey: config.serviceRoleKey, Authorization: `Bearer ${config.serviceRoleKey}`, "Content-Type": "application/json", ...extra };
}

async function supabaseList(config, table, query) {
  const response = await fetch(`${config.url}/rest/v1/${table}${query}`, { headers: headers(config) }).catch(() => undefined);
  if (!response?.ok) return { ok: false, code: "table_unavailable", table };
  const rows = await response.json().catch(() => []);
  return { ok: true, table, rows: Array.isArray(rows) ? rows : [] };
}

async function supabaseCount(config, table) {
  const response = await fetch(`${config.url}/rest/v1/${table}?select=id&limit=1`, { headers: headers(config, { Prefer: "count=exact" }) }).catch(() => undefined);
  if (!response?.ok) return { ok: false, count: null };
  const range = response.headers?.get?.("content-range") || "";
  const match = range.match(/\/(\d+)$/);
  return { ok: true, count: match ? Number(match[1]) : 0 };
}

async function supabaseInsert(config, table, payload) {
  const response = await fetch(`${config.url}/rest/v1/${table}`, { method: "POST", headers: headers(config, { Prefer: "return=representation" }), body: JSON.stringify(payload) }).catch(() => undefined);
  if (!response?.ok) return { ok: false, code: "insert_failed", table, status: response?.status || null };
  const rows = await response.json().catch(() => []);
  return { ok: true, table, rows };
}

async function supabasePatch(config, table, id, payload) {
  const response = await fetch(`${config.url}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", headers: headers(config, { Prefer: "return=representation" }), body: JSON.stringify(payload) }).catch(() => undefined);
  if (!response?.ok) return { ok: false, code: "update_failed", table, status: response?.status || null };
  const rows = await response.json().catch(() => []);
  return { ok: true, table, rows };
}

function sanitizeText(value) {
  return String(value || "").trim().slice(0, 2000);
}

function sanitizeChoice(value, fallback) {
  const clean = sanitizeText(value).replace(/[^a-z0-9_\-]/gi, "_").slice(0, 80);
  return clean || fallback;
}

function sanitizeObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const output = {};
  for (const [key, item] of Object.entries(value)) {
    if (["password", "secret", "token", "service_role", "api_key"].some((part) => key.toLowerCase().includes(part))) continue;
    output[key] = typeof item === "string" ? sanitizeText(item) : item;
  }
  return output;
}

function toNumberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function passthrough(req, res, next) {
  return next();
}
