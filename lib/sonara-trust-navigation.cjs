// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// One reusable navigation contract for the SONARA Industries parent and its
// three studios. Legal documents remain sourced from legalPages() in server.js;
// duplicating their copy or route mappings here would cause policy drift.
const TRUST_DESTINATIONS = Object.freeze([
  Object.freeze({ label: "About", href: "/about" }),
  Object.freeze({ label: "Help and FAQs", href: "/help" }),
  Object.freeze({ label: "Tutorials", href: "/tutorials" }),
  Object.freeze({ label: "Contact", href: "/contact" }),
  Object.freeze({ label: "Support", href: "/support" }),
  Object.freeze({ label: "Security", href: "/security" }),
  Object.freeze({ label: "Accessibility", href: "/accessibility" })
]);

function renderTrustNavigation(escapeHtml) {
  if (typeof escapeHtml !== "function") throw new TypeError("escapeHtml is required");
  return `<nav aria-label="Help and company information">
    ${TRUST_DESTINATIONS.map(({ label, href }) =>
      `<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>`
    ).join("\n    ")}
  </nav>`;
}

module.exports = { TRUST_DESTINATIONS, renderTrustNavigation };
