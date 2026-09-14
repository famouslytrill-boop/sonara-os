"use strict";

const STACK_ITEMS = Object.freeze([
  item("hosting", "Vercel", "Deploy the SONARA web application, preview changes, and inspect builds.", "The free path has project, usage, and collaboration limits.", "Keep release checks, route checks, and setup status visible.", "in_use", "https://vercel.com/"),
  item("hosting", "Cloudflare", "DNS, caching, and inbound email-routing options for a public business site.", "Free features have service-specific limits and require domain ownership.", "Document DNS setup and keep customer data out of edge logs.", "setup_required", "https://www.cloudflare.com/"),
  item("database", "Hosted data service", "Managed accounts, private records, file storage, and access rules.", "Free capacity is limited; production requires backups, monitoring, and access policy review.", "Store organization records, approvals, audit events, and private customer files.", "in_use", "https://supabase.com/"),
  item("database", "Private search extension", "Similarity search for organization-scoped knowledge and memory.", "An embedding provider or local model is still required before semantic search can run.", "Keep namespaces, ownership, deletion, and audit boundaries explicit.", "setup_required", "https://github.com/pgvector/pgvector"),
  item("email", "Resend", "Transactional email for contact requests, account notices, and approved customer messages.", "A verified sender domain, recipient settings, and provider key are required before sending.", "Show delivery status, retries, and support references without exposing provider details.", "in_use", "https://resend.com/"),
  item("analytics", "OpenTelemetry", "Server-side traces, metrics, and structured operational events.", "Collection and storage destinations have their own cost and retention limits.", "Measure route errors and job outcomes while redacting secrets and private content.", "research_only", "https://opentelemetry.io/"),
  item("design", "Penpot", "Open-source design collaboration for wireframes, flow maps, and brand direction.", "Self-hosting needs its own authentication, storage, and maintenance plan.", "Turn approved designs into accessible, tested SONARA interfaces.", "research_only", "https://penpot.app/"),
  item("media", "FFmpeg", "Worker-side conversion, thumbnails, audio metadata, and export preparation for owned media.", "It requires isolated compute, resource limits, and review of input ownership.", "Queue work, retain provenance, and show a real job state instead of a fake progress bar.", "research_only", "https://ffmpeg.org/"),
  item("maps", "OpenStreetMap and Leaflet", "Maps and venue context with user-selected or opt-in locations.", "Public tiles are not an unlimited production backend; attribution and rate limits apply.", "Keep location optional, coarse by default, and separate from customer marketing consent.", "research_only", "https://www.openstreetmap.org/"),
  item("automation", "Deterministic workflows", "Repeatable checklists, formulas, approvals, and scheduled follow-up states.", "Automation does not replace consent, legal review, or a human decision on high-impact actions.", "Use the existing database-backed job and audit model before adding a separate automation platform.", "in_use", "/technology-radar"),
  item("security", "Security baseline", "Secret scanning, scoped roles, rate limits, private storage, and audit events.", "No free tool replaces incident response, qualified legal advice, or ongoing access review.", "Keep setup gaps visible to founders and administrators without showing secret values.", "in_use", "/security"),
  item("operations", "SONARA free tools", "Break-even, pricing, rates, budgets, referrals, and practical launch calculations.", "The calculations are free; saving organization records requires an account and applicable access.", "Start with the work you can verify, then add paid records only when they help.", "in_use", "/free-tools")
]);

function registerFreeLaunchStackRoutes(app, deps) {
  const { layout, linkAction, escapeHtml = escape } = deps;

  app.get("/free-launch-stack", (req, res) => {
    return res.status(200).type("html").send(layout({
      title: "Free Launch Stack",
      eyebrow: "FREE TOOLS DIRECTORY",
      heading: "Build a useful business system before you add subscriptions.",
      body: "A free-first directory for founders, creators, and small teams. Every listing says what it helps with, where the free path stops, and what SONARA can help you organize.",
      sections: [
        `<section class="sonara-launch-stack" data-launch-stack>
          <div class="sonara-launch-stack__intro">
            <h2>Choose a category, then use only what you need.</h2>
            <p>Recommendations are independent research, not affiliate placement. Third-party services have their own terms, limits, and privacy rules.</p>
            <label class="sonara-launch-stack__search">Find a tool or job <input type="search" data-launch-stack-search placeholder="Search hosting, storage, design, email..." autocomplete="off"></label>
            <div class="card-actions" aria-label="Free Launch Stack categories">
              <button class="action" type="button" data-launch-stack-filter="all" aria-pressed="true">All</button>
              ${categories().map((category) => `<button class="action" type="button" data-launch-stack-filter="${category.key}" aria-pressed="false">${escapeHtml(category.label)}</button>`).join("")}
            </div>
          </div>
          <div class="sonara-launch-stack__grid" data-launch-stack-results>
            ${STACK_ITEMS.map((entry) => stackCard(entry, escapeHtml)).join("")}
          </div>
          <p class="sonara-launch-stack__empty" data-launch-stack-empty hidden>No listings match that search. Try a broader term or browse all categories.</p>
        </section>`
      ],
      actions: [
        linkAction("/signup", "Start Free"),
        linkAction("/free-tools", "Use SONARA free tools"),
        linkAction("/pricing", "Upgrade when ready"),
        linkAction("/technology-radar", "Review technology boundaries")
      ],
      surface: "marketing",
      canonical: "/free-launch-stack",
      scripts: ["/sonara-free-launch-stack.js"]
    }));
  });

  app.get("/api/free-launch-stack", (req, res) => {
    res.status(200).json({
      ok: true,
      status: "research_directory",
      itemCount: STACK_ITEMS.length,
      items: STACK_ITEMS.map(({ key, category, name, summary, freeBoundary, sonaraHelp, availability, officialUrl }) => ({
        key, category, name, summary, freeBoundary, sonaraHelp, availability, officialUrl
      }))
    });
  });
}

function item(category, name, summary, freeBoundary, sonaraHelp, availability, officialUrl) {
  return Object.freeze({
    key: `${category}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
    category,
    name,
    summary,
    freeBoundary,
    sonaraHelp,
    availability,
    officialUrl
  });
}

function categories() {
  return [
    ["hosting", "Hosting"], ["database", "Data"], ["email", "Email"], ["analytics", "Measurement"],
    ["design", "Design"], ["media", "Media"], ["maps", "Maps"], ["automation", "Automation"],
    ["security", "Security"], ["operations", "Operations"]
  ].map(([key, label]) => ({ key, label }));
}

function stackCard(entry, escapeHtml) {
  const availability = {
    in_use: "Available in SONARA",
    setup_required: "Setup required",
    research_only: "Research candidate"
  }[entry.availability] || "Review required";
  const action = entry.officialUrl.startsWith("/")
    ? `<a class="action" href="${escapeHtml(entry.officialUrl)}">Open in SONARA</a>`
    : `<a class="action" href="${escapeHtml(entry.officialUrl)}" target="_blank" rel="noreferrer">Visit source</a>`;
  const searchable = `${entry.name} ${entry.category} ${entry.summary} ${entry.sonaraHelp}`.toLowerCase();
  return `<article class="card sonara-launch-stack__card" data-launch-stack-card data-category="${escapeHtml(entry.category)}" data-search="${escapeHtml(searchable)}">
    <p class="sonara-launch-stack__status">${escapeHtml(availability)}</p>
    <h3>${escapeHtml(entry.name)}</h3>
    <p>${escapeHtml(entry.summary)}</p>
    <dl class="sonara-launch-stack__details"><div><dt>Free path</dt><dd>${escapeHtml(entry.freeBoundary)}</dd></div><div><dt>SONARA can help</dt><dd>${escapeHtml(entry.sonaraHelp)}</dd></div></dl>
    <div class="card-actions">${action}</div>
  </article>`;
}

function escape(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

module.exports = registerFreeLaunchStackRoutes;
