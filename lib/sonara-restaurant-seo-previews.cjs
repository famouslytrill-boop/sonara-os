// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Structured data DRAFTS for owner review, not proof of a published restaurant,
// ownership, Google indexing, eligibility, customer reviews or a public event.
const { instant } = require("./sonara-event-resource-scenario.cjs");
const DAYS = Object.freeze(["Monday", "Tuesday", "Wednesday", "Thursday",
  "Friday", "Saturday", "Sunday"]);
const STATUSES = Object.freeze({
  scheduled: "https://schema.org/EventScheduled",
  cancelled: "https://schema.org/EventCancelled",
  postponed: "https://schema.org/EventPostponed",
  rescheduled: "https://schema.org/EventRescheduled"
});
const clean = (value, max) => typeof value === "string" &&
  value.trim().length > 0 && value.trim().length <= max ? value.trim() : null;
const fail = (issues) => ({ ok: false, state: "invalid_markup_input", issues,
  isPublished: false, googleEligibilityVerified: false });

function httpsUrl(value) {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const parsed = new URL(value);
    const h = parsed.hostname.toLowerCase();
    if (parsed.protocol !== "https:" || parsed.username || parsed.password ||
      !h.includes(".") || h === "localhost" || h.endsWith(".local") ||
      h.endsWith(".internal") || h.endsWith(".test") || h.endsWith(".invalid") ||
      /^\d+\.\d+\.\d+\.\d+$/.test(h) || parsed.port && parsed.port !== "443") return null;
    return parsed.href;
  } catch { return null; }
}

function postalAddress(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const streetAddress = clean(data.streetAddress, 200);
  const addressLocality = clean(data.addressLocality, 100);
  const addressRegion = clean(data.addressRegion, 100);
  const postalCode = clean(data.postalCode, 24);
  const addressCountry = clean(data.addressCountry, 64);
  if (!streetAddress || !addressLocality || !addressCountry) return null;
  return {
    "@type": "PostalAddress", streetAddress, addressLocality, addressCountry,
    ...(addressRegion ? { addressRegion } : {}),
    ...(postalCode ? { postalCode } : {})
  };
}
function openingHours(input) {
  if (input === undefined || input === null) return { ok: true, rows: [] };
  if (!Array.isArray(input) || input.length > 14) return { ok: false };
  const rows = [];
  for (const entry of input) {
    if (!entry || !DAYS.includes(entry.dayOfWeek) ||
      typeof entry.opens !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(entry.opens) ||
      typeof entry.closes !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(entry.closes) ||
      entry.opens === entry.closes) return { ok: false };
    rows.push({ "@type": "OpeningHoursSpecification",
      dayOfWeek: "https://schema.org/" + entry.dayOfWeek,
      opens: entry.opens, closes: entry.closes });
  }
  return { ok: true, rows };
}

function previewRestaurant(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return fail(["invalid_profile"]);
  const issues = [];
  const name = clean(input.name, 160), address = postalAddress(input.address);
  const url = httpsUrl(input.url), menu = input.menuUrl == null ? null : httpsUrl(input.menuUrl);
  const hours = openingHours(input.openingHours);
  if (!name) issues.push("restaurant_name_required");
  if (!address) issues.push("physical_address_required");
  if (!url) issues.push("public_https_url_required");
  if (input.menuUrl != null && !menu) issues.push("invalid_menu_url");
  if (!hours.ok) issues.push("invalid_opening_hours");
  if (issues.length) return fail(issues);
  const telephone = clean(input.telephone, 40);
  const cuisine = clean(input.servesCuisine, 120);
  const schema = {
    "@context": "https://schema.org",
    "@type": "Restaurant", name, address, url,
    ...(menu ? { hasMenu: menu } : {}),
    ...(telephone ? { telephone } : {}),
    ...(cuisine ? { servesCuisine: cuisine } : {}),
    ...(hours.rows.length ? { openingHoursSpecification: hours.rows } : {})
  };
  return { ok: true, state: "markup_preview_only", schema,
    publicationApproved: false, businessOwnershipVerified: false,
    isPublished: false, googleEligibilityVerified: false,
    noReviewsOrRatingsInvented: true };
}

function previewPublicEvent(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return fail(["invalid_event"]);
  const issues = [];
  const name = clean(input.name, 160), url = httpsUrl(input.url);
  const venueName = clean(input.venueName, 160), address = postalAddress(input.address);
  const start = instant(input.startsAt), end = instant(input.endsAt);
  const status = STATUSES[input.status];
  if (!name) issues.push("event_name_required");
  if (!url) issues.push("public_https_event_url_required");
  if (!venueName || !address) issues.push("physical_venue_required");
  if (start === null || end === null || end <= start) issues.push("event_times_with_explicit_offset_required");
  if (!status) issues.push("event_status_required");
  if (issues.length) return fail(issues);
  const schema = {
    "@context": "https://schema.org", "@type": "Event",
    name, url, startDate: input.startsAt, endDate: input.endsAt,
    eventStatus: status,
    location: { "@type": "Place", name: venueName, address }
  };
  return { ok: true, state: "markup_preview_only", schema,
    invitationOnlyCheckNotPerformed: true,
    publicationApproved: false, isPublished: false,
    googleEligibilityVerified: false, noTicketsOrReviewsInvented: true };
}

// If a renderer eventually embeds this in a <script> element, ensure </script>
// and HTML control characters cannot close the element. It remains a PREVIEW.
function safeJsonLd(schema) {
  return JSON.stringify(schema).replace(/</g, "\\u003c").replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026").replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

module.exports = { previewRestaurant, previewPublicEvent, safeJsonLd };
