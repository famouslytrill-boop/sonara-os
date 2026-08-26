"use strict";

// GET /leadforge -- the LeadForge landing page.
//
// A standalone document rather than a page inside layout(). The SONARA shell
// carries SONARA branding, a SONARA nav and links to the three workspaces; a
// LeadForge landing page wearing that header would be neither one brand nor the
// other. So this renders its own <html> and loads its own stylesheet, which is
// also why /public/leadforge.css does not extend the SONARA design system.
//
// ## The notice is not decoration
//
// lib/sonara-leadforge-content.cjs marks every stat, logo and quote as either a
// sample or sourced, and `hasSamples()` decides whether the notice renders. The
// route does not get its own say. That matters because this application's home
// page carries the sentence "SONARA does not publish fake testimonials,
// invented customer counts, fictional awards, guaranteed revenue, false
// scarcity, or unsupported compliance and security claims" -- and a landing
// page served from the same application with an invented figure on it would
// make that sentence false.
//
// Replace the samples with sourced figures and the notice disappears on its
// own. Nobody has to remember to remove it, and nobody can remove it while the
// samples are still there.

const content = require("../lib/sonara-leadforge-content.cjs");

const REQUIRED = ["escapeHtml"];

function registerLeadforgeRoutes(app, deps = {}) {
  for (const name of REQUIRED) {
    if (typeof deps[name] !== "function") throw new TypeError(`registerLeadforgeRoutes requires ${name}`);
  }
  const { escapeHtml } = deps;
  const e = escapeHtml;

  const { BRAND, ACTIONS, STATS, LOGOS, TESTIMONIAL, WORKFLOW, FEATURES, CHAT_STEPS, TRUST, SAMPLE_NOTICE } = content;

  const sampleTag = (item) => (item.sample ? `<span class="lf-sample-tag">Sample</span>` : "");

  const button = (action, kind) =>
    `<a class="lf-btn lf-btn--${kind}" href="${e(action.href)}">${e(action.label)}</a>`;

  // ---- Mockups. Built from markup rather than images so they stay sharp,
  // stay readable to a screen reader, and cost no extra request.
  const pipelineMock = `
    <div class="lf-mock" role="img" aria-label="Sample pipeline view: four accounts with fit scores and routed owners">
      <div class="lf-mock__bar"><i></i><i></i><i></i><span>leadforge — routed today</span></div>
      <div class="lf-mock__body">
        ${[
          ["Northwind Logistics", "412 staff · Freight · Series B", "94", "hot", "→ A. Rivera"],
          ["Atlas Freight", "180 staff · Freight · Bootstrapped", "81", "hot", "→ A. Rivera"],
          ["Fern &amp; Co", "64 staff · Retail ops", "58", "warm", "→ J. Okafor"],
          ["Verity Data", "1,100 staff · Analytics", "31", "cool", "→ nurture"]
        ].map(([co, meta, score, tone, owner]) => `
          <div class="lf-row">
            <span class="lf-row__co"><b>${co}</b><small>${meta}</small></span>
            <span class="lf-score lf-score--${tone}">${score}</span>
            <span class="lf-owner">${owner}</span>
          </div>`).join("")}
      </div>
    </div>`;

  const scoreMock = `
    <div class="lf-mock" role="img" aria-label="Sample score breakdown showing which fields moved a fit score of 94">
      <div class="lf-mock__bar"><i></i><i></i><i></i><span>why 94 — Northwind Logistics</span></div>
      <div class="lf-mock__body">
        <div class="lf-bars">
          ${[
            ["Headcount fit", 92, ""],
            ["Stack match", 78, ""],
            ["Hiring signal", 64, ""],
            ["Territory", 45, "lf-bar--alt"],
            ["Last touch age", 22, "lf-bar--alt"]
          ].map(([label, pct, alt]) => `
            <span class="lf-bar ${alt}">
              <span>${label}</span>
              <span class="lf-bar__track"><span class="lf-bar__fill" style="width:${pct}%"></span></span>
              <b>+${pct}</b>
            </span>`).join("")}
        </div>
        <p class="lf-fine">Every score opens to this. A number nobody can interrogate is a number nobody acts on.</p>
      </div>
    </div>`;

  const chatMock = `
    <div class="lf-mock" role="img" aria-label="Sample chat conversation qualifying a visitor and routing them to an owner">
      <div class="lf-mock__bar"><i></i><i></i><i></i><span>chat — live on your site</span></div>
      <div class="lf-chat">
        <p class="lf-msg lf-msg--us">You are on the routing page — are you comparing tools, or already mid-migration?</p>
        <p class="lf-msg lf-msg--them">Mid-migration. We are moving off two tools and a spreadsheet.</p>
        <p class="lf-msg lf-msg--us">That is the usual three. How many reps are taking inbound today?</p>
        <p class="lf-msg lf-msg--them">Six, across two territories.</p>
        <p class="lf-msg lf-msg--sys">enriched · 412 staff · freight · matches ICP → score 94 → routed to A. Rivera</p>
        <p class="lf-msg lf-msg--us">Rivera covers freight and has Thursday free. Shall I put you in at 2pm?</p>
      </div>
    </div>`;

  function page() {
    const showNotice = content.hasSamples();

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(BRAND.name)} — ${e(BRAND.tagline)}</title>
<meta name="description" content="${e(BRAND.promise)}">
<meta name="robots" content="noindex">
<link rel="preload" href="/fonts/geist-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/sonara-fonts.css">
<link rel="stylesheet" href="/leadforge.css">
</head>
<body>
<a class="lf-skip" href="#lf-main">Skip to content</a>

${showNotice ? `
<div class="lf-notice" role="note">
  <div class="lf-wrap">
    <strong>${e(SAMPLE_NOTICE.title)}</strong>
    <p>${e(SAMPLE_NOTICE.body)}</p>
  </div>
</div>` : ""}

<header class="lf-header">
  <div class="lf-wrap">
    <a class="lf-brand" href="/leadforge">
      <svg class="lf-mark" viewBox="0 0 32 32" aria-hidden="true">
        <rect x="1" y="1" width="30" height="30" rx="9" fill="none" stroke="#22D3EE" stroke-width="2"/>
        <path d="M11 22V10h8" fill="none" stroke="#22D3EE" stroke-width="2.6" stroke-linecap="round"/>
        <path d="M11 16h6" fill="none" stroke="#FB8B3C" stroke-width="2.6" stroke-linecap="round"/>
      </svg>
      ${e(BRAND.name)}
    </a>
    <nav class="lf-nav" aria-label="Primary">
      <a href="#how">How it works</a>
      <a href="#product">Product</a>
      <a href="#chat">Chat</a>
      <a href="#trust">Trust</a>
    </nav>
    ${button(ACTIONS.primary, "primary")}
  </div>
</header>

<main id="lf-main">

  <section class="lf-hero">
    <div class="lf-wrap">
      <div class="lf-hero-grid">
        <div>
          <span class="lf-badge"><span></span>One system, not five subscriptions</span>
          <h1>Your pipeline stops being five tools that disagree.</h1>
          <p class="lf-lede">${e(BRAND.promise)}</p>
          <div class="lf-actions">
            ${button(ACTIONS.primary, "primary")}
            ${button(ACTIONS.secondary, "secondary")}
          </div>
          <ul class="lf-hero-trust">
            <li><span class="lf-tick">✓</span> First routed lead on day one</li>
            <li><span class="lf-tick">✓</span> Export everything, any time</li>
            <li><span class="lf-tick">✓</span> No training on your customer data</li>
          </ul>
        </div>
        ${pipelineMock}
      </div>
    </div>
  </section>

  <section class="lf-logos">
    <div class="lf-wrap">
      <p class="lf-fine">Built for lean revenue teams running inbound and outbound off one record</p>
      <ul>
        ${LOGOS.map((logo) => `<li><span class="lf-dot"></span>${e(logo.value)}</li>`).join("")}
      </ul>
      ${LOGOS.some((l) => l.sample) ? `<p class="lf-fine" style="margin-top:16px">These are placeholder names. Real customer names go here once there are some, and not before.</p>` : ""}
    </div>
  </section>

  <section>
    <div class="lf-wrap">
      <div class="lf-head">
        <span class="lf-eyebrow">Why teams move</span>
        <h2>What one system actually buys you</h2>
        <p class="lf-lede">Not a faster version of the same stack. Fewer moving parts, so there is less that can silently disagree.</p>
      </div>
      <div class="lf-grid lf-grid--4">
        ${STATS.map((stat) => `
          <article class="lf-card lf-stat">
            <b>${e(stat.value)}</b>
            <u>${e(stat.label)}</u>
            <p>${e(stat.detail)}</p>
            ${sampleTag(stat)}
          </article>`).join("")}
      </div>
    </div>
  </section>

  <section id="how">
    <div class="lf-wrap">
      <div class="lf-head">
        <span class="lf-eyebrow">Define ICP → close from pipeline</span>
        <h2>Six steps, one record, no handoffs</h2>
        <p class="lf-lede">Each step reads and writes the same row. That is the whole product: these steps cannot disagree with each other, because they are not separate systems being kept in sync.</p>
      </div>
      <div class="lf-flow">
        ${WORKFLOW.map((step) => `
          <article class="lf-step">
            <span class="lf-step__n">${e(step.step)}</span>
            <h3>${e(step.title)}</h3>
            <p>${e(step.body)}</p>
            <span class="lf-step__detail">${e(step.detail)}</span>
          </article>`).join("")}
      </div>
    </div>
  </section>

  <section id="product">
    <div class="lf-wrap">
      <div class="lf-head">
        <span class="lf-eyebrow">Product</span>
        <h2>Built to be argued with</h2>
        <p class="lf-lede">Scores you can open, routing that keeps its reasons, and a chat widget that hands over an opportunity rather than a transcript.</p>
      </div>

      <article class="lf-feature">
        <div class="lf-feature__copy">
          <span class="lf-eyebrow">${e(FEATURES[0].eyebrow)}</span>
          <h3>${e(FEATURES[0].title)}</h3>
          <p class="lf-lede">${e(FEATURES[0].body)}</p>
          <ul class="lf-list">${FEATURES[0].points.map((p) => `<li>${e(p)}</li>`).join("")}</ul>
        </div>
        ${pipelineMock}
      </article>

      <article class="lf-feature">
        <div class="lf-feature__copy">
          <span class="lf-eyebrow">${e(FEATURES[1].eyebrow)}</span>
          <h3>${e(FEATURES[1].title)}</h3>
          <p class="lf-lede">${e(FEATURES[1].body)}</p>
          <ul class="lf-list">${FEATURES[1].points.map((p) => `<li>${e(p)}</li>`).join("")}</ul>
        </div>
        ${scoreMock}
      </article>

      <article class="lf-feature">
        <div class="lf-feature__copy">
          <span class="lf-eyebrow">${e(FEATURES[2].eyebrow)}</span>
          <h3>${e(FEATURES[2].title)}</h3>
          <p class="lf-lede">${e(FEATURES[2].body)}</p>
          <ul class="lf-list">${FEATURES[2].points.map((p) => `<li>${e(p)}</li>`).join("")}</ul>
        </div>
        <div class="lf-mock" role="img" aria-label="Sample routing rules resolving in order">
          <div class="lf-mock__bar"><i></i><i></i><i></i><span>routing — resolved in order</span></div>
          <div class="lf-mock__body">
            <div class="lf-row"><span class="lf-row__co"><b>1 · Named account</b><small>Owner already on the record</small></span><span class="lf-score lf-score--cool">skip</span><span class="lf-owner">no match</span></div>
            <div class="lf-row"><span class="lf-row__co"><b>2 · Territory</b><small>Freight, EMEA</small></span><span class="lf-score lf-score--hot">match</span><span class="lf-owner">3 eligible</span></div>
            <div class="lf-row"><span class="lf-row__co"><b>3 · Capacity</b><small>Open pipeline this week</small></span><span class="lf-score lf-score--hot">match</span><span class="lf-owner">→ A. Rivera</span></div>
            <p class="lf-fine">Reason written to the record: territory match, lowest open load of three eligible owners.</p>
          </div>
        </div>
      </article>
    </div>
  </section>

  <section id="chat">
    <div class="lf-wrap">
      <div class="lf-head">
        <span class="lf-eyebrow">${e(FEATURES[3].eyebrow)}</span>
        <h2>${e(FEATURES[3].title)}</h2>
        <p class="lf-lede">${e(FEATURES[3].body)}</p>
      </div>
      <div class="lf-feature">
        <div class="lf-feature__copy">
          <div class="lf-grid" style="gap:16px">
            ${CHAT_STEPS.map((step, index) => `
              <article class="lf-step">
                <span class="lf-step__n">0${index + 1}</span>
                <h3>${e(step.title)}</h3>
                <p>${e(step.body)}</p>
              </article>`).join("")}
          </div>
          <div class="lf-actions" style="margin-top:26px">${button(ACTIONS.secondary, "secondary")}</div>
        </div>
        ${chatMock}
      </div>
    </div>
  </section>

  <section>
    <div class="lf-wrap">
      <figure class="lf-quote">
        <blockquote>“${e(TESTIMONIAL.quote)}”</blockquote>
        <figcaption>
          <span class="lf-avatar" aria-hidden="true"></span>
          <cite>
            <b>${e(TESTIMONIAL.name)}</b>
            <small>${e(TESTIMONIAL.role)}, ${e(TESTIMONIAL.company)}</small>
          </cite>
          ${TESTIMONIAL.sample ? `<span class="lf-sample-tag">Placeholder — not a real customer</span>` : ""}
        </figcaption>
      </figure>
    </div>
  </section>

  <section id="trust">
    <div class="lf-wrap">
      <div class="lf-head">
        <span class="lf-eyebrow">Onboarding and trust</span>
        <h2>The boring questions, answered before you ask</h2>
        <p class="lf-lede">What it takes to start, what happens to your data, and what a security review will find.</p>
      </div>
      <div class="lf-grid lf-grid--3">
        ${TRUST.map((block) => `
          <article class="lf-card">
            <h3>${e(block.title)}</h3>
            <p>${e(block.body)}</p>
            <ul class="lf-list">${block.points.map((p) => `<li>${e(p)}</li>`).join("")}</ul>
          </article>`).join("")}
      </div>
    </div>
  </section>

  <section class="lf-cta">
    <div class="lf-wrap">
      <div class="lf-head">
        <span class="lf-eyebrow">Start with your own ICP</span>
        <h2>See it built against your market, live</h2>
        <p class="lf-lede">Bring the profile you actually sell to. We will build it in the session and route a real lead through it before the call ends.</p>
      </div>
      <div class="lf-actions">
        ${button(ACTIONS.primary, "primary")}
        ${button(ACTIONS.secondary, "secondary")}
      </div>
    </div>
  </section>

</main>

<footer class="lf-footer">
  <div class="lf-wrap">
    <p>${e(BRAND.name)} — ${e(BRAND.tagline)}.</p>
    <nav aria-label="Footer">
      <a href="/leadforge">Overview</a>
      <a href="#how">How it works</a>
      <a href="#trust">Trust</a>
      <a href="/">SONARA Industries</a>
    </nav>
  </div>
</footer>
</body>
</html>`;
  }

  app.get("/leadforge", (req, res) => res.status(200).type("html").send(page()));
}

registerLeadforgeRoutes.PAGE = "/leadforge";
registerLeadforgeRoutes.REQUIRED = REQUIRED;

module.exports = registerLeadforgeRoutes;
