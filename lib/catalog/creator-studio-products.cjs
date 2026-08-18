"use strict";

// See lib/catalog/sonara-industries-products.cjs for the row shape. name,
// summary and customerOutcome are customer-facing copy; the rest is internal.

module.exports = Object.freeze([
  [
    "brand-asset-system",
    "Brand & Asset Library",
    "brand",
    "Every asset you have, with a note on where it came from and what you are allowed to do with it.",
    "Know what you may release before you release it.",
    "starter",
    "beta",
    // Was /creator-studio/dashboard, which is the generic workspace index --
    // free tools, paid tools, recent activity. /creator-studio/assets is the
    // asset catalogue itself, with a form and the customer's saved records.
    "/creator-studio/assets",
    "asset records|rights notes|saved assets",
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
    // The summary is what a customer reads on the catalog card, and it went on
    // promising bundles, delivery files and payment links after the capability
    // list beside it had been cut to what the page does. Trimming the internal
    // field and leaving the customer-facing one is the wrong half.
    "Write down what you are selling, what is in it and what it costs, and keep the draft.",
    "Get an offer straight in your head before you put it in front of anybody.",
    // Free, on the owner's instruction. The only page that does this is a free
    // one, so a Starter floor charged for something a signed-in customer
    // already had.
    "free",
    "beta",
    // Twice wrong before this. It pointed at /creator-studio/launch-readiness,
    // the generic setup checklist every product shares; then at
    // /creator-studio/offers, chosen because the page definition is titled
    // "Offer Records" -- and rendering it shows two cards, "What this tool
    // does" and "Access", with no records and no form. Reading the definition
    // is not reading the page.
    //
    // /creator-studio/offers/free is the one that works: it drafts a creator
    // offer from real inputs and saves it. The claims are cut to that. Bundles,
    // payment links and delivery files are not built anywhere in Creator
    // Studio, and this row said all three.
    "/creator-studio/offers/free",
    "offer drafts|what you are selling|price and scope",
    "Stripe|creator assets|storage",
    "Availability, rights, license terms, pricing, delivery, and refunds require owner approval."
  ],
  [
    "creator-rate-card-builder",
    "Rate Card Builder",
    "monetization",
    "Turn a day rate into a rate card that states the licence, the revisions included, and what a rush actually costs.",
    "Quote without undercharging for the things clients assume are free.",
    "free",
    "active",
    "/creator-studio/tools/rate-card",
    "day and half-day rates|rush rate|licence line|revision policy|ownership note",
    "module_outputs|planner tools",
    "A pricing structure, not a contract. Licence and ownership terms should be reviewed before you send them to a client."
  ],
  [
    "split-sheet-and-credits",
    "Split Sheet and Credits",
    "rights",
    "Check that every collaborator's share of a work adds up to one hundred percent, and produce the credit line, before anybody signs.",
    "Catch a split that does not add up while it is still a conversation.",
    "free",
    "active",
    "/creator-studio/tools/split-sheet",
    "share validation|credits block|consent reminder",
    "module_outputs|planner tools",
    "Checks arithmetic and records intent. It is not a signed agreement, and everybody named must still agree in writing."
  ],
  [
    "content-repurposing-planner",
    "Repurposing Planner",
    "content",
    "Work out how many usable pieces one recording is really worth, and how many weeks of posting that covers.",
    "Stop guessing whether you have enough to post next month.",
    "free",
    "active",
    "/creator-studio/tools/repurpose",
    "usable clip estimate|pieces per format|weeks of content|publishing order",
    "module_outputs|planner tools",
    "An estimate from the length you supply. Music, footage and anybody appearing in the source still need clearing per format."
  ],
  [
    "deal-memo-recorder",
    "Deal Memo Recorder",
    "rights",
    "A dated record of what was agreed at the moment it was agreed, and a list of what is still missing before work starts.",
    "Two thirds of creators had a dispute last year. This is what they were about.",
    "free",
    "active",
    "/creator-studio/tools/deal-memo",
    "agreed fee|deliverables|usage term|payment due date|what is still missing",
    "module_outputs|market tools",
    "A record of what you understood was agreed. It is not a contract and not legal advice."
  ],
  [
    "late-payment-escalation",
    "Late Payment Escalation",
    "payments",
    "What a late invoice is costing you including the delay, with a dated ladder of what to send next.",
    "Chase what you are owed without guessing at the tone or the timing.",
    "free",
    "active",
    "/creator-studio/tools/late-payment",
    "days overdue|interest accrued|total now owed|dated escalation ladder",
    "module_outputs|market tools",
    "Interest is only chargeable where your terms or your jurisdiction allow it, and the result says so before you invoice it."
  ],
  [
    "usage-rights-expiry",
    "Usage Rights Expiry",
    "rights",
    "When a licence you granted runs out, so work still in use becomes a renewal conversation rather than a quiet loss.",
    "Get paid again for work that is still earning for somebody else.",
    "free",
    "active",
    "/creator-studio/tools/rights-expiry",
    "expiry date|days remaining|renewal position",
    "module_outputs|market tools",
    "Tracks dates you enter. It does not monitor where the work is being used and cannot detect an infringement."
  ],
]);
