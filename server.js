const express = require("express");
const { randomUUID } = require("node:crypto");

const app = express();

app.use(express.urlencoded({ extended: false }));
app.use(express.json({ limit: "64kb" }));

app.get("/", (req, res) => {
  return res.status(200).type("html").send(
    layout({
      title: "SONARA Industries",
      eyebrow: "Launch operating system",
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

app.get("/api/health", (req, res) => {
  return res.status(200).json({ ok: true });
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
  if (!config.ok) {
    return {
      ok: false,
      message: `Support storage is not configured. Reference ID: ${referenceId}.`
    };
  }

  const response = await fetch(`${config.url}/rest/v1/support_requests`, {
    method: "POST",
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      reference_id: referenceId,
      category: request.category,
      requester_email: request.email,
      message_preview: redactSensitiveText(request.message).slice(0, 280),
      consent_accepted: true,
      metadata: { source: "express_contact" }
    })
  }).catch(() => undefined);

  if (!response?.ok) {
    return {
      ok: false,
      message: `Support storage is unavailable. Reference ID: ${referenceId}.`
    };
  }
  return { ok: true, message: `Your request was received. Reference ID: ${referenceId}.` };
}

function getSupabaseServerConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceRoleKey) {
    return { ok: false };
  }
  return { ok: true, url: url.replace(/\/$/, ""), serviceRoleKey };
}

function isStripeCheckoutReady() {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_CORE);
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
