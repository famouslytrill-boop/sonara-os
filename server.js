const express = require("express");
const crypto = require("node:crypto");
const { randomUUID } = require("node:crypto");
const { URLSearchParams } = require("node:url");

const app = express();
const ADMIN_SESSION_COOKIE = "sonara_admin_session";
const ADMIN_SESSION_MAX_AGE_SECONDS = 10 * 60 * 60;

app.use(express.static("public"));

app.post("/api/webhooks/stripe", express.raw({ type: "application/json" }), async (req, res) => {
  const readiness = getReadiness();
  if (readiness.services.stripe !== "configured" || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(503).json({ ok: false, code: "setup_required", service: "stripe_webhooks" });
  }

  const verification = verifyStripeWebhookSignature(req.body, req.get("stripe-signature"), process.env.STRIPE_WEBHOOK_SECRET);
  if (!verification.ok) {
    return res.status(400).json({ ok: false, code: "invalid_signature" });
  }

  const event = JSON.parse(req.body.toString("utf8"));
  const audit = await recordBillingWebhookEvent(event);
  const sync = await synchronizeBillingFromStripeEvent(event);
  return res.status(200).json({ ok: true, received: true, audited: audit.ok, synchronized: sync.ok, event_id: event.id });
});

app.use(express.urlencoded({ extended: false }));
app.use(express.json({ limit: "64kb" }));

app.get("/", (req, res) => {
  return res.status(200).type("html").send(
    layout({
      title: "SONARA Industries",
      eyebrow: "LAUNCH OPERATING SYSTEM",
      heading: "SONARA Industries",
      body:
        "A house of focused studios for launching service businesses, creator products, and growth systems with disciplined infrastructure.",
      sections: [
        brandCard("Business Builder", "Launch-ready service business infrastructure: proof, offers, intake, payments, and operating rhythm."),
        brandCard("Creator Studio", "Creator monetization systems for assets, media, catalogs, launch offers, and owned audience workflows."),
        brandCard("Growth Studio", "Consent-safe campaign planning, customer follow-up, experiments, and operator-grade growth routines.")
      ],
      actions: [
        linkAction("/contact", "Request launch review"),
        linkAction("/pricing", "View pricing"),
        linkAction("/security", "Security posture")
      ]
    })
  );
});

registerProduct("business-builder", {
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
  name: "Creator Studio",
  body: "Creator product and catalog workspace for assets, offers, release planning, monetization readiness, and media records.",
  cards: [
    ["Asset Catalog", "Organize creator assets, catalog items, and provenance-ready records."],
    ["Creator Offers", "Prepare creator products and customer-facing offers."],
    ["Release/content checklist", "Track release and content tasks without claiming automation is live."],
    ["Monetization Readiness", "Surface payment and email setup requirements before selling."],
    ["Media & Customer Records", "Track contacts, buyers, collaborators, campaign records, and media records."]
  ],
  checklist: ["Review asset catalog", "Prepare creator offer", "Confirm release checklist", "Verify monetization readiness"]
});

registerProduct("growth-studio", {
  name: "Growth Studio",
  body: "Growth workspace for campaign planning, lead follow-up, consent-safe checklists, automation readiness, and growth records.",
  cards: [
    ["Campaign Workspace", "Plan growth campaigns and launch experiments."],
    ["Lead & Customer Follow-Up", "Prepare follow-up workflows with consent and owner review."],
    ["Consent-safe checklist", "Keep outbound actions reviewable and audit-ready."],
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
  const stripeReady = readiness.services.checkout === "enabled";
  return res.status(200).type("html").send(
    layout({
      title: "Pricing",
      eyebrow: "Commercial readiness",
      heading: "Pricing",
      body: stripeReady
        ? "Checkout is configured for server-side processing."
        : "Checkout setup required until Stripe server variables and price IDs are configured.",
      sections: [
        priceCard("Free", "$0", "Public readiness checklist and product path selection.", "free", stripeReady),
        priceCard("Starter monthly", "$7/mo", "Low-cost entry for one workspace, basic offer, intake, checklist tools, and limited records.", "starter_monthly", stripeReady),
        priceCard("Core monthly", "$19/mo", "Best value for one studio, customer records, offer records, launch readiness, and support queue.", "core_monthly", stripeReady),
        priceCard("Pro monthly", "$39/mo", "All three studios, deeper records, campaign planning, advanced readiness, and priority support queue.", "pro_monthly", stripeReady),
        priceCard("Business Builder setup", "One-time", "Manual setup package for service launch infrastructure.", "business_builder_one_time", stripeReady)
      ],
      actions: [linkAction("/contact", "Request setup"), linkAction("/legal/refund-policy", "Refund policy")]
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
        brandCard("Server-only credentials", "Service-role keys, provider secrets, webhook secrets, and admin tokens are never shipped to public clients."),
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
        brandCard("Readiness", "Provider setup is surfaced through non-secret readiness checks."),
        brandCard("Admin access", "Founder operations remain protected behind temporary server-only admin access until OAuth sessions are complete.")
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
        brandCard("Environment", "Configure Supabase, Stripe, Resend, Google OAuth, and admin access in Vercel."),
        brandCard("Payments", "Checkout remains server-gated until Stripe variables and price IDs exist."),
        brandCard("Support", "Contact requests use Supabase and Resend when configured, with safe setup required fallback behavior.")
      ],
      actions: [linkAction("/help", "Help"), linkAction("/api/readiness", "Readiness JSON"), linkAction("/", "Home")]
    })
  );
});

app.get("/login", (req, res) => {
  const readiness = getReadiness();
  if (readiness.services.googleOAuth !== "configured") {
    return res.status(200).type("html").send(
      layout({
        title: "Login",
        eyebrow: "Access readiness",
        heading: "Login",
        body: "Setup required: Google OAuth is not configured. Public pages remain available while owner credentials are added.",
        sections: [
          brandCard("Google OAuth", "Configure Google Cloud OAuth and Supabase Auth provider settings before enabling persistent sessions."),
          brandCard("Admin protection", "Founder routes remain protected by a temporary server-only admin token until OAuth sessions are complete.")
        ],
        actions: [linkAction("/docs", "Docs"), linkAction("/", "Home")]
      })
    );
  }

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "consent"
  });
  return res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

app.get("/signup", (req, res) => {
  return res.status(200).type("html").send(
    layout({
      title: "Signup",
      eyebrow: "Account readiness",
      heading: "Create an account",
      body: "Account access will unlock Business Builder, Creator Studio, and Growth Studio once Supabase Auth is configured by the owner.",
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
  return res.status(result.status).json(result.body);
});

app.post("/auth/login", async (req, res) => {
  const result = await handleEmailAuth("login", req.body);
  return res.status(result.status).json(result.body);
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
  return res.status(200).json({ ok: true, message: "No persistent session is active." });
});

app.post("/auth/logout", (req, res) => {
  return res.status(200).json({ ok: true, message: "No persistent session is active." });
});

app.get("/account", (req, res) => {
  return res.status(200).type("html").send(
    layout({
      title: "Account",
      eyebrow: "Account readiness",
      heading: "Account",
      body: getReadiness().services.supabase === "configured"
        ? "Supabase Auth is configured. Persistent session handling requires owner smoke testing before customer launch."
        : "Setup required: Connect Supabase Auth to enable account sessions.",
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

app.get("/auth/callback", (req, res) => {
  const readiness = getReadiness();
  if (readiness.services.googleOAuth !== "configured") {
    return res.status(503).json({ ok: false, code: "setup_required", service: "google_oauth" });
  }
  if (!req.query.code) return res.status(400).json({ ok: false, code: "missing_oauth_code" });
  return res.status(200).type("html").send(
    responsePage("Authentication callback received", "Google OAuth configuration is present. Session exchange remains gated until the production auth provider is connected.", [
      linkAction("/", "Home")
    ])
  );
});

app.post("/api/checkout/session", async (req, res) => {
  const plan = String(req.body.plan || "").trim();
  if (!isValidPlan(plan)) return res.status(400).json({ ok: false, code: "invalid_plan" });
  if (plan === "free") return res.status(200).json({ ok: true, code: "free_plan", redirect_url: "/contact" });

  const readiness = getReadiness();
  if (readiness.services.checkout !== "enabled") {
    return res.status(503).json({ ok: false, code: "setup_required", service: "stripe_checkout" });
  }

  const priceId = getStripePriceId(plan);
  if (!priceId) return res.status(503).json({ ok: false, code: "setup_required", service: "stripe_price" });

  const session = await createStripeCheckoutSession(plan, priceId);
  if (!session.ok) return res.status(502).json({ ok: false, code: "checkout_unavailable" });
  return res.status(200).json({ ok: true, checkout_url: session.url });
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

app.post("/api/business-builder/offers", async (req, res) => {
  const validation = requireFields(req.body, ["serviceType", "audience", "priceIdea", "deliverables"]);
  if (!validation.ok) return res.status(400).json(validation);
  const output = buildBusinessOffer(req.body);
  return res.status(200).json(await saveModuleOutput("business_builder", "offer_builder", req.body, output));
});

app.post("/api/business-builder/intake", async (req, res) => {
  const validation = requireFields(req.body, ["name", "email", "message", "serviceInterest"]);
  if (!validation.ok) return res.status(400).json(validation);
  const output = {
    referenceId: randomUUID(),
    summary: `${req.body.name} requested ${req.body.serviceInterest}.`,
    nextAction: "Review request and follow up through the support queue."
  };
  return res.status(200).json(await saveModuleOutput("business_builder", "intake_queue", req.body, output));
});

app.get("/api/business-builder/records", async (req, res) => res.status(200).json(await readModuleRecords("business_builder")));
app.get("/api/business-builder/readiness", (req, res) => res.status(200).json(productReadinessJson("business_builder")));

app.post("/api/creator-studio/assets", async (req, res) => {
  const validation = requireFields(req.body, ["title", "type", "platform", "status", "rightsNotes"]);
  if (!validation.ok) return res.status(400).json(validation);
  const output = {
    title: String(req.body.title),
    rightsReview: "Rights notes captured for owner review.",
    nextAction: "Add platform, status, and release checklist before monetization."
  };
  return res.status(200).json(await saveModuleOutput("creator_studio", "asset_catalog", req.body, output));
});

app.post("/api/creator-studio/offers", async (req, res) => {
  const validation = requireFields(req.body, ["offerType", "audience", "deliverables", "priceIdea"]);
  if (!validation.ok) return res.status(400).json(validation);
  const output = buildCreatorOffer(req.body);
  return res.status(200).json(await saveModuleOutput("creator_studio", "creator_offers", req.body, output));
});

app.get("/api/creator-studio/records", async (req, res) => res.status(200).json(await readModuleRecords("creator_studio")));
app.get("/api/creator-studio/readiness", (req, res) => res.status(200).json(productReadinessJson("creator_studio")));

app.post("/api/growth-studio/campaigns", async (req, res) => {
  const validation = requireFields(req.body, ["goal", "audience", "offer", "channel", "timeline"]);
  if (!validation.ok) return res.status(400).json(validation);
  const output = buildCampaignPlan(req.body);
  return res.status(200).json(await saveModuleOutput("growth_studio", "campaign_workspace", req.body, output));
});

app.post("/api/growth-studio/leads", async (req, res) => {
  const validation = requireFields(req.body, ["name", "email", "source", "consentStatus"]);
  if (!validation.ok) return res.status(400).json(validation);
  const output = {
    followUpPlan: "Confirm consent, use truthful subject/from lines, include unsubscribe language for commercial email, and keep audience source notes.",
    nextAction: "Review lead before any outreach."
  };
  return res.status(200).json(await saveModuleOutput("growth_studio", "lead_follow_up", req.body, output));
});

app.get("/api/growth-studio/records", async (req, res) => res.status(200).json(await readModuleRecords("growth_studio")));
app.get("/api/growth-studio/readiness", (req, res) => res.status(200).json(productReadinessJson("growth_studio")));

app.get("/api/health", (req, res) => res.status(200).json({ ok: true }));

app.get("/api/readiness", (req, res) => res.status(200).json(getReadiness()));

app.get("/manifest.webmanifest", (req, res) => res.redirect(308, "/site.webmanifest"));

app.get("/offline", (req, res) => {
  return res.status(200).type("html").send(
    responsePage("Offline", "The SONARA interface is available again when network access returns.", [linkAction("/", "Home")])
  );
});

app.get("/admin/login", (req, res) => {
  const readiness = getAdminEnvReadiness();
  const tokenReady = readiness.find((item) => item.key === "ADMIN_ACCESS_TOKEN")?.ok;
  return res.status(tokenReady ? 200 : 503).type("html").send(
    layout({
      title: "Admin login",
      eyebrow: "Founder operations",
      heading: "Admin login",
      body: tokenReady
        ? "Enter the temporary server-side admin access token to open founder operations."
        : "Admin access setup is required before founder operations can open.",
      sections: [
        adminLoginForm(),
        ...readiness.map((item) => brandCard(item.label, item.ok ? "Ready" : item.warning))
      ],
      actions: [linkAction("/", "Home")]
    })
  );
});

app.post("/admin/login", (req, res) => {
  if (getReadiness().services.adminProtection !== "configured") {
    return res.status(503).type("html").send(responsePage("Admin setup required", "Admin access requires a server-side ADMIN_ACCESS_TOKEN before browser login can be used.", [linkAction("/admin/login", "Return to admin login")]));
  }

  const token = String(req.body.token || req.body.password || "").trim();
  if (!isAdminTokenValid(token)) {
    return res.status(401).type("html").send(responsePage("Admin access denied", "The submitted admin token was not accepted.", [linkAction("/admin/login", "Return to admin login")]));
  }

  res.cookie(ADMIN_SESSION_COOKIE, createAdminSessionCookie(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS * 1000
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

app.get("/admin", requireAdmin, (req, res) => {
  const readiness = getReadiness();
  return res.status(200).type("html").send(adminPage("Admin", "Protected founder operations for launch readiness.", readiness));
});

app.get("/admin/support", requireAdmin, async (req, res) => {
  const result = await listSupportRequests();
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

app.get("/admin/billing", requireAdmin, (req, res) => {
  const readiness = getReadiness();
  return res.status(200).type("html").send(
    layout({
      title: "Billing readiness",
      eyebrow: "Founder operations",
      heading: "Billing readiness",
      body: readiness.services.checkout === "enabled" ? "Stripe checkout and webhook variables are present." : "Stripe checkout remains setup required until server variables and price IDs exist.",
      sections: [
        brandCard("Checkout", readiness.services.checkout),
        brandCard("Stripe", readiness.services.stripe),
        brandCard("Webhook audit", readiness.services.supabase === "configured" ? "database-backed audit available" : "Setup required")
      ],
      actions: [linkAction("/admin", "Admin"), linkAction("/pricing", "Pricing"), adminLogoutAction()]
    })
  );
});

app.get("/admin/env-readiness", requireAdmin, (req, res) => {
  return res.status(200).type("html").send(
    layout({
      title: "Environment readiness",
      eyebrow: "Founder operations",
      heading: "Environment readiness",
      body: "Non-secret service readiness flags. Secret values are never displayed.",
      sections: getAdminEnvReadiness().map((item) => brandCard(item.label, item.ok ? "Ready" : item.warning)),
      actions: [linkAction("/admin", "Admin"), linkAction("/admin/support", "Support queue"), linkAction("/admin/billing", "Billing"), adminLogoutAction()]
    })
  );
});

for (const page of legalPages()) {
  app.get(page.href, (req, res) => legalPage(res, page.title, page.points));
}

app.use((req, res) => res.status(404).json({ error: "not_found" }));

if (require.main === module) {
  const port = process.env.PORT || 5000;
  app.listen(port, () => console.log(`Listening on ${port}`));
}

module.exports = app;

function registerProduct(slug, config) {
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
        actions: [
          linkAction(`/${slug}/dashboard`, "Open dashboard"),
          linkAction(`/${slug}/launch-readiness`, "Launch readiness"),
          linkAction("/", "SONARA Industries")
        ]
      })
    );
  });

  app.get(`/${slug}/dashboard`, (req, res) => {
    const readiness = getReadiness();
    res.status(200).type("html").send(
      layout({
        title: `${config.name} Dashboard`,
        eyebrow: "Workspace",
        heading: `${config.name} Dashboard`,
        body: "Operational workspace with setup-aware cards. Backend-dependent actions remain gated until provider variables are configured.",
        sections: [
          brandCard("Dashboard cards", "Workspace status, provider readiness, recent activity, and customer next actions are available."),
          brandCard("Records/workspace", readiness.services.supabase === "configured" ? "Supabase-backed records can be connected." : "Setup required: Supabase is not configured."),
          brandCard("Recent activity", "No production activity is shown until backend providers are configured."),
          brandCard("Customer next actions", "Review readiness, submit launch request, or prepare product records.")
        ],
        actions: [linkAction(`/${slug}`, "Overview"), linkAction(`/${slug}/launch-readiness`, "Launch readiness"), linkAction("/", "SONARA Industries")]
      })
    );
  });

  app.get(`/${slug}/launch-readiness`, (req, res) => {
    const readiness = getReadiness();
    res.status(200).type("html").send(
      layout({
        title: `${config.name} Launch Readiness`,
        eyebrow: "Readiness",
        heading: `${config.name} Launch Readiness`,
        body: "Provider readiness is shown without exposing secrets. Missing services stay setup required.",
        sections: readinessCards(readiness),
        actions: [linkAction(`/${slug}/dashboard`, "Dashboard"), linkAction("/api/readiness", "Readiness JSON"), linkAction("/", "SONARA Industries")]
      })
    );
  });
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
      .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; margin: 28px 0 44px; }
      .card { min-height: 190px; border: 1px solid var(--line); border-radius: 18px; padding: 22px; background: rgba(17,17,25,.82); box-shadow: 0 24px 80px rgba(0,0,0,.32); }
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
  <body>
    <header>
      <a class="brand" href="/">SONARA Industries</a>
      <nav aria-label="Primary">
        <a href="/business-builder">Business Builder</a>
        <a href="/creator-studio">Creator Studio</a>
        <a href="/growth-studio">Growth Studio</a>
        <a href="/contact">Contact</a>
        <a href="/pricing">Pricing</a>
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
  </body>
</html>`;
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
    <title>${escapeHtml(title)} | SONARA Industries</title>`;
}

function responsePage(title, body, actions) {
  return layout({ title, eyebrow: "System response", heading: title, body, sections: [], actions });
}

function adminPage(title, body, readiness) {
  return layout({ title, eyebrow: "Founder operations", heading: title, body, sections: readinessCards(readiness), actions: [linkAction("/admin/support", "Support queue"), linkAction("/admin/billing", "Billing"), linkAction("/admin/env-readiness", "Env readiness"), adminLogoutAction()] });
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

function checklistCard(title, items) {
  return `<article class="card"><h2>${escapeHtml(title)}</h2><p>${items.map((item) => escapeHtml(item)).join(" / ")}</p></article>`;
}

function priceCard(name, price, description, plan, stripeReady) {
  if (plan === "free") return brandCard(`${name} - ${price}`, `${description} No checkout required.`);
  return `<article class="card">
    <h2>${escapeHtml(`${name} - ${price}`)}</h2>
    <p>${escapeHtml(`${description} ${stripeReady ? "Checkout available." : "Checkout setup required."}`)}</p>
    <form method="post" action="/api/checkout/session">
      <input type="hidden" name="plan" value="${escapeHtml(plan)}">
      <button type="submit">${stripeReady ? "Start checkout" : "Checkout setup required"}</button>
    </form>
  </article>`;
}

function linkAction(href, label) {
  return `<a class="action" href="${escapeHtml(href)}">${escapeHtml(label)}</a>`;
}

function adminLogoutAction() {
  return `<form method="post" action="/admin/logout"><button class="action" type="submit">Logout</button></form>`;
}

function adminLoginForm() {
  return `<article class="card">
    <h2>Protected access</h2>
    <form method="post" action="/admin/login">
      <label>Admin token<input name="token" type="password" autocomplete="current-password" required></label>
      <button type="submit">Open admin</button>
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

function authForm(label, action) {
  return `<article class="card">
    <h2>${escapeHtml(label)}</h2>
    <form method="post" action="${escapeHtml(action)}">
      <label>Email<input name="email" type="email" required></label>
      <label>Password<input name="password" type="password" required></label>
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
    brandCard("Support preference", "Connect Supabase and Resend to enable the support queue.")
  ];
}

function legalPage(res, title, points) {
  return res.status(200).type("html").send(
    layout({
      title,
      eyebrow: "Legal",
      heading: title,
      body: "Owner-review-required draft for SONARA Industries production launch. This page requires qualified legal review before paid public launch and is not legal advice.",
      sections: points.map((point, index) => brandCard(`Section ${index + 1}`, point)),
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
    { href: "/legal/subprocessor-notice", title: "Subprocessor Notice", points: ["Configured infrastructure providers may process data to operate the service.", "Provider use depends on owner configuration and production settings.", "Customers should review processor terms before paid public launch."] }
  ];
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
  return { ok: true, referenceId, status: "setup_required", message: `Setup required: Supabase is not configured, so the request used the safe fallback queue. Reference ID: ${referenceId}.` };
}

async function sendSupportNotification(request) {
  if (getReadiness().services.emailDelivery !== "enabled") return { ok: false, error: "resend_not_configured" };
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL,
      to: [process.env.SUPPORT_TO_EMAIL],
      subject: `SONARA support request ${request.referenceId}: ${request.subject}`,
      text: [`Reference ID: ${request.referenceId}`, `Category: ${request.category}`, `Name: ${request.name}`, `Requester: ${request.email}`, "", redactSensitiveText(request.message)].join("\n")
    })
  }).catch(() => undefined);
  return response?.ok ? { ok: true } : { ok: false, error: `resend_${response?.status || "unavailable"}` };
}

function getReadiness() {
  const supabase = missing(["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]);
  const stripe = missing(["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_PRICE_STARTER_MONTHLY", "STRIPE_PRICE_CORE_MONTHLY", "STRIPE_PRICE_PRO_MONTHLY", "STRIPE_PRICE_BUSINESS_BUILDER_ONE_TIME", "STRIPE_SUCCESS_URL", "STRIPE_CANCEL_URL"]);
  const resend = missing(["RESEND_API_KEY", "RESEND_FROM_EMAIL", "SUPPORT_TO_EMAIL"]);
  const googleOAuth = missing(["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI", "PUBLIC_SITE_URL"]);
  const adminProtection = missing(["ADMIN_ACCESS_TOKEN", "ADMIN_EMAILS"]);
  return {
    ok: true,
    services: {
      supabase: supabase.length ? "missing" : "configured",
      stripe: stripe.length ? "missing" : "configured",
      resend: resend.length ? "missing" : "configured",
      googleOAuth: googleOAuth.length ? "missing" : "configured",
      adminProtection: adminProtection.length ? "missing" : "configured",
      legalPages: "review_required",
      checkout: stripe.length ? "setup_required" : "enabled",
      emailDelivery: resend.length ? "setup_required" : "enabled"
    },
    missing: { supabase, stripe, resend, googleOAuth, adminProtection }
  };
}

function getAdminEnvReadiness() {
  const adminToken = process.env.ADMIN_ACCESS_TOKEN || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return [
    { key: "ADMIN_ACCESS_TOKEN", label: "ADMIN_ACCESS_TOKEN", ok: Boolean(adminToken), warning: "ADMIN_ACCESS_TOKEN is required for temporary founder access." },
    { key: "ADMIN_ACCESS_TOKEN_NOT_PLACEHOLDER", label: "ADMIN_ACCESS_TOKEN placeholder check", ok: Boolean(adminToken) && !/^A+$/i.test(adminToken), warning: "ADMIN_ACCESS_TOKEN must not use an all-A placeholder value." },
    { key: "ADMIN_ACCESS_TOKEN_LENGTH", label: "ADMIN_ACCESS_TOKEN length", ok: adminToken.length >= 32, warning: "ADMIN_ACCESS_TOKEN should be at least 32 characters." },
    { key: "STRIPE_PRICE_STARTER_MONTHLY", label: "STRIPE_PRICE_STARTER_MONTHLY", ok: startsWithEnv("STRIPE_PRICE_STARTER_MONTHLY", "price_"), warning: "Starter monthly price ID should start with price_." },
    { key: "STRIPE_PRICE_CORE_MONTHLY", label: "STRIPE_PRICE_CORE_MONTHLY", ok: startsWithEnv("STRIPE_PRICE_CORE_MONTHLY", "price_"), warning: "Core monthly price ID should start with price_." },
    { key: "STRIPE_SECRET_KEY", label: "STRIPE_SECRET_KEY", ok: startsWithAnyEnv("STRIPE_SECRET_KEY", ["sk_live_", "sk_test_"]), warning: "Stripe secret key should start with sk_live_ or sk_test_." },
    { key: "STRIPE_WEBHOOK_SECRET", label: "STRIPE_WEBHOOK_SECRET", ok: startsWithEnv("STRIPE_WEBHOOK_SECRET", "whsec_"), warning: "Stripe webhook secret should start with whsec_." },
    { key: "SUPABASE_URL", label: "SUPABASE_URL", ok: /^https:\/\/.+\.supabase\.co\/?$/.test(process.env.SUPABASE_URL || ""), warning: "Supabase URL should start with https:// and include .supabase.co." },
    { key: "SUPABASE_SERVICE_ROLE_KEY", label: "SUPABASE_SERVICE_ROLE_KEY", ok: Boolean(serviceRoleKey), warning: "Supabase service role key must exist server-side only." }
  ];
}

function startsWithEnv(key, prefix) {
  return String(process.env[key] || "").startsWith(prefix);
}

function startsWithAnyEnv(key, prefixes) {
  const value = String(process.env[key] || "");
  return prefixes.some((prefix) => value.startsWith(prefix));
}

function isSupabaseConfigured() {
  return getReadiness().services.supabase === "configured";
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

async function safeInsertModuleOutput(productKey, moduleKey, input, output) {
  const config = getSupabaseAdminClient();
  if (!config.ok) return { ok: false, code: "setup_required" };
  const response = await fetch(`${config.url}/rest/v1/module_outputs`, {
    method: "POST",
    headers: supabaseHeaders(config, { prefer: "return=representation" }),
    body: JSON.stringify({ product_key: productKey, module_key: moduleKey, input_payload: input, output_payload: output })
  }).catch(() => undefined);
  return { ok: Boolean(response?.ok), rows: response?.ok ? await response.json().catch(() => []) : [] };
}

async function safeReadOrganizationScopedRecords(productKey) {
  const config = getSupabaseAdminClient();
  if (!config.ok) return { ok: false, code: "setup_required", records: [] };
  const response = await fetch(`${config.url}/rest/v1/module_outputs?select=id,module_key,created_at,output_payload&product_key=eq.${encodeURIComponent(productKey)}&order=created_at.desc&limit=20`, {
    headers: supabaseHeaders(config)
  }).catch(() => undefined);
  if (!response?.ok) return { ok: false, code: "read_failed", records: [] };
  return { ok: true, records: await response.json().catch(() => []) };
}

async function saveModuleOutput(productKey, moduleKey, input, output) {
  const saved = await safeInsertModuleOutput(productKey, moduleKey, input, output);
  return {
    ok: true,
    saved: saved.ok,
    code: saved.ok ? "saved" : "setup_required",
    productKey,
    moduleKey,
    output
  };
}

async function readModuleRecords(productKey) {
  const result = await safeReadOrganizationScopedRecords(productKey);
  return {
    ok: true,
    saved: result.ok,
    code: result.ok ? "records_available" : "setup_required",
    productKey,
    records: result.records
  };
}

function productReadinessJson(productKey) {
  return { ok: true, productKey, readiness: getReadiness().services };
}

function requireFields(body, fields) {
  const missingFields = fields.filter((field) => !String(body[field] || "").trim());
  if (missingFields.length) return { ok: false, code: "validation_failed", missing: missingFields };
  return { ok: true };
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

function missing(keys) {
  return keys.filter((key) => !process.env[key]);
}

async function handleEmailAuth(mode, body) {
  if (!isSupabaseConfigured()) {
    return { status: 503, body: { ok: false, code: "setup_required", service: "supabase_auth" } };
  }
  const email = String(body.email || "").trim();
  const password = String(body.password || "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8) {
    return { status: 400, body: { ok: false, code: "validation_failed" } };
  }

  const endpoint = mode === "signup" ? "/auth/v1/signup" : "/auth/v1/token?grant_type=password";
  const config = getSupabaseServerClient();
  const response = await fetch(`${config.url}${endpoint}`, {
    method: "POST",
    headers: {
      apikey: process.env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email, password })
  }).catch(() => undefined);

  if (!response?.ok) return { status: 401, body: { ok: false, code: "auth_not_completed" } };
  return { status: 200, body: { ok: true, code: mode === "signup" ? "signup_requested" : "login_ready", sessionStored: false } };
}

function requireAdmin(req, res, next) {
  if (getReadiness().services.adminProtection !== "configured") {
    if (acceptsHtml(req)) return res.redirect(303, "/admin/login");
    return res.status(503).json({ ok: false, code: "setup_required", service: "admin_access" });
  }

  if (isAdminTokenValid(getAdminRequestToken(req)) || isAdminSessionCookieValid(req)) return next();

  if (acceptsHtml(req)) return res.redirect(303, "/admin/login");
  return res.status(401).json({ ok: false, code: "admin_auth_required" });
}

function getAdminRequestToken(req) {
  const authHeader = String(req.get("authorization") || "");
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  return [
    bearerMatch?.[1],
    req.get("x-admin-token"),
    req.get("x-admin-access-token"),
    typeof req.query.admin_token === "string" ? req.query.admin_token : ""
  ].find((value) => String(value || "").trim()) || "";
}

function isAdminTokenValid(token) {
  return timingSafeCompare(String(token || ""), String(process.env.ADMIN_ACCESS_TOKEN || ""));
}

function timingSafeCompare(a, b) {
  if (!a || !b) return false;
  const left = crypto.createHash("sha256").update(String(a)).digest();
  const right = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(left, right);
}

function acceptsHtml(req) {
  const accept = String(req.get("accept") || "");
  return accept.includes("text/html") && !accept.includes("application/json");
}

function createAdminSessionCookie() {
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({
    iat: now,
    exp: now + ADMIN_SESSION_MAX_AGE_SECONDS,
    nonce: randomUUID()
  })).toString("base64url");
  return `${payload}.${signAdminSessionPayload(payload)}`;
}

function isAdminSessionCookieValid(req) {
  const value = getCookie(req, ADMIN_SESSION_COOKIE);
  if (!value || !value.includes(".")) return false;
  const [payload, signature] = value.split(".");
  if (!payload || !signature || !timingSafeCompare(signature, signAdminSessionPayload(payload))) return false;

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return Number.isFinite(session.exp) && session.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

function signAdminSessionPayload(payload) {
  return crypto.createHmac("sha256", process.env.ADMIN_ACCESS_TOKEN || "admin-session-not-configured").update(payload).digest("base64url");
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
  return ["free", "starter_monthly", "core_monthly", "pro_monthly", "business_builder_one_time"].includes(plan);
}

function getStripePriceId(plan) {
  return {
    starter_monthly: process.env.STRIPE_PRICE_STARTER_MONTHLY,
    core_monthly: process.env.STRIPE_PRICE_CORE_MONTHLY,
    pro_monthly: process.env.STRIPE_PRICE_PRO_MONTHLY,
    business_builder_one_time: process.env.STRIPE_PRICE_BUSINESS_BUILDER_ONE_TIME
  }[plan];
}

async function createStripeCheckoutSession(plan, priceId) {
  const params = new URLSearchParams({
    mode: plan === "business_builder_one_time" ? "payment" : "subscription",
    success_url: process.env.STRIPE_SUCCESS_URL,
    cancel_url: process.env.STRIPE_CANCEL_URL,
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
    "metadata[plan]": plan
  });
  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString()
  }).catch(() => undefined);
  if (!response?.ok) return { ok: false };
  const session = await response.json();
  return { ok: true, url: session.url };
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
  const response = await fetch(`${config.url}/rest/v1/billing_webhook_events`, {
    method: "POST",
    headers: supabaseHeaders(config, { prefer: "resolution=ignore-duplicates" }),
    body: JSON.stringify({
      provider: "stripe",
      provider_event_id: event.id,
      event_type: event.type,
      livemode: Boolean(event.livemode),
      processing_status: "processed",
      processed_at: new Date().toISOString(),
      metadata: { object: event.data?.object?.object, customer: event.data?.object?.customer, subscription: event.data?.object?.subscription || event.data?.object?.id }
    })
  }).catch(() => undefined);
  return { ok: Boolean(response?.ok) };
}

async function synchronizeBillingFromStripeEvent(event) {
  if (!["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"].includes(event.type)) return { ok: true, ignored: true };
  const config = getSupabaseServerConfig();
  const subscription = event.data?.object;
  const organizationId = subscription?.metadata?.organization_id;
  if (!config.ok || !subscription?.id || !organizationId) return { ok: false };
  const planSlug = subscription.metadata?.plan || "core_monthly";
  const response = await fetch(`${config.url}/rest/v1/billing_subscriptions`, {
    method: "POST",
    headers: supabaseHeaders(config, { prefer: "resolution=merge-duplicates" }),
    body: JSON.stringify({ organization_id: organizationId, provider: "stripe", provider_customer_ref: subscription.customer, provider_subscription_ref: subscription.id, plan_slug: planSlug, status: subscription.status, cancel_at_period_end: Boolean(subscription.cancel_at_period_end), metadata: { source: "stripe_webhook" } })
  }).catch(() => undefined);
  await fetch(`${config.url}/rest/v1/billing_entitlements`, {
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

function getSupabaseServerConfig() {
  const url = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceRoleKey) return { ok: false };
  return { ok: true, url: url.replace(/\/$/, ""), serviceRoleKey };
}

function supabaseHeaders(config, options = {}) {
  const headers = { apikey: config.serviceRoleKey, Authorization: `Bearer ${config.serviceRoleKey}`, "Content-Type": "application/json" };
  if (options.prefer) headers.Prefer = options.prefer;
  return headers;
}

function formatLabel(value) {
  return value.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());
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
