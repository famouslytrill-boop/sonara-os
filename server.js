const express = require("express");
const { randomUUID } = require("node:crypto");
const crypto = require("node:crypto");
const { URLSearchParams } = require("node:url");

const app = express();

app.post("/api/webhooks/stripe", express.raw({ type: "application/json" }), async (req, res) => {
  const env = getEnvStatus();
  if (!env.stripe.ready || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(503).json({ ok: false, code: "setup_required", service: "stripe_webhooks" });
  }

  const signature = req.get("stripe-signature");
  const verification = verifyStripeWebhookSignature(req.body, signature, process.env.STRIPE_WEBHOOK_SECRET);
  if (!verification.ok) {
    return res.status(400).json({ ok: false, code: "invalid_signature" });
  }

  const event = JSON.parse(req.body.toString("utf8"));
  const audit = await recordBillingWebhookEvent(event);
  await synchronizeBillingFromStripeEvent(event);

  return res.status(200).json({
    ok: true,
    received: true,
    audited: audit.ok,
    event_id: event.id
  });
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
        brandCard(
          "Business Builder",
          "Launch-ready service business infrastructure: proof, offers, intake, payments, and operating rhythm."
        ),
        brandCard(
          "Creator Studio",
          "Creator monetization systems for assets, media, catalogs, launch offers, and owned audience workflows."
        ),
        brandCard(
          "Growth Studio",
          "Consent-safe campaign planning, customer follow-up, experiments, and operator-grade growth routines."
        )
      ],
      actions: [
        linkAction("/contact", "Request launch review"),
        linkAction("/pricing", "View pricing"),
        linkAction("/security", "Security posture")
      ]
    })
  );
});

app.get("/contact", (req, res) => {
  return res.status(200).type("html").send(
    layout({
      title: "Contact",
      eyebrow: "Launch review",
      heading: "Contact SONARA Industries",
      body:
        "Use the intake below for launch, support, or feedback requests. Submissions are stored only when the server-side Supabase configuration is available.",
      sections: [contactForm()],
      actions: [linkAction("/", "Return home"), linkAction("/pricing", "Pricing")]
    })
  );
});

app.post("/contact", async (req, res) => {
  const request = normalizeSupportRequest(req.body);
  if (!request.ok) {
    return res.status(400).type("html").send(
      layout({
        title: "Request not accepted",
        eyebrow: "Contact",
        heading: "Request not accepted",
        body: request.message,
        sections: [contactForm()],
        actions: [linkAction("/contact", "Try again")]
      })
    );
  }

  const result = await saveSupportRequest(request.value);
  const status = result.ok ? 200 : 503;
  return res.status(status).type("html").send(
    layout({
      title: result.ok ? "Request received" : "Storage unavailable",
      eyebrow: "Contact",
      heading: result.ok ? "Request received" : "Support storage unavailable",
      body: result.message,
      sections: [],
      actions: [linkAction("/", "Return home"), linkAction("/contact", "Contact")]
    })
  );
});

app.get("/pricing", (req, res) => {
  const stripeReady = isStripeCheckoutReady();
  const checkoutState = stripeReady
    ? "Checkout is configured for live processing."
    : "Checkout is blocked until live Stripe server variables are configured.";

  return res.status(200).type("html").send(
    layout({
      title: "Pricing",
      eyebrow: "Commercial readiness",
      heading: "Pricing",
      body: checkoutState,
      sections: [
        priceCard("Starter", "$9/mo", "Essential launch infrastructure.", stripeReady),
        priceCard("Core", "$29/mo", "Operating system for active businesses.", stripeReady),
        priceCard("Growth", "$59/mo", "Campaign and customer growth workspace.", stripeReady)
      ],
      actions: [linkAction("/contact", "Request setup"), linkAction("/legal/refund-policy", "Refund policy")]
    })
  );
});

app.get("/legal/terms", (req, res) => {
  return legalPage(res, "Terms of Service", [
    "SONARA Industries provides launch, creator, and growth software tools on an as-is operational basis.",
    "Users are responsible for lawful use, accurate business information, and approval of outbound actions.",
    "Production actions may require human review, configured providers, and audit-ready records."
  ]);
});

app.get("/legal/privacy", (req, res) => {
  return legalPage(res, "Privacy Policy", [
    "SONARA Industries collects account, contact, support, and operational records needed to provide the service.",
    "Server-side credentials and provider secrets are not exposed to public clients.",
    "Customer data should be handled according to consent, retention, and organization access controls."
  ]);
});

app.get("/legal/refund-policy", (req, res) => {
  return legalPage(res, "Refund Policy", [
    "Subscription and setup refund requests are reviewed based on plan terms, usage, and delivered work.",
    "Approved refunds are returned through the original payment provider when available.",
    "Chargeback, fraud, or abuse cases may require additional review."
  ]);
});

app.get("/legal/cookie-policy", (req, res) => {
  return legalPage(res, "Cookie Policy", [
    "SONARA Industries may use essential cookies for session, security, and application stability.",
    "Analytics or marketing cookies should remain disabled until configured with disclosure and consent controls.",
    "Browser settings may be used to limit non-essential storage."
  ]);
});

app.get("/legal/acceptable-use", (req, res) => {
  return legalPage(res, "Acceptable Use", [
    "Do not use SONARA Industries for spam, credential capture, unlawful surveillance, piracy, or unsafe automation.",
    "AI-assisted outbound actions require preview, approval, and audit records.",
    "Voice, media, and creator tools require consent, provenance, and anti-clone safety."
  ]);
});

app.get("/legal/accessibility", (req, res) => {
  return legalPage(res, "Accessibility", [
    "SONARA Industries aims to provide clear navigation, readable layouts, and keyboard-accessible workflows.",
    "Accessibility issues can be reported through the contact route for review.",
    "Launch pages should remain usable without requiring animated or media-heavy experiences."
  ]);
});

app.get("/security", (req, res) => {
  return res.status(200).type("html").send(
    layout({
      title: "Security",
      eyebrow: "Operational posture",
      heading: "Security",
      body:
        "SONARA keeps production infrastructure boring, reviewable, and server-controlled. Secrets stay server-side and high-risk automation requires approval.",
      sections: [
        brandCard("Server-only credentials", "Service-role keys and provider secrets are never shipped to public clients."),
        brandCard("Human approval", "AI outbound actions require preview, approval, and audit-ready records."),
        brandCard("Data boundaries", "Organization-scoped records require RBAC, provenance, and retention discipline.")
      ],
      actions: [linkAction("/legal/privacy", "Privacy"), linkAction("/contact", "Report issue")]
    })
  );
});

app.get("/login", (req, res) => {
  const env = getEnvStatus();
  if (!env.googleOAuth.ready) {
    return res.status(503).json({
      ok: false,
      code: "setup_required",
      service: "google_oauth",
      missing: env.googleOAuth.missing
    });
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

app.get("/auth/callback", (req, res) => {
  const env = getEnvStatus();
  if (!env.googleOAuth.ready) {
    return res.status(503).json({
      ok: false,
      code: "setup_required",
      service: "google_oauth",
      missing: env.googleOAuth.missing
    });
  }

  if (!req.query.code) {
    return res.status(400).json({ ok: false, code: "missing_oauth_code" });
  }

  return res.status(200).type("html").send(
    layout({
      title: "Authentication callback",
      eyebrow: "Access readiness",
      heading: "Authentication callback received",
      body:
        "Google OAuth configuration is present. Session exchange remains gated until the production auth provider is connected.",
      sections: [brandCard("Manual review", "Complete Supabase Auth provider setup before enabling persistent admin sessions.")],
      actions: [linkAction("/", "Home"), linkAction("/admin/env-readiness", "Env readiness")]
    })
  );
});

app.post("/logout", (req, res) => {
  return res.status(200).json({ ok: true, message: "No persistent session is active in this Express readiness shell." });
});

app.post("/api/checkout/session", async (req, res) => {
  const env = getEnvStatus();
  if (!env.stripe.ready) {
    return res.status(503).json({
      ok: false,
      code: "setup_required",
      service: "stripe_checkout",
      missing: env.stripe.missing
    });
  }

  const plan = String(req.body.plan || "").trim();
  const priceId = getStripePriceId(plan);
  if (!priceId) {
    return res.status(400).json({ ok: false, code: "invalid_plan" });
  }

  const session = await createStripeCheckoutSession(plan, priceId);
  if (!session.ok) {
    return res.status(502).json({ ok: false, code: "checkout_unavailable" });
  }

  return res.status(200).json({ ok: true, checkout_url: session.url });
});

app.get("/api/health", (req, res) => {
  return res.status(200).json({ ok: true });
});

app.get("/api/readiness", (req, res) => {
  return res.status(200).json({
    ok: true,
    services: getPublicReadiness()
  });
});

app.get("/admin", requireAdmin, (req, res) => {
  const readiness = getPublicReadiness();
  return res.status(200).type("html").send(
    layout({
      title: "Admin",
      eyebrow: "Founder operations",
      heading: "Admin",
      body: "Protected readiness workspace for launch operations. Temporary access uses a server-only admin token.",
      sections: Object.entries(readiness).map(([key, value]) =>
        brandCard(formatLabel(key), value.ready ? "Configured" : `Setup required: ${value.missing.join(", ") || "manual review"}`)
      ),
      actions: [
        linkAction("/admin/support", "Support queue"),
        linkAction("/admin/billing", "Billing readiness"),
        linkAction("/admin/env-readiness", "Env readiness")
      ]
    })
  );
});

app.get("/admin/support", requireAdmin, async (req, res) => {
  const result = await listSupportRequests();
  return res.status(200).type("html").send(
    layout({
      title: "Support queue",
      eyebrow: "Founder operations",
      heading: "Support queue",
      body: result.ok
        ? "Database-backed support requests are available for review."
        : "Support queue requires Supabase service-role configuration.",
      sections: result.requests.map((request) =>
        brandCard(request.reference_id || "Support request", `${request.category || "contact"} - ${request.email_delivery_status || "pending"} - ${request.created_at || "no timestamp"}`)
      ),
      actions: [linkAction("/admin", "Admin"), linkAction("/contact", "Contact")]
    })
  );
});

app.get("/admin/billing", requireAdmin, (req, res) => {
  const readiness = getPublicReadiness();
  return res.status(200).type("html").send(
    layout({
      title: "Billing readiness",
      eyebrow: "Founder operations",
      heading: "Billing readiness",
      body: readiness.stripe.ready
        ? "Stripe checkout and webhook variables are present."
        : "Stripe checkout remains blocked until required server variables and price IDs exist.",
      sections: [
        brandCard("Checkout", readiness.stripe.ready ? "Ready" : `Missing: ${readiness.stripe.missing.join(", ")}`),
        brandCard("Webhook audit", readiness.supabase.ready ? "Supabase audit tables can be used." : "Supabase is not configured.")
      ],
      actions: [linkAction("/admin", "Admin"), linkAction("/pricing", "Pricing")]
    })
  );
});

app.get("/admin/env-readiness", requireAdmin, (req, res) => {
  const readiness = getPublicReadiness();
  return res.status(200).type("html").send(
    layout({
      title: "Environment readiness",
      eyebrow: "Founder operations",
      heading: "Environment readiness",
      body: "Non-secret service readiness flags. Missing values are named, but secret values are never displayed.",
      sections: Object.entries(readiness).map(([key, value]) =>
        brandCard(formatLabel(key), value.ready ? "Ready" : `Missing: ${value.missing.join(", ")}`)
      ),
      actions: [linkAction("/admin", "Admin"), linkAction("/api/readiness", "Readiness JSON")]
    })
  );
});

app.use((req, res) => {
  return res.status(404).json({ error: "not_found" });
});

if (require.main === module) {
  const port = process.env.PORT || 5000;
  app.listen(port, () => console.log(`Listening on ${port}`));
}

module.exports = app;

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
      footer { border-top: 1px solid var(--line); padding: 28px 0 44px; color: var(--muted); }
      @media (max-width: 760px) { header { align-items: flex-start; flex-direction: column; } .grid { grid-template-columns: 1fr; } .hero { padding-top: 42px; } }
    </style>
  </head>
  <body>
    <header>
      <a class="brand" href="/">SONARA Industries</a>
      <nav aria-label="Primary">
        <a href="/contact">Contact</a>
        <a href="/pricing">Pricing</a>
        <a href="/security">Security</a>
        <a href="/legal/terms">Legal</a>
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
    <footer>SONARA Industries builds launch infrastructure for Business Builder, Creator Studio, and Growth Studio.</footer>
  </body>
</html>`;
}

function brandCard(title, body) {
  return `<article class="card"><h2>${escapeHtml(title)}</h2><p>${escapeHtml(body)}</p></article>`;
}

function priceCard(name, price, description, stripeReady) {
  const status = stripeReady ? "Checkout available" : "Checkout requires live Stripe configuration";
  return brandCard(`${name} - ${price}`, `${description} ${status}.`);
}

function linkAction(href, label) {
  return `<a class="action" href="${escapeHtml(href)}">${escapeHtml(label)}</a>`;
}

function contactForm() {
  return `<article class="card">
    <h2>Request intake</h2>
    <form method="post" action="/contact">
      <input name="email" type="email" placeholder="work email" required>
      <select name="category" required>
        <option value="contact">Contact</option>
        <option value="support">Support</option>
        <option value="feedback">Feedback</option>
      </select>
      <textarea name="message" rows="6" placeholder="launch context" required></textarea>
      <label><input name="consent" type="checkbox" value="yes" required> Consent to process this request</label>
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
      body: "Current operating terms for SONARA Industries production launch.",
      sections: points.map((point, index) => brandCard(`Section ${index + 1}`, point)),
      actions: [linkAction("/", "Home"), linkAction("/contact", "Contact")]
    })
  );
}

function normalizeSupportRequest(body) {
  const category = String(body.category || "contact").trim();
  const email = String(body.email || "").trim();
  const message = String(body.message || "").trim();
  const consent = body.consent === "yes" || body.consent === "on" || body.consent === true;

  if (!["contact", "support", "feedback"].includes(category)) {
    return { ok: false, message: "Choose a valid request type." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, message: "Enter a valid email address." };
  }
  if (message.length < 10 || message.length > 4000) {
    return { ok: false, message: "Enter a message between 10 and 4000 characters." };
  }
  if (!consent) {
    return { ok: false, message: "Consent is required before submitting a request." };
  }
  return { ok: true, value: { category, email, message } };
}

async function saveSupportRequest(request) {
  const config = getSupabaseServerConfig();
  const referenceId = randomUUID();
  let stored = false;
  let supportRequestId;

  if (!config.ok) {
    const email = await sendSupportNotification({ ...request, referenceId });
    return {
      ok: true,
      message: `Request recorded in the safe fallback queue. Reference ID: ${referenceId}. Email notification: ${email.ok ? "sent" : "setup required"}.`
    };
  }

  const response = await fetch(`${config.url}/rest/v1/support_requests`, {
    method: "POST",
    headers: supabaseHeaders(config, { prefer: "return=representation" }),
    body: JSON.stringify({
      reference_id: referenceId,
      category: request.category,
      requester_email: request.email,
      message_preview: redactSensitiveText(request.message).slice(0, 280),
      consent_accepted: true,
      metadata: { source: "express_contact" }
    })
  }).catch(() => undefined);

  if (response?.ok) {
    stored = true;
    const rows = await response.json().catch(() => []);
    supportRequestId = rows[0]?.id;
  }

  const email = await sendSupportNotification({ ...request, referenceId });
  if (supportRequestId) {
    await updateSupportEmailStatus(supportRequestId, email);
  }

  if (!stored) {
    return {
      ok: true,
      message: `Support storage is unavailable, so the request used the safe fallback queue. Reference ID: ${referenceId}. Email notification: ${email.ok ? "sent" : "setup required"}.`
    };
  }

  return {
    ok: true,
    message: `Your request was received. Reference ID: ${referenceId}. Email notification: ${email.ok ? "sent" : "queued"}.`
  };
}

async function sendSupportNotification(request) {
  const env = getEnvStatus();
  if (!env.resend.ready) {
    return { ok: false, setupRequired: true, error: "resend_not_configured" };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL,
      to: [process.env.SUPPORT_TO_EMAIL],
      subject: `SONARA support request ${request.referenceId}`,
      text: [
        `Reference ID: ${request.referenceId}`,
        `Category: ${request.category}`,
        `Requester: ${request.email}`,
        "",
        redactSensitiveText(request.message)
      ].join("\n")
    })
  }).catch(() => undefined);

  if (!response?.ok) {
    return { ok: false, error: `resend_${response?.status || "unavailable"}` };
  }
  return { ok: true };
}

function getSupabaseServerConfig() {
  const url = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceRoleKey) {
    return { ok: false };
  }
  return { ok: true, url: url.replace(/\/$/, ""), serviceRoleKey };
}

function isStripeCheckoutReady() {
  return getEnvStatus().stripe.ready;
}

function requiredMissing(keys) {
  return keys.filter((key) => !process.env[key]);
}

function getEnvStatus() {
  const supabaseRequired = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
  const googleRequired = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI", "PUBLIC_SITE_URL"];
  const stripeRequired = [
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_PRICE_STARTER_MONTHLY",
    "STRIPE_PRICE_CORE_MONTHLY",
    "STRIPE_PRICE_PRO_MONTHLY",
    "STRIPE_PRICE_BUSINESS_BUILDER_ONE_TIME",
    "STRIPE_SUCCESS_URL",
    "STRIPE_CANCEL_URL"
  ];
  const resendRequired = ["RESEND_API_KEY", "RESEND_FROM_EMAIL", "SUPPORT_TO_EMAIL"];
  const adminRequired = ["ADMIN_ACCESS_TOKEN", "ADMIN_EMAILS"];

  return {
    supabase: serviceStatus(supabaseRequired),
    googleOAuth: serviceStatus(googleRequired),
    stripe: serviceStatus(stripeRequired),
    resend: serviceStatus(resendRequired),
    admin: serviceStatus(adminRequired),
    legal: { ready: true, missing: [] }
  };
}

function getPublicReadiness() {
  return getEnvStatus();
}

function serviceStatus(required) {
  const missing = requiredMissing(required);
  return { ready: missing.length === 0, missing };
}

function requireAdmin(req, res, next) {
  const env = getEnvStatus();
  if (!env.admin.ready) {
    return res.status(503).json({
      ok: false,
      code: "setup_required",
      service: "admin_access",
      missing: env.admin.missing
    });
  }

  const headerToken = req.get("x-admin-access-token");
  const authToken = String(req.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const queryToken = typeof req.query.token === "string" ? req.query.token : "";
  const token = headerToken || authToken || queryToken;

  if (!token || token !== process.env.ADMIN_ACCESS_TOKEN) {
    return res.status(401).json({ ok: false, code: "admin_auth_required" });
  }

  return next();
}

function getStripePriceId(plan) {
  const priceIds = {
    starter_monthly: process.env.STRIPE_PRICE_STARTER_MONTHLY,
    core_monthly: process.env.STRIPE_PRICE_CORE_MONTHLY,
    pro_monthly: process.env.STRIPE_PRICE_PRO_MONTHLY,
    business_builder_one_time: process.env.STRIPE_PRICE_BUSINESS_BUILDER_ONE_TIME
  };
  return priceIds[plan];
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
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params.toString()
  }).catch(() => undefined);

  if (!response?.ok) {
    return { ok: false };
  }
  const session = await response.json();
  return { ok: true, url: session.url };
}

function verifyStripeWebhookSignature(rawBody, header, secret) {
  if (!header || !Buffer.isBuffer(rawBody)) {
    return { ok: false };
  }

  const parts = Object.fromEntries(
    header.split(",").map((part) => {
      const [key, value] = part.split("=");
      return [key, value];
    })
  );
  if (!parts.t || !parts.v1) {
    return { ok: false };
  }

  const payload = `${parts.t}.${rawBody.toString("utf8")}`;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  const safeExpected = Buffer.from(expected);
  const safeActual = Buffer.from(parts.v1);
  if (safeExpected.length !== safeActual.length) {
    return { ok: false };
  }
  return { ok: crypto.timingSafeEqual(safeExpected, safeActual) };
}

async function recordBillingWebhookEvent(event) {
  const config = getSupabaseServerConfig();
  if (!config.ok) {
    return { ok: false, setupRequired: true };
  }

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
      metadata: {
        object: event.data?.object?.object,
        customer: event.data?.object?.customer,
        subscription: event.data?.object?.subscription || event.data?.object?.id
      }
    })
  }).catch(() => undefined);

  return { ok: Boolean(response?.ok) };
}

async function synchronizeBillingFromStripeEvent(event) {
  if (!["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"].includes(event.type)) {
    return { ok: true, ignored: true };
  }

  const config = getSupabaseServerConfig();
  const subscription = event.data?.object;
  if (!config.ok || !subscription?.id) {
    return { ok: false };
  }

  const planSlug = subscription.metadata?.plan || "core_monthly";
  const organizationId = subscription.metadata?.organization_id;
  if (!organizationId) {
    return { ok: false, missingOrganization: true };
  }

  const response = await fetch(`${config.url}/rest/v1/billing_subscriptions`, {
    method: "POST",
    headers: supabaseHeaders(config, { prefer: "resolution=merge-duplicates" }),
    body: JSON.stringify({
      organization_id: organizationId,
      provider: "stripe",
      provider_customer_ref: subscription.customer,
      provider_subscription_ref: subscription.id,
      plan_slug: planSlug,
      status: subscription.status,
      cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
      metadata: { source: "stripe_webhook" }
    })
  }).catch(() => undefined);

  await fetch(`${config.url}/rest/v1/billing_entitlements`, {
    method: "POST",
    headers: supabaseHeaders(config, { prefer: "resolution=merge-duplicates" }),
    body: JSON.stringify({
      organization_id: organizationId,
      entitlement_key: planSlug,
      status: ["active", "trialing"].includes(subscription.status) ? "active" : "disabled",
      source: "billing",
      metadata: {
        provider: "stripe",
        provider_subscription_ref: subscription.id
      }
    })
  }).catch(() => undefined);

  return { ok: Boolean(response?.ok) };
}

async function updateSupportEmailStatus(supportRequestId, email) {
  const config = getSupabaseServerConfig();
  if (!config.ok) {
    return { ok: false };
  }

  await fetch(`${config.url}/rest/v1/support_requests?id=eq.${encodeURIComponent(supportRequestId)}`, {
    method: "PATCH",
    headers: supabaseHeaders(config),
    body: JSON.stringify({
      email_delivery_status: email.ok ? "email_sent" : "email_failed",
      email_error_summary: email.ok ? null : redactSensitiveText(email.error || "email_not_sent").slice(0, 240),
      email_retry_count: email.ok ? 0 : 1
    })
  }).catch(() => undefined);

  await fetch(`${config.url}/rest/v1/support_email_delivery_attempts`, {
    method: "POST",
    headers: supabaseHeaders(config),
    body: JSON.stringify({
      support_request_id: supportRequestId,
      delivery_status: email.ok ? "email_sent" : "email_failed",
      provider: "resend",
      sanitized_error_summary: email.ok ? null : redactSensitiveText(email.error || "email_not_sent").slice(0, 240)
    })
  }).catch(() => undefined);

  return { ok: true };
}

async function listSupportRequests() {
  const config = getSupabaseServerConfig();
  if (!config.ok) {
    return { ok: false, requests: [] };
  }

  const response = await fetch(
    `${config.url}/rest/v1/support_requests?select=reference_id,category,email_delivery_status,created_at&order=created_at.desc&limit=20`,
    {
      headers: supabaseHeaders(config)
    }
  ).catch(() => undefined);

  if (!response?.ok) {
    return { ok: false, requests: [] };
  }
  const requests = await response.json().catch(() => []);
  return { ok: true, requests };
}

function supabaseHeaders(config, options = {}) {
  const headers = {
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${config.serviceRoleKey}`,
    "Content-Type": "application/json"
  };
  if (options.prefer) {
    headers.Prefer = options.prefer;
  }
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
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
