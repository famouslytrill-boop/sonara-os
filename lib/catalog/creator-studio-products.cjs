"use strict";

// See lib/catalog/sonara-industries-products.cjs for the row shape. name,
// summary and customerOutcome are customer-facing copy; the rest is internal.

module.exports = Object.freeze([
  [
    "brand-asset-system",
    "Brand & Asset Library",
    "brand",
    "Your identity, brand kit, files, versions, sources, ownership notes, licences, and approvals in one library.",
    "Keep every project on-brand and know what you are allowed to release.",
    "starter",
    "beta",
    "/creator-studio/dashboard",
    "brand profile|brand kit|asset catalog|versions|rights metadata|approvals",
    "creator assets|storage",
    "Uploading an asset does not prove ownership or clearance."
  ],
  [
    "content-project-repurposing",
    "Content Projects & Reuse",
    "production",
    "Briefs, tasks, files, revisions, approvals, deadlines, deliverables, and a version for each channel.",
    "Take an idea all the way to approved, channel-ready content.",
    "starter",
    "beta",
    "/creator-studio/tools/brief",
    "creative brief|project workspace|revision workflow|repurposing plan|content calendar",
    "projects|assets|approval records",
    "Adapted content requires human review and may not copy protected expression or impersonate people."
  ],
  [
    "release-package-builder",
    "Release Packager",
    "release",
    "Files, details, credits, collaborators, rights, permissions, sources, calendar, checklist, and the handoff to distribution.",
    "Hand over one complete release package with nothing missing.",
    "core",
    "beta",
    "/creator-studio/music-system",
    "release calendar|metadata|credits|collaborators|rights evidence|release checklist|package export",
    "creator releases|storage|exports",
    "Package completeness does not guarantee clearance, acceptance, streams, or sales."
  ],
  [
    "creator-commerce-digital-products",
    "Selling Your Work",
    "commerce",
    "Products, services, licences, bundles, prices, delivery files, payment links, and your refund position.",
    "Get your creative work ready to sell and deliver properly.",
    "starter",
    "beta",
    // Was /creator-studio/launch-readiness, which is server.js's generic
    // `/:product/launch-readiness` -- the same service setup checklist all
    // three products share, showing which providers are configured. It is not
    // even signed-in gated, so a paid product pointed at a public page about
    // deployment. The identical fault was found and fixed on Business Builder's
    // exports product and missed here, because the two rows were read a week
    // apart and nothing compares a route to what the route renders.
    //
    // /creator-studio/offers is the paid workspace page holding offer records,
    // which is what this row describes.
    "/creator-studio/offers",
    "digital catalog|creator offers|bundles|payment links|delivery files|monetization readiness",
    "Stripe|creator assets|storage",
    "Availability, rights, license terms, pricing, delivery, and refunds require owner approval."
  ]
]);
