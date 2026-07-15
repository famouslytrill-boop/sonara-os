"use strict";

const {
  PRODUCTION_ORIGIN,
  ROUTE_REGISTRY,
  PUBLIC_SITEMAP_ROUTES
} = require("../lib/sonara-route-registry.cjs");

const TUTORIALS = {
  "/tutorials/getting-started": {
    title: "Getting started",
    body: "Create an account, choose the product that matches the work in front of you, create a workspace, and run one free tool before considering a paid plan.",
    steps: ["Create or sign in to your account.", "Create your organization and workspace.", "Choose Business Builder, Creator Studio, or Growth Studio.", "Run a free tool and review the generated output.", "Upgrade only when you need saved history, advanced workflows, or operator delivery."]
  },
  "/tutorials/business-builder": {
    title: "Business Builder tutorial",
    body: "Move from an offer idea to an operating business without filling an empty dashboard first.",
    steps: ["Describe the customer problem and first offer.", "Use pricing and readiness tools to test the offer.", "Create the workspace records you actually need.", "Track requests, customers, and operational follow-up.", "Use paid records only after billing access is verified."]
  },
  "/tutorials/creator-studio": {
    title: "Creator Studio tutorial",
    body: "Organize a creative system from the story and asset plan through release and delivery.",
    steps: ["Create a creator profile outline.", "Build an asset and release checklist.", "Turn the core idea into a content brief.", "Track rights, releases, and deliverables in the creator workspace.", "Request operator review when the project needs hands-on delivery."]
  },
  "/tutorials/growth-studio": {
    title: "Growth Studio tutorial",
    body: "Run focused, consent-aware growth work with clear goals and review dates.",
    steps: ["Choose one measurable campaign outcome.", "Create a campaign outline and offer angle.", "Prepare a consent-safe follow-up script.", "Track leads and the next responsible action.", "Review the signal before expanding the campaign."]
  }
};

function registerRouteRegistryRoutes(app, deps) {
  const {
    layout,
    brandCard,
    actionCard,
    linkAction,
    responsePage,
    escapeHtml,
    requireCustomer,
    requireWorkspaceAccess,
    requireAdmin,
    wantsJson,
    getSupabaseAuthConfig,
    getSupabaseServerConfig,
    supabaseHeaders,
    getPublicAppUrl,
    getCustomerPrimaryOrganization,
    getReadiness,
    displayStatus,
    accountNoticeCard,
    logoutAction,
    adminActions,
    adminRowsPage,
    recordAdminAuditEvent,
    getDeploymentInfo,
    safeListTable
  } = deps;

  const sendPage = (res, input) => res.status(200).type("html").send(layout(input));
  const setupMessage = "This feature is ready in the application, but saving needs the account database to be connected by an administrator.";

  app.get("/api/routes/public", (req, res) => {
    return res.status(200).json({
      ok: true,
      routes: ROUTE_REGISTRY.filter((record) => record.visibility === "public").map((record) => ({
        route: record.route,
        title: record.title,
        description: record.description,
        indexingPolicy: record.indexingPolicy,
        readiness: record.readiness
      }))
    });
  });

  app.get("/sitemap.xml", (req, res) => {
    const urls = PUBLIC_SITEMAP_ROUTES
      .map((record) => `<url><loc>${escapeHtml(record.canonicalUrl)}</loc><changefreq>weekly</changefreq></url>`)
      .join("");
    return res.status(200).type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`);
  });

  app.get("/robots.txt", (req, res) => {
    return res.status(200).type("text/plain").send([
      "User-agent: *",
      "Allow: /",
      "Disallow: /admin/",
      "Disallow: /account/",
      "Disallow: /dashboard",
      "Disallow: /requests",
      "Disallow: /deliverables",
      `Sitemap: ${PRODUCTION_ORIGIN}/sitemap.xml`
    ].join("\n"));
  });

  app.get("/products", (req, res) => sendPage(res, {
    title: "Products",
    eyebrow: "One platform, three workspaces",
    heading: "Choose the system that matches the work.",
    body: "Each product has its own tools and records. They share one account and operating layer without mixing customer data across products.",
    sections: [
      actionCard("Business Builder", "Create, launch, and operate a business with offers, pricing, customer workflows, and practical records.", [linkAction("/business-builder", "Explore Business Builder"), linkAction("/tutorials/business-builder", "Tutorial")]),
      actionCard("Creator Studio", "Organize, protect, publish, and grow creative work through repeatable release and content systems.", [linkAction("/creator-studio", "Explore Creator Studio"), linkAction("/tutorials/creator-studio", "Tutorial")]),
      actionCard("Growth Studio", "Plan campaigns, follow up responsibly, and learn from measurable growth signals.", [linkAction("/growth-studio", "Explore Growth Studio"), linkAction("/tutorials/growth-studio", "Tutorial")])
    ],
    actions: [linkAction("/free-tools", "Free tools"), linkAction("/pricing", "Pricing"), linkAction("/start", "Start")]
  }));

  app.get("/free-tools", (req, res) => sendPage(res, {
    title: "Free tools",
    eyebrow: "Useful before you pay",
    heading: "Start with a real output.",
    body: "Signed-in customers can use deterministic free tools without submitting a service intake first. Sign in is required so product data stays attached to the correct account.",
    sections: [
      actionCard("Business Builder tools", "Offer outline, pricing calculator, readiness score, launch checklist, customer starter, and service-package builder.", [linkAction("/business-builder/tools", "Open Business Builder tools")]),
      actionCard("Creator Studio tools", "Creator profile, asset checklist, release checklist, content brief, content plan, and music-system blueprint.", [linkAction("/creator-studio/tools", "Open Creator Studio tools")]),
      actionCard("Growth Studio tools", "Campaign outline, follow-up script, consent checklist, offer angles, KPI calculator, and growth readiness score.", [linkAction("/growth-studio/tools", "Open Growth Studio tools")])
    ],
    actions: [linkAction("/signup", "Create account"), linkAction("/login", "Sign in"), linkAction("/tutorials", "Tutorials")]
  }));

  app.get("/how-it-works", (req, res) => sendPage(res, {
    title: "How SONARA works",
    eyebrow: "From goal to delivery",
    heading: "Every workflow shows the next honest step.",
    body: "SONARA combines software tools with optional operator delivery. Missing providers show setup-required states instead of simulated success.",
    sections: [
      brandCard("1. Choose an outcome", "Start with the business, creator, or growth result you need."),
      brandCard("2. Create a useful output", "Use a free tool, checklist, calculator, or structured workspace action."),
      brandCard("3. Save and track", "Account database records keep the output, request, status, and responsible party connected."),
      brandCard("4. Upgrade with proof", "Paid access unlocks only after Stripe records active or trialing billing state."),
      brandCard("5. Receive delivery", "Service requests move through review, production, feedback, delivery, and completion with visible status.")
    ],
    actions: [linkAction("/start", "Start"), linkAction("/service-catalog", "Service catalog"), linkAction("/tutorials/getting-started", "Getting started")]
  }));

  app.get("/tutorials", (req, res) => sendPage(res, {
    title: "Tutorials",
    eyebrow: "Learn at your pace",
    heading: "Short guides for the work in front of you.",
    body: "Tutorials explain the platform without blocking access to the application.",
    sections: Object.entries(TUTORIALS).map(([route, tutorial]) => actionCard(tutorial.title, tutorial.body, [linkAction(route, "Read tutorial")])),
    actions: [linkAction("/help", "Help center"), linkAction("/free-tools", "Free tools")]
  }));

  for (const [route, tutorial] of Object.entries(TUTORIALS)) {
    app.get(route, (req, res) => sendPage(res, {
      title: tutorial.title,
      eyebrow: "SONARA tutorial",
      heading: tutorial.title,
      body: tutorial.body,
      sections: tutorial.steps.map((step, index) => brandCard(`Step ${index + 1}`, step)),
      actions: [linkAction("/tutorials", "All tutorials"), linkAction("/start", "Start"), linkAction("/help", "Get help")]
    }));
  }

  app.get("/business-builder/tutorial", (req, res) => res.redirect(302, "/tutorials/business-builder"));
  app.get("/creator-studio/tutorial", (req, res) => res.redirect(302, "/tutorials/creator-studio"));
  app.get("/growth-studio/tutorial", (req, res) => res.redirect(302, "/tutorials/growth-studio"));

  app.get("/forgot-password", (req, res) => sendPage(res, {
    title: "Reset your password",
    eyebrow: "Account recovery",
    heading: "Request a secure reset link.",
    body: "Enter the email address used for your SONARA account. For privacy, the confirmation is the same whether or not an account exists.",
    sections: [`<form class="card" method="post" action="/auth/forgot-password"><label>Email address<input type="email" name="email" autocomplete="email" required maxlength="254"></label><button type="submit">Send reset link</button></form>`],
    actions: [linkAction("/login", "Return to sign in"), linkAction("/support", "Account help")]
  }));

  app.post("/auth/forgot-password", async (req, res) => {
    const email = String(req.body.email || "").trim().toLowerCase();
    const config = getSupabaseAuthConfig();
    if (!email || !email.includes("@")) {
      const payload = { ok: false, code: "validation_failed", message: "Enter a valid email address." };
      if (wantsJson(req)) return res.status(400).json(payload);
      return res.status(400).type("html").send(responsePage("Check your email address", payload.message, [linkAction("/forgot-password", "Try again")]));
    }
    if (!config.ok) {
      const payload = { ok: false, code: "setup_required", service: "supabase_auth", message: "Account recovery is unavailable until the administrator finishes account setup." };
      if (wantsJson(req)) return res.status(503).json(payload);
      return res.status(503).type("html").send(responsePage("Account recovery needs setup", payload.message, [linkAction("/support", "Get help")]));
    }
    await fetch(`${config.url}/auth/v1/recover`, {
      method: "POST",
      headers: { apikey: config.anonKey, Authorization: `Bearer ${config.anonKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email, redirect_to: `${getPublicAppUrl(req)}/reset-password` })
    }).catch(() => undefined);
    const payload = { ok: true, code: "recovery_requested", message: "If an account matches that address, a secure reset link is on the way." };
    if (wantsJson(req)) return res.status(200).json(payload);
    return res.status(200).type("html").send(responsePage("Check your email", payload.message, [linkAction("/login", "Return to sign in")]));
  });

  app.get("/reset-password", (req, res) => sendPage(res, {
    title: "Choose a new password",
    eyebrow: "Account recovery",
    heading: "Create a new password.",
    body: "Open this page from the secure recovery link in your email. Your recovery token is removed from the address bar before the form is submitted.",
    sections: [`<form class="card" method="post" action="/auth/reset-password" data-sonara-recovery-form><input type="hidden" name="accessToken" data-sonara-recovery-token><label>New password<input type="password" name="password" autocomplete="new-password" minlength="12" maxlength="128" required></label><p data-sonara-recovery-status role="status">Checking the recovery link…</p><button type="submit" disabled data-sonara-recovery-submit>Update password</button></form><script src="/sonara-auth-recovery.js" defer></script>`],
    actions: [linkAction("/forgot-password", "Request another link"), linkAction("/support", "Account help")]
  }));

  app.post("/auth/reset-password", async (req, res) => {
    const accessToken = String(req.body.accessToken || "").trim();
    const password = String(req.body.password || "");
    const config = getSupabaseAuthConfig();
    if (!config.ok) return res.status(503).type("html").send(responsePage("Account recovery needs setup", "The administrator needs to finish account setup.", [linkAction("/support", "Get help")]));
    if (!accessToken || password.length < 12 || password.length > 128) return res.status(400).type("html").send(responsePage("Check the reset form", "Use a valid recovery link and a password with at least 12 characters.", [linkAction("/forgot-password", "Request another link")]));
    const response = await fetch(`${config.url}/auth/v1/user`, {
      method: "PUT",
      headers: { apikey: config.anonKey, Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ password })
    }).catch(() => undefined);
    if (!response?.ok) return res.status(400).type("html").send(responsePage("Reset link expired", "Request a new password reset link and try again.", [linkAction("/forgot-password", "Request another link")]));
    return res.status(200).type("html").send(responsePage("Password updated", "Your password has been changed. Sign in with the new password.", [linkAction("/login", "Sign in")]));
  });

  app.get("/account/profile", requireCustomer, (req, res) => sendPage(res, {
    title: "Profile",
    eyebrow: "Your account",
    heading: "Profile",
    body: "Review the identity attached to this signed-in account.",
    sections: [accountNoticeCard(req), brandCard("Email address", req.sonaraUser?.email || "Email address not returned."), brandCard("Profile editing", setupMessage)],
    actions: [linkAction("/account", "Account"), linkAction("/account/security", "Security"), logoutAction()]
  }));

  app.get("/account/security", requireCustomer, (req, res) => sendPage(res, {
    title: "Account security",
    eyebrow: "Your account",
    heading: "Security",
    body: "Manage password recovery and active sign-in behavior without exposing session details.",
    sections: [accountNoticeCard(req), brandCard("Password", "Use the secure recovery flow when you need to change a forgotten password."), brandCard("Sessions", "SONARA uses HttpOnly session cookies. Explicit logout clears the browser session.")],
    actions: [linkAction("/forgot-password", "Reset password"), linkAction("/account", "Account"), logoutAction()]
  }));

  app.get("/account/preferences", requireCustomer, async (req, res) => {
    const result = await safeListTable("user_preferences", `?select=language,unit_system,appearance_mode,notifications_enabled,timezone&user_id=eq.${encodeURIComponent(req.sonaraUser.id)}&limit=1`);
    const preference = result.rows?.[0] || {};
    const option = (value, label, current) => `<option value="${value}"${current === value ? " selected" : ""}>${label}</option>`;
    return sendPage(res, {
      title: "Preferences",
      eyebrow: "Your account",
      heading: "Preferences",
      body: result.ok ? "These settings are saved to your account and applied on this device when supported." : setupMessage,
      sections: [`<form class="card" method="post" action="/account/preferences"><label>Appearance<select name="appearanceMode" data-sonara-appearance-select>${option("system", "System", preference.appearance_mode || "system")}${option("light", "Light", preference.appearance_mode)}${option("dark", "Dark", preference.appearance_mode)}</select></label><label>Language<select name="language">${option("en-US", "English (US)", preference.language || "en-US")}${option("es", "Español", preference.language)}${option("fr", "Français", preference.language)}${option("pt-BR", "Português (Brasil)", preference.language)}</select></label><label>Units<select name="unitSystem">${option("imperial", "US customary", preference.unit_system || "imperial")}${option("metric", "Metric", preference.unit_system)}</select></label><label>Time zone<input name="timezone" value="${escapeHtml(preference.timezone || "")}" maxlength="80" placeholder="America/New_York"></label><label><input type="checkbox" name="notificationsEnabled" value="true"${preference.notifications_enabled === false ? "" : " checked"}> Account notifications enabled</label><button type="submit">Save preferences</button></form>`],
      actions: [linkAction("/settings", "Device settings"), linkAction("/account", "Account")]
    });
  });

  app.post("/account/preferences", requireCustomer, async (req, res) => {
    const appearanceMode = String(req.body.appearanceMode || "system");
    const language = String(req.body.language || "en-US");
    const unitSystem = String(req.body.unitSystem || "imperial");
    const timezone = String(req.body.timezone || "").trim().slice(0, 80) || null;
    if (!["system", "light", "dark"].includes(appearanceMode) || !["en-US", "es", "fr", "pt-BR"].includes(language) || !["imperial", "metric"].includes(unitSystem)) {
      return res.status(400).type("html").send(responsePage("Check your preferences", "Choose a supported appearance, language, and unit setting.", [linkAction("/account/preferences", "Try again")]));
    }
    const config = getSupabaseServerConfig();
    const organization = await getCustomerPrimaryOrganization(req.sonaraUser);
    if (!config.ok) return res.status(503).type("html").send(responsePage("Saving needs setup", setupMessage, [linkAction("/account/preferences", "Preferences")]));
    const save = await fetch(`${config.url}/rest/v1/user_preferences?on_conflict=user_id`, {
      method: "POST",
      headers: supabaseHeaders(config, { prefer: "resolution=merge-duplicates,return=representation" }),
      body: JSON.stringify({ user_id: req.sonaraUser.id, organization_id: organization.ok ? organization.organizationId : null, language, unit_system: unitSystem, appearance_mode: appearanceMode, notifications_enabled: req.body.notificationsEnabled === "true", timezone, updated_at: new Date().toISOString() })
    }).catch(() => undefined);
    if (!save?.ok) return res.status(503).type("html").send(responsePage("Saving needs setup", "Preferences could not be saved because the account database is not ready.", [linkAction("/account/preferences", "Preferences")]));
    return res.status(200).type("html").send(responsePage("Preferences saved", "Your account preferences were updated.", [linkAction("/account/preferences", "Review preferences"), linkAction("/dashboard", "Dashboard")]));
  });

  app.get("/account/workspaces", requireCustomer, async (req, res) => {
    const organization = await getCustomerPrimaryOrganization(req.sonaraUser);
    const rows = organization.ok ? await safeListTable("organizations", `?select=id,name,created_at&id=eq.${encodeURIComponent(organization.organizationId)}&limit=1`) : { ok: false, rows: [] };
    const current = rows.rows?.[0];
    return sendPage(res, {
      title: "Workspaces",
      eyebrow: "Your account",
      heading: "Workspaces",
      body: current ? "Your active organization workspace is shown below." : "Your workspace has not been created yet.",
      sections: [current ? brandCard(current.name || "Organization workspace", "This workspace controls product membership and saved records.") : brandCard("Workspace setup required", "Create your organization and first workspace to save product records.")],
      actions: [linkAction("/account/setup", current ? "Review setup" : "Create workspace"), linkAction("/dashboard", "Dashboard")]
    });
  });

  app.get("/account/integrations", requireCustomer, (req, res) => {
    const services = getReadiness().services || {};
    return sendPage(res, {
      title: "Integrations",
      eyebrow: "Your account",
      heading: "Connected services",
      body: "Customer-safe availability labels only. Provider credentials and internal diagnostics are visible only to administrators.",
      sections: [brandCard("Account database", displayStatus(services.supabase || "missing")), brandCard("Payment connection", displayStatus(services.stripe || "missing")), brandCard("Email delivery", displayStatus(services.emailDelivery || "missing")), brandCard("Google sign-in", displayStatus(services.googleSignIn || "missing"))],
      actions: [linkAction("/account", "Account"), linkAction("/support", "Get help")]
    });
  });

  app.get("/notifications", requireCustomer, async (req, res) => {
    const result = await safeListTable("user_notifications", `?select=id,title,body,category,read_at,created_at&user_id=eq.${encodeURIComponent(req.sonaraUser.id)}&order=created_at.desc&limit=25`);
    const sections = result.ok && result.rows.length
      ? result.rows.map((row) => brandCard(row.title || "Notification", `${row.body || "No additional details."} Status: ${row.read_at ? "read" : "unread"}.`))
      : [brandCard("No notifications", result.ok ? "New account, request, billing, and deliverable updates will appear here." : setupMessage)];
    return sendPage(res, { title: "Notifications", eyebrow: "Your workspace", heading: "Notifications", body: "Updates that belong to this signed-in account.", sections, actions: [linkAction("/account/preferences", "Notification preferences"), linkAction("/dashboard", "Dashboard")] });
  });

  app.get("/business-builder/pricing", (req, res) => res.redirect(302, "/pricing#business-builder"));
  app.get("/creator-studio/billing", requireWorkspaceAccess("creator_studio"), (req, res) => res.redirect(303, "/billing"));
  app.get("/growth-studio/billing", requireWorkspaceAccess("growth_studio"), (req, res) => res.redirect(303, "/billing"));

  const workspacePages = [
    ["/business-builder/routes", "business_builder", "Routes", "Plan service or delivery routes after a workspace and the required records are connected."],
    ["/business-builder/vehicles", "business_builder", "Vehicles", "Track vehicle readiness only when the business needs delivery or field operations."],
    ["/creator-studio/calendar", "creator_studio", "Content calendar", "Organize release and content dates without publishing automatically."],
    ["/creator-studio/rights", "creator_studio", "Rights", "Track ownership, consent, licensing notes, and review status for creator assets."]
  ];
  for (const [route, productKey, title, body] of workspacePages) {
    app.get(route, requireWorkspaceAccess(productKey), (req, res) => sendPage(res, { title, eyebrow: "Workspace module", heading: title, body, sections: [accountNoticeCard(req), brandCard("Module readiness", setupMessage)], actions: [linkAction(`/${productKey.replace(/_/g, "-")}/dashboard`, "Dashboard"), linkAction("/support", "Get help")] }));
  }

  app.get("/admin/organizations", requireAdmin, async (req, res) => {
    await recordAdminAuditEvent(req, "admin.organizations.view", { path: req.path });
    return res.status(200).type("html").send(await adminRowsPage({ title: "Organizations", heading: "Organizations", body: "Read-only organization readiness. Membership and role changes use protected server operations.", table: "organizations", query: "?select=id,name,created_at&order=created_at.desc&limit=25", emptyText: "No organization rows returned.", rowTitle: (row) => row.name || "Organization", rowBody: (row) => `Created: ${row.created_at || "not returned"}.`, actions: adminActions() }));
  });

  app.get("/admin/audit", requireAdmin, async (req, res) => {
    await recordAdminAuditEvent(req, "admin.audit.view", { path: req.path });
    return res.status(200).type("html").send(await adminRowsPage({ title: "Audit", heading: "Administrator audit", body: "Recent administrator actions. Secret values must never be stored in audit metadata.", table: "admin_audit_logs", query: "?select=id,action,target_type,target_id,created_at&order=created_at.desc&limit=50", emptyText: "No administrator audit rows returned.", rowTitle: (row) => row.action || "Admin action", rowBody: (row) => `${row.target_type || "route"}: ${row.target_id || "not returned"}. ${row.created_at || ""}`, actions: adminActions() }));
  });

  app.get("/admin/email", requireAdmin, async (req, res) => {
    await recordAdminAuditEvent(req, "admin.email.view", { path: req.path });
    const services = getReadiness().services || {};
    return sendPage(res, { title: "Email readiness", eyebrow: "Founder operations", heading: "Email", body: "Safe provider readiness without API keys, sender credentials, or customer message content.", sections: [brandCard("Resend connection", displayStatus(services.emailDelivery || "missing")), brandCard("Sender verification", "Verify the sending domain and From address in Resend before treating email as ready."), brandCard("Failure behavior", "When email is unavailable, customer records keep a setup-required delivery state instead of reporting success.")], actions: adminActions() });
  });

  app.get("/admin/migrations", requireAdmin, async (req, res) => {
    await recordAdminAuditEvent(req, "admin.migrations.view", { path: req.path });
    return sendPage(res, { title: "Migration readiness", eyebrow: "Founder operations", heading: "Database migrations", body: "Read-only migration readiness. This page does not execute SQL or modify the production database.", sections: [brandCard("Current application migration", "20260714150000_sonara_notifications_and_integrations.sql"), brandCard("Account preferences extension", "20260715120000_user_preferences_appearance_notifications.sql must be reviewed and applied through the deployment workflow."), brandCard("Safety boundary", "No arbitrary SQL executor is exposed in the web application.")], actions: [linkAction("/admin/database", "Database"), ...adminActions()] });
  });

  app.get("/admin/pipelines", requireAdmin, async (req, res) => {
    await recordAdminAuditEvent(req, "admin.pipelines.view", { path: req.path });
    return sendPage(res, { title: "Pipelines", eyebrow: "Founder operations", heading: "Build pipelines", body: "Repository pipeline configuration is present, but live provider status must be verified in GitHub, GitLab, and Vercel.", sections: [brandCard("GitHub", "Primary source and deployment pipeline. Review the latest workflow run before release."), brandCard("GitLab", "Secondary mirror only. Mirror after GitHub verification passes."), brandCard("Docker", "Container publishing is separate from the Vercel web runtime and must not reroute customer traffic by accident.")], actions: adminActions() });
  });

  app.get("/admin/deployments", requireAdmin, async (req, res) => {
    await recordAdminAuditEvent(req, "admin.deployments.view", { path: req.path });
    const deployment = getDeploymentInfo();
    return sendPage(res, { title: "Deployments", eyebrow: "Founder operations", heading: "Deployment status", body: "Safe public deployment identifiers only.", sections: [brandCard("Commit", deployment.commitSha || "Not returned by the hosting environment."), brandCard("Branch", deployment.branch || "Not returned by the hosting environment."), brandCard("Environment", deployment.environment || "Not returned by the hosting environment."), brandCard("Verification", "Confirm the production commit and run post-deploy route checks before announcing a release.")], actions: adminActions() });
  });
}

module.exports = registerRouteRegistryRoutes;
