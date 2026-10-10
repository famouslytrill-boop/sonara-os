// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const {
  PRODUCTION_ORIGIN,
  ROUTE_REGISTRY,
  PUBLIC_SITEMAP_ROUTES
} = require("../lib/sonara-route-registry.cjs");
const { isPasswordLeaked, LEAKED_PASSWORD_MESSAGE } = require("../lib/sonara-leaked-password.cjs");
const plainLanguage = require("../lib/sonara-plain-language.cjs");
const { getGuide } = require("../lib/sonara-guides.cjs");
const { UI_LOCALES, SUPPORTED_LOCALE_CODES, normalizeLocale } = require("../lib/sonara-locale-contract.cjs");
const { renderWorkspaceDirectory } = require("../lib/sonara-workspace-directory.cjs");
// The free-tool count and its one sentence. Read rather than restated: the
// /free-tools page below carried its own copy of "Six tools ... two in each
// studio" and three per-studio cards each naming their two by hand, and every
// one of those went stale the day the free set changed.
const { FREE_TOOL_COUNT, freeToolSentence, freeToolCountByCompany } = require("../lib/sonara-tool-access.cjs");
const { createPlatformJobWorkerRepository } = require("../lib/sonara-platform-job-worker.cjs");
const {
  createIntegrationReadinessService,
  readIntegrationReadinessActivationConfig
} = require("../lib/sonara-integration-readiness.cjs");

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
    wantsJson,
    getSupabaseAuthConfig,
    getSupabaseServerConfig,
    supabaseHeaders,
    getPublicAppUrl,
    getCustomerPrimaryOrganization,
    getLiveReadiness,
    displayStatus,
    accountNoticeCard,
    logoutAction,
    safeListTable,
    createRateLimiter,
    getEnv
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

  const platformJobs = createPlatformJobWorkerRepository({ getSupabaseServerConfig });
  const integrationReadiness = createIntegrationReadinessService({
    getSupabaseServerConfig,
    platformJobs
  });
  const integrationProbeLimiter = typeof createRateLimiter === "function"
    ? createRateLimiter({
        name: "integrations.readiness_probe",
        windowSeconds: 60,
        maxAttempts: 12,
        scopes: ["ip", "subject"],
        subjectFrom: (req) => req.sonaraUser?.id || req.sonaraAccess?.user?.id,
        getSupabaseServerConfig
      })
    : passThrough;
  const activationConfig = () => readIntegrationReadinessActivationConfig((name) =>
    typeof getEnv === "function" ? getEnv(name) : process.env[name]
  );

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

  app.get("/workspace-modules", requireCustomer, (req, res) => sendPage(res, {
    title: "Workspace modules",
    eyebrow: "Your workspaces",
    heading: "Browse workspace modules",
    body: "Choose a destination by workspace and purpose. Each link opens its registered page; setup and plan requirements are checked there.",
    sections: [renderWorkspaceDirectory()],
    actions: [linkAction("/dashboard", "All workspaces")]
  }));

  // Named counts, no named tools.
  //
  // Each card used to name its studio's free tools in prose -- "break-even and
  // runway, and the stock reorder planner" -- and said how many more were
  // locked. Both halves went stale on 2 October 2026 when the free set changed,
  // and the stale half is the dangerous one: naming a tool as free that a gate
  // then refuses is the advertise-then-refuse funnel
  // routes/sonara-service-lifecycle-routes.cjs exists to prevent.
  //
  // So this page counts and links, and the directory it links to is the page
  // that names them -- built from the same list the gate reads.
  app.get("/free-tools", (req, res) => {
    const counts = freeToolCountByCompany();
    const studios = [
      ["Business Builder", "business_builder", "/business-builder/tools"],
      ["Creator Studio", "creator_studio", "/creator-studio/tools"],
      ["Growth Studio", "growth_studio", "/growth-studio/tools"]
    ];
    return sendMarketingPage(res, {
      title: "Free tools",
      eyebrow: `${FREE_TOOL_COUNT} free, and the rest on a plan`,
      heading: "Get a real result in your first few minutes.",
      body: `${freeToolSentence()} They give a real answer in a couple of minutes, and nothing is saved unless you ask. Every directory below labels each tool as free or on a plan before you press anything, so no tool is advertised as free and then refused.`,
      sections: [
        actionCard(
          "SONARA Industries tools",
          `${counts.sonara_industries} free with no account, and the only three that run entirely on your own device: format your JSON, fingerprint your text, and estimate what your files and backups need. Nothing you type into one is uploaded.`,
          [linkAction("/tools", "Open SONARA Industries tools")]
        ),
        ...studios.map(([name, key, directory]) => actionCard(
          `${name} tools`,
          `${counts[key]} free with no account and no card. The rest open on a plan that covers ${name}, and the directory names every one of them either way.`,
          [linkAction(directory, `Open ${name} tools`)]
        ))
      ],
      actions: [linkAction("/signup", "Create account"), linkAction("/login", "Sign in"), linkAction("/tutorials", "Tutorials")]
    });
  });

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
      // Steps first, then the longer guidance behind them. The steps say what
      // order to do things in; the guide says what you need to know to do them
      // well, which is the part these pages were missing.
      sections: [
        ...tutorial.steps.map((step, index) => brandCard(`Step ${index + 1}`, step)),
        ...getGuide(route).map(([heading, detail]) => brandCard(heading, detail))
      ],
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
      // Was "unavailable until the administrator finishes account setup".
      // A customer reading that has no idea who the administrator is, or
      // whether it means them. It is our setup, they cannot affect it, and the
      // only useful thing they can do is ask us -- so say that.
      const payload = {
        ok: false,
        code: "setup_required",
        service: "supabase_auth",
        message: `${plainLanguage.setupRequiredSentence("supabase_auth")} Nothing you can do from here — contact us and we will reset your password by hand.`
      };
      if (wantsJson(req)) return res.status(503).json(payload);
      return res.status(503).type("html").send(responsePage("We cannot send a reset link yet", payload.message, [linkAction("/contact", "Contact us"), linkAction("/support", "Get help")]));
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
    // The status line starts as the failure explanation, not as "Checking the
    // recovery link…".
    //
    // The token arrives in the URL fragment, which never reaches the server, so
    // only the browser can read it -- public/sonara-auth-recovery.js lifts it
    // into the hidden field and enables the button. If that script is blocked,
    // fails, 404s, or is refused by the CSP, none of that happens.
    //
    // With "Checking the recovery link…" as the default, the outcome was a page
    // that claimed to be working on it forever, next to a permanently greyed-out
    // button, with nothing to say why. The person reading it has just clicked a
    // reset link from their email because they are already locked out, and the
    // page told them to wait for something that was never going to happen.
    //
    // The script runs synchronously and rewrites this line immediately, so the
    // default is only ever seen when the script did not run -- which is exactly
    // when it needs to be true. Same principle as the scroll entrance: never
    // show a state you might not be able to move on from.
    sections: [`<form class="card" method="post" action="/auth/reset-password" data-sonara-recovery-form><input type="hidden" name="accessToken" data-sonara-recovery-token><label>New password<input id="account-recovery-password" type="password" name="password" autocomplete="new-password" minlength="12" maxlength="128" required></label><button type="button" data-toggle-password="account-recovery-password" aria-controls="account-recovery-password" aria-pressed="false" aria-label="Show password">Show password</button><p data-sonara-recovery-status role="status">This step needs JavaScript, because your recovery link can only be read by your browser. Turn it on for this site and reload, or contact us and we will reset your password by hand.</p><button type="submit" disabled data-sonara-recovery-submit>Update password</button></form><noscript><p class="fine">JavaScript is turned off, so this page cannot read your recovery link. Contact us and we will reset your password for you.</p></noscript><script src="/sonara-auth-recovery.js" defer></script>`],
    actions: [linkAction("/forgot-password", "Request another link"), linkAction("/support", "Account help")]
  }));

  app.post("/auth/reset-password", resetPasswordLimiter, async (req, res) => {
    const accessToken = String(req.body.accessToken || "").trim();
    const password = String(req.body.password || "");
    const config = getSupabaseAuthConfig();
    if (!config.ok) {
      return res.status(503).type("html").send(
        responsePage(
          "We cannot change your password yet",
          `${plainLanguage.setupRequiredSentence("supabase_auth")} Nothing you can do from here — contact us and we will reset your password by hand.`,
          [linkAction("/contact", "Contact us"), linkAction("/support", "Get help")]
        )
      );
    }
    if (!accessToken || password.length < 12 || password.length > 128) return res.status(400).type("html").send(responsePage("Check the reset form", "Use a valid recovery link and a password with at least 12 characters.", [linkAction("/forgot-password", "Request another link")]));
    // The other point a password is chosen. Someone resetting after a breach
    // notice is exactly the person most likely to reach for a password they
    // have used elsewhere, so this is the more important of the two checks.
    // It fails open: see lib/sonara-leaked-password.cjs.
    const breach = await isPasswordLeaked(password);
    if (breach.leaked) {
      return res.status(400).type("html").send(responsePage("Choose a different password", LEAKED_PASSWORD_MESSAGE, [linkAction("/forgot-password", "Request another link")]));
    }
    const response = await fetch(`${config.url}/auth/v1/user`, {
      method: "PUT",
      headers: { apikey: config.anonKey, Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ password })
    }).catch(() => undefined);
    if (!response?.ok) return res.status(400).type("html").send(responsePage("Reset link expired", "Request a new password reset link and try again.", [linkAction("/forgot-password", "Request another link")]));
    return res.status(200).type("html").send(responsePage("Password updated", "Your password has been changed. Sign in with the new password.", [linkAction("/login", "Sign in")]));
  });

  // /account/profile moved to routes/sonara-account-profile-routes.cjs on
  // 3 October 2026. What was here showed the account's email beside a card
  // reading "This feature works, but saving needs your records connected by an
  // administrator first" -- on a page with no form, for a column
  // (profiles.full_name) that no route in this repository had ever written. The
  // sentence read as "come back later" and nothing was coming. The replacement
  // saves a name, a headline, a description and a picture.

  app.get("/account/security", requireCustomer, (req, res) => sendPage(res, {
    title: "Account security",
    eyebrow: "Your account",
    heading: "Security",
    body: "Manage password recovery and active sign-in behavior without exposing session details.",
    sections: [accountNoticeCard(req), brandCard("Password", "Use the secure recovery flow when you need to change a forgotten password."), brandCard("Two-step sign-in", "Add a code from an app on your phone, asked for after your password. Without a link here the page exists and nothing points at it."), brandCard("Sessions", "SONARA keeps short-lived access and rotating refresh tokens in HttpOnly cookies. Explicit logout clears both browser cookies.")],
    actions: [linkAction("/account/security/two-factor", "Two-step sign-in"), linkAction("/forgot-password", "Reset password"), linkAction("/account", "Account"), logoutAction()]
  }));

  app.get("/account/preferences", requireCustomer, async (req, res) => {
    const result = await safeListTable("user_preferences", `?select=language,unit_system,appearance_mode,notifications_enabled,timezone&user_id=eq.${encodeURIComponent(req.sonaraUser.id)}&limit=1`);
    const preference = result.rows?.[0] || {};
    const option = (value, label, current) => `<option value="${value}"${current === value ? " selected" : ""}>${label}</option>`;
    return sendPage(res, {
      title: "Preferences",
      eyebrow: "Your account",
      heading: "Preferences",
      body: result.ok ? "Account preferences are saved to your account. The Experience menu's interface language is saved separately on this device." : setupMessage,
      sections: [`<form class="card" method="post" action="/account/preferences"><label>Appearance<select name="appearanceMode" data-sonara-appearance-select>${option("system", "System", preference.appearance_mode || "system")}${option("light", "Light", preference.appearance_mode)}${option("dark", "Dark", preference.appearance_mode)}</select></label><label>Account language<select name="language">${UI_LOCALES.map(({ code, language }) => option(code, language, normalizeLocale(preference.language || "en-US"))).join("")}</select></label><label>Units<select name="unitSystem">${option("imperial", "US customary", preference.unit_system || "imperial")}${option("metric", "Metric", preference.unit_system)}</select></label><label>Time zone<input name="timezone" value="${escapeHtml(preference.timezone || "")}" maxlength="80" placeholder="America/New_York"></label><label><input type="checkbox" name="notificationsEnabled" value="true"${preference.notifications_enabled === false ? "" : " checked"}> Account notifications enabled</label><button type="submit">Save preferences</button></form>`],
      actions: [linkAction("/settings", "Device settings"), linkAction("/account", "Account")]
    });
  });

  app.post("/account/preferences", requireCustomer, async (req, res) => {
    const appearanceMode = String(req.body.appearanceMode || "system");
    const language = String(req.body.language || "en-US");
    const unitSystem = String(req.body.unitSystem || "imperial");
    const timezone = String(req.body.timezone || "").trim().slice(0, 80) || null;
    if (!["system", "light", "dark"].includes(appearanceMode) || !SUPPORTED_LOCALE_CODES.includes(language) || !["imperial", "metric"].includes(unitSystem)) {
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
    const rows = organization.ok ? await safeListTable("organizations", `?select=id,name&id=eq.${encodeURIComponent(organization.organizationId)}&limit=1`) : { ok: false, rows: [] };
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

  app.get("/account/integrations", requireCustomer, async (req, res) => {
    const services = (await getLiveReadiness()).services || {};
    const organization = await getCustomerPrimaryOrganization(req.sonaraUser);
    const activation = activationConfig();
    const scopedCanary = organization.ok
      && activation.ok
      && activation.allowed
      && activation.organizationId === organization.organizationId;
    const state = organization.ok
      ? await integrationReadiness.list({ organizationId: organization.organizationId, limit: 20 })
      : { ok: false, code: "organization_unavailable", providers: [], connections: [], jobs: [] };

    const connectionByProvider = new Map((state.connections || []).map((row) => [row.provider_key, row]));
    const providerSections = state.ok
      ? state.providers.map((provider) => {
          const connection = connectionByProvider.get(provider.provider_key);
          const connectionStatus = connection?.connection_status || "not connected";
          const button = scopedCanary
            ? `<form method="post" action="/api/integrations/readiness-probes"><input type="hidden" name="provider_key" value="${escapeHtml(provider.provider_key)}"><input type="hidden" name="request_id" value="${escapeHtml(integrationReadiness.newRequestId())}"><button type="submit">Check readiness</button></form>`
            : "";
          return `<article class="card"><h2>${escapeHtml(provider.name)}</h2><p>${escapeHtml(provider.category)} · provider ${escapeHtml(provider.status)} · ${escapeHtml(connectionStatus)}</p>${button}</article>`;
        })
      : [brandCard("Provider state unavailable", "Your provider catalog or connection state could not be read. This does not mean your providers are disconnected.")];

    const jobSections = state.ok && state.jobs.length
      ? state.jobs.map((job) => brandCard(
          `${job.provider_key}: ${job.status}`,
          job.status === "completed"
            ? `Readiness: ${job.readiness}.`
            : job.error_code
              ? `The check did not finish: ${job.error_code}.`
              : "The readiness check has not reached a terminal result yet."
        ))
      : [brandCard("No readiness checks yet", scopedCanary
          ? "Use Check readiness on a provider above. This reads SONARA's connection state only; it does not call or change the external provider."
          : "Provider checks remain disabled unless an explicit one-organization canary is enabled.")];

    const workerStatus = scopedCanary
      ? "Read-only readiness canary enabled for this organization."
      : activation.enabled
        ? "The readiness worker is enabled for a different canary organization."
        : "The readiness worker is off. No provider job will be queued.";

    return sendPage(res, {
      title: "Integrations",
      eyebrow: "Your account",
      heading: "Connected services",
      body: "Provider and connection status only. Credentials, tokens, connection settings, and internal diagnostics are never rendered here.",
      sections: [
        brandCard("Account database", displayStatus(services.supabase || "missing")),
        brandCard("Payment connection", displayStatus(services.stripe || "missing")),
        brandCard("Email delivery", displayStatus(services.emailDelivery || "missing")),
        brandCard("Google sign-in", displayStatus(services.googleSignIn || "missing")),
        brandCard("Readiness worker", workerStatus),
        ...providerSections,
        ...jobSections
      ],
      actions: [linkAction("/account", "Account"), linkAction("/support", "Get help")]
    });
  });

  app.post("/api/integrations/readiness-probes", requireCustomer, integrationProbeLimiter, async (req, res) => {
    const respond = (status, payload) => {
      if (wantsJson(req)) return res.status(status).json(payload);
      const query = payload.ok
        ? "?probe=queued"
        : `?problem=${encodeURIComponent(payload.code || "not_queued")}`;
      return res.redirect(303, `/account/integrations${query}`);
    };

    const activation = activationConfig();
    if (!activation.ok) return respond(503, { ok: false, code: activation.reason || "worker_configuration_invalid" });
    if (!activation.allowed) return respond(403, { ok: false, code: "readiness_worker_disabled" });

    const organization = await getCustomerPrimaryOrganization(req.sonaraUser);
    if (!organization.ok) return respond(403, { ok: false, code: "organization_unavailable" });
    if (organization.organizationId !== activation.organizationId) {
      return respond(403, { ok: false, code: "readiness_canary_scope_mismatch" });
    }

    let result;
    try {
      result = await integrationReadiness.enqueueProbe({
        organizationId: organization.organizationId,
        userId: req.sonaraUser?.id || null,
        providerKey: req.body.provider_key,
        requestId: req.body.request_id
      });
    } catch {
      return respond(400, { ok: false, code: "validation_failed" });
    }
    return respond(result.ok ? 202 : result.code === "worker_queue_unavailable" ? 503 : 400, result);
  });

  app.get("/notifications", requireCustomer, async (req, res) => {
    const result = await safeListTable("user_notifications", `?select=id,title,body,category,read_at&user_id=eq.${encodeURIComponent(req.sonaraUser.id)}&order=created_at.desc&limit=25`);
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

  // Was a hand-rolled list of location_zones whose empty state read "Add the
  // areas you cover and they will appear here" -- above no form, on a page that
  // had never had one. A page inviting an action it does not offer is the same
  // defect as a page claiming a capability it does not have.
  //
  // It goes to the owner record page, which lists the same rows and can add
  // one, on the precedent set for vehicles directly above: one page per kind of
  // record rather than a second view of it that can drift.
  app.get("/business-builder/routes", requireWorkspaceAccess("business_builder"), (req, res) => res.redirect(302, "/business-builder/owner/areas"));

  app.get("/creator-studio/rights", requireWorkspaceAccess("creator_studio"), async (req, res) => {
    const organization = await getCustomerPrimaryOrganization(req.sonaraUser);
    // Consent evidence, never the evidence document itself.
    const listed = organization.ok
      ? await safeListTable("creator_voice_consents", `?select=id,subject_name,subject_type,consent_scope,evidence_type,consent_attested,expires_at,revoked_at&organization_id=eq.${encodeURIComponent(organization.organizationId)}&order=created_at.desc&limit=100`)
      : { ok: false, rows: [] };
    const sections = listed.ok && listed.rows.length
      ? listed.rows.map((row) => brandCard(
        // subject_name is nullable and subject_type is not null, so the heading
        // fell back to "Consent record" -- discarding the fact that is always
        // there in favour of the one that might not be.
        row.subject_name || plainLanguage.voiceSubjectLabel(row.subject_type),
        [
          `${consentState(row)}.`,
          // Was consent_scope with its underscores swapped for spaces, so the
          // same permission read "Voice copying" on /creator-studio/voice-permissions
          // and "voice clone" here. One vocabulary now, in
          // lib/sonara-plain-language.cjs.
          `Covers ${plainLanguage.voiceScopeLabel(row.consent_scope).toLowerCase()}.`,
          row.evidence_type ? `Evidence: ${plainLanguage.voiceEvidenceLabel(row.evidence_type).toLowerCase()}.` : "",
          row.expires_at ? `Runs out ${String(row.expires_at).slice(0, 10)}.` : ""
        ].filter(Boolean).join(" ")))
      // Same heading fault, and on the surface where it matters most: a
      // creator reading "No consent records yet" after a failed read might
      // reasonably conclude a permission they recorded had been lost.
      : [listed.ok
        ? brandCard("No consent records yet", "Voice work needs a consent record before it will run. Records you add appear here with the evidence you attached.")
        : brandCard("Consent records not available just now", "We could not load your consent records just now. Try again shortly.")];
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
