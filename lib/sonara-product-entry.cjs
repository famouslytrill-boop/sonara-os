// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const { escapeHtml } = require("./sonara-shell.cjs");

// Public entries describe actual destinations, never pretend to show a
// customer's data. Operational authorization remains at the destination.
const ENTRIES = {
  "business-builder": {
    heading: "Run the business.",
    steps: [
      ["Offer", "Define and price your service.", "/business-builder/offers/free", "Create offer"],
      ["Customers", "Organize your customer records.", "/business-builder/owner/customers", "View customers"],
      ["Bookings", "Review appointments and availability.", "/business-builder/owner/bookings", "Manage bookings"],
      ["Payments", "Review setup before taking a payment.", "/business-builder/payments", "View payments"]
    ],
    paths: [
      ["Shape your offer", "Start with the service, scope, and price you actually provide.", "/business-builder/offers/free", "Draft an offer"],
      ["Keep operations connected", "Bring customer and work records into your daily routine.", "/business-builder/owner/customers", "Open customer records"],
      ["Prepare to take payments", "Review payment setup before accepting a charge.", "/business-builder/launch-readiness", "Review payment setup"]
    ]
  },
  "creator-studio": {
    heading: "Make room for your work.",
    steps: [
      ["Assets", "Organize the work you own.", "/creator-studio/assets", "Open assets"],
      ["Music", "Keep your music projects together.", "/creator-studio/music-system", "Open music system"],
      ["Offers", "Prepare a product or creative service.", "/creator-studio/offers/free", "Draft an offer"],
      ["Release", "Review your release tasks and setup.", "/creator-studio/launch-readiness", "Review setup"]
    ],
    paths: [
      ["Start with your originals", "Keep assets and ownership notes connected to the work they describe.", "/creator-studio/assets", "Organize assets"],
      ["Build a creative offer", "Describe what you make, who it serves, and what you will deliver.", "/creator-studio/offers/free", "Draft a creator offer"],
      ["Prepare your next release", "Review your records and setup before publishing or selling.", "/creator-studio/launch-readiness", "Review release setup"]
    ]
  },
  "growth-studio": {
    body: "Plan campaigns, organize leads, review consent, and learn from recorded results. Sending runs through your connected email or SMS provider.",
    heading: "Give growth a clear direction.",
    steps: [
      ["Plan", "Set a campaign goal and audience.", "/growth-studio/campaigns", "Plan a campaign"],
      ["Leads", "Review real enquiries and their source.", "/growth-studio/leads", "Review leads"],
      ["Consent", "Review audience rules and permissions.", "/growth-studio/segments", "Review segments"],
      ["Measure", "Connect outcomes to recorded evidence.", "/growth-studio/attribution", "Review attribution"]
    ],
    paths: [
      ["Plan before you dispatch", "Connect the goal, audience, content, and approval for each campaign.", "/growth-studio/campaigns", "Plan a campaign"],
      ["Understand your audience", "Review leads and consent before deciding who to contact.", "/growth-studio/leads", "Review leads"],
      ["Learn from the evidence", "Review recorded touchpoints and conversions with their limitations.", "/growth-studio/attribution", "Review attribution"]
    ]
  }
};

const arrow = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
function entryLink(href, label) {
  return `<a href="${escapeHtml(href)}">${escapeHtml(label)}${arrow}</a>`;
}

function renderProductEntry(slug, config) {
  const entry = ENTRIES[slug];
  if (!entry) throw new RangeError(`Unknown product entry: ${slug}`);
  return {
    variant: "product",
    heading: entry.heading,
    body: entry.body || config.body,
    eyebrow: `${config.name}™`,
    heroAside: `<nav class="product-entry-map" aria-label="${escapeHtml(config.name)} workflow destinations"><ol>${entry.steps.map(([title, description, href, label], index) => `<li><span class="product-entry-number" aria-hidden="true">${index + 1}</span><div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(description)}</p></div>${entryLink(href, label)}</li>`).join("")}</ol></nav>`,
    sections: [
      `<section class="product-entry-paths" aria-label="Ways to start with ${escapeHtml(config.name)}">${entry.paths.map(([title, description, href, label], index) => `<article><span class="product-entry-index" aria-hidden="true">0${index + 1}</span><h2>${escapeHtml(title)}</h2><p>${escapeHtml(description)}</p>${entryLink(href, label)}</article>`).join("")}</section>`,
      `<section class="product-entry-details"><h2>Made for your next step.</h2><p>${escapeHtml(config.audience)}</p><details><summary>Explore ${escapeHtml(config.name)} capabilities</summary><p>${escapeHtml(config.body)}</p><dl>${config.cards.map(([title, description]) => `<div><dt>${escapeHtml(title)}</dt><dd>${escapeHtml(description)}</dd></div>`).join("")}</dl>${slug === "growth-studio" ? '<nav aria-label="Growth operations"><a href="/growth-studio/control-center">Open control center</a> · <a href="/growth-studio/experiments">Review experiments</a> · <a href="/growth-studio/providers">Review providers</a></nav>' : ""}</details><p>Sign in to save your work. Plan access and connected providers determine which operations are available.</p><a href="/${slug}/tools">Browse all ${escapeHtml(config.name)} tools</a> · <a href="/search">Search your workspace</a></section>`
    ]
  };
}

module.exports = { renderProductEntry };
