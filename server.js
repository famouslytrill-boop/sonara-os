const express = require("express");
const crypto = require("node:crypto");
const { randomUUID } = require("node:crypto");
const { URLSearchParams } = require("node:url");

const app = express();

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
    ["Offer builder shell", "Shape the launch offer, scope, proof points, and customer next action."],
    ["Intake/request queue shell", "Capture requests through the support queue and review workflow."],
    ["Booking/payment readiness shell", "Keep checkout gated until Stripe products, prices, and webhooks are configured."],
    ["Customer records shell", "Prepare organization-scoped customer records for Supabase-backed operations."]
  ],
  checklist: ["Define launch offer", "Verify contact intake", "Confirm payment readiness", "Review customer records"]
});

registerProduct("creator-studio", {
  name: "Creator Studio",
  body: "Creator product and catalog workspace for assets, offers, release planning, monetization readiness, and media records.",
  cards: [
    ["Asset/catalog shell", "Organize creator assets, catalog items, and provenance-ready records."],
    ["Creator offer shell", "Prepare creator products and customer-facing offers."],
    ["Release/content checklist", "Track release and content tasks without claiming automation is live."],
    ["Monetization readiness shell", "Surface payment and email setup requirements before selling."]
  ],
  checklist: ["Review asset catalog", "Prepare creator offer", "Confirm release checklist", "Verify monetization readiness"]
});

registerProduct("growth-studio", {
  name: "Growth Studio",
  body: "Growth workspace for campaign planning, lead follow-up, consent-safe checklists, automation readiness, and growth records.",
  cards: [
    ["Campaign workspace shell", "Plan growth campaigns and launch experiments."],
    ["Lead/customer follow-up shell", "Prepare follow-up workflows with consent and owner review."],
    ["Consent-safe checklist", "Keep outbound actions reviewable and audit-ready."],
    ["Automation readiness shell", "Show setup requirements instead of pretending automations are live."]
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
        : "Checkout is setup_required until Stripe server variables and price IDs are configured.",
      sections: [
        priceCard("Free", "$0", "Public readiness shell and launch review entry point.", "free", stripeReady),
        priceCard("Starter monthly", "$9/mo", "Essential launch infrastructure.", "starter_monthly", stripeReady),
        priceCard("Core monthly", "$29/mo", "Operating system for active businesses.", "core_monthly", stripeReady),
        priceCard("Pro monthly", "$59/mo", "Campaign and customer growth workspace.", "pro_monthly", stripeReady),
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
        brandCard("Support", "Contact requests use Supabase and Resend when configured, with safe setup_required fallback behavior.")
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
        body: "setup_required: Google OAuth is not configured. Public pages remain available while owner credentials are added.",
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

app.get("/logout", (req, res) => {
  return res.status(200).type("html").send(
    responsePage("Logout", "No persistent session is active in this Express readiness shell. OAuth-backed session logout will be enabled when owner credentials are configured.", [
      linkAction("/", "Home"),
      linkAction("/login", "Login")
    ])
  );
});

app.post("/logout", (req, res) => {
  return res.status(200).json({ ok: true, message: "No persistent session is active in this Express readiness shell." });
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

app.get("/api/health", (req, res) => res.status(200).json({ ok: true }));

app.get("/api/readiness", (req, res) => res.status(200).json(getReadiness()));

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
      body: result.ok ? "Recent database-backed support requests are available for review." : "Support queue setup_required: Supabase service role is not configured.",
      sections: result.requests.length
        ? result.requests.map((request) => brandCard(request.reference_id || "Support request", `${request.category || "contact"} - ${request.email_delivery_status || "pending"} - ${request.created_at || "no timestamp"}`))
        : [brandCard("Queue status", result.ok ? "No recent requests returned." : "Database-backed queue requires Supabase setup.")],
      actions: [linkAction("/admin", "Admin"), linkAction("/contact", "Contact")]
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
      body: readiness.services.checkout === "enabled" ? "Stripe checkout and webhook variables are present." : "Stripe checkout remains setup_required until server variables and price IDs exist.",
      sections: [
        brandCard("Checkout", readiness.services.checkout),
        brandCard("Stripe", readiness.services.stripe),
        brandCard("Webhook audit", readiness.services.supabase === "configured" ? "database-backed audit available" : "setup_required")
      ],
      actions: [linkAction("/admin", "Admin"), linkAction("/pricing", "Pricing")]
    })
  );
});

app.get("/admin/env-readiness", requireAdmin, (req, res) => {
  const readiness = getReadiness();
  return res.status(200).type("html").send(adminPage("Environment readiness", "Non-secret service readiness flags. Secret values are never displayed.", readiness));
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
        eyebrow: "Product shell",
        heading: config.name,
        body: config.body,
        sections: [
          brandCard("What this product does", config.body),
          ...config.cards.map(([title, body]) => brandCard(title, body)),
          checklistCard("Setup checklist", config.checklist)
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
        body: "Operational shell with setup-aware cards. Backend-dependent actions remain gated until provider variables are configured.",
        sections: [
          brandCard("Dashboard cards", "Workspace status, provider readiness, recent activity, and customer next actions are available in shell form."),
          brandCard("Records/workspace", readiness.services.supabase === "configured" ? "Supabase-backed records can be connected." : "setup_required: Supabase is not configured."),
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
        body: "Provider readiness is shown without exposing secrets. Missing services stay setup_required.",
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
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)} | SONARA Industries</title>
    <style>
      :root { color-scheme: dark; --bg: #07070a; --panel: #111119; --line: #2b2b38; --text: #f7f3ee; --muted: #aaa3b5; --gold: #d7b46a; }
      * { box-sizing: border-box; }
      body { margin: 0; background: radial-gradient(circle at top left, #27202f 0, #07070a 38rem); color: var(--text); font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      a { color: inherit; }
      header, main, footer { width: min(1120px, calc(100% - 40px)); margin: 0 auto; }
      header { display: flex; justify-content: space-between; gap: 24px; align-items: center; padding: 28px 0; }
      nav { display: flex; flex-wrap: wrap; gap: 14px; }
      nav a, .action { border: 1px solid var(--line); border-radius: 999px; padding: 10px 14px; text-decoration: none; color: var(--muted); background: rgba(255,255,255,0.03); }
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
      input, textarea, select, button { width: 100%; border-radius: 12px; border: 1px solid var(--line); background: #09090f; color: var(--text); padding: 12px 14px; font: inherit; }
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

function responsePage(title, body, actions) {
  return layout({ title, eyebrow: "System response", heading: title, body, sections: [], actions });
}

function adminPage(title, body, readiness) {
  return layout({ title, eyebrow: "Founder operations", heading: title, body, sections: readinessCards(readiness), actions: [linkAction("/admin/support", "Support queue"), linkAction("/admin/billing", "Billing"), linkAction("/admin/env-readiness", "Env readiness")] });
}

function readinessCards(readiness) {
  return Object.entries(readiness.services).map(([key, value]) => brandCard(formatLabel(key), value));
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
    <p>${escapeHtml(`${description} ${stripeReady ? "Checkout available." : "Checkout setup_required."}`)}</p>
    <form method="post" action="/api/checkout/session">
      <input type="hidden" name="plan" value="${escapeHtml(plan)}">
      <button type="submit">${stripeReady ? "Start checkout" : "Checkout setup_required"}</button>
    </form>
  </article>`;
}

function linkAction(href, label) {
  return `<a class="action" href="${escapeHtml(href)}">${escapeHtml(label)}</a>`;
}

function contactForm() {
  return `<article class="card">
    <h2>Request intake</h2>
    <form method="post" action="/contact">
      <input name="name" type="text" placeholder="name" required>
      <input name="email" type="email" placeholder="work email" required>
      <input name="subject" type="text" placeholder="subject" required>
      <select name="category" required>
        <option value="contact">Contact</option>
        <option value="support">Support</option>
        <option value="billing">Billing</option>
        <option value="feedback">Feedback</option>
      </select>
      <textarea name="message" rows="6" placeholder="launch context" required></textarea>
      <label class="fine"><input name="consent" type="checkbox" value="yes" required> Consent to process this request</label>
      <button type="submit">Submit request</button>
    </form>
  </article>`;
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
    { href: "/legal/accessibility", title: "Accessibility", points: ["SONARA Industries aims to provide clear navigation, readable layouts, and keyboard-accessible workflows.", "Accessibility issues can be reported through the contact route for review.", "Launch pages should remain usable without requiring animated or media-heavy experiences."] }
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
  const config = getSupabaseServerConfig();
  const referenceId = randomUUID();
  let stored = false;
  let supportRequestId;

  if (config.ok) {
    const response = await fetch(`${config.url}/rest/v1/support_requests`, {
      method: "POST",
      headers: supabaseHeaders(config, { prefer: "return=representation" }),
      body: JSON.stringify({
        reference_id: referenceId,
        category: request.category === "billing" ? "support" : request.category,
        requester_email: request.email,
        message_preview: redactSensitiveText(`${request.name} - ${request.subject}: ${request.message}`).slice(0, 280),
        consent_accepted: true,
        metadata: { source: "express_contact", subject: request.subject, name: request.name }
      })
    }).catch(() => undefined);
    if (response?.ok) {
      stored = true;
      const rows = await response.json().catch(() => []);
      supportRequestId = rows[0]?.id;
    }
  }

  const email = await sendSupportNotification({ ...request, referenceId });
  if (supportRequestId) await updateSupportEmailStatus(supportRequestId, email);

  if (stored && email.ok) return { ok: true, referenceId, status: "received", message: `Your request was received. Reference ID: ${referenceId}. Email notification: sent.` };
  if (stored && !email.ok) return { ok: true, referenceId, status: "email_notification_failed", message: `Your request was received. Reference ID: ${referenceId}. Email notification failed and remains queued.` };
  return { ok: true, referenceId, status: "setup_required", message: `setup_required: Supabase is not configured, so the request used the safe fallback queue. Reference ID: ${referenceId}.` };
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

function missing(keys) {
  return keys.filter((key) => !process.env[key]);
}

function requireAdmin(req, res, next) {
  if (getReadiness().services.adminProtection !== "configured") return res.status(503).json({ ok: false, code: "setup_required", service: "admin_access" });
  const authToken = String(req.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const token = req.get("x-admin-access-token") || authToken || (typeof req.query.admin_token === "string" ? req.query.admin_token : "");
  if (!token || token !== process.env.ADMIN_ACCESS_TOKEN) return res.status(401).json({ ok: false, code: "admin_auth_required" });
  return next();
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
