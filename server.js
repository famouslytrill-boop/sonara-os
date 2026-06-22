const express = require("express");
const crypto = require("node:crypto");
const { randomUUID } = require("node:crypto");
const { URL, URLSearchParams } = require("node:url");
const registerSonaraEcosystemRoutes = require("./routes/sonara-ecosystem-routes.cjs");
const registerSonaraFormulaRoutes = require("./routes/sonara-formula-routes.cjs");
const registerCreatorMusicSystemReadOnlyRoutes = require("./routes/creator-music-system-readonly.cjs");
const registerLastNineHoursRoutes = require("./routes/sonara-last9-routes.cjs");

const app = express();
const ADMIN_SESSION_COOKIE = "sonara_admin_session";
const CUSTOMER_SESSION_COOKIE = "sonara_customer_session";
const ADMIN_SESSION_MAX_AGE_SECONDS = 10 * 60 * 60;
const CUSTOMER_SESSION_MAX_AGE_SECONDS = 60 * 60;
const EMPLOYEE_INVITE_MAX_AGE_DAYS = 7;
const STRIPE_PLANS = {
  free: {
    name: "Free",
    price: "$0",
    description: "Public readiness checklist and product path selection.",
    env: undefined,
    mode: undefined
  },
  starter_monthly: {
    name: "Starter monthly",
    price: "$7/mo",
    description: "Low-cost entry for one workspace, basic offer, intake, checklist tools, and limited records.",
    env: "STRIPE_PRICE_STARTER_MONTHLY",
    envAliases: ["STRIPE_PRICE_ID_BUSINESS_BUILDER_MONTHLY", "STRIPE_PRICE_BUSINESS_BUILDER_STARTER_MONTHLY"],
    mode: "subscription"
  },
  core_monthly: {
    name: "Core monthly",
    price: "$19/mo",
    description: "Best value for one studio, customer records, offer records, launch readiness, and support queue.",
    env: "STRIPE_PRICE_CORE_MONTHLY",
    envAliases: ["STRIPE_PRICE_ID_CREATOR_STUDIO_MONTHLY", "STRIPE_PRICE_BUSINESS_BUILDER_CORE_MONTHLY", "STRIPE_PRICE_CREATOR_STUDIO_CORE_MONTHLY", "STRIPE_PRICE_GROWTH_STUDIO_CORE_MONTHLY"],
    mode: "subscription"
  },
  pro_monthly: {
    name: "Pro monthly",
    price: "$39/mo",
    description: "All three studios, deeper records, campaign planning, advanced readiness, and priority support queue.",
    env: "STRIPE_PRICE_PRO_MONTHLY",
    envAliases: ["STRIPE_PRICE_ID_GROWTH_STUDIO_MONTHLY", "STRIPE_PRICE_BUSINESS_BUILDER_PRO_MONTHLY", "STRIPE_PRICE_CREATOR_STUDIO_PRO_MONTHLY", "STRIPE_PRICE_GROWTH_STUDIO_PRO_MONTHLY"],
    mode: "subscription"
  },
  business_builder_one_time: {
    name: "Business Builder setup",
    price: "One-time",
    description: "Manual setup package for service launch infrastructure.",
    env: "STRIPE_PRICE_BUSINESS_BUILDER_ONE_TIME",
    envAliases: ["STRIPE_PRICE_ID_BUSINESS_BUILDER_ONETIME", "STRIPE_PRICE_BUSINESS_BUILDER_ONETIME"],
    mode: "payment"
  }
};
app.use(express.static("public"));

app.post("/api/webhooks/stripe", express.raw({ type: "application/json" }), handleStripeWebhook);
app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), handleStripeWebhook);

app.use(express.urlencoded({ extended: false }));
app.use(express.json({ limit: "64kb" }));

registerSonaraEcosystemRoutes(app, {
  layout,
  brandCard,
  linkAction,
  escapeHtml,
  requireAdmin,
  safeListTable
});

registerSonaraFormulaRoutes(app, {
  layout,
  brandCard,
  linkAction,
  responsePage,
  escapeHtml,
  requireAdmin,
  requireWorkspaceAccess,
  safeListTable,
  getSupabaseServerConfig,
  getCustomerPrimaryOrganization,
  supabaseHeaders,
  insertActivityEvent
});

registerCreatorMusicSystemReadOnlyRoutes(app, {
  layout,
  brandCard,
  linkAction,
  escapeHtml,
  requireWorkspaceAccess,
  safeListTable
});

registerLastNineHoursRoutes(app, {
  layout,
  brandCard,
  linkAction,
  responsePage,
  escapeHtml,
  requireCustomer,
  requireBusinessManager,
  requireWorkspaceAccess,
  getCustomerPrimaryOrganization,
  getSupabaseServerConfig
});

app.get("/", (req, res) => {
  return res.status(200).type("html").send(
    layout({
      title: "SONARA Industries",
      eyebrow: "LAUNCH OPERATING SYSTEM",
      heading: "SONARA Industries",
      body:
        "Launch infrastructure for small businesses, creators, and growth teams. Start with free planning tools, then upgrade when payment-backed records and operations are needed.",
      sections: [
        brandCard("Business Builder", "Launch-ready service business infrastructure: proof, offers, intake, payments, and operating rhythm."),
        brandCard("Creator Studio", "Creator monetization systems for assets, media, catalogs, launch offers, and owned audience workflows."),
        brandCard("Growth Studio", "Consent-safe campaign planning, customer follow-up, experiments, and operator-grade growth routines."),
        brandCard("Free access", "Logged-in users can use free planning tools without a paid plan. Saving records depends on account database setup."),
        brandCard("Paid access", "Paid workspaces unlock only after Stripe payment updates record active access in the account database.")
      ],
      actions: [
        linkAction("/signup", "Start Free"),
        linkAction("/pricing", "View pricing"),
        linkAction("/login", "Login"),
        linkAction("/business-builder", "Business Builder"),
        linkAction("/creator-studio", "Creator Studio"),
        linkAction("/growth-studio", "Growth Studio")
      ]
    })
  );
});

registerProduct("business-builder", {
  productKey: "business_builder",
  name: "Business Builder",
  body: "Service-business launch infrastructure for offers, intake, customer records, booking readiness, and payment readiness.",
  cards: [
    ["Offer Builder", "Shape the launch offer, scope, proof points, and customer next action."],
    ["Intake & Request Queue", "Capture requests through the support queue and review workflow."],
    ["Booking & Payment Readiness", "Keep checkout gated until Stripe products, prices, and webhooks are configured."],
    ["Customer Records", "Prepare organization-scoped customer records for Supabase-backed operations."]
  ],
  checklist: ["Business profile", "Offer", "Intake", "Pricing", "Payment", "Support", "Legal", "Analytics"]
});

registerProduct("creator-studio", {
  productKey: "creator_studio",
  name: "Creator Studio",
  body: "Creator product and catalog workspace for assets, offers, release planning, monetization readiness, and media records.",
  cards: [
    ["Asset Catalog", "Organize creator assets, catalog items, and provenance-ready records."],
    ["Creator Offers", "Prepare creator products and customer-facing offers."],
    ["Release & Content Checklist", "Track release and content tasks without claiming automation is live."],
    ["Monetization Readiness", "Surface payment and email setup requirements before selling."],
    ["Media & Customer Records", "Track contacts, buyers, collaborators, campaign records, and media records."]
  ],
  checklist: ["Review asset catalog", "Prepare creator offer", "Confirm release checklist", "Verify monetization readiness"]
});

registerProduct("growth-studio", {
  productKey: "growth_studio",
  name: "Growth Studio",
  body: "Growth workspace for campaign planning, lead follow-up, consent-safe checklists, automation readiness, and growth records.",
  cards: [
    ["Campaign Workspace", "Plan growth campaigns and launch experiments."],
    ["Lead & Customer Follow-Up", "Prepare follow-up workflows with consent and owner review."],
    ["Consent-Safe Campaign Checklist", "Keep outbound actions reviewable and audit-ready."],
    ["Automation Readiness", "Show setup requirements instead of pretending automations are live."],
    ["Growth Records", "Track campaign records, leads, outcomes, and notes."]
  ],
  checklist: ["Plan campaign", "Review consent posture", "Confirm email readiness", "Prepare growth records"]
});

app.get("/contact", (req, res) => {
  return res.status(200).type("html").send(
    layout({
      title: "Contact",
      eyebrow: "Launch review",
      heading: "Contact SONARA Industries",
      body: "Use this intake for launch, support, billing, access, or readiness requests. Accepted requests always return a reference ID.",
      sections: [contactForm()],
      actions: [linkAction("/", "Return home"), linkAction("/help", "Help"), linkAction("/pricing", "Pricing")]
    })
  );
});

app.post("/contact", async (req, res) => {
  const request = normalizeSupportRequest(req.body);
  const wantsJson = req.is("application/json") || req.get("accept")?.includes("application/json");

  if (!request.ok) {
    const payload = { ok: false, code: "validation_failed", message: request.message };
    if (wantsJson) return res.status(400).json(payload);
    return res.status(400).type("html").send(responsePage("Request not accepted", request.message, [linkAction("/contact", "Try again")]));
  }

  const result = await saveSupportRequest(request.value);
  if (wantsJson) return res.status(200).json(result);
  return res.status(200).type("html").send(
    responsePage(result.ok ? "Request received" : "Request queued", result.message, [linkAction("/", "Return home"), linkAction("/contact", "Contact")])
  );
});

app.get("/api/support/status", (req, res) => {
  const readiness = getReadiness();
  return res.status(200).json({
    ok: true,
    supportQueue: readiness.services.supabase === "configured" ? "database_backed" : "setup_required",
    emailDelivery: readiness.services.emailDelivery,
    secretsExposed: false
  });
});

app.get("/pricing", (req, res) => {
  const readiness = getReadiness();
  const planStatuses = getCheckoutPlanStatuses();
  const enabledPlanCount = Object.entries(planStatuses).filter(([plan, status]) => plan !== "free" && status.checkout === "enabled").length;
  return res.status(200).type("html").send(
    layout({
      title: "Pricing",
      eyebrow: "Commercial readiness",
      heading: "Pricing",
      body: enabledPlanCount
        ? "Checkout is configured for enabled plans."
        : "Checkout setup required until the payment connection and plan settings are configured.",
      sections: Object.entries(STRIPE_PLANS).map(([plan, config]) => priceCard(plan, config, planStatuses[plan], readiness)),
      actions: [linkAction("/signup", "Start Free"), linkAction("/login", "Login"), linkAction("/business-builder/billing", "Billing")]
    })
  );
});

app.get("/security", (req, res) => {
  return res.status(200).type("html").send(
    layout({
      title: "Security",
      eyebrow: "Operational posture",
      heading: "Security",
      body: "SONARA keeps production infrastructure boring, reviewable, and server-controlled. Secrets stay server-side and high-risk automation requires approval.",
      sections: [
        brandCard("Server-only credentials", "Service-role keys, provider secrets, webhook secrets, and admin credentials are never shipped to public clients."),
        brandCard("Human approval", "AI and outbound actions require preview, owner approval, and audit-ready records."),
        brandCard("Data boundaries", "Organization-scoped records require RBAC, provenance, and retention discipline.")
      ],
      actions: [linkAction("/legal/privacy", "Privacy"), linkAction("/contact", "Report issue")]
    })
  );
});

app.get("/help", (req, res) => {
  return res.status(200).type("html").send(
    layout({
      title: "Help",
      eyebrow: "Support",
      heading: "Help",
      body: "Support and launch review entry points for SONARA Industries.",
      sections: [
        brandCard("Contact support", "Use the contact form for launch, billing, access, and readiness requests."),
        brandCard("Service setup", "Tools show what is ready without exposing private setup details."),
        brandCard("Admin access", "Founder operations remain protected by server-side admin authorization.")
      ],
      actions: [linkAction("/contact", "Contact"), linkAction("/docs", "Docs"), linkAction("/", "Home")]
    })
  );
});

app.get("/docs", (req, res) => {
  return res.status(200).type("html").send(
    layout({
      title: "Docs",
      eyebrow: "Launch documentation",
      heading: "Docs",
      body: "Operational setup references for paid-launch readiness.",
      sections: [
        brandCard("Service setup", "Configure the account database, payment connection, email delivery, email auth, and founder access before paid launch."),
        brandCard("Payments", "Checkout remains server-gated until payment settings exist."),
        brandCard("Support", "Contact requests use the account database and email delivery when configured, with safe setup required fallback behavior.")
      ],
      actions: [linkAction("/help", "Help"), linkAction("/api/readiness", "Readiness JSON"), linkAction("/", "Home")]
    })
  );
});

app.get("/login", (req, res) => {
  return res.status(200).type("html").send(
    layout({
      title: "Login",
      eyebrow: "Access readiness",
      heading: "Login",
      body: "Use email/password access after account login is configured and owner-tested.",
      sections: [
        authForm("Login with email", "/auth/login"),
        brandCard("Account access", "Email login unlocks protected workspaces after account sessions are configured."),
        brandCard("Admin protection", "Founder routes remain protected by server-side authorization.")
      ],
      actions: [linkAction("/signup", "Create account"), linkAction("/docs", "Docs"), linkAction("/", "Home")]
    })
  );
});

app.get("/signup", (req, res) => {
  return res.status(200).type("html").send(
    layout({
      title: "Signup",
      eyebrow: "Account readiness",
      heading: "Create an account",
      body: "Account access will unlock Business Builder, Creator Studio, and Growth Studio once email login is configured by the owner.",
      sections: [
        authForm("Create account", "/auth/signup"),
        brandCard("Account access", "Use one account for product path selection, first offer setup, support preferences, and payment readiness.")
      ],
      actions: [linkAction("/login", "Login"), linkAction("/", "Home")]
    })
  );
});

app.post("/auth/signup", async (req, res) => {
  const result = await handleEmailAuth("signup", req.body);
  return sendEmailAuthResult(req, res, result, "/dashboard?account=created", "/login");
});

app.get("/auth/signup", (req, res) => {
  if (wantsAuthReadinessJson(req)) {
    return res.status(200).json({
      ok: true,
      code: "signup_ready",
      sessionStored: false,
      method: "POST",
      action: "/auth/signup"
    });
  }

  return res.redirect(303, "/signup");
});

app.get("/auth/login", (req, res) => {
  if (wantsAuthReadinessJson(req)) {
    return res.status(200).json({
      ok: true,
      code: "login_ready",
      sessionStored: false,
      method: "POST",
      action: "/auth/login"
    });
  }

  return res.redirect(303, "/login");
});

app.post("/auth/login", async (req, res) => {
  const result = await handleEmailAuth("login", req.body);
  return sendEmailAuthResult(req, res, result, "/dashboard?login=success", "/login");
});

app.get("/logout", (req, res) => {
  return res.status(200).type("html").send(
    responsePage("Logout", "No persistent session is active. OAuth-backed session logout will be enabled when owner credentials are configured.", [
      linkAction("/", "Home"),
      linkAction("/login", "Login")
    ])
  );
});

app.post("/logout", (req, res) => {
  clearCustomerSessionCookie(res);
  if (acceptsHtml(req)) return res.redirect(303, "/login");
  return res.status(200).json({ ok: true, message: "No persistent session is active." });
});

app.post("/auth/logout", (req, res) => {
  clearCustomerSessionCookie(res);
  return res.status(200).json({ ok: true, message: "No persistent session is active." });
});

app.get("/account", (req, res) => {
  return res.status(200).type("html").send(
    layout({
      title: "Account",
      eyebrow: "Account readiness",
      heading: "Account",
      body: getReadiness().services.supabase === "configured"
        ? "Email login is configured. Persistent session handling requires owner smoke testing before customer launch."
        : "Setup required: Connect account login to enable account sessions.",
      sections: accountSetupCards(),
      actions: [linkAction("/account/setup", "Account setup"), linkAction("/login", "Login"), linkAction("/", "Home")]
    })
  );
});

app.get("/account/setup", (req, res) => {
  return res.status(200).type("html").send(
    layout({
      title: "Account setup",
      eyebrow: "Account readiness",
      heading: "Account setup",
      body: "Complete these items after email login is configured and owner-tested.",
      sections: accountSetupCards(),
      actions: [linkAction("/account", "Account"), linkAction("/contact", "Request setup"), linkAction("/", "Home")]
    })
  );
});

app.get("/dashboard", requireAppAccess, (req, res) => {
  return res.status(200).type("html").send(
    layout({
      title: "Dashboard",
      eyebrow: "Workspace",
      heading: "Dashboard",
      body: "Choose a SONARA product workspace. Owner/admin access is for operations; customer access follows free and paid plan rules.",
      sections: [
        accountNoticeCard(req),
        accessCard(req.sonaraAccess),
        brandCard("Business Builder", "Offer, intake, customer, and payment readiness workspace."),
        brandCard("Creator Studio", "Asset, offer, release, monetization, and media records workspace."),
        brandCard("Growth Studio", "Campaign, lead follow-up, consent, automation, and growth records workspace."),
        brandCard("Free access", "Logged-in users can use public readiness checklists and basic planning outputs without a paid plan."),
        brandCard("Paid access", "Paid workspaces stay locked until payment updates confirm an active or trialing plan.")
      ],
      actions: [
        linkAction("/business-builder/dashboard", "Business Builder dashboard"),
        linkAction("/creator-studio/dashboard", "Creator Studio dashboard"),
        linkAction("/growth-studio/dashboard", "Growth Studio dashboard"),
        logoutAction()
      ]
    })
  );
});

app.get("/auth/callback", (req, res) => {
  const payload = { ok: false, code: "disabled", service: "google_oauth", message: "Google OAuth is deferred until owner configuration is complete." };
  if (!acceptsHtml(req)) return res.status(503).json(payload);
  return res.status(503).type("html").send(
    responsePage("OAuth deferred", "Google OAuth is disabled for launch verification. Use email/password access after account login is configured.", [
      linkAction("/login", "Login"),
      linkAction("/", "Home")
    ])
  );
});

app.get("/api/checkout/session", (req, res) => {
  return res.status(405).json({ ok: false, code: "method_not_allowed", message: "Use POST to create a checkout session." });
});

app.post("/api/checkout/session", handleCheckoutSessionRequest);
app.post("/api/billing/create-checkout-session", handleCheckoutSessionRequest);

app.post("/api/billing/create-portal-session", async (req, res) => {
  const customer = await resolveCustomerSession(req);
  if (!customer.ok) {
    if (acceptsHtml(req)) return res.redirect(303, "/login");
    return res.status(customer.status).json(customer.body);
  }

  const organization = await getCustomerPrimaryOrganization(customer.user);
  if (!organization.ok) return sendSetupRequired(req, res, 503, "customer_organization", organization.code);

  const secretStatus = getStripeSecretStatus();
  if (secretStatus.status !== "configured") return sendSetupRequired(req, res, 503, "stripe_secret_key", secretStatus.status);

  const stripeCustomer = await getOrCreateStripeCustomer(customer.user, organization.organizationId);
  if (!stripeCustomer.ok) return sendSetupRequired(req, res, 503, "stripe_customer", stripeCustomer.code || "not_available");

  const response = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${getEnv("STRIPE_SECRET_KEY")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      customer: stripeCustomer.stripeCustomerId,
      return_url: `${getPublicAppUrl(req)}/business-builder/billing`
    }).toString()
  }).catch(() => undefined);
  if (!response?.ok) return sendSetupRequired(req, res, 502, "stripe_customer_portal", "portal_unavailable");
  const portal = await response.json().catch(() => ({}));
  if (wantsJson(req)) return res.status(200).json({ ok: true, portal_url: portal.url });
  return res.redirect(303, portal.url || "/business-builder/billing");
});

app.get("/api/billing/status", (req, res) => {
  const readiness = getReadiness();
  return res.status(200).json({
    ok: true,
    checkout: readiness.services.checkout,
    stripe: readiness.services.stripe,
    paidStatus: "not_verified",
    message: readiness.services.checkout === "enabled" ? "Checkout can be started server-side." : "setup_required"
  });
});

app.get("/settings", requireCustomer, (req, res) => {
  return res.status(200).type("html").send(
    layout({
      title: "Settings",
      eyebrow: "Account readiness",
      heading: "Settings",
      body: "Language and unit preferences are prepared for profile-backed storage after account sessions are enabled.",
      sections: [
        brandCard("Language preference", "Default: English. Recommended implementation: persist a locale field on profile_settings and apply translations through a dedicated i18n layer."),
        brandCard("Unit preference", "Default: US customary where relevant. Store metric or imperial preference in profile_settings when customer profiles are active."),
        brandCard("Session requirement", "Preferences are not persisted until account sessions are configured and owner-tested.")
      ],
      actions: [linkAction("/account", "Account"), linkAction("/", "Home"), logoutAction()]
    })
  );
});

app.get("/billing", requireCustomer, (req, res) => res.redirect(303, "/business-builder/billing"));

app.get("/business-builder/billing", requireWorkspaceAccess("business_builder"), async (req, res) => {
  const readiness = getReadiness();
  const organization = await getCustomerPrimaryOrganization(req.sonaraUser);
  const billing = organization.ok ? await getBillingPanelSummary(organization.organizationId) : { status: organization.code, rows: [] };
  return res.status(200).type("html").send(
    layout({
      title: "Business Builder Billing",
      eyebrow: "Plan access",
      heading: "Billing",
      body: "Manage upgrades and billing. Paid tools unlock only after payment updates record active access.",
      sections: [
        accountNoticeCard(req),
        accessCard(req.sonaraAccess),
        billingPanel(readiness, billing),
        brandCard("Current plan", billing.status || "No active paid plan found."),
        brandCard("Customer portal", readiness.services.stripe === "configured" ? "Stripe customer portal can open after a Stripe customer record exists." : "Setup required: payment connection is missing.")
      ],
      actions: [linkAction("/pricing", "View pricing"), linkAction("/business-builder/dashboard", "Dashboard"), logoutAction()]
    })
  );
});

app.get("/business-builder/login", (req, res) => {
  return res.status(200).type("html").send(
    layout({
      title: "Business Builder Login",
      eyebrow: "Business Builder access",
      heading: "Business Builder Login",
      body: "Email/password access for Business Builder owners, managers, and employees.",
      sections: [
        authForm("Login with email", "/auth/login"),
        brandCard("Employee access", "Employees use their own email/password credentials after accepting an owner-created invite."),
        brandCard("Password ownership", "Business owners never create, view, store, or know employee passwords.")
      ],
      actions: [linkAction("/business-builder", "Business Builder"), linkAction("/login", "SONARA login"), linkAction("/", "Home")]
    })
  );
});

app.get("/business-builder/employees", requireBusinessManager, async (req, res) => {
  const summary = await getBusinessEmployeeSummary(req.sonaraBusinessMembership?.workspace_id);
  return res.status(200).type("html").send(
    layout({
      title: "Business Builder Employees",
      eyebrow: "Business Builder operations",
      heading: "Employee access",
      body: "Owner and manager workspace for employee invitations. Employees set their own password through the invite flow.",
      sections: [
        businessEmployeeInviteForm(),
        brandCard("Memberships", summary.memberships),
        brandCard("Pending invites", summary.invites),
        brandCard("Password policy", "Invite records store token hashes only. Raw employee passwords are never accepted from owners.")
      ],
      actions: [linkAction("/business-builder/dashboard", "Dashboard"), linkAction("/business-builder/login", "Employee login"), logoutAction()]
    })
  );
});

app.post("/api/business-builder/employees/invite", requireBusinessManager, async (req, res) => {
  const result = await createBusinessEmployeeInvite(req);
  if (wantsJson(req)) return res.status(result.status).json(result.body);
  return res.status(result.status).type("html").send(
    responsePage(result.body.ok ? "Invite recorded" : "Invite not created", result.body.message || result.body.code, [
      linkAction("/business-builder/employees", "Employees"),
      linkAction("/business-builder/dashboard", "Dashboard")
    ])
  );
});

app.get("/business-builder/invite/accept", (req, res) => {
  return res.status(200).type("html").send(
    layout({
      title: "Accept Business Builder Invite",
      eyebrow: "Business Builder access",
      heading: "Accept invite",
      body: "Employees accept an invite and set their own password. Owners cannot create employee passwords.",
      sections: [businessEmployeeAcceptForm()],
      actions: [linkAction("/business-builder/login", "Employee login"), linkAction("/business-builder", "Business Builder")]
    })
  );
});

app.post("/business-builder/invite/accept", async (req, res) => {
  const result = await acceptBusinessEmployeeInvite(req.body);
  if (wantsJson(req)) return res.status(result.status).json(result.body);
  return res.status(result.status).type("html").send(
    responsePage(result.body.ok ? "Invite accepted" : "Invite not accepted", result.body.message || result.body.code, [
      linkAction("/business-builder/login", "Employee login"),
      linkAction("/business-builder/invite/accept", "Try again")
    ])
  );
});

app.post("/api/business-builder/offers", async (req, res) => {
  const validation = requireFields(req.body, ["serviceType", "audience", "priceIdea", "deliverables"]);
  if (!validation.ok) return res.status(400).json(validation);
  return requireWorkspaceAccess("business_builder")(req, res, async () => {
    const output = buildBusinessOffer(req.body);
    return res.status(200).json(await saveModuleOutput(req, "business_builder", "offer_builder", req.body, output));
  });
});

app.post("/api/business-builder/intake", requireWorkspaceAccess("business_builder"), async (req, res) => {
  const validation = requireFields(req.body, ["name", "email", "message", "serviceInterest"]);
  if (!validation.ok) return res.status(400).json(validation);
  const output = {
    referenceId: randomUUID(),
    summary: `${req.body.name} requested ${req.body.serviceInterest}.`,
    nextAction: "Review request and follow up through the support queue."
  };
  return res.status(200).json(await saveBusinessBuilderIntake(req, output));
});

app.get("/api/business-builder/records", requirePaidOrOwnerAccess("business_builder"), async (req, res) => res.status(200).json(await readModuleRecords(req, "business_builder")));
app.get("/api/business-builder/readiness", (req, res) => res.status(200).json(productReadinessJson("business_builder")));
app.get("/api/business-builder/checklist", requireWorkspaceAccess("business_builder"), async (req, res) => res.status(200).json(await listChecklistItems(req)));
app.post("/api/business-builder/checklist", requireWorkspaceAccess("business_builder"), async (req, res) => {
  const validation = requireFields(req.body, ["title"]);
  if (!validation.ok) return res.status(400).json(validation);
  return res.status(200).json(await createChecklistItem(req));
});
app.patch("/api/business-builder/checklist", requireWorkspaceAccess("business_builder"), async (req, res) => {
  const validation = requireFields(req.body, ["id"]);
  if (!validation.ok) return res.status(400).json(validation);
  return res.status(200).json(await updateChecklistItem(req));
});
app.delete("/api/business-builder/checklist", requireWorkspaceAccess("business_builder"), async (req, res) => {
  const validation = requireFields(req.body, ["id"]);
  if (!validation.ok) return res.status(400).json(validation);
  return res.status(200).json(await deleteChecklistItem(req));
});

app.post("/api/creator-studio/assets", async (req, res) => {
  const validation = requireFields(req.body, ["title", "type", "platform", "status", "rightsNotes"]);
  if (!validation.ok) return res.status(400).json(validation);
  return requireWorkspaceAccess("creator_studio")(req, res, async () => {
    const output = {
      title: String(req.body.title),
      rightsReview: "Rights notes captured for owner review.",
      nextAction: "Add platform, status, and release checklist before monetization."
    };
    return res.status(200).json(await saveModuleOutput(req, "creator_studio", "asset_catalog", req.body, output));
  });
});

app.post("/api/creator-studio/offers", async (req, res) => {
  const validation = requireFields(req.body, ["offerType", "audience", "deliverables", "priceIdea"]);
  if (!validation.ok) return res.status(400).json(validation);
  return requireWorkspaceAccess("creator_studio")(req, res, async () => {
    const output = buildCreatorOffer(req.body);
    return res.status(200).json(await saveModuleOutput(req, "creator_studio", "creator_offers", req.body, output));
  });
});

app.get("/api/creator-studio/records", requirePaidOrOwnerAccess("creator_studio"), async (req, res) => res.status(200).json(await readModuleRecords(req, "creator_studio")));
app.get("/api/creator-studio/readiness", (req, res) => res.status(200).json(productReadinessJson("creator_studio")));

app.post("/api/growth-studio/campaigns", async (req, res) => {
  const validation = requireFields(req.body, ["goal", "audience", "offer", "channel", "timeline"]);
  if (!validation.ok) return res.status(400).json(validation);
  return requireWorkspaceAccess("growth_studio")(req, res, async () => {
    const output = buildCampaignPlan(req.body);
    return res.status(200).json(await saveModuleOutput(req, "growth_studio", "campaign_workspace", req.body, output));
  });
});

app.post("/api/growth-studio/leads", async (req, res) => {
  const validation = requireFields(req.body, ["name", "email", "source", "consentStatus"]);
  if (!validation.ok) return res.status(400).json(validation);
  return requireWorkspaceAccess("growth_studio")(req, res, async () => {
    const output = {
      followUpPlan: "Confirm consent, use truthful subject/from lines, include unsubscribe language for commercial email, and keep audience source notes.",
      nextAction: "Review lead before any outreach."
    };
    return res.status(200).json(await saveModuleOutput(req, "growth_studio", "lead_follow_up", req.body, output));
  });
});

app.get("/api/growth-studio/records", requirePaidOrOwnerAccess("growth_studio"), async (req, res) => res.status(200).json(await readModuleRecords(req, "growth_studio")));
app.get("/api/growth-studio/readiness", (req, res) => res.status(200).json(productReadinessJson("growth_studio")));

app.get("/api/health", (req, res) => res.status(200).json({
  ok: true,
  app: "sonara-industries",
  runtime: "express",
  deployment: getDeploymentInfo(),
  timestamp: new Date().toISOString()
}));

app.get("/api/readiness", (req, res) => res.status(200).json(getReadiness()));

app.get("/api/admin/overview", requireAdmin, async (req, res) => {
  await recordAdminAuditEvent(req, "api.admin.overview.view", { path: req.path });
  return res.status(200).json({ ok: true, metrics: await getAdminOverviewJson() });
});

app.get("/api/admin/env-status", requireAdmin, async (req, res) => {
  await recordAdminAuditEvent(req, "api.admin.env_status.view", { path: req.path });
  return res.status(200).json({
    ok: true,
    services: getReadiness().services,
    checks: getAdminEnvReadiness().map((item) => ({ key: item.key, label: item.label, ok: item.ok, status: item.status }))
  });
});

app.get("/manifest.webmanifest", (req, res) => res.redirect(308, "/site.webmanifest"));

app.get("/offline", (req, res) => {
  return res.status(200).type("html").send(
    responsePage("Offline", "The SONARA interface is available again when network access returns.", [linkAction("/", "Home")])
  );
});

app.get("/admin/login", rejectCustomerBearerFromAdminLogin, (req, res) => {
  const readiness = getAdminEnvReadiness();
  const adminReady = getReadiness().services.adminProtection === "configured";
  return res.status(adminReady ? 200 : 503).type("html").send(
    layout({
      title: "Admin login",
      eyebrow: "Founder operations",
      heading: "Admin login",
      body: adminReady
        ? "Sign in with the founder/admin email account. Access is checked server-side against the admin allowlist or user roles."
        : "Supabase email login and founder access rules are required before founder operations can open.",
      sections: [
        adminLoginForm(),
        ...readiness.map((item) => brandCard(item.label, adminReadinessText(item)))
      ],
      actions: [linkAction("/", "Home"), linkAction("/api/readiness", "Readiness"), linkAction("/security", "Security")]
    })
  );
});

app.post("/admin/login", rejectCustomerBearerFromAdminLogin, async (req, res) => {
  if (getReadiness().services.adminProtection !== "configured") {
    await recordAdminAuditEvent(req, "admin.login.setup_required", { path: req.path });
    return res.status(503).type("html").send(responsePage("Admin setup required", "Supabase auth is not configured.", [linkAction("/admin/login", "Return to admin login")]));
  }

  const auth = await handleEmailAuth("login", req.body);
  if (auth.status < 200 || auth.status >= 300 || !auth.session?.accessToken) {
    await recordAdminAuditEvent(req, "admin.login.failed", { path: req.path });
    return res.status(401).type("html").send(responsePage("Admin access denied", "Email or password is incorrect.", [linkAction("/admin/login", "Return to admin login")]));
  }

  const verification = await verifySupabaseAccessToken(auth.session.accessToken);
  const admin = verification.ok ? await isSupabaseAdminUser(verification.user) : { ok: false };
  if (!admin.ok) {
    await recordAdminAuditEvent(req, "admin.login.not_admin", { path: req.path, email_domain: String(req.body.email || "").split("@")[1] || "unknown" });
    return res.status(403).type("html").send(responsePage("Admin access denied", "This account is not an admin.", [linkAction("/admin/login", "Return to admin login")]));
  }

  await recordAdminAuditEvent(req, "admin.login.succeeded", { path: req.path, method: "supabase_email" });
  res.cookie(ADMIN_SESSION_COOKIE, auth.session.accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.min(auth.session.maxAgeSeconds || ADMIN_SESSION_MAX_AGE_SECONDS, ADMIN_SESSION_MAX_AGE_SECONDS) * 1000
  });
  return res.redirect(303, "/admin");
});

app.post("/admin/logout", (req, res) => {
  res.clearCookie(ADMIN_SESSION_COOKIE, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/"
  });
  return res.redirect(303, "/admin/login");
});

app.get("/admin", requireAdmin, async (req, res) => {
  const readiness = getReadiness();
  const metrics = await getAdminMetrics();
  await recordAdminAuditEvent(req, "admin.dashboard.view", { path: req.path });
  return res.status(200).type("html").send(adminPage("Admin", "Protected founder operations for launch readiness.", readiness, metrics));
});

app.get("/admin/support", requireAdmin, async (req, res) => {
  const result = await listSupportRequests();
  await recordAdminAuditEvent(req, "admin.support.view", { path: req.path });
  return res.status(200).type("html").send(
    layout({
      title: "Support queue",
      eyebrow: "Founder operations",
      heading: "Support queue",
      body: result.ok ? "Recent database-backed support requests are available for review." : "Support queue setup required: Supabase service role is not configured.",
      sections: result.requests.length
        ? result.requests.map((request) => brandCard(request.reference_id || "Support request", `${request.category || "contact"} - ${request.email_delivery_status || "pending"} - ${request.created_at || "no timestamp"}`))
        : [brandCard("Queue status", result.ok ? "No recent requests returned." : "Database-backed queue requires Supabase setup.")],
      actions: [linkAction("/admin", "Admin"), linkAction("/contact", "Contact"), adminLogoutAction()]
    })
  );
});

app.get("/admin/billing", requireAdmin, async (req, res) => {
  const readiness = getReadiness();
  const billingSummary = await getBillingSummary();
  await recordAdminAuditEvent(req, "admin.billing.view", { path: req.path });
  return res.status(200).type("html").send(
    layout({
      title: "Billing readiness",
      eyebrow: "Founder operations",
      heading: "Billing readiness",
      body: readiness.services.checkout === "enabled" ? "Stripe checkout and webhook variables are present." : "Stripe checkout remains setup required until server variables and price IDs exist.",
      sections: [
        brandCard("Checkout", readiness.services.checkout),
        brandCard("Stripe", readiness.services.stripe),
        brandCard("Webhook audit", readiness.services.supabase === "configured" ? "database-backed audit available" : "Setup required"),
        brandCard("Webhook events", billingSummary.webhookEvents),
        brandCard("Subscriptions", billingSummary.subscriptions)
      ],
      actions: [linkAction("/admin", "Admin"), linkAction("/pricing", "Pricing"), adminLogoutAction()]
    })
  );
});

app.get("/admin/business-builder/employees", requireAdmin, async (req, res) => {
  const summary = await getBusinessEmployeeSummary();
  await recordAdminAuditEvent(req, "admin.business_builder_employees.view", { path: req.path });
  return res.status(200).type("html").send(
    layout({
      title: "Business Builder Employees",
      eyebrow: "Founder operations",
      heading: "Business Builder employees",
      body: "Founder view for Business Builder employee invitation and membership readiness. Secret values and raw invite tokens are never displayed.",
      sections: [
        brandCard("Workspaces", summary.workspaces),
        brandCard("Memberships", summary.memberships),
        brandCard("Pending invites", summary.invites),
        brandCard("Password control", "Employees set their own password through email login. Owners do not create employee passwords.")
      ],
      actions: [linkAction("/admin", "Admin"), linkAction("/admin/billing", "Billing"), linkAction("/business-builder/employees", "Workspace employee portal"), adminLogoutAction()]
    })
  );
});

app.get("/admin/env-readiness", requireAdmin, async (req, res) => {
  await recordAdminAuditEvent(req, "admin.env_readiness.view", { path: req.path });
  return res.status(200).type("html").send(
    layout({
      title: "Environment readiness",
      eyebrow: "Founder operations",
      heading: "Environment readiness",
      body: "Non-secret service readiness flags. Secret values are never displayed.",
      sections: getAdminEnvReadiness().map((item) => brandCard(item.label, adminReadinessText(item))),
      actions: [linkAction("/admin", "Admin"), linkAction("/admin/support", "Support queue"), linkAction("/admin/billing", "Billing"), adminLogoutAction()]
    })
  );
});

app.get("/admin/users", requireAdmin, async (req, res) => {
  await recordAdminAuditEvent(req, "admin.users.view", { path: req.path });
  return res.status(200).type("html").send(await adminRowsPage({
    title: "Users",
    heading: "Users and customers",
    body: "Safe profile summary for founder operations. Customer records require the account database and service-role server access.",
    table: "profiles",
    query: "?select=id,email,display_name,created_at&order=created_at.desc&limit=20",
    emptyText: "No profile rows returned.",
    rowTitle: (row) => row.email || row.display_name || row.id,
    rowBody: (row) => `Display name: ${row.display_name || "not set"} / Created: ${row.created_at || "not returned"}`,
    actions: adminActions()
  }));
});

app.get("/admin/roles", requireAdmin, async (req, res) => {
  await recordAdminAuditEvent(req, "admin.roles.view", { path: req.path });
  return res.status(200).type("html").send(await adminRowsPage({
    title: "Roles",
    heading: "User roles",
    body: "Server-side role assignments for owner, admin, customer, and employee access. Assign roles only after verifying the user account.",
    table: "user_roles",
    query: "?select=id,user_id,role,created_at&order=created_at.desc&limit=20",
    emptyText: "No user role rows returned.",
    rowTitle: (row) => row.role || "role",
    rowBody: (row) => `User: ${row.user_id || "not returned"} / Created: ${row.created_at || "not returned"}`,
    extraSections: [adminRoleForm()],
    actions: adminActions()
  }));
});

app.post("/admin/roles", requireAdmin, async (req, res) => {
  const result = await updateUserRole(req);
  await recordAdminAuditEvent(req, "admin.roles.update", { path: req.path, result: result.body.code, role: result.body.role });
  if (wantsJson(req)) return res.status(result.status).json(result.body);
  return res.status(result.status).type("html").send(responsePage(result.body.ok ? "Role updated" : "Role not updated", result.body.message || result.body.code, [linkAction("/admin/roles", "Roles"), linkAction("/admin", "Admin")]));
});

app.get("/admin/subscriptions", requireAdmin, async (req, res) => {
  await recordAdminAuditEvent(req, "admin.subscriptions.view", { path: req.path });
  return res.status(200).type("html").send(await adminRowsPage({
    title: "Subscriptions",
    heading: "Subscriptions",
    body: "Payment plan records written by Stripe webhook processing. Checkout sessions alone do not unlock paid access.",
    table: "billing_subscriptions",
    query: "?select=organization_id,plan_slug,status,current_period_end,cancel_at_period_end,updated_at&order=updated_at.desc&limit=20",
    emptyText: "No subscription rows returned.",
    rowTitle: (row) => `${row.plan_slug || "plan"} - ${row.status || "unknown"}`,
    rowBody: (row) => `Organization: ${row.organization_id || "not returned"} / Current period end: ${row.current_period_end || "not returned"} / Cancel at period end: ${Boolean(row.cancel_at_period_end)}`,
    actions: adminActions()
  }));
});

app.get("/admin/webhooks", requireAdmin, async (req, res) => {
  await recordAdminAuditEvent(req, "admin.webhooks.view", { path: req.path });
  return res.status(200).type("html").send(await adminRowsPage({
    title: "Payment updates",
    heading: "Payment updates",
    body: "Recent Stripe webhook audit rows. Failed payment events are recorded for review and do not unlock paid access.",
    table: "billing_webhook_events",
    query: "?select=provider_event_id,event_type,processing_status,created_at&order=created_at.desc&limit=20",
    emptyText: "No payment update rows returned.",
    rowTitle: (row) => row.event_type || "payment update",
    rowBody: (row) => `Status: ${row.processing_status || "not returned"} / Event: ${row.provider_event_id || "not returned"} / Created: ${row.created_at || "not returned"}`,
    actions: adminActions()
  }));
});

app.get("/admin/catalog", requireAdmin, async (req, res) => {
  await recordAdminAuditEvent(req, "admin.catalog.view", { path: req.path });
  return res.status(200).type("html").send(
    layout({
      title: "Catalog",
      eyebrow: "Founder operations",
      heading: "Catalog and price readiness",
      body: "Product and price readiness for the SONARA house of brands. Raw provider keys are never displayed.",
      sections: [
        ...Object.entries(STRIPE_PLANS).map(([plan, config]) => brandCard(config.name, plan === "free" ? "Free plan: no checkout required." : displayStatus(getStripePlanPriceStatus(plan).checkout))),
        ...(await getProductModuleCatalogCards())
      ],
      actions: adminActions()
    })
  );
});

app.get("/admin/system", requireAdmin, async (req, res) => {
  await recordAdminAuditEvent(req, "admin.system.view", { path: req.path });
  return res.status(200).type("html").send(
    layout({
      title: "System",
      eyebrow: "Founder operations",
      heading: "System status",
      body: "Non-secret system readiness and route map for launch operations.",
      sections: [deploymentCard(), ...readinessCards(getReadiness()), ...getRouteMapCards()],
      actions: adminActions()
    })
  );
});

app.get("/admin/business-builder", requireAdmin, async (req, res) => res.status(200).type("html").send(await adminProductOperationsPage(req, "business-builder")));
app.get("/admin/creator-studio", requireAdmin, async (req, res) => res.status(200).type("html").send(await adminProductOperationsPage(req, "creator-studio")));
app.get("/admin/growth-studio", requireAdmin, async (req, res) => res.status(200).type("html").send(await adminProductOperationsPage(req, "growth-studio")));

for (const page of legalPages()) {
  app.get(page.href, (req, res) => legalPage(res, page.title, page.points));
}

for (const page of legalAliasPages()) {
  app.get(page.href, (req, res) => legalPage(res, page.title, page.points));
}

app.use((req, res) => {
  if (wantsJson(req)) {
    return res.status(404).json({
      ok: false,
      code: "not_found",
      error: "not_found",
      message: "Unknown route."
    });
  }

  return res.status(404).type("html").send(
    layout({
      title: "Page not found",
      eyebrow: "Not found",
      heading: "Page not found",
      body: "Unknown route.",
      sections: [brandCard("Route unavailable", "The page or action you requested is not registered in SONARA Industries.")],
      actions: [linkAction("/", "Home"), linkAction("/help", "Help")]
    })
  );
});

if (require.main === module) {
  const port = process.env.PORT || 5000;
  app.listen(port, () => console.log(`Listening on ${port}`));
}

module.exports = app;

function registerProduct(slug, config) {
  const productKey = config.productKey || slug.replace(/-/g, "_");
  const routes = getProductPageDefinitions(slug);
  app.get(`/${slug}`, (req, res) => {
    res.status(200).type("html").send(
      layout({
        title: config.name,
        eyebrow: "Product system",
        heading: config.name,
        body: config.body,
        sections: [
          brandCard("What this product does", config.body),
          ...config.cards.map(([title, body]) => brandCard(title, body)),
          checklistCard("Launch Setup Checklist", config.checklist)
        ],
        actions: productLandingActions(slug)
      })
    );
  });

  app.get(`/${slug}/dashboard`, requireWorkspaceAccess(productKey), async (req, res) => {
    const dashboard = await getWorkspaceDashboardSummary(req.sonaraAccess, productKey);
    res.status(200).type("html").send(
      layout({
        title: `${config.name} Dashboard`,
        eyebrow: "Workspace",
        heading: `${config.name} Dashboard`,
        body: "Your company area for real setup work. Some tools unlock after setup or payment.",
        sections: [
          accessCard(req.sonaraAccess),
          brandCard("Free tools", `Logged-in users can open: ${routes.free.map((page) => page.label).join(", ")}.`),
          brandCard("Paid tools", `Upgrade to use: ${routes.paid.map((page) => page.label).join(", ")}.`),
          workspaceRecordsCard(dashboard),
          workspaceActivityCard(dashboard),
          brandCard("Next actions", "Open a free tool, submit a real form, or upgrade for paid workspace operations.")
        ],
        actions: productDashboardActions(slug)
      })
    );
  });

  app.get(`/${slug}/launch-readiness`, (req, res) => {
    const readiness = getReadiness();
    res.status(200).type("html").send(
      layout({
        title: `${config.name} Setup Checklist`,
        eyebrow: "Launch Setup Checklist",
        heading: `${config.name} Setup Checklist`,
        body: "Service setup is shown without exposing secrets. Missing services stay setup required.",
        sections: readinessCards(readiness),
        actions: productLaunchReadinessActions(slug)
      })
    );
  });

  for (const page of routes.free) {
    app.get(page.path, requireWorkspaceAccess(productKey), (req, res) => {
      res.status(200).type("html").send(workspaceToolPage({ slug, config, page, access: req.sonaraAccess, paid: false }));
    });
  }

  for (const page of routes.paid) {
    app.get(page.path, requirePaidOrOwnerAccess(productKey), (req, res) => {
      res.status(200).type("html").send(workspaceToolPage({ slug, config, page, access: req.sonaraAccess, paid: true }));
    });
  }
}

function getProductPageDefinitions(slug) {
  const definitions = {
    "business-builder": {
      free: [
        { path: "/business-builder/readiness", label: "Launch Setup Checklist", title: "Business Builder Launch Setup Checklist", module: "readiness", body: "Track the launch basics before paid operations are enabled.", form: "business_checklist" },
        { path: "/business-builder/intake", label: "Intake", title: "Intake & Request Queue", module: "intake", body: "Capture a real service request. Saved records require account database setup.", form: "business_intake" },
        { path: "/business-builder/checklist", label: "Launch Setup Checklist", title: "Launch Setup Checklist", module: "checklist", body: "Use this free checklist to prepare business profile, offer, intake, pricing, payment, support, legal, and analytics.", form: "business_checklist" },
        { path: "/business-builder/offers/free", label: "Free offer draft", title: "Offer Builder", module: "offer_builder", body: "Draft a simple service offer from your real inputs.", form: "business_offer" },
        { path: "/business-builder/records/free", label: "Free records", title: "Free Records", module: "free_records", body: "Free records show saved basic module outputs when the account database and organization membership are configured.", api: "/api/business-builder/records" },
        { path: "/business-builder/help", label: "Help", title: "Business Builder Help", module: "help", body: "Operational help for service offers, intake, customer records, booking readiness, and support setup." }
      ],
      paid: [
        { path: "/business-builder/customers", label: "Customers", title: "Customer Records", module: "customers", body: "Paid customer records unlock after billing state confirms plan access." },
        { path: "/business-builder/offers", label: "Offers", title: "Offer Records", module: "offers", body: "Paid offer records unlock after billing state confirms plan access." },
        { path: "/business-builder/orders", label: "Orders", title: "Orders", module: "orders", body: "Order operations require payment setup and account database records." },
        { path: "/business-builder/payments", label: "Payments", title: "Payments", module: "payments", body: "Payment operations require configured checkout, webhook delivery, and confirmed billing records." },
        { path: "/business-builder/launch-plan", label: "Launch plan", title: "Launch Plan", module: "launch_plan", body: "Paid launch planning unlocks after plan access is recorded." },
        { path: "/business-builder/automations", label: "Automations", title: "Automations", module: "automations", body: "Automation remains setup required until owner-approved workflows and audit logging are configured." }
      ]
    },
    "creator-studio": {
      free: [
        { path: "/creator-studio/assets", label: "Asset Catalog", title: "Asset Catalog", module: "asset_catalog", body: "Create a real asset record with rights notes. Saved records require account database setup.", form: "creator_asset" },
        { path: "/creator-studio/releases", label: "Releases", title: "Release & Content Checklist", module: "release_checklist", body: "Prepare platform setup, ownership, pricing, promo assets, distribution, and support." },
        { path: "/creator-studio/checklist", label: "Checklist", title: "Creator Studio Checklist", module: "checklist", body: "Use this checklist before monetizing creator products or releases." },
        { path: "/creator-studio/offers/free", label: "Free offer draft", title: "Creator Offers", module: "creator_offers", body: "Draft a creator offer from real product inputs.", form: "creator_offer" },
        { path: "/creator-studio/records/free", label: "Free records", title: "Free Records", module: "free_records", body: "Free records show saved basic module outputs when account database setup is complete.", api: "/api/creator-studio/records" },
        { path: "/creator-studio/help", label: "Help", title: "Creator Studio Help", module: "help", body: "Operational help for assets, offers, release checklists, catalog readiness, and monetization setup." }
      ],
      paid: [
        { path: "/creator-studio/offers", label: "Offers", title: "Offer Records", module: "offers", body: "Paid offer records unlock after billing state confirms plan access." },
        { path: "/creator-studio/records", label: "Records", title: "Media & Customer Records", module: "records", body: "Paid media and customer records unlock after billing state confirms plan access." },
        { path: "/creator-studio/settings", label: "Settings", title: "Creator Studio Settings", module: "settings", body: "Workspace settings require paid plan access or owner/admin operations." },
        { path: "/creator-studio/catalog", label: "Catalog", title: "Catalog", module: "catalog", body: "Catalog operations require paid plan access and account database records." },
        { path: "/creator-studio/monetization", label: "Monetization", title: "Monetization Readiness", module: "monetization", body: "Monetization requires payment setup, rights review, and owner-approved terms." },
        { path: "/creator-studio/media-kit", label: "Media kit", title: "Media Kit", module: "media_kit", body: "Paid media kit operations unlock after billing state confirms plan access." },
        { path: "/creator-studio/automations", label: "Automations", title: "Automations", module: "automations", body: "Automation remains setup required until owner-approved workflows and audit logging are configured." }
      ]
    },
    "growth-studio": {
      free: [
        { path: "/growth-studio/campaigns", label: "Campaign Workspace", title: "Campaign Workspace", module: "campaign_workspace", body: "Create a campaign plan from real goal, audience, offer, channel, and timeline inputs.", form: "growth_campaign" },
        { path: "/growth-studio/leads", label: "Lead follow-up", title: "Lead & Customer Follow-Up", module: "lead_follow_up", body: "Capture consent-safe lead follow-up inputs. Saved records require account database setup.", form: "growth_lead" },
        { path: "/growth-studio/checklist", label: "Consent checklist", title: "Consent-Safe Campaign Checklist", module: "checklist", body: "Review consent status, unsubscribe language, mailing address, truthful sender details, and audience-source notes." },
        { path: "/growth-studio/offers/free", label: "Free offer draft", title: "Growth Offer Notes", module: "growth_offer", body: "Use campaign inputs to prepare a truthful offer angle before outreach.", form: "growth_campaign" },
        { path: "/growth-studio/records/free", label: "Free records", title: "Free Records", module: "free_records", body: "Free records show saved basic module outputs when account database setup is complete.", api: "/api/growth-studio/records" },
        { path: "/growth-studio/help", label: "Help", title: "Growth Studio Help", module: "help", body: "Operational help for campaign planning, consent-safe follow-up, lead records, and payment-safe growth routines." }
      ],
      paid: [
        { path: "/growth-studio/offers", label: "Offers", title: "Growth Offers", module: "offers", body: "Paid offer records unlock after billing state confirms plan access." },
        { path: "/growth-studio/records", label: "Records", title: "Growth Records", module: "records", body: "Paid growth records unlock after billing state confirms plan access." },
        { path: "/growth-studio/settings", label: "Settings", title: "Growth Studio Settings", module: "settings", body: "Workspace settings require paid plan access or owner/admin operations." },
        { path: "/growth-studio/followups", label: "Follow-ups", title: "Follow-Ups", module: "followups", body: "Follow-up operations require consent review, email delivery setup, and paid plan access." },
        { path: "/growth-studio/content-plan", label: "Content plan", title: "Content Plan", module: "content_plan", body: "Paid content planning unlocks after billing state confirms plan access." },
        { path: "/growth-studio/analytics", label: "Analytics", title: "Analytics", module: "analytics", body: "Analytics requires real campaign records and paid plan access." },
        { path: "/growth-studio/automations", label: "Automations", title: "Automations", module: "automations", body: "Automation remains setup required until owner-approved workflows and audit logging are configured." }
      ]
    }
  };
  return definitions[slug] || { free: [], paid: [] };
}

function productLandingActions(slug) {
  if (slug === "business-builder") {
    return [
      linkAction("/business-builder/dashboard", "Open dashboard"),
      linkAction("/business-builder/intake", "Intake"),
      linkAction("/business-builder/launch-readiness", "Launch checklist"),
      linkAction("/pricing", "Pricing"),
      linkAction("/login", "Login")
    ];
  }
  return [
    linkAction(`/${slug}/dashboard`, "Open dashboard"),
    linkAction(`/${slug}/launch-readiness`, "Launch checklist"),
    linkAction("/pricing", "Pricing"),
    linkAction("/login", "Login")
  ];
}

function productDashboardActions(slug) {
  if (slug === "business-builder") {
    return [
      linkAction("/business-builder/intake", "Intake"),
      linkAction("/business-builder/launch-readiness", "Launch checklist"),
      linkAction("/business-builder/billing", "Billing"),
      linkAction("/contact", "Support"),
      logoutAction()
    ];
  }
  return [
    linkAction(`/${slug}/launch-readiness`, "Launch checklist"),
    linkAction("/dashboard", "All workspaces"),
    linkAction("/pricing", "Pricing"),
    logoutAction()
  ];
}

function productLaunchReadinessActions(slug) {
  if (slug === "business-builder") {
    return [
      linkAction("/business-builder/dashboard", "Business Builder dashboard"),
      linkAction("/business-builder/intake", "Intake"),
      linkAction("/business-builder/billing", "Billing"),
      linkAction("/dashboard", "All workspaces"),
      logoutAction()
    ];
  }
  return [
    linkAction(`/${slug}/dashboard`, "Dashboard"),
    linkAction("/dashboard", "All workspaces"),
    linkAction("/pricing", "Pricing"),
    logoutAction()
  ];
}

function workspaceToolPage({ slug, config, page, access, paid }) {
  const sections = [
    accessCard(access),
    brandCard("What you can do here", page.body),
    workspaceServiceCard(page, paid),
    ...workspaceFormSections(page),
    ...workspaceRecordSections(page)
  ];
  return layout({
    title: page.title,
    eyebrow: paid ? "Paid workspace" : "Free workspace",
    heading: page.title,
    body: paid
      ? "Paid tools are available to owner/admin operations or customers with confirmed plan access."
      : "Free tools are available to logged-in users. Saving records depends on account database setup.",
    sections,
    actions: [
      linkAction(`/${slug}/dashboard`, `${config.name} dashboard`),
      linkAction(`/${slug}/launch-readiness`, "Launch Setup Checklist"),
      paid ? linkAction("/pricing", "Plan access") : linkAction("/dashboard", "All workspaces"),
      logoutAction()
    ]
  });
}

function workspaceServiceCard(page, paid) {
  if (paid) return brandCard("Your plan access", "This page checks owner/admin access or confirmed payment records before rendering. Checkout session creation alone does not unlock it.");
  if (page.form) return brandCard("Working action", "Submit the form on this page to generate a deterministic output. If the account database is configured, the record is saved for your organization.");
  if (page.api) return brandCard("Records", "Records are shown through the paid records API when plan access exists. Free users can still use the planning tools.");
  return brandCard("Status", "This page is a live setup guide. It does not claim unavailable automation, payments, or email delivery are working.");
}

function workspaceFormSections(page) {
  const forms = {
    business_offer: businessOfferForm,
    business_intake: businessIntakeForm,
    business_checklist: businessChecklistCard,
    creator_asset: creatorAssetForm,
    creator_offer: creatorOfferForm,
    growth_campaign: growthCampaignForm,
    growth_lead: growthLeadForm
  };
  const form = forms[page.form];
  return form ? [form()] : [];
}

function workspaceRecordSections(page) {
  if (!page.api) return [];
  return [brandCard("Record access", `Saved records are read from ${page.api}. Free users can create planning outputs; paid records unlock only after confirmed plan access.`)];
}

function layout({ title, eyebrow, heading, body, sections, actions }) {
  return `<!doctype html>
<html lang="en">
  <head>
    ${renderHead(title)}
    <style>
      :root { color-scheme: dark; --bg: #07070a; --panel: #111119; --line: #2b2b38; --text: #f7f3ee; --muted: #aaa3b5; --gold: #d7b46a; }
      * { box-sizing: border-box; }
      body { margin: 0; padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left); background: radial-gradient(circle at top left, #27202f 0, #07070a 38rem); color: var(--text); font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      a { color: inherit; }
      header, main, footer { width: min(1120px, calc(100% - 40px)); margin: 0 auto; }
      header { display: flex; justify-content: space-between; gap: 24px; align-items: center; padding: 28px 0; }
      nav { display: flex; flex-wrap: wrap; gap: 14px; }
      nav a, .action { border: 1px solid var(--line); border-radius: 999px; padding: 12px 16px; min-height: 44px; display: inline-flex; align-items: center; text-decoration: none; color: var(--muted); background: rgba(255,255,255,0.03); }
      nav a:hover, .action:hover { border-color: var(--gold); color: var(--text); }
      .brand { letter-spacing: .16em; text-transform: uppercase; font-size: 13px; color: var(--gold); }
      .hero { padding: 72px 0 52px; }
      .eyebrow { color: var(--gold); letter-spacing: .22em; text-transform: uppercase; font-size: 12px; }
      h1 { font-size: clamp(44px, 8vw, 92px); line-height: .95; margin: 18px 0; letter-spacing: -0.04em; }
      h2 { margin: 0 0 10px; }
      p { color: var(--muted); line-height: 1.7; font-size: 17px; }
      .lede { max-width: 760px; font-size: 20px; }
      .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin: 28px 0 44px; align-items: stretch; }
      .card { min-width: 0; min-height: 190px; border: 1px solid var(--line); border-radius: 18px; padding: 22px; background: rgba(17,17,25,.82); box-shadow: 0 24px 80px rgba(0,0,0,.32); overflow-wrap: anywhere; word-break: break-word; }
      .card h2 { overflow-wrap: anywhere; word-break: break-word; }
      .card p { overflow-wrap: anywhere; word-break: break-word; }
      .actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 22px; }
      form { display: grid; gap: 14px; }
      input, textarea, select, button { width: 100%; min-height: 44px; border-radius: 12px; border: 1px solid var(--line); background: #09090f; color: var(--text); padding: 12px 14px; font: inherit; }
      button { cursor: pointer; background: var(--gold); color: #111; font-weight: 700; }
      .fine { font-size: 13px; color: var(--muted); }
      footer { border-top: 1px solid var(--line); padding: 28px 0 44px; color: var(--muted); }
      footer nav { margin-top: 16px; }
      @media (max-width: 760px) { header { align-items: flex-start; flex-direction: column; } .grid { grid-template-columns: 1fr; } .hero { padding-top: 42px; } }
    </style>
  </head>
  <body class="${escapeHtml(pageShellClass(title, heading, eyebrow))}">
    <header>
      <a class="brand" href="/">SONARA Industries</a>
      <nav aria-label="Primary">
        <a href="/business-builder">Business Builder</a>
        <a href="/creator-studio">Creator Studio</a>
        <a href="/growth-studio">Growth Studio</a>
        <a href="/contact">Contact</a>
        <a href="/pricing">Pricing</a>
        <a href="/login">Login</a>
        <a href="/dashboard">Dashboard</a>
        <a href="/admin">Admin</a>
        <a href="/help">Help</a>
        <a href="/security">Security</a>
      </nav>
    </header>
    <main>
      <section class="hero">
        <div class="eyebrow">${escapeHtml(eyebrow)}</div>
        <h1>${escapeHtml(heading)}</h1>
        <p class="lede">${escapeHtml(body)}</p>
        <div class="actions">${actions.join("")}</div>
      </section>
      <section class="grid">${sections.join("")}</section>
    </main>
    <footer>
      SONARA Industries builds launch infrastructure for Business Builder, Creator Studio, and Growth Studio.
      <nav aria-label="Legal">
        ${legalPages().map((page) => `<a href="${escapeHtml(page.href)}">${escapeHtml(page.title)}</a>`).join("")}
      </nav>
    </footer>
    <script>
      document.querySelectorAll("[data-toggle-password]").forEach((button) => {
        button.addEventListener("click", () => {
          const input = document.getElementById(button.getAttribute("data-toggle-password"));
          if (!input) return;
          const hidden = input.type === "password";
          input.type = hidden ? "text" : "password";
          button.textContent = hidden ? "Hide password" : "Show password";
          button.setAttribute("aria-pressed", String(hidden));
        });
      });
    </script>
  </body>
</html>`;
}

function pageShellClass(title, heading, eyebrow) {
  const text = `${title || ""} ${heading || ""} ${eyebrow || ""}`.toLowerCase();
  if (text.includes("business builder")) return "shell-business-builder";
  if (text.includes("creator studio") || text.includes("formula")) return text.includes("formula") ? "shell-formulas" : "shell-creator-studio";
  if (text.includes("growth studio")) return "shell-growth-studio";
  if (text.includes("admin") || text.includes("founder")) return "shell-admin";
  if (text.includes("ecosystem")) return "shell-ecosystem";
  return "shell-sonara";
}

function renderHead(title) {
  return `<meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#11101a">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-title" content="SONARA">
    <meta property="og:title" content="${escapeHtml(title)} | SONARA Industries">
    <meta property="og:site_name" content="SONARA Industries">
    <meta property="og:type" content="website">
    <meta property="og:image" content="/og-image.png">
    <link rel="icon" href="/favicon.ico" sizes="any">
    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    <link rel="apple-touch-icon" href="/icons/icon-180.png">
    <link rel="manifest" href="/site.webmanifest">
    <link rel="stylesheet" href="/sonara-brand-system.css">
    <title>${escapeHtml(title)} | SONARA Industries</title>`;
}

function accountNoticeCard(req) {
  const account = String(req.query?.account || "");
  const login = String(req.query?.login || "");
  if (account === "created") return brandCard("Account created", "You are signed in. Choose Business Builder, Creator Studio, or Growth Studio to start working.");
  if (login === "success") return brandCard("Welcome back", "Your workspace is open and protected by account access.");
  return "";
}

function responsePage(title, body, actions) {
  return layout({ title, eyebrow: "System response", heading: title, body, sections: [], actions });
}

function adminPage(title, body, readiness, metrics = {}) {
  const operations = [
    deploymentCard(),
    brandCard("Users and customers", metrics.users || (readiness.services.supabase === "configured" ? "Supabase-backed profile records are available server-side." : "Setup required: connect Supabase before customer records can be listed.")),
    brandCard("Orders and subscriptions", metrics.subscriptions || (readiness.services.stripe === "configured" ? "Stripe checkout can create paid sessions for configured plans." : "Setup required: Stripe secret key is missing or invalid.")),
    brandCard("Payment updates", metrics.webhookEvents || (readiness.services.supabase === "configured" ? "Webhook audit table is available after migrations are applied." : "Setup required: connect the account database before payment updates can be listed.")),
    brandCard("Contact messages", metrics.supportRequests || (readiness.services.supabase === "configured" ? "Support queue reads from Supabase when service role access is configured." : "Setup required: contact requests use safe fallback references.")),
    brandCard("Product catalog status", metrics.catalog || "Business Builder, Creator Studio, and Growth Studio are registered as SONARA product areas."),
    brandCard("System status", "Health and readiness checks are available without exposing secret values.")
  ];
  return layout({ title, eyebrow: "Founder operations", heading: title, body, sections: [...operations, ...readinessCards(readiness)], actions: adminActions() });
}

function deploymentCard() {
  const deployment = getDeploymentInfo();
  return brandCard("Deployment", `Commit: ${deployment.commitSha}. Branch: ${deployment.branch}. Environment: ${deployment.environment}.`);
}

function adminActions() {
  return [
    linkAction("/admin", "Admin"),
    linkAction("/admin/users", "Users"),
    linkAction("/admin/roles", "Roles"),
    linkAction("/admin/subscriptions", "Subscriptions"),
    linkAction("/admin/webhooks", "Payment updates"),
    linkAction("/admin/support", "Support queue"),
    linkAction("/admin/catalog", "Catalog"),
    linkAction("/admin/system", "System"),
    linkAction("/admin/formulas", "Formulas"),
    linkAction("/admin/ecosystem", "Ecosystem"),
    linkAction("/admin/business-builder", "Business Builder"),
    linkAction("/admin/creator-studio", "Creator Studio"),
    linkAction("/admin/growth-studio", "Growth Studio"),
    adminLogoutAction()
  ];
}

async function adminRowsPage({ title, heading, body, table, query, emptyText, rowTitle, rowBody, extraSections = [], actions }) {
  const rows = await safeListTable(table, query);
  const sections = [...extraSections];
  if (!rows.ok) sections.push(brandCard("Setup required", `${table} rows are unavailable until the account database tables are migrated and service-role server access is configured.`));
  else if (!rows.rows.length) sections.push(brandCard("No rows", emptyText));
  else sections.push(...rows.rows.map((row) => brandCard(rowTitle(row), rowBody(row))));
  return layout({ title, eyebrow: "Founder operations", heading, body, sections, actions });
}

function adminRoleForm() {
  return `<article class="card">
    <h2>Update role</h2>
    <form method="post" action="/admin/roles">
      <label>User ID<input name="userId" type="text" required></label>
      <label>Role<select name="role" required><option value="owner">Owner</option><option value="admin">Admin</option><option value="customer">Customer</option><option value="employee">Employee</option></select></label>
      <label>Action<select name="action" required><option value="grant">Grant role</option><option value="revoke">Revoke role</option></select></label>
      <button type="submit">Update role</button>
    </form>
  </article>`;
}

async function adminProductOperationsPage(req, slug) {
  await recordAdminAuditEvent(req, `admin.${slug.replace(/-/g, "_")}.view`, { path: req.path });
  const config = getProductConfigBySlug(slug);
  const routes = getProductPageDefinitions(slug);
  const summary = slug === "business-builder" ? await getBusinessEmployeeSummary() : undefined;
  const sections = [
    brandCard("Owner/Admin access", "Founder operations can open this workspace for setup, testing, and support without changing customer paid-access rules."),
    brandCard("Free routes", routes.free.map((page) => page.path).join(" / ")),
    brandCard("Paid routes", routes.paid.map((page) => page.path).join(" / ")),
    brandCard("Service setup", productReadinessJson(config.productKey).readiness.checkout === "enabled" ? "Payment connection has at least one enabled checkout plan." : "Some tools unlock after setup or payment.")
  ];
  if (summary) sections.push(brandCard("Employee invites", summary.invites), brandCard("Employee memberships", summary.memberships));
  return layout({
    title: `${config.name} operations`,
    eyebrow: "Founder operations",
    heading: `${config.name} operations`,
    body: "Operational view for founder setup and support. Raw secrets are never displayed.",
    sections,
    actions: [linkAction(`/${slug}/dashboard`, "Open workspace"), ...adminActions()]
  });
}

function getProductConfigBySlug(slug) {
  const map = {
    "business-builder": { name: "Business Builder", productKey: "business_builder" },
    "creator-studio": { name: "Creator Studio", productKey: "creator_studio" },
    "growth-studio": { name: "Growth Studio", productKey: "growth_studio" }
  };
  return map[slug] || { name: slug, productKey: slug.replace(/-/g, "_") };
}

async function getProductModuleCatalogCards() {
  const config = getSupabaseServerConfig();
  if (!config.ok) return [brandCard("Product modules", "Setup required: account database is not configured.")];
  const count = await safeCountTable(config, "product_modules");
  return [brandCard("Product modules", formatMetric("Product modules", count))];
}

function getRouteMapCards() {
  return [
    brandCard("Public routes", "/, /pricing, /contact, /login, /signup, /help, /docs, /security"),
    brandCard("Workspace routes", "/business-builder, /creator-studio, /growth-studio, each with dashboard, free tools, and paid tools"),
    brandCard("Admin routes", "/admin/users, /admin/roles, /admin/subscriptions, /admin/webhooks, /admin/support, /admin/catalog, /admin/system")
  ];
}

function readinessCards(readiness) {
  return Object.entries(readiness.services).map(([key, value]) => brandCard(formatLabel(key), displayStatus(value)));
}

function displayStatus(value) {
  return String(value)
    .replace(/setup_required/g, "Setup required")
    .replace(/review_required/g, "Review required")
    .replace(/_/g, " ")
    .replace(/^./, (char) => char.toUpperCase());
}

function brandCard(title, body) {
  return `<article class="card"><h2>${escapeHtml(title)}</h2><p>${escapeHtml(body)}</p></article>`;
}

function accessCard(access) {
  if (access?.ownerOverride) return brandCard("Owner/Admin access", "Founder operations can open all workspaces for setup, testing, support, and administration. Customer billing rules are unchanged.");
  if (access?.mode === "customer") return brandCard("Free customer access", "Logged-in users can use free tools. Paid tools require confirmed plan access from payment records.");
  return brandCard("Access", "Login is required before protected workspace tools can open.");
}

async function getWorkspaceDashboardSummary(access, productKey) {
  const readiness = getReadiness();
  if (readiness.services.supabase !== "configured") return { ok: false, code: "setup_required", service: "account_database", counts: null, activity: [] };
  const organization = await getCustomerPrimaryOrganization(access?.user);
  if (!organization.ok) return { ok: false, code: organization.code || "organization_membership_missing", service: "organization", counts: null, activity: [] };
  const config = getSupabaseServerConfig();
  if (!config.ok) return { ok: false, code: "setup_required", service: "account_database", counts: null, activity: [] };
  const [intake, checklist, support, activity] = await Promise.all([
    safeCountFiltered(config, "intake_requests", `?organization_id=eq.${encodeURIComponent(organization.organizationId)}&select=id&limit=1`),
    safeCountFiltered(config, "launch_checklist_items", `?organization_id=eq.${encodeURIComponent(organization.organizationId)}&select=id&limit=1`),
    safeCountFiltered(config, "support_requests", `?organization_id=eq.${encodeURIComponent(organization.organizationId)}&select=id&limit=1`),
    safeListTable("activity_events", `?select=event_type,created_at&organization_id=eq.${encodeURIComponent(organization.organizationId)}&order=created_at.desc&limit=6`)
  ]);
  return {
    ok: true,
    productKey,
    organizationId: organization.organizationId,
    counts: { intake, checklist, support },
    activity: activity.ok ? activity.rows : []
  };
}

function workspaceRecordsCard(summary) {
  if (!summary.ok) return brandCard("Records", `Setup required: ${displayStatus(summary.service || summary.code || "account_database")} is not ready.`);
  const counts = summary.counts || {};
  return brandCard("Records", [
    `Intake: ${countLabel(counts.intake)}.`,
    `Checklist: ${countLabel(counts.checklist)}.`,
    `Support: ${countLabel(counts.support)}.`
  ].join(" "));
}

function workspaceActivityCard(summary) {
  if (!summary.ok) return brandCard("Recent activity", "No activity is shown until the account database and organization membership are ready.");
  if (!summary.activity?.length) return brandCard("Recent activity", "No activity yet.");
  return brandCard("Recent activity", summary.activity.map((event) => `${displayStatus(event.event_type || "activity")} ${event.created_at || ""}`.trim()).join(" / "));
}

function countLabel(result) {
  return result?.ok ? String(result.count) : "unavailable";
}

function checklistCard(title, items) {
  return `<article class="card"><h2>${escapeHtml(title)}</h2><p>${items.map((item) => escapeHtml(item)).join(" / ")}</p></article>`;
}

function priceCard(plan, config, planStatus, readiness) {
  if (plan === "free") return brandCard(`${config.name} - ${config.price}`, `${config.description} No checkout required.`);
  const enabled = planStatus.checkout === "enabled";
  const setupText = getPriceCardSetupText(planStatus, readiness);
  return `<article class="card">
    <h2>${escapeHtml(`${config.name} - ${config.price}`)}</h2>
    <p>${escapeHtml(`${config.description} ${enabled ? "Checkout available." : setupText}`)}</p>
    <form method="post" action="/api/checkout/session">
      <input type="hidden" name="plan" value="${escapeHtml(plan)}">
      <button type="submit">${enabled ? "Start checkout" : "Checkout setup required"}</button>
    </form>
  </article>`;
}

function billingPanel(readiness, billing) {
  const planForms = Object.entries(STRIPE_PLANS)
    .filter(([plan]) => plan !== "free")
    .map(([plan, config]) => `<form method="post" action="/api/billing/create-checkout-session">
      <input type="hidden" name="plan" value="${escapeHtml(plan)}">
      <button type="submit">${escapeHtml(`Upgrade: ${config.name}`)}</button>
    </form>`)
    .join("");
  return `<article class="card">
    <h2>Billing actions</h2>
    <p>${escapeHtml(readiness.services.checkout === "enabled" ? "Checkout can start for configured plans." : "Checkout setup required before paid plans can be purchased.")}</p>
    ${planForms}
    <form method="post" action="/api/billing/create-portal-session">
      <button type="submit">Manage billing portal</button>
    </form>
    <p class="fine">${escapeHtml(billing.rows?.length ? "Current records come from the account database." : "No billing records returned yet.")}</p>
  </article>`;
}

function getPriceCardSetupText(planStatus, readiness) {
  if (readiness.services.stripe !== "configured") return "Checkout setup required: payment connection is missing or invalid.";
  if (planStatus.reason === "missing") return "Checkout is not configured for this plan yet.";
  if (planStatus.reason === "invalid_placeholder") return "Checkout setup required: plan price settings are placeholders.";
  if (planStatus.reason === "invalid_prefix") return "Checkout setup required: plan price settings are invalid.";
  return "Checkout setup required.";
}

function linkAction(href, label) {
  return `<a class="action" href="${escapeHtml(href)}">${escapeHtml(label)}</a>`;
}

function adminLogoutAction() {
  return `<form method="post" action="/admin/logout"><button class="action" type="submit">Logout</button></form>`;
}

function logoutAction() {
  return `<form method="post" action="/logout"><button class="action" type="submit">Logout</button></form>`;
}

function adminLoginForm() {
  const inputId = "admin-founder-password";
  return `<article class="card">
    <h2>Protected access</h2>
    <form method="post" action="/admin/login">
      <label>Founder email<input name="email" type="email" autocomplete="username" required></label>
      <label>Password<input id="${inputId}" name="password" type="password" autocomplete="current-password" required></label>
      <button type="button" data-toggle-password="${inputId}" aria-controls="${inputId}" aria-pressed="false">Show password</button>
      <button type="submit">Sign in to admin</button>
    </form>
  </article>`;
}

function businessEmployeeInviteForm() {
  return `<article class="card">
    <h2>Create employee invite</h2>
    <form method="post" action="/api/business-builder/employees/invite">
      <label>Workspace ID<input name="workspaceId" type="text" required></label>
      <label>Organization ID<input name="organizationId" type="text" required></label>
      <label>Employee name<input name="name" type="text" required></label>
      <label>Employee email<input name="email" type="email" required></label>
      <label>Role<select name="role" required><option value="employee">Employee</option><option value="manager">Manager</option></select></label>
      <label>Permissions<input name="permissions" type="text" aria-label="Permissions such as intake, records, readiness"></label>
      <p class="fine">Do not enter an employee password. Employees set their own password through the invite flow.</p>
      <button type="submit">Create invite</button>
    </form>
  </article>`;
}

function businessEmployeeAcceptForm() {
  const inputId = "business-employee-password";
  return `<article class="card">
    <h2>Set employee password</h2>
    <form method="post" action="/business-builder/invite/accept">
      <label>Invite token<input name="token" type="text" required></label>
      <label>Email<input name="email" type="email" required></label>
      <label>Password<input id="${inputId}" name="password" type="password" required></label>
      <button type="button" data-toggle-password="${inputId}" aria-controls="${inputId}" aria-pressed="false">Show password</button>
      <button type="submit">Accept invite</button>
    </form>
  </article>`;
}

function contactForm() {
  return `<article class="card">
    <h2>Request intake</h2>
    <form method="post" action="/contact">
      <label>Name<input name="name" type="text" required></label>
      <label>Work email<input name="email" type="email" required></label>
      <label>Subject<input name="subject" type="text" required></label>
      <select name="category" required>
        <option value="contact">Contact</option>
        <option value="support">Support</option>
        <option value="billing">Billing</option>
        <option value="feedback">Feedback</option>
      </select>
      <label>Launch context<textarea name="message" rows="6" required></textarea></label>
      <label class="fine"><input name="consent" type="checkbox" value="yes" required> Consent to process this request</label>
      <button type="submit">Submit request</button>
    </form>
  </article>`;
}

function businessOfferForm() {
  return `<article class="card">
    <h2>Offer Builder</h2>
    <form method="post" action="/api/business-builder/offers">
      <label>Service type<input name="serviceType" type="text" required></label>
      <label>Audience<input name="audience" type="text" required></label>
      <label>Price idea<input name="priceIdea" type="text" required></label>
      <label>Deliverables<textarea name="deliverables" rows="4" required></textarea></label>
      <label>Proof points<textarea name="proofPoints" rows="4"></textarea></label>
      <button type="submit">Create offer draft</button>
    </form>
  </article>`;
}

function businessIntakeForm() {
  return `<article class="card">
    <h2>Intake request</h2>
    <form method="post" action="/api/business-builder/intake">
      <label>Name<input name="name" type="text" required></label>
      <label>Email<input name="email" type="email" required></label>
      <label>Service interest<input name="serviceInterest" type="text" required></label>
      <label>Message<textarea name="message" rows="5" required></textarea></label>
      <button type="submit">Record intake</button>
    </form>
  </article>`;
}

function businessChecklistCard() {
  return checklistCard("Launch Setup Checklist", ["Business profile", "Offer", "Intake", "Pricing", "Payment", "Support", "Legal", "Analytics"]);
}

function creatorAssetForm() {
  return `<article class="card">
    <h2>Asset record</h2>
    <form method="post" action="/api/creator-studio/assets">
      <label>Title<input name="title" type="text" required></label>
      <label>Type<input name="type" type="text" required></label>
      <label>Platform<input name="platform" type="text" required></label>
      <label>Status<input name="status" type="text" required></label>
      <label>Rights notes<textarea name="rightsNotes" rows="5" required></textarea></label>
      <button type="submit">Create asset record</button>
    </form>
  </article>`;
}

function creatorOfferForm() {
  return `<article class="card">
    <h2>Creator offer</h2>
    <form method="post" action="/api/creator-studio/offers">
      <label>Offer type<input name="offerType" type="text" required></label>
      <label>Audience<input name="audience" type="text" required></label>
      <label>Deliverables<textarea name="deliverables" rows="4" required></textarea></label>
      <label>Price idea<input name="priceIdea" type="text" required></label>
      <button type="submit">Create creator offer</button>
    </form>
  </article>`;
}

function growthCampaignForm() {
  return `<article class="card">
    <h2>Campaign plan</h2>
    <form method="post" action="/api/growth-studio/campaigns">
      <label>Goal<input name="goal" type="text" required></label>
      <label>Audience<input name="audience" type="text" required></label>
      <label>Offer<input name="offer" type="text" required></label>
      <label>Channel<input name="channel" type="text" required></label>
      <label>Timeline<input name="timeline" type="text" required></label>
      <button type="submit">Create campaign plan</button>
    </form>
  </article>`;
}

function growthLeadForm() {
  return `<article class="card">
    <h2>Lead follow-up</h2>
    <form method="post" action="/api/growth-studio/leads">
      <label>Name<input name="name" type="text" required></label>
      <label>Email<input name="email" type="email" required></label>
      <label>Source<input name="source" type="text" required></label>
      <label>Consent status<input name="consentStatus" type="text" required></label>
      <button type="submit">Create follow-up plan</button>
    </form>
  </article>`;
}

function authForm(label, action) {
  const inputId = `password-${crypto.createHash("sha1").update(action).digest("hex").slice(0, 8)}`;
  return `<article class="card">
    <h2>${escapeHtml(label)}</h2>
    <form method="post" action="${escapeHtml(action)}">
      <label>Email<input name="email" type="email" required></label>
      <label>Password<input id="${inputId}" name="password" type="password" required></label>
      <button type="button" data-toggle-password="${inputId}" aria-controls="${inputId}" aria-pressed="false">Show password</button>
      <button type="submit">${escapeHtml(label)}</button>
    </form>
  </article>`;
}

function accountSetupCards() {
  return [
    brandCard("Organization name", "Required after account access is configured."),
    brandCard("Product path", "Choose Business Builder, Creator Studio, Growth Studio, or all three."),
    brandCard("First offer", "Draft the first offer before checkout activation."),
    brandCard("Contact email", "Confirm the support and customer contact address."),
    brandCard("Payment readiness", "Connect Stripe to enable checkout."),
    brandCard("Support preference", "Connect the account database and email delivery to enable the support queue.")
  ];
}

function legalPage(res, title, points) {
  return res.status(200).type("html").send(
    layout({
      title,
      eyebrow: "Legal",
      heading: title,
      body: "Owner-review-required draft for SONARA Industries production launch. This page requires qualified legal review before paid public launch and is not legal advice.",
      sections: points.map((point, index) => Array.isArray(point) ? brandCard(point[0], point[1]) : brandCard(`Section ${index + 1}`, point)),
      actions: [linkAction("/", "Home"), linkAction("/contact", "Contact")]
    })
  );
}

function legalPages() {
  return [
    { href: "/legal/terms", title: "Terms of Service", points: ["SONARA Industries provides launch, creator, and growth software tools on an as-is operational basis.", "Users are responsible for lawful use, accurate business information, and approval of outbound actions.", "Production actions may require human review, configured providers, and audit-ready records."] },
    { href: "/legal/privacy", title: "Privacy Policy", points: ["SONARA Industries collects account, contact, support, and operational records needed to provide the service.", "Server-side credentials and provider secrets are not exposed to public clients.", "Customer data should be handled according to consent, retention, and organization access controls."] },
    { href: "/legal/refund-policy", title: "Refund Policy", points: ["Subscription and setup refund requests are reviewed based on plan terms, usage, and delivered work.", "Approved refunds are returned through the original payment provider when available.", "Chargeback, fraud, or abuse cases may require additional review."] },
    { href: "/legal/cookie-policy", title: "Cookie Policy", points: ["SONARA Industries may use essential cookies for session, security, and application stability.", "Analytics or marketing cookies should remain disabled until configured with disclosure and consent controls.", "Browser settings may be used to limit non-essential storage."] },
    { href: "/legal/acceptable-use", title: "Acceptable Use", points: ["Do not use SONARA Industries for spam, credential capture, unlawful surveillance, piracy, or unsafe automation.", "AI-assisted outbound actions require preview, approval, and audit records.", "Voice, media, and creator tools require consent, provenance, and anti-clone safety."] },
    { href: "/legal/accessibility", title: "Accessibility", points: ["SONARA Industries aims to provide clear navigation, readable layouts, and keyboard-accessible workflows.", "Accessibility issues can be reported through the contact route for review.", "Launch pages should remain usable without requiring animated or media-heavy experiences."] },
    { href: "/legal/earnings-disclaimer", title: "Earnings Disclaimer", points: ["Pricing, launch tools, and campaign planning do not guarantee revenue.", "Results depend on market demand, offer quality, audience, execution, and provider setup.", "Any examples require owner review before public use."] },
    { href: "/legal/ai-disclaimer", title: "AI and Tooling Disclaimer", points: ["Automated or assisted outputs require human review before use.", "The system must not be used to make deceptive claims or unsafe outbound actions.", "AI-assisted output should be checked for accuracy, rights, and provenance."] },
    { href: "/legal/payment-terms", title: "Payment Terms", points: ["Stripe checkout activates only after owner configuration.", "Refunds, chargebacks, failed payments, and subscription changes require provider and owner review.", "Stripe restricted-business rules and payment-network rules apply."] },
    { href: "/legal/data-processing", title: "Data Processing", points: ["Customer, support, billing, and module records may be processed to provide the service.", "Service-role credentials are server-only and must not be exposed to clients.", "Third-party processors may include Supabase, Vercel, Stripe, Resend, and analytics providers when configured."] },
    { href: "/legal/security-policy", title: "Security Policy", points: ["Report security issues through the contact route or configured support address.", "Do not submit secrets through public forms.", "Admin routes require protected access and should be replaced with full OAuth/session admin auth before broader operator access."] },
    { href: "/legal/disclaimer", title: "General Disclaimer", points: ["SONARA Industries provides operational software and setup tools, not legal, tax, financial, or business guarantees.", "Customers remain responsible for reviewing outputs before use.", "No revenue, customer, or compliance outcome is guaranteed."] },
    { href: "/legal/can-spam", title: "Commercial Email Reminder", points: ["Commercial email should use truthful subject and from information.", "Include unsubscribe language and a physical mailing address when required.", "Keep consent and audience-source notes before outreach."] },
    { href: "/legal/subprocessor-notice", title: "Subprocessor Notice", points: [["Service providers", "This template explains how SONARA Industries may use subprocessors for hosting, payments, email delivery, analytics, authentication, monitoring, and support operations."], ["Data handling", "Subprocessors should receive only the data needed to operate the service, subject to provider terms, contracts, and production configuration."], ["Review required", "This is a legal template and requires qualified legal review before production use. It is not legal advice."]] }
  ];
}

function legalAliasPages() {
  const byHref = Object.fromEntries(legalPages().map((page) => [page.href, page]));
  return [
    { href: "/terms", source: "/legal/terms" },
    { href: "/privacy", source: "/legal/privacy" },
    { href: "/refund-policy", source: "/legal/refund-policy" },
    { href: "/cookies", source: "/legal/cookie-policy" },
    { href: "/acceptable-use", source: "/legal/acceptable-use" },
    { href: "/accessibility", source: "/legal/accessibility" },
    { href: "/earnings-disclaimer", source: "/legal/earnings-disclaimer" },
    { href: "/subprocessor-notice", source: "/legal/subprocessor-notice" }
  ].map((alias) => ({ ...byHref[alias.source], href: alias.href }));
}

function normalizeSupportRequest(body) {
  const category = String(body.category || "contact").trim();
  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim();
  const subject = String(body.subject || "").trim();
  const message = String(body.message || "").trim();
  const consent = body.consent === "yes" || body.consent === "on" || body.consent === true;
  if (!["contact", "support", "billing", "feedback"].includes(category)) return { ok: false, message: "Choose a valid request type." };
  if (name.length < 2) return { ok: false, message: "Enter your name." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, message: "Enter a valid email address." };
  if (subject.length < 3) return { ok: false, message: "Enter a subject." };
  if (message.length < 10 || message.length > 4000) return { ok: false, message: "Enter a message between 10 and 4000 characters." };
  if (!consent) return { ok: false, message: "Consent is required before submitting a request." };
  return { ok: true, value: { category, name, email, subject, message } };
}

async function saveSupportRequest(request) {
  const referenceId = randomUUID();
  let stored = false;
  let supportRequestId;

  const insert = await safeInsertSupportRequest({
    reference_id: referenceId,
    category: request.category === "billing" ? "support" : request.category,
    requester_email: request.email,
    message_preview: redactSensitiveText(`${request.name} - ${request.subject}: ${request.message}`).slice(0, 280),
    consent_accepted: true,
    metadata: { source: "express_contact", subject: request.subject, name: request.name }
  });

  if (insert.ok) {
    stored = true;
    supportRequestId = insert.rows[0]?.id;
  }

  const email = await sendSupportNotification({ ...request, referenceId });
  if (supportRequestId) await updateSupportEmailStatus(supportRequestId, email);

  if (stored && email.ok) return { ok: true, referenceId, status: "received", message: `Your request was received. Reference ID: ${referenceId}. Email notification: sent.` };
  if (stored && !email.ok) return { ok: true, referenceId, status: "email_notification_failed", message: `Your request was received. Reference ID: ${referenceId}. Email notification failed and remains queued.` };
  return { ok: true, referenceId, status: "setup_required", message: `Setup required: the account database is not configured, so the request used the safe fallback queue. Reference ID: ${referenceId}.` };
}

async function sendSupportNotification(request) {
  if (getReadiness().services.emailDelivery !== "enabled") return { ok: false, error: "resend_not_configured" };
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${getEnv("RESEND_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: getEnv("RESEND_FROM_EMAIL"),
      to: [getEnv(["SUPPORT_TO_EMAIL", "CONTACT_TO_EMAIL"])],
      subject: `SONARA support request ${request.referenceId}: ${request.subject}`,
      text: [`Reference ID: ${request.referenceId}`, `Category: ${request.category}`, `Name: ${request.name}`, `Requester: ${request.email}`, "", redactSensitiveText(request.message)].join("\n")
    })
  }).catch(() => undefined);
  return response?.ok ? { ok: true } : { ok: false, error: `resend_${response?.status || "unavailable"}` };
}

async function createBusinessEmployeeInvite(req) {
  const body = req.body || {};
  if (body.password || body.employeePassword || body.temporaryPassword) {
    return { status: 400, body: { ok: false, code: "password_not_allowed", message: "Owners cannot create or submit employee passwords." } };
  }

  const workspaceId = String(body.workspaceId || body.workspace_id || req.sonaraBusinessMembership?.workspace_id || "").trim();
  const organizationId = String(body.organizationId || body.organization_id || req.sonaraBusinessMembership?.organization_id || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const name = String(body.name || body.invitedName || "").trim();
  const role = String(body.role || "employee").trim();
  const permissions = splitList(body.permissions || "");

  if (!workspaceId || !organizationId) return { status: 400, body: { ok: false, code: "validation_failed", message: "Workspace ID and organization ID are required." } };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { status: 400, body: { ok: false, code: "validation_failed", message: "Enter a valid employee email." } };
  if (name.length < 2) return { status: 400, body: { ok: false, code: "validation_failed", message: "Enter the employee name." } };
  if (!["manager", "employee"].includes(role)) return { status: 400, body: { ok: false, code: "validation_failed", message: "Choose manager or employee." } };

  const config = getSupabaseAdminClient();
  if (!config.ok) return { status: 503, body: { ok: false, code: "setup_required", service: "supabase" } };

  const rawToken = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hashInviteToken(rawToken);
  const expiresAt = new Date(Date.now() + EMPLOYEE_INVITE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const response = await fetch(`${config.url}/rest/v1/business_employee_invites`, {
    method: "POST",
    headers: supabaseHeaders(config, { prefer: "return=representation" }),
    body: JSON.stringify({
      organization_id: organizationId,
      workspace_id: workspaceId,
      invited_email: email,
      invited_name: name,
      role,
      permissions,
      status: "pending",
      token_hash: tokenHash,
      expires_at: expiresAt,
      created_by_user_id: req.sonaraUser?.id || null
    })
  }).catch(() => undefined);

  if (!response?.ok) return { status: 502, body: { ok: false, code: "invite_not_recorded", message: "Employee invite could not be recorded." } };
  const rows = await response.json().catch(() => []);
  const invite = rows[0] || {};
  const inviteUrl = `${getPublicAppUrl(req)}/business-builder/invite/accept?token=${encodeURIComponent(rawToken)}`;
  const emailResult = await sendBusinessInviteEmail({ email, name, role, inviteUrl });
  await recordAdminAuditEvent(req, "business.employee_invite.created", { target_type: "business_employee_invite", target_id: invite.id || "pending", workspace_id: workspaceId, email_domain: email.split("@")[1] || "unknown", email_delivery: emailResult.ok ? "sent" : "setup_required" });

  return {
    status: 200,
    body: {
      ok: true,
      code: "invite_recorded",
      inviteId: invite.id,
      delivery: emailResult.ok ? "email_sent" : "setup_required",
      message: emailResult.ok
        ? "Employee invite recorded and email delivery was requested."
        : "Employee invite recorded. Email delivery setup is required before invite email delivery is available."
    }
  };
}

async function acceptBusinessEmployeeInvite(body) {
  const token = String(body.token || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (!token || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8) {
    return { status: 400, body: { ok: false, code: "validation_failed", message: "Invite token, valid email, and an 8+ character password are required." } };
  }
  if (!isSupabaseConfigured()) return { status: 503, body: { ok: false, code: "setup_required", service: "supabase_auth" } };

  const config = getSupabaseAdminClient();
  const inviteResponse = await fetch(`${config.url}/rest/v1/business_employee_invites?select=id,organization_id,workspace_id,role,status,expires_at,invited_email&token_hash=eq.${encodeURIComponent(hashInviteToken(token))}&status=eq.pending&limit=1`, {
    headers: supabaseHeaders(config)
  }).catch(() => undefined);
  if (!inviteResponse?.ok) return { status: 502, body: { ok: false, code: "invite_lookup_failed" } };
  const invites = await inviteResponse.json().catch(() => []);
  const invite = invites[0];
  if (!invite) return { status: 404, body: { ok: false, code: "invite_not_found" } };
  if (String(invite.invited_email || "").toLowerCase() !== email) return { status: 403, body: { ok: false, code: "invite_email_mismatch" } };
  if (new Date(invite.expires_at).getTime() <= Date.now()) return { status: 410, body: { ok: false, code: "invite_expired" } };

  const auth = await createEmployeeAuthUser(email, password);
  if (!auth.ok || !auth.userId) return { status: auth.status || 502, body: { ok: false, code: auth.code || "auth_not_completed" } };

  const membership = await fetch(`${config.url}/rest/v1/business_memberships?on_conflict=workspace_id,user_id`, {
    method: "POST",
    headers: supabaseHeaders(config, { prefer: "resolution=merge-duplicates" }),
    body: JSON.stringify({
      organization_id: invite.organization_id,
      workspace_id: invite.workspace_id,
      user_id: auth.userId,
      role: invite.role,
      status: "active"
    })
  }).catch(() => undefined);
  if (!membership?.ok) return { status: 502, body: { ok: false, code: "membership_not_recorded" } };

  await fetch(`${config.url}/rest/v1/business_employee_invites?id=eq.${encodeURIComponent(invite.id)}`, {
    method: "PATCH",
    headers: supabaseHeaders(config),
    body: JSON.stringify({ status: "accepted", accepted_by_user_id: auth.userId, accepted_at: new Date().toISOString() })
  }).catch(() => undefined);

  return { status: 200, body: { ok: true, code: "invite_accepted", message: "Invite accepted. Use Business Builder login with your email and password." } };
}

async function createEmployeeAuthUser(email, password) {
  const config = getSupabaseServerClient();
  const anonKey = getEnv(["SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]);
  if (!config.ok || !anonKey) return { ok: false, status: 503, code: "setup_required" };
  const response = await fetch(`${config.url}/auth/v1/signup`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email, password })
  }).catch(() => undefined);
  if (!response?.ok) return { ok: false, status: 401, code: "auth_not_completed" };
  const payload = await response.json().catch(() => ({}));
  const userId = payload.user?.id || payload.id;
  return { ok: Boolean(userId), userId };
}

async function sendBusinessInviteEmail({ email, name, role, inviteUrl }) {
  if (getReadiness().services.emailDelivery !== "enabled") return { ok: false, error: "resend_not_configured" };
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${getEnv("RESEND_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: getEnv("RESEND_FROM_EMAIL"),
      to: [email],
      subject: "Business Builder employee invite",
      text: [`Hello ${name},`, "", `You were invited as a Business Builder ${role}.`, "Set your own password using this secure invite link:", inviteUrl, "", "If you did not expect this invite, ignore this email."].join("\n")
    })
  }).catch(() => undefined);
  return response?.ok ? { ok: true } : { ok: false, error: `resend_${response?.status || "unavailable"}` };
}

function hashInviteToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function getReadiness() {
  const supabaseStatus = getSupabaseReadinessStatus();
  const supabaseAuthStatus = getSupabaseAuthReadinessStatus();
  const resendStatus = getResendStatus();
  const googleOAuth = missingEnvGroups([
    ["GOOGLE_CLIENT_ID"],
    ["GOOGLE_CLIENT_SECRET"],
    ["GOOGLE_REDIRECT_URI"],
    ["PUBLIC_SITE_URL", "NEXT_PUBLIC_SITE_URL", "NEXT_PUBLIC_APP_URL", "APP_URL"]
  ]);
  const serviceRoleStatus = getSecretValueStatus("SUPABASE_SERVICE_ROLE_KEY");
  const founderAccessStatus = getFounderAccessStatus();
  const adminProtectionStatus = getAdminProtectionStatus(supabaseAuthStatus, founderAccessStatus, serviceRoleStatus);
  const stripeSecret = getStripeSecretStatus();
  const stripeWebhook = getStripeWebhookStatus();
  const checkoutPlans = getCheckoutPlanStatuses();
  const enabledPlanCount = Object.entries(checkoutPlans).filter(([plan, status]) => plan !== "free" && status.checkout === "enabled").length;
  const stripeMissing = [];
  if (stripeSecret.status === "missing") stripeMissing.push("STRIPE_SECRET_KEY");
  if (stripeWebhook.status === "missing") stripeMissing.push("STRIPE_WEBHOOK_SECRET");
  for (const planStatus of Object.values(checkoutPlans)) {
    if (planStatus.env && planStatus.reason === "missing") stripeMissing.push(planStatus.env);
  }
  const services = {
    supabase: supabaseStatus.status,
    stripe: stripeSecret.status === "configured" ? "configured" : stripeSecret.status === "missing" ? "missing" : "invalid",
    stripeWebhook: stripeWebhook.status === "configured" ? "configured" : stripeWebhook.status === "missing" ? "missing" : "invalid",
    resend: resendStatus.status,
    googleOAuth: "deferred",
    adminProtection: adminProtectionStatus.status,
    legalPages: "review_required",
    checkout: enabledPlanCount ? "enabled" : "setup_required",
    emailDelivery: resendStatus.status === "configured" ? "enabled" : resendStatus.status === "missing" ? "setup_required" : "invalid",
    accountDatabase: supabaseStatus.status,
    paymentConnection: stripeSecret.status === "configured" ? "configured" : stripeSecret.status === "missing" ? "missing" : "invalid",
    paymentUpdates: stripeWebhook.status === "configured" ? "configured" : stripeWebhook.status === "missing" ? "missing" : "invalid",
    googleSignIn: "deferred",
    founderAccess: founderAccessStatus.status
  };
  return {
    ok: true,
    accountDatabase: services.accountDatabase,
    paymentConnection: services.paymentConnection,
    paymentUpdates: services.paymentUpdates,
    emailDelivery: resendStatus.status,
    googleSignIn: services.googleSignIn,
    founderAccess: services.founderAccess,
    services,
    checkoutPlans,
    missing: { supabase: supabaseStatus.missing, stripe: stripeMissing, resend: resendStatus.missing, googleOAuth, adminProtection: adminProtectionStatus.missing },
    invalid: { supabase: supabaseStatus.invalid, stripe: getInvalidStripeEnvStatuses(), resend: resendStatus.invalid, founderAccess: founderAccessStatus.invalid, adminProtection: adminProtectionStatus.invalid }
  };
}

function getAdminEnvReadiness() {
  const supabaseAuth = getSupabaseAuthReadinessStatus();
  const adminSource = getAdminAuthorizationSourceStatus();
  const serviceRole = getSecretValueStatus("SUPABASE_SERVICE_ROLE_KEY");
  const resend = getResendStatus();
  return [
    readinessItem("SUPABASE_AUTH", "Supabase email login", supabaseAuth.status, "Supabase auth is not configured."),
    readinessItem("ADMIN_ACCESS_SOURCE", "Founder email allowlist or user_roles", adminSource.status, "Configure an admin/founder email allowlist or the service role key for user_roles lookup."),
    ...Object.entries(STRIPE_PLANS)
      .filter(([, config]) => config.env)
      .map(([plan, config]) => {
        const status = getStripePlanPriceStatus(plan);
        return readinessItem(config.env, getPlanEnvLabel(config), status.status, getStripePriceWarning(status));
      }),
    readinessItem("STRIPE_SECRET_KEY", "STRIPE_SECRET_KEY", getStripeSecretStatus().status, "Stripe secret key should start with sk_live_ or sk_test_."),
    readinessItem("STRIPE_WEBHOOK_SECRET", "STRIPE_WEBHOOK_SECRET", getStripeWebhookStatus().status, "Stripe webhook secret should start with whsec_."),
    readinessItem("SUPABASE_URL", "SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL", getSupabaseUrlStatus().status, "Supabase URL should start with https:// and include .supabase.co."),
    readinessItem("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE_KEY", serviceRole.status, "Server-only service role key is required for admin database metrics and durable user_roles lookup."),
    readinessItem("RESEND_API_KEY", "Email delivery key", getResendApiKeyStatus().status, "Email delivery key is missing or looks like a placeholder."),
    readinessItem("RESEND_FROM_EMAIL", "Email sender", getEmailValueStatus("RESEND_FROM_EMAIL").status, "Email sender is missing or invalid.")
  ];
}

function readinessItem(key, label, status, warning) {
  const normalized = status === "invalid_prefix" || status === "invalid_placeholder" ? "invalid" : status;
  return { key, label, ok: normalized === "configured", status: normalized, warning: normalized === "invalid" ? "Invalid placeholder" : warning };
}

function adminReadinessText(item) {
  if (item.status === "configured") return "Configured";
  if (item.status === "invalid") return "Invalid placeholder";
  if (item.status === "missing") return "Missing";
  return item.warning || displayStatus(item.status || "setup_required");
}

function getSupabaseReadinessStatus() {
  return combineEnvStatuses([
    { env: "SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL", ...getSupabaseUrlStatus() },
    { env: "SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY", ...getSecretValueStatus(["SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]) },
    { env: "SUPABASE_SERVICE_ROLE_KEY", ...getSecretValueStatus("SUPABASE_SERVICE_ROLE_KEY") }
  ]);
}

function getSupabaseAuthReadinessStatus() {
  return combineEnvStatuses([
    { env: "SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL", ...getSupabaseUrlStatus() },
    { env: "SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY", ...getSecretValueStatus(["SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]) }
  ]);
}

function getSupabaseUrlStatus() {
  const value = getEnv(["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"]);
  if (!value) return { status: "missing" };
  if (isPlaceholderValue(value) || !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(value)) return { status: "invalid" };
  return { status: "configured" };
}

function getResendStatus() {
  return combineEnvStatuses([
    { env: "RESEND_API_KEY", ...getResendApiKeyStatus() },
    { env: "RESEND_FROM_EMAIL", ...getEmailValueStatus("RESEND_FROM_EMAIL") }
  ]);
}

function getResendApiKeyStatus() {
  const value = getEnv("RESEND_API_KEY");
  if (!value) return { status: "missing" };
  if (isPlaceholderValue(value) || value.length < 12) return { status: "invalid" };
  return { status: "configured" };
}

function getEmailValueStatus(name) {
  const value = getEnv(name);
  if (!value) return { status: "missing" };
  if (!isEmailLike(value) || isPlaceholderEmail(value)) return { status: "invalid" };
  return { status: "configured" };
}

function getSecretValueStatus(names) {
  const value = getEnv(names);
  if (!value) return { status: "missing" };
  if (isPlaceholderValue(value) || value.length < 12) return { status: "invalid" };
  return { status: "configured" };
}

function getFounderAccessStatus() {
  const rawEmails = splitList([getEnv("FOUNDER_EMAILS"), getEnv("ADMIN_EMAILS"), getEnv("ADMIN_EMAIL")].filter(Boolean).join(","));
  if (!rawEmails.length) return { status: "missing", missing: ["FOUNDER_EMAILS or ADMIN_EMAILS"] };
  const valid = rawEmails.filter((email) => isEmailLike(email) && !isPlaceholderEmail(email));
  if (!valid.length) return { status: "invalid", invalid: ["FOUNDER_EMAILS or ADMIN_EMAILS"] };
  return { status: "configured", missing: [], invalid: [] };
}

function getAdminAuthorizationSourceStatus() {
  const founder = getFounderAccessStatus();
  const serviceRole = getSecretValueStatus("SUPABASE_SERVICE_ROLE_KEY");
  if (founder.status === "configured" || serviceRole.status === "configured") return { status: "configured" };
  if (founder.status === "invalid" || serviceRole.status === "invalid") return { status: "invalid" };
  return { status: "missing" };
}

function getAdminProtectionStatus(authStatus, founderStatus, serviceRoleStatus) {
  const adminSourceConfigured = founderStatus.status === "configured" || serviceRoleStatus.status === "configured";
  const missing = [];
  const invalid = [];
  if (authStatus.status === "missing") missing.push("Supabase auth");
  if (authStatus.status === "invalid") invalid.push("Supabase auth");
  if (!adminSourceConfigured) {
    if (founderStatus.status === "invalid" || serviceRoleStatus.status === "invalid") invalid.push("Founder access source");
    else missing.push("Founder access source");
  }
  if (invalid.length) return { status: "invalid", missing, invalid };
  if (missing.length) return { status: "missing", missing, invalid };
  return { status: "configured", missing, invalid };
}

function combineEnvStatuses(items) {
  const missing = items.filter((item) => item.status === "missing").map((item) => item.env);
  const invalid = items.filter((item) => item.status === "invalid").map((item) => item.env);
  return {
    status: invalid.length ? "invalid" : missing.length ? "missing" : "configured",
    missing,
    invalid
  };
}

function getStripePriceWarning(status) {
  if (status.status === "missing") return `${status.env} is missing.`;
  if (status.status === "invalid_placeholder") return `${status.env} looks like a placeholder.`;
  if (status.status === "invalid_prefix") return `${status.env} must start with price_; it must not use secret, product, or customer IDs.`;
  return "Stripe price ID should start with price_.";
}

function getStripeSecretStatus() {
  const value = getEnv("STRIPE_SECRET_KEY");
  if (!value) return { status: "missing" };
  if (isPlaceholderValue(value)) return { status: "invalid_placeholder" };
  if (!startsWithAny(value, ["sk_live_", "sk_test_"])) return { status: "invalid_prefix" };
  return { status: "configured" };
}

function getStripeWebhookStatus() {
  const value = getEnv("STRIPE_WEBHOOK_SECRET");
  if (!value) return { status: "missing" };
  if (isPlaceholderValue(value)) return { status: "invalid_placeholder" };
  if (!value.startsWith("whsec_")) return { status: "invalid_prefix" };
  return { status: "configured" };
}

function getStripePlanPriceStatus(plan) {
  const config = STRIPE_PLANS[plan];
  if (!config?.env) return { status: "not_required", checkout: "enabled", env: undefined, reason: "not_required" };
  const envNames = getPlanEnvNames(config);
  const value = getEnv(envNames);
  const envLabel = envNames.join(" or ");
  if (!value) return { status: "missing", checkout: "setup_required", env: envLabel, reason: "missing" };
  if (isPlaceholderValue(value)) return { status: "invalid_placeholder", checkout: "setup_required", env: envLabel, reason: "invalid_placeholder" };
  if (!isStripePriceId(value)) return { status: "invalid_prefix", checkout: "setup_required", env: envLabel, reason: "invalid_prefix" };
  return { status: "configured", checkout: getStripeSecretStatus().status === "configured" ? "enabled" : "setup_required", env: envLabel, reason: "configured", priceId: value };
}

function getCheckoutPlanStatuses() {
  return Object.fromEntries(Object.keys(STRIPE_PLANS).map((plan) => {
    const status = getStripePlanPriceStatus(plan);
    return [plan, { checkout: status.checkout, env: status.env, reason: status.reason }];
  }));
}

function getInvalidStripeEnvStatuses() {
  const statuses = [];
  const secret = getStripeSecretStatus();
  const webhook = getStripeWebhookStatus();
  if (secret.status.startsWith("invalid")) statuses.push({ env: "STRIPE_SECRET_KEY", reason: secret.status });
  if (webhook.status.startsWith("invalid")) statuses.push({ env: "STRIPE_WEBHOOK_SECRET", reason: webhook.status });
  for (const plan of Object.keys(STRIPE_PLANS)) {
    const status = getStripePlanPriceStatus(plan);
    if (status.status.startsWith("invalid")) statuses.push({ env: status.env, reason: status.status });
  }
  return statuses;
}

function isStripePriceId(value) {
  return String(value || "").startsWith("price_") && !isPlaceholderValue(value);
}

function startsWithAny(value, prefixes) {
  return prefixes.some((prefix) => String(value || "").startsWith(prefix));
}

function isPlaceholderValue(value) {
  const raw = String(value || "").trim();
  const normalized = raw.toLowerCase();
  if (!normalized) return true;
  if (normalized.includes("...")) return true;
  if (["changeme", "change-me", "replace-me", "todo"].includes(normalized)) return true;
  return /(^|[_\-\s])(placeholder|dummy|fake|xxx|your|sample|example|must[_-]?not[_-]?render)([_\-\s]|$)/i.test(normalized)
    || /^price_(test|xxx|placeholder|example|your)/i.test(normalized)
    || /^sk_(test|live)_(test|xxx|placeholder|example|your)/i.test(normalized)
    || /^whsec_(test|xxx|placeholder|example|your)/i.test(normalized);
}

function isEmailLike(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function isPlaceholderEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  return isPlaceholderValue(email) || ["your-email@example.com", "you@example.com"].includes(email);
}

function getPlanEnvNames(config) {
  return [config.env, ...(config.envAliases || [])].filter(Boolean);
}

function getPlanEnvLabel(config) {
  return getPlanEnvNames(config).join(" / ");
}

function isSupabaseConfigured() {
  return getReadiness().services.supabase === "configured";
}

function isSupabaseAuthConfigured() {
  return Boolean(getEnv(["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"]) && getEnv(["SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]));
}

function getSupabaseAuthConfig() {
  const url = getEnv(["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"]);
  const anonKey = getEnv(["SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]);
  if (!url || !anonKey) return { ok: false };
  return { ok: true, url: url.replace(/\/$/, ""), anonKey };
}

function getSupabaseServerClient() {
  return getSupabaseServerConfig();
}

function getSupabaseAdminClient() {
  return getSupabaseServerConfig();
}

async function safeInsertSupportRequest(record) {
  const config = getSupabaseAdminClient();
  if (!config.ok) return { ok: false, code: "setup_required" };
  const response = await fetch(`${config.url}/rest/v1/support_requests`, {
    method: "POST",
    headers: supabaseHeaders(config, { prefer: "return=representation" }),
    body: JSON.stringify(record)
  }).catch(() => undefined);
  return { ok: Boolean(response?.ok), rows: response?.ok ? await response.json().catch(() => []) : [] };
}

async function safeInsertModuleOutput(organizationId, productKey, moduleKey, input, output) {
  const config = getSupabaseAdminClient();
  if (!config.ok) return { ok: false, code: "setup_required" };
  if (!organizationId) return { ok: false, code: "organization_setup_required" };
  const response = await fetch(`${config.url}/rest/v1/module_outputs`, {
    method: "POST",
    headers: supabaseHeaders(config, { prefer: "return=representation" }),
    body: JSON.stringify({ organization_id: organizationId, product_key: productKey, module_key: moduleKey, input_payload: input, output_payload: output })
  }).catch(() => undefined);
  return { ok: Boolean(response?.ok), rows: response?.ok ? await response.json().catch(() => []) : [] };
}

async function safeReadOrganizationScopedRecords(organizationId, productKey) {
  const config = getSupabaseAdminClient();
  if (!config.ok) return { ok: false, code: "setup_required", records: [] };
  if (!organizationId) return { ok: false, code: "organization_setup_required", records: [] };
  const response = await fetch(`${config.url}/rest/v1/module_outputs?select=id,module_key,created_at,output_payload&organization_id=eq.${encodeURIComponent(organizationId)}&product_key=eq.${encodeURIComponent(productKey)}&order=created_at.desc&limit=20`, {
    headers: supabaseHeaders(config)
  }).catch(() => undefined);
  if (!response?.ok) return { ok: false, code: "read_failed", records: [] };
  return { ok: true, records: await response.json().catch(() => []) };
}

async function saveModuleOutput(req, productKey, moduleKey, input, output) {
  const organization = await getCustomerPrimaryOrganization(req.sonaraUser);
  const saved = await safeInsertModuleOutput(organization.organizationId, productKey, moduleKey, input, output);
  return {
    ok: true,
    saved: saved.ok,
    code: saved.ok ? "saved" : "setup_required",
    productKey,
    moduleKey,
    output
  };
}

async function readModuleRecords(req, productKey) {
  const organization = await getCustomerPrimaryOrganization(req.sonaraUser);
  const result = await safeReadOrganizationScopedRecords(organization.organizationId, productKey);
  return {
    ok: true,
    saved: result.ok,
    code: result.ok ? "records_available" : "setup_required",
    productKey,
    records: result.records
  };
}

async function saveBusinessBuilderIntake(req, output) {
  const organization = await getCustomerPrimaryOrganization(req.sonaraUser);
  if (!organization.ok) {
    return { ok: true, saved: false, code: "setup_required", service: "customer_organization", output };
  }

  const config = getSupabaseAdminClient();
  if (!config.ok) return { ok: true, saved: false, code: "setup_required", service: "supabase", output };

  const record = {
    organization_id: organization.organizationId,
    user_id: req.sonaraUser?.id || null,
    company_name: String(req.body.companyName || req.body.company_name || "").trim() || null,
    contact_name: String(req.body.name || req.body.contactName || "").trim(),
    email: String(req.body.email || "").trim(),
    phone: String(req.body.phone || "").trim() || null,
    industry: String(req.body.industry || "").trim() || null,
    budget: String(req.body.budget || "").trim() || null,
    timeline: String(req.body.timeline || "").trim() || null,
    goals: String(req.body.message || req.body.goals || "").trim(),
    current_website: String(req.body.currentWebsite || req.body.current_website || "").trim() || null,
    needed_services: splitList(req.body.neededServices || req.body.serviceInterest || ""),
    status: "new"
  };

  const intake = await fetch(`${config.url}/rest/v1/intake_requests`, {
    method: "POST",
    headers: supabaseHeaders(config, { prefer: "return=representation" }),
    body: JSON.stringify(record)
  }).catch(() => undefined);
  if (!intake?.ok) return { ok: true, saved: false, code: "setup_required", service: "intake_requests", output };
  const rows = await intake.json().catch(() => []);
  await insertActivityEvent(organization.organizationId, req.sonaraUser?.id, "business_builder.intake_created", {
    intake_request_id: rows[0]?.id || null,
    service_interest: req.body.serviceInterest || null
  });
  const email = await sendIntakeConfirmationEmail({ email: record.email, referenceId: rows[0]?.id || output.referenceId, contactName: record.contact_name });
  return { ok: true, saved: true, code: "saved", emailDelivery: email.ok ? "sent" : "setup_required", intakeRequestId: rows[0]?.id, output };
}

async function listChecklistItems(req) {
  const organization = await getCustomerPrimaryOrganization(req.sonaraUser);
  if (!organization.ok) return { ok: true, saved: false, code: "setup_required", service: "customer_organization", items: [] };
  const config = getSupabaseAdminClient();
  if (!config.ok) return { ok: true, saved: false, code: "setup_required", service: "supabase", items: [] };
  const response = await fetch(`${config.url}/rest/v1/launch_checklist_items?select=id,category,title,description,status,due_date,created_at,updated_at&organization_id=eq.${encodeURIComponent(organization.organizationId)}&order=created_at.desc`, {
    headers: supabaseHeaders(config)
  }).catch(() => undefined);
  if (!response?.ok) return { ok: true, saved: false, code: "setup_required", service: "launch_checklist_items", items: [] };
  return { ok: true, saved: true, code: "records_available", items: await response.json().catch(() => []) };
}

async function createChecklistItem(req) {
  const organization = await getCustomerPrimaryOrganization(req.sonaraUser);
  if (!organization.ok) return { ok: false, saved: false, code: "setup_required", service: "customer_organization" };
  const config = getSupabaseAdminClient();
  if (!config.ok) return { ok: false, saved: false, code: "setup_required", service: "supabase" };
  const record = {
    organization_id: organization.organizationId,
    user_id: req.sonaraUser?.id || null,
    category: String(req.body.category || "Launch").trim(),
    title: String(req.body.title || "").trim(),
    description: String(req.body.description || "").trim() || null,
    status: String(req.body.status || "todo").trim(),
    due_date: String(req.body.dueDate || req.body.due_date || "").trim() || null
  };
  if (!["todo", "in_progress", "done", "blocked"].includes(record.status)) record.status = "todo";
  const response = await fetch(`${config.url}/rest/v1/launch_checklist_items`, {
    method: "POST",
    headers: supabaseHeaders(config, { prefer: "return=representation" }),
    body: JSON.stringify(record)
  }).catch(() => undefined);
  if (!response?.ok) return { ok: false, saved: false, code: "checklist_create_failed" };
  const rows = await response.json().catch(() => []);
  await insertActivityEvent(organization.organizationId, req.sonaraUser?.id, "business_builder.checklist_created", { checklist_item_id: rows[0]?.id || null });
  return { ok: true, saved: true, code: "saved", item: rows[0] };
}

async function updateChecklistItem(req) {
  const organization = await getCustomerPrimaryOrganization(req.sonaraUser);
  if (!organization.ok) return { ok: false, saved: false, code: "setup_required", service: "customer_organization" };
  const config = getSupabaseAdminClient();
  if (!config.ok) return { ok: false, saved: false, code: "setup_required", service: "supabase" };
  const id = String(req.body.id || "").trim();
  if (!isUuid(id)) return { ok: false, code: "validation_failed", message: "Enter a valid checklist item ID." };
  const patch = {};
  for (const [field, column] of [["category", "category"], ["title", "title"], ["description", "description"], ["status", "status"], ["dueDate", "due_date"], ["due_date", "due_date"]]) {
    if (req.body[field] !== undefined) patch[column] = String(req.body[field]).trim();
  }
  if (patch.status && !["todo", "in_progress", "done", "blocked"].includes(patch.status)) return { ok: false, code: "validation_failed", message: "Choose a valid checklist status." };
  patch.updated_at = new Date().toISOString();
  const response = await fetch(`${config.url}/rest/v1/launch_checklist_items?id=eq.${encodeURIComponent(id)}&organization_id=eq.${encodeURIComponent(organization.organizationId)}`, {
    method: "PATCH",
    headers: supabaseHeaders(config, { prefer: "return=representation" }),
    body: JSON.stringify(patch)
  }).catch(() => undefined);
  if (!response?.ok) return { ok: false, saved: false, code: "checklist_update_failed" };
  const rows = await response.json().catch(() => []);
  await insertActivityEvent(organization.organizationId, req.sonaraUser?.id, "business_builder.checklist_updated", { checklist_item_id: id });
  return { ok: true, saved: true, code: "updated", item: rows[0] };
}

async function deleteChecklistItem(req) {
  const organization = await getCustomerPrimaryOrganization(req.sonaraUser);
  if (!organization.ok) return { ok: false, saved: false, code: "setup_required", service: "customer_organization" };
  const config = getSupabaseAdminClient();
  if (!config.ok) return { ok: false, saved: false, code: "setup_required", service: "supabase" };
  const id = String(req.body.id || "").trim();
  if (!isUuid(id)) return { ok: false, code: "validation_failed", message: "Enter a valid checklist item ID." };
  const response = await fetch(`${config.url}/rest/v1/launch_checklist_items?id=eq.${encodeURIComponent(id)}&organization_id=eq.${encodeURIComponent(organization.organizationId)}`, {
    method: "DELETE",
    headers: supabaseHeaders(config)
  }).catch(() => undefined);
  if (!response?.ok) return { ok: false, saved: false, code: "checklist_delete_failed" };
  await insertActivityEvent(organization.organizationId, req.sonaraUser?.id, "business_builder.checklist_deleted", { checklist_item_id: id });
  return { ok: true, saved: true, code: "deleted" };
}

async function insertActivityEvent(organizationId, userId, eventType, eventData = {}) {
  const config = getSupabaseAdminClient();
  if (!config.ok || !organizationId) return { ok: false };
  const response = await fetch(`${config.url}/rest/v1/activity_events`, {
    method: "POST",
    headers: supabaseHeaders(config),
    body: JSON.stringify({ organization_id: organizationId, user_id: userId || null, event_type: eventType, event_data: eventData })
  }).catch(() => undefined);
  return { ok: Boolean(response?.ok) };
}

async function sendIntakeConfirmationEmail({ email, referenceId, contactName }) {
  if (getReadiness().services.emailDelivery !== "enabled") return { ok: false, error: "resend_not_configured" };
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${getEnv("RESEND_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: getEnv("RESEND_FROM_EMAIL"),
      to: [email],
      subject: "Business Builder intake received",
      text: [`Hello ${contactName || "there"},`, "", "Your Business Builder intake was recorded.", `Reference: ${referenceId}`, "", "A SONARA operator will review next steps after setup and support routing are confirmed."].join("\n")
    })
  }).catch(() => undefined);
  return response?.ok ? { ok: true } : { ok: false, error: `resend_${response?.status || "unavailable"}` };
}

function productReadinessJson(productKey) {
  return { ok: true, productKey, readiness: getReadiness().services };
}

function requireFields(body, fields) {
  const missingFields = fields.filter((field) => !String(body[field] || "").trim());
  if (missingFields.length) return { ok: false, code: "validation_failed", missing: missingFields };
  return { ok: true };
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ""));
}

function buildBusinessOffer(input) {
  return {
    headline: `${input.serviceType} for ${input.audience}`,
    pricePosition: String(input.priceIdea),
    deliverables: splitList(input.deliverables),
    proofPoints: splitList(input.proofPoints || ""),
    buyerNextAction: "Submit an intake request and schedule owner review.",
    caution: "Validate scope, refund terms, and payment readiness before selling."
  };
}

function buildCreatorOffer(input) {
  return {
    offerType: String(input.offerType),
    audience: String(input.audience),
    deliverables: splitList(input.deliverables),
    pricePosition: String(input.priceIdea),
    rightsReminder: "Confirm ownership, license terms, and platform rules before monetization.",
    buyerNextAction: "Review catalog details and support requirements."
  };
}

function buildCampaignPlan(input) {
  return {
    goal: String(input.goal),
    audience: String(input.audience),
    offer: String(input.offer),
    channel: String(input.channel),
    timeline: String(input.timeline),
    plan: [
      "Confirm audience source and consent status.",
      "Prepare truthful subject/from language for commercial email.",
      "Include unsubscribe language and physical mailing address when required.",
      "Review offer claims before launch.",
      "Track outcomes without overstating attribution."
    ]
  };
}

function splitList(value) {
  return String(value).split(",").map((item) => item.trim()).filter(Boolean);
}

function getEnv(names) {
  const keys = Array.isArray(names) ? names : [names];
  for (const key of keys) {
    const value = String(process.env[key] || "").trim();
    if (value) return value;
  }
  return "";
}

function missingEnvGroups(groups) {
  return groups
    .filter((group) => !getEnv(group))
    .map((group) => group.join(" or "));
}

function getDeploymentInfo() {
  return {
    commitSha: safePublicEnvValue(getEnv("VERCEL_GIT_COMMIT_SHA") || "local"),
    branch: safePublicEnvValue(getEnv("VERCEL_GIT_COMMIT_REF") || "local"),
    environment: safePublicEnvValue(getEnv("VERCEL_ENV") || process.env.NODE_ENV || "development")
  };
}

function safePublicEnvValue(value) {
  const cleaned = String(value || "").trim().replace(/[^\w./:-]/g, "").slice(0, 120);
  return cleaned || "local";
}

async function handleEmailAuth(mode, body) {
  if (!isSupabaseAuthConfigured()) {
    return { status: 503, body: { ok: false, code: "setup_required", service: "supabase_auth" } };
  }
  const email = String(body.email || "").trim();
  const password = String(body.password || "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8) {
    return { status: 400, body: { ok: false, code: "validation_failed" } };
  }

  const endpoint = mode === "signup" ? "/auth/v1/signup" : "/auth/v1/token?grant_type=password";
  const config = getSupabaseAuthConfig();
  const response = await fetch(`${config.url}${endpoint}`, {
    method: "POST",
    headers: {
      apikey: getEnv(["SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]),
      Authorization: `Bearer ${getEnv(["SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"])}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email, password })
  }).catch(() => undefined);

  if (!response?.ok) return { status: 401, body: { ok: false, code: "auth_not_completed" } };
  const data = await response.json().catch(() => ({}));
  const accessToken = typeof data.access_token === "string" ? data.access_token : "";
  const reportedExpiresIn = Number(data.expires_in);
  const expiresIn = Number.isFinite(reportedExpiresIn) ? Math.max(60, Math.min(reportedExpiresIn, CUSTOMER_SESSION_MAX_AGE_SECONDS)) : CUSTOMER_SESSION_MAX_AGE_SECONDS;
  return {
    status: 200,
    body: { ok: true, code: mode === "signup" ? "signup_requested" : "login_ready", sessionStored: Boolean(accessToken) },
    session: accessToken ? { accessToken, maxAgeSeconds: expiresIn } : undefined
  };
}

function sendEmailAuthResult(req, res, result, sessionRedirect, fallbackRedirect) {
  if (result.session?.accessToken) setCustomerSessionCookie(res, result.session.accessToken, result.session.maxAgeSeconds);

  if (acceptsHtml(req)) {
    if (result.status >= 200 && result.status < 300) {
      return res.redirect(303, result.session?.accessToken ? sessionRedirect : fallbackRedirect);
    }

    const message = result.body?.code === "setup_required"
      ? "Account login setup is required before email/password access can complete."
      : "Email/password access was not completed.";
    return res.status(result.status).type("html").send(responsePage("Access not completed", message, [linkAction("/login", "Login"), linkAction("/signup", "Create account")]));
  }

  return res.status(result.status).json(result.body);
}

function setCustomerSessionCookie(res, accessToken, maxAgeSeconds = CUSTOMER_SESSION_MAX_AGE_SECONDS) {
  res.cookie(CUSTOMER_SESSION_COOKIE, accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.max(60, Math.min(Number(maxAgeSeconds) || CUSTOMER_SESSION_MAX_AGE_SECONDS, CUSTOMER_SESSION_MAX_AGE_SECONDS)) * 1000
  });
}

function clearCustomerSessionCookie(res) {
  res.clearCookie(CUSTOMER_SESSION_COOKIE, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/"
  });
}

async function requireCustomer(req, res, next) {
  if (!isSupabaseAuthConfigured()) {
    if (acceptsHtml(req)) return res.redirect(303, "/login");
    return res.status(503).json({ ok: false, code: "setup_required", service: "supabase_auth" });
  }

  const sessionToken = getCustomerSessionToken(req);
  if (!sessionToken) {
    if (acceptsHtml(req)) return res.redirect(303, "/login");
    return res.status(401).json({ ok: false, code: "customer_auth_required" });
  }

  const verification = await verifySupabaseAccessToken(sessionToken);
  if (!verification.ok) return res.status(401).json({ ok: false, code: "customer_auth_required" });
  req.sonaraUser = verification.user;
  return next();
}

async function requireAppAccess(req, res, next) {
  const access = await resolveWorkspaceAccess(req);
  if (access.ok) {
    req.sonaraAccess = access;
    if (access.user) req.sonaraUser = access.user;
    if (access.admin) req.sonaraAdmin = access.admin;
    return next();
  }
  if (acceptsHtml(req)) return res.redirect(303, "/login");
  return res.status(access.status || 401).json(access.body || { ok: false, code: "customer_auth_required" });
}

function requireWorkspaceAccess(productKey) {
  return async (req, res, next) => {
    const access = await resolveWorkspaceAccess(req, productKey);
    if (access.ok) {
      req.sonaraAccess = access;
      if (access.user) req.sonaraUser = access.user;
      if (access.admin) req.sonaraAdmin = access.admin;
      return next();
    }
    if (acceptsHtml(req)) return res.redirect(303, "/login");
    return res.status(access.status || 401).json(access.body || { ok: false, code: "customer_auth_required" });
  };
}

function requirePaidOrOwnerAccess(productKey) {
  return async (req, res, next) => {
    const access = await resolveWorkspaceAccess(req, productKey);
    if (!access.ok) {
      if (acceptsHtml(req)) return res.redirect(303, "/login");
      return res.status(access.status || 401).json(access.body || { ok: false, code: "customer_auth_required" });
    }

    req.sonaraAccess = access;
    if (access.user) req.sonaraUser = access.user;
    if (access.admin) req.sonaraAdmin = access.admin;

    if (access.ownerOverride) {
      req.sonaraEntitlement = { ok: true, source: "owner_admin_override", productKey };
      return next();
    }

    const entitlement = await getCustomerPaidEntitlement(access.user, productKey);
    if (!entitlement.ok) {
      const payload = {
        ok: false,
        code: entitlement.code || "upgrade_required",
        productKey,
    message: entitlement.message || "Upgrade required. Paid records unlock only after payment updates record an active or trialing plan.",
        upgrade_url: "/pricing"
      };
      if (acceptsHtml(req)) {
        return res.status(entitlement.status || 402).type("html").send(
          responsePage("Upgrade required", payload.message, [linkAction("/pricing", "View pricing"), linkAction("/dashboard", "Dashboard")])
        );
      }
      return res.status(entitlement.status || 402).json(payload);
    }
    req.sonaraEntitlement = entitlement;
    return next();
  };
}

async function resolveWorkspaceAccess(req, productKey) {
  const admin = await verifyAdminRequest(req);
  if (admin.ok) {
    return { ok: true, mode: "owner_admin", ownerOverride: true, productKey, admin, user: admin.user, roles: admin.roles || ["owner"] };
  }

  const customer = await resolveCustomerSession(req);
  if (!customer.ok) return customer;

  const roles = await getUserRoles(customer.user);
  return {
    ok: true,
    mode: roles.roles.includes("owner") || roles.roles.includes("admin") ? "owner_admin" : "customer",
    ownerOverride: roles.roles.includes("owner") || roles.roles.includes("admin"),
    productKey,
    user: customer.user,
    roles: roles.roles
  };
}

async function resolveCustomerSession(req) {
  if (!isSupabaseAuthConfigured()) {
    return { ok: false, status: 503, body: { ok: false, code: "setup_required", service: "supabase_auth" } };
  }

  const sessionToken = getCustomerSessionToken(req);
  if (!sessionToken) {
    return { ok: false, status: 401, body: { ok: false, code: "customer_auth_required" } };
  }

  const verification = await verifySupabaseAccessToken(sessionToken);
  if (!verification.ok) return { ok: false, status: 401, body: { ok: false, code: "customer_auth_required" } };
  return { ok: true, user: verification.user };
}

async function verifySupabaseAccessToken(accessToken) {
  const config = getSupabaseAuthConfig();
  if (!config.ok) return { ok: false };
  const response = await fetch(`${config.url}/auth/v1/user`, {
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${accessToken}`
    }
  }).catch(() => undefined);
  if (!response?.ok) return { ok: false };
  return { ok: true, user: await response.json().catch(() => undefined) };
}

async function rejectCustomerBearerFromAdminLogin(req, res, next) {
  const bearerToken = getBearerToken(req);
  if (!bearerToken) return next();

  const verification = await verifySupabaseAccessToken(bearerToken);
  if (!verification.ok) return next();
  const admin = await isSupabaseAdminUser(verification.user);
  if (admin.ok) return next();

  if (acceptsHtml(req)) return res.status(403).type("html").send(responsePage("Admin access denied", "Customer sessions cannot open founder operations.", [linkAction("/", "Home")]));
  return res.status(403).json({ ok: false, code: "admin_forbidden" });
}

async function requireAdmin(req, res, next) {
  const admin = await verifyAdminRequest(req);
  if (admin.ok) {
    req.sonaraAdmin = admin;
    return next();
  }

  if (admin.setupRequired) {
    if (acceptsHtml(req)) return res.redirect(303, "/admin/login");
    return res.status(503).json({ ok: false, code: "setup_required", service: "admin_access" });
  }

  if (acceptsHtml(req)) return res.redirect(303, "/admin/login");
  return res.status(401).json({ ok: false, code: "admin_auth_required" });
}

async function requireBusinessManager(req, res, next) {
  const admin = await verifyAdminRequest(req);
  if (admin.ok) {
    req.sonaraAdmin = admin;
    req.sonaraAccess = { ok: true, mode: "owner_admin", ownerOverride: true, admin, user: admin.user, roles: admin.roles || ["owner"] };
    req.sonaraBusinessMembership = {};
    return next();
  }

  if (!isSupabaseConfigured()) {
    if (acceptsHtml(req)) return res.redirect(303, "/business-builder/login");
    return res.status(503).json({ ok: false, code: "setup_required", service: "supabase_auth" });
  }

  const bearerToken = getBearerToken(req);
  if (!bearerToken) {
    if (acceptsHtml(req)) return res.redirect(303, "/business-builder/login");
    return res.status(401).json({ ok: false, code: "business_auth_required" });
  }

  const verification = await verifySupabaseAccessToken(bearerToken);
  if (!verification.ok) return res.status(401).json({ ok: false, code: "business_auth_required" });

  const membership = await isBusinessManagerUser(verification.user, getBusinessWorkspaceId(req));
  if (!membership.ok) {
    if (acceptsHtml(req)) return res.status(403).type("html").send(responsePage("Business access denied", "This account is not authorized to manage Business Builder employees for the selected workspace.", [linkAction("/business-builder/login", "Business login")]));
    return res.status(403).json({ ok: false, code: "business_forbidden" });
  }

  req.sonaraUser = verification.user;
  req.sonaraBusinessMembership = membership.membership;
  return next();
}

async function getCustomerPrimaryOrganization(user) {
  const config = getSupabaseServerConfig();
  const userId = String(user?.id || "").trim();
  if (!config.ok) return { ok: false, code: "setup_required" };
  if (!userId) return { ok: false, code: "customer_auth_required" };

  const organizationMembership = await fetch(`${config.url}/rest/v1/organization_memberships?select=organization_id&user_id=eq.${encodeURIComponent(userId)}&status=eq.active&limit=1`, {
    headers: supabaseHeaders(config)
  }).catch(() => undefined);
  if (organizationMembership?.ok) {
    const rows = await organizationMembership.json().catch(() => []);
    if (rows[0]?.organization_id) return { ok: true, organizationId: rows[0].organization_id, source: "organization_memberships" };
  }

  const legacyOrganizationMember = await fetch(`${config.url}/rest/v1/organization_members?select=organization_id&user_id=eq.${encodeURIComponent(userId)}&limit=1`, {
    headers: supabaseHeaders(config)
  }).catch(() => undefined);
  if (legacyOrganizationMember?.ok) {
    const rows = await legacyOrganizationMember.json().catch(() => []);
    if (rows[0]?.organization_id) return { ok: true, organizationId: rows[0].organization_id, source: "organization_members" };
  }

  const businessMembership = await fetch(`${config.url}/rest/v1/business_memberships?select=organization_id&user_id=eq.${encodeURIComponent(userId)}&status=eq.active&limit=1`, {
    headers: supabaseHeaders(config)
  }).catch(() => undefined);
  if (businessMembership?.ok) {
    const rows = await businessMembership.json().catch(() => []);
    if (rows[0]?.organization_id) return { ok: true, organizationId: rows[0].organization_id, source: "business_memberships" };
  }

  return { ok: false, code: "organization_membership_missing" };
}

async function getCustomerPaidEntitlement(user, productKey) {
  const organization = await getCustomerPrimaryOrganization(user);
  if (!organization.ok) return { ok: false, status: 402, code: "upgrade_required", reason: organization.code };

  const config = getSupabaseServerConfig();
  const allowedKeys = getPaidEntitlementKeys(productKey);
  const entitlementResponse = await fetch(`${config.url}/rest/v1/billing_entitlements?select=entitlement_key,status&organization_id=eq.${encodeURIComponent(organization.organizationId)}&status=eq.active`, {
    headers: supabaseHeaders(config)
  }).catch(() => undefined);
  if (entitlementResponse?.ok) {
    const rows = await entitlementResponse.json().catch(() => []);
    const match = rows.find((row) => allowedKeys.includes(row.entitlement_key) && row.status === "active");
    if (match) return { ok: true, organizationId: organization.organizationId, source: "billing_entitlements", entitlementKey: match.entitlement_key };
  }

  const subscriptionResponse = await fetch(`${config.url}/rest/v1/billing_subscriptions?select=plan_slug,status&organization_id=eq.${encodeURIComponent(organization.organizationId)}`, {
    headers: supabaseHeaders(config)
  }).catch(() => undefined);
  if (subscriptionResponse?.ok) {
    const rows = await subscriptionResponse.json().catch(() => []);
    const match = rows.find((row) => allowedKeys.includes(row.plan_slug) && ["active", "trialing"].includes(row.status));
    if (match) return { ok: true, organizationId: organization.organizationId, source: "billing_subscriptions", entitlementKey: match.plan_slug };
  }

  return {
    ok: false,
    status: 402,
    code: "upgrade_required",
    reason: "billing_state_missing",
    message: "Paid access is locked until payment updates show an active or trialing plan, or an active one-time purchase."
  };
}

function getPaidEntitlementKeys(productKey) {
  const map = {
    business_builder: ["starter_monthly", "core_monthly", "pro_monthly", "business_builder_one_time"],
    creator_studio: ["core_monthly", "pro_monthly"],
    growth_studio: ["pro_monthly"]
  };
  return map[productKey] || [];
}

async function verifyAdminRequest(req) {
  const cookieToken = getCookie(req, ADMIN_SESSION_COOKIE);
  if (cookieToken) {
    const verification = await verifySupabaseAccessToken(cookieToken);
    if (verification.ok) {
      const admin = await isSupabaseAdminUser(verification.user);
      if (admin.ok) return { ok: true, method: "admin_cookie", user: verification.user, roles: admin.roles };
      return { ok: false };
    }
  }

  const bearerToken = getBearerToken(req);
  if (bearerToken) {
    const verification = await verifySupabaseAccessToken(bearerToken);
    if (verification.ok) {
      const admin = await isSupabaseAdminUser(verification.user);
      if (admin.ok) return { ok: true, method: "supabase_role", user: verification.user, roles: admin.roles };
      return { ok: false };
    }
  }

  return { ok: false, setupRequired: getReadiness().services.adminProtection !== "configured" };
}

function getBearerToken(req) {
  const authHeader = String(req.get("authorization") || "");
  return authHeader.match(/^Bearer\s+(.+)$/i)?.[1] || "";
}

function getCustomerSessionToken(req) {
  return getBearerToken(req) || getCookie(req, CUSTOMER_SESSION_COOKIE);
}

async function isSupabaseAdminUser(user) {
  const roles = await getUserRoles(user);
  return { ok: roles.roles.includes("owner") || roles.roles.includes("admin"), roles: roles.roles };
}

async function getUserRoles(user) {
  const roles = new Set();
  const userId = String(user?.id || "").trim();
  const email = String(user?.email || "").trim().toLowerCase();

  if (email && getAdminEmailSet().has(email)) {
    roles.add("owner");
    roles.add("admin");
  }

  if (!userId) return { ok: roles.size > 0, roles: Array.from(roles) };
  const config = getSupabaseServerConfig();
  if (!config.ok) return { ok: roles.size > 0, roles: Array.from(roles) };
  const query = `/rest/v1/user_roles?select=role&user_id=eq.${encodeURIComponent(userId)}`;
  const response = await fetch(`${config.url}${query}`, { headers: supabaseHeaders(config) }).catch(() => undefined);
  if (response?.ok) {
    const rows = await response.json().catch(() => []);
    for (const row of rows) {
      if (["owner", "admin", "customer", "employee"].includes(row.role)) roles.add(row.role);
    }
  }
  return { ok: roles.size > 0, roles: Array.from(roles) };
}

function getAdminEmailSet() {
  return new Set(splitList([getEnv("ADMIN_EMAILS"), getEnv("ADMIN_EMAIL"), getEnv("FOUNDER_EMAILS")].filter(Boolean).join(",")).map((email) => email.toLowerCase()));
}

function hasAdminAuthorizationSource() {
  return getAdminEmailSet().size > 0 || Boolean(getEnv("SUPABASE_SERVICE_ROLE_KEY"));
}

async function isBusinessManagerUser(user, workspaceId) {
  const userId = String(user?.id || "").trim();
  if (!userId) return { ok: false };
  const config = getSupabaseServerConfig();
  if (!config.ok) return { ok: false };
  const filters = [
    "select=id,organization_id,workspace_id,role,status",
    `user_id=eq.${encodeURIComponent(userId)}`,
    "status=eq.active",
    "role=in.(owner,manager)",
    "limit=1"
  ];
  if (workspaceId) filters.splice(3, 0, `workspace_id=eq.${encodeURIComponent(workspaceId)}`);
  const response = await fetch(`${config.url}/rest/v1/business_memberships?${filters.join("&")}`, { headers: supabaseHeaders(config) }).catch(() => undefined);
  if (!response?.ok) return { ok: false };
  const rows = await response.json().catch(() => []);
  return { ok: Array.isArray(rows) && rows.length > 0, membership: rows[0] };
}

function getBusinessWorkspaceId(req) {
  return String(req.body?.workspaceId || req.body?.workspace_id || req.query?.workspaceId || req.query?.workspace_id || req.get("x-business-workspace-id") || "").trim();
}

function acceptsHtml(req) {
  const accept = String(req.get("accept") || "");
  return accept.includes("text/html") && !accept.includes("application/json");
}

function wantsJson(req) {
  return Boolean(req.is("application/json")) || String(req.get("accept") || "").includes("application/json");
}

function wantsAuthReadinessJson(req) {
  const format = String(req.query?.format || "").trim().toLowerCase();
  const explicitApiClient = String(req.get("x-sonara-api-client") || "").trim().toLowerCase();
  return format === "json" || explicitApiClient === "true";
}

function getCookie(req, name) {
  const cookieHeader = String(req.get("cookie") || "");
  const cookies = cookieHeader.split(";").map((part) => part.trim()).filter(Boolean);
  for (const cookie of cookies) {
    const separator = cookie.indexOf("=");
    if (separator === -1) continue;
    const key = decodeURIComponent(cookie.slice(0, separator));
    if (key === name) return decodeURIComponent(cookie.slice(separator + 1));
  }
  return "";
}

function isValidPlan(plan) {
  return Object.prototype.hasOwnProperty.call(STRIPE_PLANS, plan);
}

function normalizeCheckoutPlan(body) {
  const requested = String(body.plan || body.priceKey || body.price_key || body.product || body.product_key || "").trim();
  const aliases = {
    business_builder_monthly: "starter_monthly",
    business_builder_starter_monthly: "starter_monthly",
    creator_studio_monthly: "core_monthly",
    growth_studio_monthly: "pro_monthly",
    business_builder_onetime: "business_builder_one_time",
    business_builder_setup: "business_builder_one_time"
  };
  return aliases[requested] || requested;
}

async function handleCheckoutSessionRequest(req, res) {
  const plan = normalizeCheckoutPlan(req.body);
  if (!isValidPlan(plan)) return res.status(400).json({ ok: false, code: "invalid_plan" });
  if (plan === "free") {
    if (wantsJson(req)) return res.status(200).json({ ok: true, code: "free_plan", redirect_url: "/dashboard" });
    return res.redirect(303, "/dashboard");
  }

  const customer = await resolveCustomerSession(req);
  if (!customer.ok) {
    if (acceptsHtml(req)) return res.redirect(303, "/login");
    return res.status(customer.status).json(customer.body);
  }

  const organization = await getCustomerPrimaryOrganization(customer.user);
  if (!organization.ok) return sendSetupRequired(req, res, 503, "customer_organization", organization.code);

  const secretStatus = getStripeSecretStatus();
  if (secretStatus.status !== "configured") return sendSetupRequired(req, res, 503, "stripe_secret_key", secretStatus.status);

  const priceStatus = getStripePlanPriceStatus(plan);
  if (priceStatus.status !== "configured") {
    const payload = { ok: false, code: "setup_required", service: "stripe_price", plan, reason: priceStatus.status, env: priceStatus.env };
    if (acceptsHtml(req)) {
      return res.status(503).type("html").send(responsePage("Checkout setup required", "Checkout is not configured for this plan yet.", [
        linkAction("/pricing", "Pricing"),
        linkAction("/contact", "Request setup")
      ]));
    }
    return res.status(503).json(payload);
  }

  const stripeCustomer = await getOrCreateStripeCustomer(customer.user, organization.organizationId);
  if (!stripeCustomer.ok) return sendSetupRequired(req, res, 503, "stripe_customer", stripeCustomer.code || "not_available");

  const session = await createStripeCheckoutSession(req, plan, priceStatus.priceId, organization.organizationId, customer.user, stripeCustomer.stripeCustomerId);
  if (!session.ok || !session.url) {
    if (acceptsHtml(req)) return res.status(502).type("html").send(responsePage("Checkout unavailable", "Checkout could not be started. Try again after payment setup is reviewed.", [linkAction("/pricing", "Pricing")]));
    return res.status(502).json({ ok: false, code: "checkout_unavailable" });
  }
  if (wantsJson(req)) return res.status(200).json({ ok: true, checkout_url: session.url });
  return res.redirect(303, session.url);
}

function sendSetupRequired(req, res, status, service, reason) {
  const payload = { ok: false, code: "setup_required", service, reason };
  if (acceptsHtml(req)) {
    return res.status(status).type("html").send(responsePage("Setup required", `Setup required: ${displayStatus(service)} is ${displayStatus(reason || "missing")}.`, [
      linkAction("/pricing", "Pricing"),
      linkAction("/docs", "Setup details")
    ]));
  }
  return res.status(status).json(payload);
}

async function createStripeCheckoutSession(req, plan, priceId, organizationId, user, stripeCustomerId) {
  const urls = getCheckoutRedirectUrls(req);
  const params = new URLSearchParams({
    mode: STRIPE_PLANS[plan].mode,
    success_url: urls.successUrl,
    cancel_url: urls.cancelUrl,
    customer: stripeCustomerId,
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
    "metadata[plan]": plan,
    "metadata[organization_id]": organizationId,
    "metadata[user_id]": user?.id || "",
    "metadata[price_id]": priceId
  });
  if (STRIPE_PLANS[plan].mode === "subscription") {
    params.set("subscription_data[metadata][plan]", plan);
    params.set("subscription_data[metadata][organization_id]", organizationId);
    params.set("subscription_data[metadata][user_id]", user?.id || "");
  }
  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${getEnv("STRIPE_SECRET_KEY")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString()
  }).catch(() => undefined);
  if (!response?.ok) return { ok: false };
  const session = await response.json();
  return { ok: true, url: session.url };
}

async function getOrCreateStripeCustomer(user, organizationId) {
  const config = getSupabaseServerConfig();
  if (!config.ok) return { ok: false, code: "supabase" };
  const userId = String(user?.id || "").trim();
  if (!userId || !organizationId) return { ok: false, code: "customer_organization" };

  const existing = await fetch(`${config.url}/rest/v1/stripe_customers?select=stripe_customer_id&organization_id=eq.${encodeURIComponent(organizationId)}&user_id=eq.${encodeURIComponent(userId)}&limit=1`, {
    headers: supabaseHeaders(config)
  }).catch(() => undefined);
  if (existing?.ok) {
    const rows = await existing.json().catch(() => []);
    if (rows[0]?.stripe_customer_id) return { ok: true, stripeCustomerId: rows[0].stripe_customer_id, source: "database" };
  }

  const params = new URLSearchParams({
    email: user.email || "",
    "metadata[user_id]": userId,
    "metadata[organization_id]": organizationId
  });
  const created = await fetch("https://api.stripe.com/v1/customers", {
    method: "POST",
    headers: { Authorization: `Bearer ${getEnv("STRIPE_SECRET_KEY")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString()
  }).catch(() => undefined);
  if (!created?.ok) return { ok: false, code: "stripe_customer_create_failed" };
  const customer = await created.json().catch(() => ({}));
  if (!customer.id) return { ok: false, code: "stripe_customer_missing" };

  await fetch(`${config.url}/rest/v1/stripe_customers?on_conflict=stripe_customer_id`, {
    method: "POST",
    headers: supabaseHeaders(config, { prefer: "resolution=ignore-duplicates" }),
    body: JSON.stringify({ user_id: userId, organization_id: organizationId, stripe_customer_id: customer.id })
  }).catch(() => undefined);
  return { ok: true, stripeCustomerId: customer.id, source: "stripe" };
}

function getCheckoutRedirectUrls(req) {
  const baseUrl = getPublicAppUrl(req);
  return {
    successUrl: getSafeAbsoluteUrl(process.env.STRIPE_SUCCESS_URL, `${baseUrl}/account`),
    cancelUrl: getSafeAbsoluteUrl(process.env.STRIPE_CANCEL_URL, `${baseUrl}/pricing`)
  };
}

function getPublicAppUrl(req) {
  const configured = getEnv(["APP_URL", "PUBLIC_SITE_URL", "NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_SITE_URL"]);
  if (isSafePublicUrl(configured)) return String(configured).replace(/\/$/, "");

  const host = req.get("x-forwarded-host") || req.get("host") || "sonaraindustries.com";
  const protocol = req.get("x-forwarded-proto") || req.protocol || "https";
  return `${protocol}://${host}`.replace(/\/$/, "");
}

function getSafeAbsoluteUrl(value, fallback) {
  if (isSafePublicUrl(value)) return String(value);
  return fallback;
}

function isSafePublicUrl(value) {
  if (!value) return false;
  try {
    const url = new URL(String(value));
    if (!["http:", "https:"].includes(url.protocol)) return false;
    if (process.env.NODE_ENV === "production" && /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(url.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

async function handleStripeWebhook(req, res) {
  const readiness = getReadiness();
  const webhookSecret = getEnv("STRIPE_WEBHOOK_SECRET");
  if (readiness.services.stripeWebhook !== "configured" || !webhookSecret) {
    return res.status(503).json({ ok: false, code: "setup_required", service: "stripe_webhooks" });
  }

  const verification = verifyStripeWebhookSignature(req.body, req.get("stripe-signature"), webhookSecret);
  if (!verification.ok) return res.status(400).json({ ok: false, code: "invalid_signature" });

  let event;
  try {
    event = JSON.parse(req.body.toString("utf8"));
  } catch {
    return res.status(400).json({ ok: false, code: "invalid_payload" });
  }

  const audit = await recordBillingWebhookEvent(event);
  const sync = await synchronizeBillingFromStripeEvent(event);
  return res.status(200).json({ ok: true, received: true, audited: audit.ok, synchronized: sync.ok, event_id: event.id });
}

function verifyStripeWebhookSignature(rawBody, header, secret) {
  if (!header || !Buffer.isBuffer(rawBody)) return { ok: false };
  const parts = Object.fromEntries(header.split(",").map((part) => part.split("=")));
  if (!parts.t || !parts.v1) return { ok: false };
  const expected = crypto.createHmac("sha256", secret).update(`${parts.t}.${rawBody.toString("utf8")}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(parts.v1);
  return { ok: a.length === b.length && crypto.timingSafeEqual(a, b) };
}

async function recordBillingWebhookEvent(event) {
  const config = getSupabaseServerConfig();
  if (!config.ok) return { ok: false };
  const response = await fetch(`${config.url}/rest/v1/billing_webhook_events?on_conflict=provider,provider_event_id`, {
    method: "POST",
    headers: supabaseHeaders(config, { prefer: "resolution=ignore-duplicates" }),
    body: JSON.stringify({
      provider: "stripe",
      provider_event_id: event.id,
      event_type: event.type,
      livemode: Boolean(event.livemode),
      payload: event,
      processing_status: "processed",
      processed_at: new Date().toISOString(),
      metadata: { object: event.data?.object?.object, customer: event.data?.object?.customer, subscription: event.data?.object?.subscription || event.data?.object?.id }
    })
  }).catch(() => undefined);
  return { ok: Boolean(response?.ok) };
}

async function synchronizeBillingFromStripeEvent(event) {
  if (event.type === "checkout.session.completed") return synchronizeCheckoutSessionCompleted(event);
  if (!["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"].includes(event.type)) return { ok: true, ignored: true };
  const config = getSupabaseServerConfig();
  const subscription = event.data?.object;
  const organizationId = subscription?.metadata?.organization_id;
  if (!config.ok || !subscription?.id || !organizationId) return { ok: false };
  const planSlug = subscription.metadata?.plan || "core_monthly";
  const currentPeriodEnd = Number.isFinite(subscription.current_period_end) ? new Date(subscription.current_period_end * 1000).toISOString() : null;
  const response = await fetch(`${config.url}/rest/v1/billing_subscriptions?on_conflict=provider,provider_subscription_ref`, {
    method: "POST",
    headers: supabaseHeaders(config, { prefer: "resolution=merge-duplicates" }),
    body: JSON.stringify({ organization_id: organizationId, provider: "stripe", provider_customer_ref: subscription.customer, provider_subscription_ref: subscription.id, plan_slug: planSlug, status: subscription.status, current_period_end: currentPeriodEnd, cancel_at_period_end: Boolean(subscription.cancel_at_period_end), metadata: { source: "stripe_webhook" } })
  }).catch(() => undefined);
  await fetch(`${config.url}/rest/v1/billing_entitlements?on_conflict=organization_id,entitlement_key`, {
    method: "POST",
    headers: supabaseHeaders(config, { prefer: "resolution=merge-duplicates" }),
    body: JSON.stringify({ organization_id: organizationId, entitlement_key: planSlug, status: ["active", "trialing"].includes(subscription.status) ? "active" : "disabled", source: "billing", metadata: { provider: "stripe", provider_subscription_ref: subscription.id } })
  }).catch(() => undefined);
  return { ok: Boolean(response?.ok) };
}

async function updateSupportEmailStatus(supportRequestId, email) {
  const config = getSupabaseServerConfig();
  if (!config.ok) return { ok: false };
  await fetch(`${config.url}/rest/v1/support_requests?id=eq.${encodeURIComponent(supportRequestId)}`, {
    method: "PATCH",
    headers: supabaseHeaders(config),
    body: JSON.stringify({ email_delivery_status: email.ok ? "email_sent" : "email_failed", email_error_summary: email.ok ? null : redactSensitiveText(email.error || "email_not_sent").slice(0, 240), email_retry_count: email.ok ? 0 : 1 })
  }).catch(() => undefined);
  await fetch(`${config.url}/rest/v1/support_email_delivery_attempts`, {
    method: "POST",
    headers: supabaseHeaders(config),
    body: JSON.stringify({ support_request_id: supportRequestId, delivery_status: email.ok ? "email_sent" : "email_failed", provider: "resend", sanitized_error_summary: email.ok ? null : redactSensitiveText(email.error || "email_not_sent").slice(0, 240) })
  }).catch(() => undefined);
  return { ok: true };
}

async function listSupportRequests() {
  const config = getSupabaseServerConfig();
  if (!config.ok) return { ok: false, requests: [] };
  const response = await fetch(`${config.url}/rest/v1/support_requests?select=reference_id,category,email_delivery_status,created_at&order=created_at.desc&limit=20`, { headers: supabaseHeaders(config) }).catch(() => undefined);
  if (!response?.ok) return { ok: false, requests: [] };
  return { ok: true, requests: await response.json().catch(() => []) };
}

async function getAdminMetrics() {
  const config = getSupabaseServerConfig();
  if (!config.ok) return {};
  const [users, subscriptions, webhookEvents, supportRequests, catalog] = await Promise.all([
    safeCountTable(config, "profiles"),
    safeCountTable(config, "billing_subscriptions"),
    safeCountTable(config, "billing_webhook_events"),
    safeCountTable(config, "support_requests"),
    safeCountTable(config, "product_modules")
  ]);
  return {
    users: formatMetric("Profiles", users),
    subscriptions: formatMetric("Subscription records", subscriptions),
    webhookEvents: formatMetric("Webhook events", webhookEvents),
    supportRequests: formatMetric("Support requests", supportRequests),
    catalog: formatMetric("Product modules", catalog)
  };
}

async function getBillingSummary() {
  const config = getSupabaseServerConfig();
  if (!config.ok) return { webhookEvents: "Setup required: Supabase is not configured.", subscriptions: "Setup required: Supabase is not configured." };
  const [webhookEvents, subscriptions] = await Promise.all([
    safeCountTable(config, "billing_webhook_events"),
    safeCountTable(config, "billing_subscriptions")
  ]);
  return {
    webhookEvents: formatMetric("Recorded events", webhookEvents),
    subscriptions: formatMetric("Subscription records", subscriptions)
  };
}

async function getBillingPanelSummary(organizationId) {
  const config = getSupabaseServerConfig();
  if (!config.ok) return { status: "Setup required: account database is not configured.", rows: [] };
  if (!organizationId) return { status: "Setup required: organization membership is missing.", rows: [] };
  const response = await fetch(`${config.url}/rest/v1/billing_subscriptions?select=plan_slug,status,current_period_end&organization_id=eq.${encodeURIComponent(organizationId)}&order=updated_at.desc&limit=5`, {
    headers: supabaseHeaders(config)
  }).catch(() => undefined);
  if (!response?.ok) return { status: "No subscription records returned.", rows: [] };
  const rows = await response.json().catch(() => []);
  const active = rows.find((row) => ["active", "trialing"].includes(row.status));
  return {
    status: active ? `${displayStatus(active.plan_slug)}: ${displayStatus(active.status)}` : "No active paid plan found.",
    rows
  };
}

async function getAdminOverviewJson() {
  const config = getSupabaseServerConfig();
  if (!config.ok) {
    return {
      users: { configured: false, count: null },
      organizations: { configured: false, count: null },
      activeSubscriptions: { configured: false, count: null },
      purchases: { configured: false, count: null },
      intakeRequests: { configured: false, count: null },
      supportRequests: { configured: false, count: null },
      recentActivity: []
    };
  }
  const [users, organizations, activeSubscriptions, purchases, intakeRequests, supportRequests, activity] = await Promise.all([
    safeCountTable(config, "profiles"),
    safeCountTable(config, "organizations"),
    safeCountFiltered(config, "billing_subscriptions", "?status=in.(active,trialing)&select=id&limit=1"),
    safeCountTable(config, "purchases"),
    safeCountTable(config, "intake_requests"),
    safeCountTable(config, "support_requests"),
    safeListTable("activity_events", "?select=event_type,created_at&order=created_at.desc&limit=10")
  ]);
  return {
    users: countJson(users),
    organizations: countJson(organizations),
    activeSubscriptions: countJson(activeSubscriptions),
    purchases: countJson(purchases),
    intakeRequests: countJson(intakeRequests),
    supportRequests: countJson(supportRequests),
    recentActivity: activity.ok ? activity.rows : []
  };
}

function countJson(result) {
  return { configured: Boolean(result?.ok), count: result?.ok ? result.count : null };
}

async function getBusinessEmployeeSummary(workspaceId) {
  const config = getSupabaseServerConfig();
  if (!config.ok) {
    return {
      workspaces: "Setup required: Supabase is not configured.",
      memberships: "Setup required: Supabase is not configured.",
      invites: "Setup required: Supabase is not configured."
    };
  }
  const filter = workspaceId ? `?workspace_id=eq.${encodeURIComponent(workspaceId)}&select=id&limit=1` : "?select=id&limit=1";
  const [workspaces, memberships, invites] = await Promise.all([
    workspaceId ? safeCountFiltered(config, "business_workspaces", `?id=eq.${encodeURIComponent(workspaceId)}&select=id&limit=1`) : safeCountTable(config, "business_workspaces"),
    safeCountFiltered(config, "business_memberships", filter),
    safeCountFiltered(config, "business_employee_invites", workspaceId ? `?workspace_id=eq.${encodeURIComponent(workspaceId)}&status=eq.pending&select=id&limit=1` : "?status=eq.pending&select=id&limit=1")
  ]);
  return {
    workspaces: formatMetric("Business workspaces", workspaces),
    memberships: formatMetric("Membership records", memberships),
    invites: formatMetric("Pending invites", invites)
  };
}

async function safeCountFiltered(config, table, query) {
  const response = await fetch(`${config.url}/rest/v1/${table}${query}`, {
    headers: supabaseHeaders(config, { prefer: "count=exact" })
  }).catch(() => undefined);
  if (!response?.ok) return { ok: false };
  const range = response.headers?.get?.("content-range") || "";
  const match = range.match(/\/(\d+)$/);
  if (match) return { ok: true, count: Number(match[1]) };
  const rows = await response.json().catch(() => []);
  return { ok: true, count: Array.isArray(rows) ? rows.length : 0 };
}

async function safeListTable(table, query) {
  const config = getSupabaseServerConfig();
  if (!config.ok) return { ok: false, rows: [] };
  if (!/^[a-z_]+$/i.test(table)) return { ok: false, rows: [] };
  const response = await fetch(`${config.url}/rest/v1/${table}${query}`, {
    headers: supabaseHeaders(config)
  }).catch(() => undefined);
  if (!response?.ok) return { ok: false, rows: [] };
  const rows = await response.json().catch(() => []);
  return { ok: true, rows: Array.isArray(rows) ? rows : [] };
}

async function safeCountTable(config, table) {
  const response = await fetch(`${config.url}/rest/v1/${table}?select=id&limit=1`, {
    headers: supabaseHeaders(config, { prefer: "count=exact" })
  }).catch(() => undefined);
  if (!response?.ok) return { ok: false };
  const range = response.headers?.get?.("content-range") || "";
  const match = range.match(/\/(\d+)$/);
  if (match) return { ok: true, count: Number(match[1]) };
  const rows = await response.json().catch(() => []);
  return { ok: true, count: Array.isArray(rows) ? rows.length : 0 };
}

function formatMetric(label, result) {
  if (!result?.ok) return `${label}: unavailable until Supabase tables are migrated.`;
  return `${label}: ${result.count}`;
}

async function updateUserRole(req) {
  const userId = String(req.body.userId || req.body.user_id || "").trim();
  const role = String(req.body.role || "").trim();
  const action = String(req.body.action || "grant").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
    return { status: 400, body: { ok: false, code: "validation_failed", message: "Enter a valid user ID." } };
  }
  if (!["owner", "admin", "customer", "employee"].includes(role)) {
    return { status: 400, body: { ok: false, code: "validation_failed", message: "Choose a valid role." } };
  }
  if (!["grant", "revoke"].includes(action)) {
    return { status: 400, body: { ok: false, code: "validation_failed", message: "Choose grant or revoke." } };
  }
  const config = getSupabaseServerConfig();
  if (!config.ok) return { status: 503, body: { ok: false, code: "setup_required", service: "supabase" } };
  const url = action === "grant"
    ? `${config.url}/rest/v1/user_roles?on_conflict=user_id,role`
    : `${config.url}/rest/v1/user_roles?user_id=eq.${encodeURIComponent(userId)}&role=eq.${encodeURIComponent(role)}`;
  const response = await fetch(url, {
    method: action === "grant" ? "POST" : "DELETE",
    headers: supabaseHeaders(config, action === "grant" ? { prefer: "resolution=ignore-duplicates" } : {}),
    body: action === "grant" ? JSON.stringify({ user_id: userId, role }) : undefined
  }).catch(() => undefined);
  if (!response?.ok) return { status: 502, body: { ok: false, code: "role_update_failed", role, message: "Role update could not be recorded." } };
  return { status: 200, body: { ok: true, code: "role_updated", role, action, message: `Role ${action} recorded.` } };
}

async function recordAdminAuditEvent(req, action, metadata = {}) {
  const config = getSupabaseServerConfig();
  if (!config.ok) return { ok: false };
  const user = req.sonaraAdmin?.user;
  const response = await fetch(`${config.url}/rest/v1/admin_audit_events`, {
    method: "POST",
    headers: supabaseHeaders(config),
    body: JSON.stringify({
      actor_user_id: user?.id || null,
      actor_email: user?.email || null,
      action,
      target_type: "route",
      target_id: req.path,
      metadata: {
        method: req.method,
        auth_method: req.sonaraAdmin?.method || "unknown",
        ...metadata
      }
    })
  }).catch(() => undefined);
  return { ok: Boolean(response?.ok) };
}

async function synchronizeCheckoutSessionCompleted(event) {
  const config = getSupabaseServerConfig();
  const session = event.data?.object;
  const organizationId = session?.metadata?.organization_id;
  const planSlug = session?.metadata?.plan;
  if (!config.ok || !session?.id || !organizationId || !planSlug) return { ok: true, ignored: true };
  if (session.mode === "payment" && session.payment_status === "paid") {
    await fetch(`${config.url}/rest/v1/purchases?on_conflict=stripe_checkout_session_id`, {
      method: "POST",
      headers: supabaseHeaders(config, { prefer: "resolution=merge-duplicates" }),
      body: JSON.stringify({
        user_id: session.metadata?.user_id || null,
        organization_id: organizationId,
        stripe_checkout_session_id: session.id,
        stripe_payment_intent_id: session.payment_intent || null,
        product_key: planSlug,
        price_id: session.metadata?.price_id || null,
        status: "paid"
      })
    }).catch(() => undefined);
    const entitlement = await fetch(`${config.url}/rest/v1/billing_entitlements?on_conflict=organization_id,entitlement_key`, {
      method: "POST",
      headers: supabaseHeaders(config, { prefer: "resolution=merge-duplicates" }),
      body: JSON.stringify({
        organization_id: organizationId,
        entitlement_key: planSlug,
        status: "active",
        source: "billing",
        metadata: { provider: "stripe", checkout_session_id: session.id }
      })
    }).catch(() => undefined);
    await insertActivityEvent(organizationId, session.metadata?.user_id || null, "billing.purchase_completed", { plan: planSlug, checkout_session_id: session.id });
    return { ok: Boolean(entitlement?.ok) };
  }
  return { ok: true, ignored: true };
}

function getSupabaseServerConfig() {
  const url = getEnv(["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"]);
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) return { ok: false };
  return { ok: true, url: url.replace(/\/$/, ""), serviceRoleKey };
}

function supabaseHeaders(config, options = {}) {
  const headers = { apikey: config.serviceRoleKey, Authorization: `Bearer ${config.serviceRoleKey}`, "Content-Type": "application/json" };
  if (options.prefer) headers.Prefer = options.prefer;
  return headers;
}

function formatLabel(value) {
  const labels = {
    supabase: "Account database",
    stripe: "Payment connection",
    stripeWebhook: "Payment updates",
    resend: "Email delivery",
    googleOAuth: "Google sign-in",
    adminProtection: "Founder access",
    legalPages: "Legal pages",
    checkout: "Checkout",
    emailDelivery: "Email delivery",
    accountDatabase: "Account database",
    paymentConnection: "Payment connection",
    paymentUpdates: "Payment updates",
    googleSignIn: "Google sign-in",
    founderAccess: "Founder access"
  };
  return labels[value] || value.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());
}

function redactSensitiveText(value) {
  return String(value)
    .replace(/\b(?:sk|pk|rk|whsec)_[A-Za-z0-9_]+/g, "[redacted-token]")
    .replace(/\b\d{13,19}\b/g, "[redacted-card-like-number]")
    .replace(/\b(?:password|passcode|private key|secret key)\s*[:=]\s*\S+/gi, "[redacted-secret]");
}

function escapeHtml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
