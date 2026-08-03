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
    steps: ["Describe the customer problem and first offer.", "Use the pricing and setup tools to test the offer.", "Create the workspace records you actually need.", "Track requests, customers, and operational follow-up.", "Use paid records only after billing access is verified."]
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
    passwordResetRateLimiter,
    passwordResetSubmitRateLimiter,
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

  // Fall back to a pass-through so partially-wired callers (tests) still boot.
  const passThrough = (req, res, next) => next();
  const forgotPasswordLimiter = passwordResetRateLimiter || passThrough;
  const resetPasswordLimiter = passwordResetSubmitRateLimiter || passThrough;

  const sendPage = (res, input) => res.status(200).type("html").send(layout(input));
  // Public overview screens get depth; the account and workspace screens in
  // this same file do not. sendPage serves both, so marking it wholesale would
  // have animated /account/security along with /products.
  const sendMarketingPage = (res, input) => sendPage(res, { ...input, surface: "marketing" });
  const setupMessage = "This feature works, but saving needs your records connected by an administrator first.";

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

  app.get("/products", (req, res) => sendMarketingPage(res, {
    title: "Products",
    eyebrow: "Build. Create. Grow.",
    heading: "Three focused ways to move your work forward.",
    body: "Pick the workspace that matches what you're doing right now. Each one has its own tools and records, and they share one sign-in so you never rebuild your account to switch.",
    sections: [
      actionCard("Business Builder", "Create, launch, run, and manage a business with guided systems for offers, pricing, bookings, payments, customers, and the records that keep it moving.", [linkAction("/business-builder", "Explore Business Builder"), linkAction("/tutorials/business-builder", "Tutorial")]),
      actionCard("Creator Studio", "Organize, protect, publish, monetize, and grow your creative work — from first idea through release, media, and digital products.", [linkAction("/creator-studio", "Explore Creator Studio"), linkAction("/tutorials/creator-studio", "Tutorial")]),
      actionCard("Growth Studio", "Attract customers, leads, and referrals with campaigns, follow-up, offers, and growth systems you can actually keep up with.", [linkAction("/growth-studio", "Explore Growth Studio"), linkAction("/tutorials/growth-studio", "Tutorial")])
    ],
    actions: [linkAction("/free-tools", "Try a free tool"), linkAction("/pricing", "See pricing"), linkAction("/start", "Get started")]
  }));

  app.get("/free-tools", (req, res) => sendMarketingPage(res, {
    title: "Free tools",
    eyebrow: "Useful before you pay a cent",
    heading: "Get a real result in your first few minutes.",
    body: "Sign in and use the free planning tools in every workspace — no sales call, no service request first. You sign in so your work saves to your own account and stays there.",
    sections: [
      actionCard("Business Builder tools", "Offer outline, pricing calculator, setup score, launch checklist, first customer record, and package builder.", [linkAction("/business-builder/tools", "Open Business Builder tools")]),
      actionCard("Creator Studio tools", "Creator profile, asset checklist, release checklist, content brief, content plan, and song plan.", [linkAction("/creator-studio/tools", "Open Creator Studio tools")]),
      actionCard("Growth Studio tools", "Campaign outline, follow-up wording, permission checklist, offer angles, numbers calculator, and growth setup score.", [linkAction("/growth-studio/tools", "Open Growth Studio tools")])
    ],
    actions: [linkAction("/signup", "Create account"), linkAction("/login", "Sign in"), linkAction("/tutorials", "Tutorials")]
  }));

  app.get("/how-it-works", (req, res) => sendMarketingPage(res, {
    title: "How SONARA works",
    eyebrow: "From goal to done",
    heading: "Every step shows you the next honest move.",
    body: "SONARA gives you the tools to do the work yourself, plus optional done-for-you help when you want it. When something isn't set up yet, you see “setup required” — never a fake success.",
    sections: [
      brandCard("1. Choose an outcome", "Start with the business, creator, or growth result you actually need."),
      brandCard("2. Create something useful", "Run a free tool, checklist, calculator, or guided workspace action and get a real output."),
      brandCard("3. Save and track it", "Your outputs, requests, status, and next steps stay connected in your workspace."),
      brandCard("4. Upgrade only when it pays off", "Paid features unlock after your subscription is active — you are never charged for a plan you have not started."),
      brandCard("5. Get it delivered", "Requested services move through review, production, feedback, delivery, and completion, with the status visible the whole way.")
    ],
    actions: [linkAction("/start", "Get started"), linkAction("/service-catalog", "Service catalog"), linkAction("/tutorials/getting-started", "Getting started")]
  }));

  app.get("/tutorials", (req, res) => sendMarketingPage(res, {
    title: "Tutorials",
    eyebrow: "Learn at your pace",
    heading: "Short guides for the work in front of you.",
    body: "Tutorials explain the platform without blocking access to the application.",
    sections: Object.entries(TUTORIALS).map(([route, tutorial]) => actionCard(tutorial.title, tutorial.body, [linkAction(route, "Read tutorial")])),
    actions: [linkAction("/help", "Help center"), linkAction("/free-tools", "Free tools")]
  }));

  for (const [route, tutorial] of Object.entries(TUTORIALS)) {
    app.get(route, (req, res) => sendMarketingPage(res, {
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

  app.post("/auth/forgot-password", forgotPasswordLimiter, async (req, res) => {
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
    sections: [`<form class="card" method="post" action="/auth/reset-password" data-sonara-recovery-form><input type="hidden" name="accessToken" data-sonara-recovery-token><label>New password<input id="account-recovery-password" type="password" name="password" autocomplete="new-password" minlength="12" maxlength="128" required></label><button type="button" data-toggle-password="account-recovery-password" aria-controls="account-recovery-password" aria-pressed="false" aria-label="Show password">Show password</button><p data-sonara-recovery-status role="status">Checking the recovery link…</p><button type="submit" disabled data-sonara-recovery-submit>Update password</button></form><script src="/sonara-auth-recovery.js" defer></script>`],
    actions: [linkAction("/forgot-password", "Request another link"), linkAction("/support", "Account help")]
  }));

  app.post("/auth/reset-password", resetPasswordLimiter, async (req, res) => {
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
    sections: [accountNoticeCard(req), brandCard("Password", "Use the secure recovery flow when you need to change a forgotten password."), brandCard("Sessions", "SONARA keeps short-lived access and rotating refresh tokens in HttpOnly cookies. Explicit logout clears both browser cookies.")],
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

  // These four pages used to render one card reading "This feature works, but
  // saving needs your records connected by an administrator first." None of
  // that was true. Nothing was connected, nothing saved, and there was no
  // administrator to wait for -- the customer is the administrator. Two of them
  // described records that already existed somewhere else in the product.
  //
  // A page now either shows the records or says plainly that it is not built.
  // "Not built yet" is a worse thing to read and a better thing to be told.

  // Vehicles are kept in one place. This page described the same records the
  // owner area lists, so it goes there rather than growing a second view of
  // them that could drift.
  app.get("/business-builder/vehicles", requireWorkspaceAccess("business_builder"), (req, res) => res.redirect(302, "/business-builder/owner/vehicles"));

  app.get("/business-builder/routes", requireWorkspaceAccess("business_builder"), async (req, res) => {
    const organization = await getCustomerPrimaryOrganization(req.sonaraUser);
    const listed = organization.ok
      ? await safeListTable("location_zones", `?select=id,name,zone_type,status,created_at&organization_id=eq.${encodeURIComponent(organization.organizationId)}&order=created_at.desc&limit=100`)
      : { ok: false, rows: [] };
    const sections = listed.ok && listed.rows.length
      ? listed.rows.map((row) => brandCard(row.name || "Unnamed area", `${String(row.zone_type || "area").replaceAll("_", " ")} · ${String(row.status || "active").replaceAll("_", " ")}`))
      : [brandCard("No areas yet", listed.ok
        ? "Add the areas you cover and they will appear here. Routes are planned from your locations and the areas you work in."
        : "We could not load your areas just now. Try again shortly.")];
    return sendPage(res, {
      title: "Routes",
      eyebrow: "Workspace module",
      heading: "Routes and areas you cover",
      body: "The places you deliver to or work in. Nothing is dispatched automatically.",
      sections,
      actions: [linkAction("/business-builder/owner/locations", "Locations"), linkAction("/business-builder/owner/vehicles", "Vehicles"), linkAction("/business-builder/dashboard", "Dashboard")]
    });
  });

  app.get("/creator-studio/rights", requireWorkspaceAccess("creator_studio"), async (req, res) => {
    const organization = await getCustomerPrimaryOrganization(req.sonaraUser);
    // Consent evidence, never the evidence document itself.
    const listed = organization.ok
      ? await safeListTable("creator_voice_consents", `?select=id,subject_name,subject_type,consent_scope,evidence_type,consent_attested,expires_at,revoked_at,created_at&organization_id=eq.${encodeURIComponent(organization.organizationId)}&order=created_at.desc&limit=100`)
      : { ok: false, rows: [] };
    const sections = listed.ok && listed.rows.length
      ? listed.rows.map((row) => brandCard(row.subject_name || "Consent record", [
        `${consentState(row)}.`,
        `Covers ${String(row.consent_scope || "voice work").replaceAll("_", " ")}.`,
        row.evidence_type ? `Evidence: ${String(row.evidence_type).replaceAll("_", " ")}.` : "",
        row.expires_at ? `Runs out ${String(row.expires_at).slice(0, 10)}.` : ""
      ].filter(Boolean).join(" ")))
      : [brandCard("No consent records yet", listed.ok
        ? "Voice work needs a consent record before it will run. Records you add appear here with the evidence you attached."
        : "We could not load your consent records just now. Try again shortly.")];
    return sendPage(res, {
      title: "Rights",
      eyebrow: "Workspace module",
      heading: "Rights and consent",
      body: "Who has agreed to what, and the evidence behind it. Voice work is held until a matching record exists.",
      sections,
      actions: [linkAction("/creator-studio/generation", "Generation Studio"), linkAction("/creator-studio/generation/jobs", "Your generation work"), linkAction("/creator-studio/dashboard", "Dashboard")]
    });
  });

  // Nothing stores creator release dates yet, so this says so rather than
  // claiming to work. When there is a table behind it, it becomes a list like
  // the two above.
  app.get("/creator-studio/calendar", requireWorkspaceAccess("creator_studio"), (req, res) => sendPage(res, {
    title: "Content calendar",
    eyebrow: "Workspace module",
    heading: "Content calendar",
    body: "Not built yet.",
    sections: [
      accountNoticeCard(req),
      brandCard("Not built yet", "There is nowhere to save release dates at the moment, so this page would only look like it worked. Your music projects hold the work itself in the meantime, and nothing here publishes anything on its own.")
    ],
    actions: [linkAction("/creator-studio/music-projects", "Music projects"), linkAction("/creator-studio/dashboard", "Dashboard"), linkAction("/support", "Ask us for this")]
  }));

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
    await recordAdminAuditEvent(req, "admin.migrations.view", { path: req.path, delegate: "database_management" });
    if (typeof app.locals.sonaraDatabaseManagementPage !== "function") {
      return res.status(503).type("html").send(responsePage("Database Management needs setup", "The database management runtime handler is unavailable.", [linkAction("/admin", "Admin")]));
    }
    return app.locals.sonaraDatabaseManagementPage(req, res, "migrations");
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

// A consent record has no status column -- it has an attestation, an expiry and
// a revocation, and the state is whichever of those applies first. Deriving it
// here keeps the page from claiming somebody agreed to something after they
// withdrew it or after it ran out.
function consentState(row) {
  if (row.revoked_at) return "Withdrawn";
  if (row.expires_at && new Date(String(row.expires_at)).getTime() < Date.now()) return "Ran out";
  if (row.consent_attested) return "Agreed";
  return "Not confirmed yet";
}

module.exports = registerRouteRegistryRoutes;
