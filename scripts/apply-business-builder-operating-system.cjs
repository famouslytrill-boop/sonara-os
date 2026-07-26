"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
patchRouteModule();
patchServer();
console.log("Business Builder operating workflow integrated without duplicate routes");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function write(relativePath, source) {
  fs.writeFileSync(path.join(root, relativePath), source);
}

function replaceBetween(source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  if (start === -1) throw new Error(`Missing ${label} start marker`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (end === -1) throw new Error(`Missing ${label} end marker`);
  return `${source.slice(0, start)}${replacement}${source.slice(end)}`;
}

function patchRouteModule() {
  let source = read("routes/sonara-business-control-plane-routes.cjs");

  if (!source.includes("const requireWorkspaceAccess = deps.requireWorkspaceAccess")) {
    source = source.replace(
      "  const requireCustomer = deps.requireCustomer || requirePaidOrOwnerAccess(\"business_builder\");\n  const getCustomerPrimaryOrganization",
      "  const requireCustomer = deps.requireCustomer || requirePaidOrOwnerAccess(\"business_builder\");\n  const requireWorkspaceAccess = deps.requireWorkspaceAccess;\n  const getCustomerPrimaryOrganization"
    );
  }
  source = source.replace(
    "  const access = requirePaidOrOwnerAccess(\"business_builder\");\n",
    "  const access = requirePaidOrOwnerAccess(\"business_builder\");\n  const workspaceAccess = typeof requireWorkspaceAccess === \"function\" ? requireWorkspaceAccess(\"business_builder\") : requireCustomer;\n"
  );

  const accountStart = '  app.get("/account/setup", requireCustomer, async (req, res) => {';
  const dashboardStart = '  app.get("/business-builder/dashboard", access, async (req, res) => {';
  if (source.includes(accountStart)) {
    const accountMiddleware = `  app.use((req, res, next) => {
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

`;
    source = replaceBetween(source, accountStart, dashboardStart, accountMiddleware, "account setup route");
  }

  const controlCenterStart = '  app.get("/business-builder/control-center", access, async (req, res) => {';
  if (source.includes(dashboardStart)) {
    const dashboardMiddleware = `  async function renderBusinessBuilderDashboard(req, res) {
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

`;
    source = replaceBetween(source, dashboardStart, controlCenterStart, dashboardMiddleware, "Business Builder dashboard route");
  }

  const legacyFlowStart = '  app.get("/business-builder/offers/free", access, async (req, res) => redirectToPrimaryResource(req, res, "services"));';
  const controlPlaneStart = '  app.get("/api/business-builder/control-plane", access, async (req, res) => {';
  if (source.includes(legacyFlowStart)) {
    source = replaceBetween(source, legacyFlowStart, controlPlaneStart, "", "legacy Business Builder flow overrides");
  }

  source = source.replace(/app\.(get|post|patch|delete)\(("\/(?:api\/)?business-builder[^\"]*"), access,/g, 'app.$1($2, workspaceAccess,');
  source = source.replace('app.get("/api/business-builder/control-plane", workspaceAccess,', 'app.get("/api/business-builder/control-plane", access,');

  const patchRoute = '  app.patch("/api/business-builder/businesses/:businessId/:resource/:id", workspaceAccess, async (req, res) => mutateResource(req, res, "update"));';
  if (source.includes(patchRoute) && !source.includes('/:resource/:id/archive"')) {
    source = source.replace(
      patchRoute,
      `  app.post("/api/business-builder/businesses/:businessId/:resource/:id/archive", workspaceAccess, async (req, res) => mutateResource(req, res, "archive"));\n${patchRoute}`
    );
  }

  const recordCardStart = "function recordCard(businessId, key, definition, row) {";
  const recordDetailsStart = "function recordDetails(row) {";
  if (source.includes(recordCardStart)) {
    const recordCard = `function recordCard(businessId, key, definition, row) {
  const title = row.name || row.display_name || row.customer_name || row.title || row.provider_key || row.permission_key || "Saved record";
  const status = row.status || row.connection_status || row.role_key || "active";
  const details = recordDetails(row);
  return \`<article class="card bb-record-card"><div><span class="sonara-kicker">\${escapeBasic(String(status).replaceAll("_", " "))}</span><h2>\${escapeBasic(title)}</h2>\${details ? \`<p>\${escapeBasic(details)}</p>\` : ""}</div><form method="post" action="/api/business-builder/businesses/\${encodeURIComponent(businessId)}/\${encodeURIComponent(key)}/\${encodeURIComponent(row.id)}/archive"><button class="bb-quiet-action" type="submit">Archive</button></form></article>\`;
}

`;
    source = replaceBetween(source, recordCardStart, recordDetailsStart, recordCard, "record card archive action");
  }

  source = source.replace("normalizeFields(req.body, definition.fields, false);", "normalizeFields(req.body, definition.fields, false, acceptsHtml(req));");
  source = source.replace("normalizeFields(req.body, definition.fields, true).value;", "normalizeFields(req.body, definition.fields, true, acceptsHtml(req)).value;");
  source = source.replace("function normalizeFields(body, fields, partial) {", "function normalizeFields(body, fields, partial, moneyInMajorUnits = false) {");
  source = source.replace(
    '    if (rules.type === "money") { const cents = moneyToCents(input); if (!Number.isFinite(cents)) return { ok: false, status: 400, code: `invalid_${name}`, value: {} }; value[name] = cents; continue; }',
    '    if (rules.type === "money") { const cents = moneyInMajorUnits ? moneyToCents(input) : Number.parseInt(String(input), 10); if (!Number.isFinite(cents)) return { ok: false, status: 400, code: `invalid_${name}`, value: {} }; value[name] = cents; continue; }'
  );

  write("routes/sonara-business-control-plane-routes.cjs", source);
}

function patchServer() {
  let source = read("server.js");

  const registrationPattern = /registerSonaraBusinessControlPlaneRoutes\(app, \{[\s\S]*?\n\}\);/;
  const registration = `registerSonaraBusinessControlPlaneRoutes(app, {
  layout,
  brandCard,
  linkAction,
  escapeHtml,
  requireCustomer,
  requireWorkspaceAccess,
  requirePaidOrOwnerAccess,
  getCustomerPrimaryOrganization,
  getSupabaseServerConfig,
  supabaseHeaders
});`;
  if (registrationPattern.test(source)) source = source.replace(registrationPattern, registration);

  const helperMarker = "async function saveModuleOutput(req, productKey, moduleKey, input, output) {";
  if (!source.includes("async function safeInsertBusinessBuilderOperatingRecord")) {
    const helper = `async function safeInsertBusinessBuilderOperatingRecord(organizationId, userId, productKey, moduleKey, input, output) {
  if (productKey !== "business_builder" || moduleKey !== "offer_builder") return { ok: false, code: "not_applicable", rows: [] };
  const config = getSupabaseAdminClient();
  if (!config.ok || !organizationId) return { ok: false, code: "setup_required", rows: [] };
  const businessResponse = await fetch(\`${'${config.url}'}/rest/v1/business_workspaces?select=id&organization_id=eq.\${encodeURIComponent(organizationId)}&deleted_at=is.null&order=created_at.asc&limit=1\`, {
    headers: supabaseHeaders(config)
  }).catch(() => undefined);
  if (!businessResponse?.ok) return { ok: false, code: "business_lookup_failed", rows: [] };
  const businesses = await businessResponse.json().catch(() => []);
  const businessId = businesses[0]?.id;
  if (!businessId) return { ok: false, code: "business_required", rows: [] };
  const rawPrice = String(input.priceIdea || input.price || "0").replace(/[^0-9.-]/g, "");
  const amount = Number(rawPrice);
  const priceCents = Number.isFinite(amount) ? Math.round(amount * 100) : 0;
  const response = await fetch(\`${'${config.url}'}/rest/v1/business_service_catalog\`, {
    method: "POST",
    headers: supabaseHeaders(config, { prefer: "return=representation" }),
    body: JSON.stringify({
      organization_id: organizationId,
      business_id: businessId,
      name: String(input.serviceType || input.name || "Business offer").trim(),
      category: "offer",
      description: String(input.deliverables || input.description || "").trim() || null,
      price_cents: priceCents,
      currency: "usd",
      status: "active",
      metadata: { audience: String(input.audience || "").trim() || null, source: "business_builder_offer", output }
    })
  }).catch(() => undefined);
  return { ok: Boolean(response?.ok), code: response?.ok ? "saved" : "save_failed", rows: response?.ok ? await response.json().catch(() => []) : [] };
}

`;
    if (!source.includes(helperMarker)) throw new Error("saveModuleOutput marker not found");
    source = source.replace(helperMarker, `${helper}${helperMarker}`);
  }

  const oldSave = `  const saved = await safeInsertModuleOutput(organization.organizationId, productKey, moduleKey, input, output);
  const domain = await safeInsertDomainModuleRecord(organization.organizationId, req.sonaraUser?.id, productKey, moduleKey, input, output);
  const anySaved = saved.ok || domain.ok;
  const referenceId = saved.rows?.[0]?.id || domain.rows?.[0]?.id || randomUUID();`;
  const newSave = `  const saved = await safeInsertModuleOutput(organization.organizationId, productKey, moduleKey, input, output);
  const domain = await safeInsertDomainModuleRecord(organization.organizationId, req.sonaraUser?.id, productKey, moduleKey, input, output);
  const operating = await safeInsertBusinessBuilderOperatingRecord(organization.organizationId, req.sonaraUser?.id, productKey, moduleKey, input, output);
  const anySaved = saved.ok || domain.ok || operating.ok;
  const referenceId = saved.rows?.[0]?.id || domain.rows?.[0]?.id || operating.rows?.[0]?.id || randomUUID();`;
  if (source.includes(oldSave)) source = source.replace(oldSave, newSave);
  if (!source.includes("operatingRecordSaved: operating.ok")) {
    source = source.replace(
      "    domainRecordSaved: domain.ok,\n    domainTable: domain.ok ? domain.table : null,",
      "    domainRecordSaved: domain.ok,\n    domainTable: domain.ok ? domain.table : null,\n    operatingRecordSaved: operating.ok,\n    operatingTable: operating.ok ? \"business_service_catalog\" : null,"
    );
  }

  write("server.js", source);
}
