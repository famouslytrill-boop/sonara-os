"use strict";

// Which pages each product workspace has, and what its action bars link to.
//
// First slice of the server.js split (5,119 lines). The split runs in the
// background and must never be the reason a release is held, so it moves in
// pieces that each leave the tree shippable rather than in one cut.
//
// Why this piece first: these four functions are pure data and link-building,
// and -- checked against all 44 scripts/apply-*.cjs -- no generator anchors on
// any of them. That matters more than size here. 765 distinct strings in
// server.js are replacement targets or anchors for the code generators, and
// moving one of those breaks the build in a way that only shows up when
// apply:runtime next runs. workspaceToolPage, which sits immediately after this
// block in server.js, is rewritten wholesale by
// apply-customer-ready-production-experience.cjs and therefore stays exactly
// where it is.
//
// linkAction and logoutAction are injected rather than imported: linkAction is
// referenced by 30 generators and has to stay in server.js. This is the same
// dependency-injection shape the routes/*.cjs modules already use, so it is a
// pattern the codebase already reads fluently rather than a new one.

/**
 * @param {object} deps
 * @param {(href: string, label: string) => string} deps.linkAction
 * @param {() => string} deps.logoutAction
 */
function createProductPages({ linkAction, logoutAction }) {
  if (typeof linkAction !== "function") throw new TypeError("createProductPages needs linkAction");
  if (typeof logoutAction !== "function") throw new TypeError("createProductPages needs logoutAction");

  function getProductPageDefinitions(slug) {
    const definitions = {
      "business-builder": {
        free: [
          { path: "/business-builder/readiness", label: "Launch Setup Checklist", title: "Business Builder Launch Setup Checklist", module: "readiness", body: "Track the launch basics before paid operations are enabled.", form: "business_checklist" },
          { path: "/business-builder/intake", label: "Intake", title: "Customer Enquiries", module: "intake", body: "Take a real service request. Saving it needs your records set up first.", form: "business_intake" },
          { path: "/business-builder/checklist", label: "Launch Setup Checklist", title: "Launch Setup Checklist", module: "checklist", body: "Use this free checklist to prepare business profile, offer, intake, pricing, payment, support, legal, and analytics.", form: "business_checklist" },
          { path: "/business-builder/offers/free", label: "Free offer draft", title: "Offer Builder", module: "offer_builder", body: "Draft a simple service offer from your real inputs.", form: "business_offer" },
          { path: "/business-builder/records/free", label: "Free records", title: "Free Records", module: "free_records", body: "Free records show saved basic module outputs when the account database and organization membership are configured.", api: "/api/business-builder/records" },
          { path: "/business-builder/help", label: "Help", title: "Business Builder Help", module: "help", body: "Help with your service offers, customer enquiries, customer records, taking bookings, and setting up support." }
        ],
        paid: [
          { path: "/business-builder/customers", label: "Customers", title: "Customer Records", module: "customers", body: "Paid customer records unlock after billing state confirms plan access." },
          { path: "/business-builder/records", label: "Records", title: "Business Records", module: "records", body: "Paid business records unlock after billing state confirms plan access." },
          { path: "/business-builder/offers", label: "Offers", title: "Offer Records", module: "offers", body: "Paid offer records unlock after billing state confirms plan access." },
          { path: "/business-builder/orders", label: "Orders", title: "Orders", module: "orders", body: "Order operations require payment setup and account database records." },
          { path: "/business-builder/payments", label: "Payments", title: "Payments", module: "payments", body: "Payment operations require configured checkout, webhook delivery, and confirmed billing records." },
          { path: "/business-builder/launch-plan", label: "Launch plan", title: "Launch Plan", module: "launch_plan", body: "Paid launch planning unlocks after plan access is recorded." },
          { path: "/business-builder/automations", label: "Automations", title: "Automations", module: "automations", body: "Automation remains setup required until owner-approved workflows and audit logging are configured." }
        ]
      },
      "creator-studio": {
        free: [
          { path: "/creator-studio/assets", label: "Asset Catalog", title: "Asset Catalog", module: "asset_catalog", body: "Create a real asset record with rights notes. Saved records require account database setup.", form: "creator_asset" },
          { path: "/creator-studio/releases", label: "Releases", title: "Release & Content Checklist", module: "release_checklist", body: "Prepare platform setup, ownership, pricing, promo assets, distribution, and support." },
          { path: "/creator-studio/checklist", label: "Checklist", title: "Creator Studio Checklist", module: "checklist", body: "Use this checklist before monetizing creator products or releases." },
          { path: "/creator-studio/offers/free", label: "Free offer draft", title: "Creator Offers", module: "creator_offers", body: "Draft a creator offer from real product inputs.", form: "creator_offer" },
          { path: "/creator-studio/records/free", label: "Free records", title: "Free Records", module: "free_records", body: "Free records show saved basic module outputs when account database setup is complete.", api: "/api/creator-studio/records" },
          { path: "/creator-studio/help", label: "Help", title: "Creator Studio Help", module: "help", body: "Help with your assets, offers, release checklists, getting your catalogue ready, and setting up payments." }
        ],
        paid: [
          { path: "/creator-studio/offers", label: "Offers", title: "Offer Records", module: "offers", body: "Paid offer records unlock after billing state confirms plan access." },
          { path: "/creator-studio/records", label: "Records", title: "Media & Customer Records", module: "records", body: "Paid media and customer records unlock after billing state confirms plan access." },
          { path: "/creator-studio/settings", label: "Settings", title: "Creator Studio Settings", module: "settings", body: "Workspace settings require paid plan access or owner/admin operations." },
          { path: "/creator-studio/catalog", label: "Catalog", title: "Catalog", module: "catalog", body: "Catalog operations require paid plan access and account database records." },
          { path: "/creator-studio/monetization", label: "Monetization", title: "Ready To Sell", module: "monetization", body: "Before you sell, you need payments set up, your rights checked, and terms you have approved." },
          { path: "/creator-studio/media-kit", label: "Media kit", title: "Media Kit", module: "media_kit", body: "Paid media kit operations unlock after billing state confirms plan access." },
          { path: "/creator-studio/automations", label: "Automations", title: "Automations", module: "automations", body: "Automation remains setup required until owner-approved workflows and audit logging are configured." }
        ]
      },
      "growth-studio": {
        free: [
          { path: "/growth-studio/campaigns", label: "Campaign Workspace", title: "Campaign Workspace", module: "campaign_workspace", body: "Create a campaign plan from real goal, audience, offer, channel, and timeline inputs.", form: "growth_campaign" },
          { path: "/growth-studio/leads", label: "Lead follow-up", title: "Lead & Customer Follow-Up", module: "lead_follow_up", body: "Capture consent-safe lead follow-up inputs. Saved records require account database setup.", form: "growth_lead" },
          { path: "/growth-studio/checklist", label: "Consent checklist", title: "Consent-Safe Campaign Checklist", module: "checklist", body: "Review consent status, unsubscribe language, mailing address, truthful sender details, and audience-source notes." },
          { path: "/growth-studio/offers/free", label: "Free offer draft", title: "Growth Offer Notes", module: "growth_offer", body: "Use campaign inputs to prepare a truthful offer angle before outreach.", form: "growth_campaign" },
          { path: "/growth-studio/records/free", label: "Free records", title: "Free Records", module: "free_records", body: "Free records show saved basic module outputs when account database setup is complete.", api: "/api/growth-studio/records" },
          { path: "/growth-studio/help", label: "Help", title: "Growth Studio Help", module: "help", body: "Operational help for campaign planning, consent-safe follow-up, lead records, and payment-safe growth routines." }
        ],
        paid: [
          { path: "/growth-studio/offers", label: "Offers", title: "Growth Offers", module: "offers", body: "Paid offer records unlock after billing state confirms plan access." },
          { path: "/growth-studio/records", label: "Records", title: "Growth Records", module: "records", body: "Paid growth records unlock after billing state confirms plan access." },
          { path: "/growth-studio/settings", label: "Settings", title: "Growth Studio Settings", module: "settings", body: "Workspace settings require paid plan access or owner/admin operations." },
          { path: "/growth-studio/followups", label: "Follow-ups", title: "Follow-Ups", module: "followups", body: "Follow-up operations require consent review, email delivery setup, and paid plan access." },
          // Content plan and Automations were here as placeholders describing
          // themselves as locked. They are real record pages now, registered in
          // lib/sonara-growth-record-pages.cjs against endpoints that already
          // worked, and still behind the same paid check. They are not listed
          // twice: Express keeps the first registration for a path, so leaving
          // these entries would have left the placeholder winning and the real
          // page unreachable.
          { path: "/growth-studio/analytics", label: "Analytics", title: "Analytics", module: "analytics", body: "Analytics requires real campaign records and paid plan access." }
        ]
      }
    };
    return definitions[slug] || { free: [], paid: [] };
  }

  function productLandingActions(slug) {
    if (slug === "business-builder") {
      return [
        linkAction("/business-builder/dashboard", "Open dashboard"),
        linkAction("/business-builder/tools", "All tools"),
        linkAction("/business-builder/intake", "Intake"),
        linkAction("/business-builder/launch-readiness", "Launch checklist"),
        linkAction("/business-builder/billing", "Billing"),
        linkAction("/pricing", "Pricing"),
        linkAction("/login", "Login")
      ];
    }
    if (slug === "creator-studio") {
      return [
        linkAction("/creator-studio/dashboard", "Open dashboard"),
        linkAction("/creator-studio/tools", "All tools"),
        linkAction("/creator-studio/assets", "Assets"),
        linkAction("/creator-studio/offers/free", "Offer draft"),
        linkAction("/creator-studio/music-system", "Music system"),
        linkAction("/pricing", "Pricing"),
        linkAction("/login", "Login")
      ];
    }
    if (slug === "growth-studio") {
      return [
        linkAction("/growth-studio/control-center", "Open control center"),
        linkAction("/growth-studio/tools", "All tools"),
        linkAction("/growth-studio/campaigns", "Campaigns"),
        linkAction("/growth-studio/leads", "Leads"),
        linkAction("/growth-studio/segments", "Audience segments"), linkAction("/growth-studio/attribution", "Attribution"), linkAction("/growth-studio/experiments", "Experiments"), linkAction("/growth-studio/providers", "Providers"),
        linkAction("/pricing", "Pricing"),
        linkAction("/login", "Login")
      ];
    }
    return [
      linkAction(`/${slug}/dashboard`, "Open dashboard"),
      linkAction(`/${slug}/launch-readiness`, "Launch checklist"),
      linkAction("/pricing", "Pricing"),
      linkAction("/login", "Login")
    ];
  }

  function productDashboardActions(slug) {
    if (slug === "business-builder") {
      return [
        linkAction("/business-builder/intake", "Intake"),
        linkAction("/business-builder/launch-readiness", "Launch checklist"),
        linkAction("/business-builder/billing", "Billing"),
        linkAction("/contact", "Support"),
        logoutAction()
      ];
    }
    if (slug === "creator-studio") {
      return [
        linkAction("/creator-studio/assets", "Assets"),
        linkAction("/creator-studio/offers/free", "Offer draft"),
        linkAction("/creator-studio/checklist", "Checklist"),
        linkAction("/creator-studio/music-system", "Music system"),
        logoutAction()
      ];
    }
    if (slug === "growth-studio") {
      return [
        linkAction("/growth-studio/campaigns", "Campaigns"),
        linkAction("/growth-studio/leads", "Leads"),
        linkAction("/growth-studio/checklist", "Consent checklist"),
        linkAction("/pricing", "Pricing"),
        logoutAction()
      ];
    }
    return [
      linkAction(`/${slug}/launch-readiness`, "Launch checklist"),
      linkAction("/dashboard", "All workspaces"),
      linkAction("/pricing", "Pricing"),
      logoutAction()
    ];
  }

  function productLaunchReadinessActions(slug) {
    if (slug === "business-builder") {
      return [
        linkAction("/business-builder/dashboard", "Business Builder dashboard"),
        linkAction("/business-builder/intake", "Intake"),
        linkAction("/business-builder/billing", "Billing"),
        linkAction("/dashboard", "All workspaces"),
        logoutAction()
      ];
    }
    return [
      linkAction(`/${slug}/dashboard`, "Dashboard"),
      linkAction("/dashboard", "All workspaces"),
      linkAction("/pricing", "Pricing"),
      logoutAction()
    ];
  }

  return {
    getProductPageDefinitions,
    productLandingActions,
    productDashboardActions,
    productLaunchReadinessActions
  };
}

module.exports = { createProductPages };
