"use strict";

const SONARA_BRAND_REGISTRY = Object.freeze({
  parent: Object.freeze({
    name: "SONARA Industries",
    platform: "SONARA One",
    message: "Build, create, and grow—without losing control.",
    promise: "Premium enough to trust. Accessible enough to begin.",
    audience: "Independent founders, creators, operators, and small teams.",
    logo: "/brand/sonara-one-mark-v3.svg",
    horizontalLogo: "/brand/sonara-industries-logo-v3.svg",
    darkLogo: "/brand/sonara-one-mark-v3-dark.svg",
    monochromeLogo: "/brand/sonara-one-mark-v3-mono.svg"
  }),
  products: Object.freeze([
    Object.freeze({
      key: "business_builder",
      slug: "business-builder",
      name: "Business Builder",
      experienceMode: "Forge",
      action: "Launch and operate",
      description: "Turn an idea into an offer, customer path, records system, payment-ready workflow, and repeatable operating rhythm.",
      route: "/business-builder",
      dashboardRoute: "/business-builder/dashboard",
      primaryRoute: "/business-builder/launch-readiness",
      logo: "/brand/business-builder-mark-v3.svg",
      horizontalLogo: "/brand/business-builder-logo-v3.svg",
      accent: "forge",
      milestones: Object.freeze(["Identity", "Offer", "Records", "Customer path", "Payment", "Readiness", "Operate"])
    }),
    Object.freeze({
      key: "creator_studio",
      slug: "creator-studio",
      name: "Creator Studio",
      experienceMode: "Canvas",
      action: "Create and release",
      description: "Organize artist systems, songs, prompts, assets, rights checks, releases, media systems, and monetization readiness.",
      route: "/creator-studio",
      dashboardRoute: "/creator-studio/dashboard",
      primaryRoute: "/creator-studio/assets",
      logo: "/brand/creator-studio-mark-v3.svg",
      horizontalLogo: "/brand/creator-studio-logo-v3.svg",
      accent: "canvas"
    }),
    Object.freeze({
      key: "growth_studio",
      slug: "growth-studio",
      name: "Growth Studio",
      experienceMode: "Signal",
      action: "Reach and learn",
      // The sentence, decided 26 August 2026. Growth Studio does not send.
      //
      // There is no SMTP path, no SMS and no Twilio in this source. Campaigns
      // are created through a connected provider's API -- HubSpot, Klaviyo --
      // and this product is the layer above: it records consent before dispatch
      // and keeps the paid contact count down. Described as an alternative to
      // those tools it fails the first time a customer presses send, so it is
      // described as what it is. scripts/check-growth-studio-copy.mjs holds the
      // line in both directions.
      description: "Plan campaigns, score and route leads, and record consent before anything is dispatched. Sending runs through the email and SMS provider you already use.",
      route: "/growth-studio",
      dashboardRoute: "/growth-studio/dashboard",
      primaryRoute: "/growth-studio/campaigns",
      logo: "/brand/growth-studio-mark-v3.svg",
      horizontalLogo: "/brand/growth-studio-logo-v3.svg",
      accent: "signal"
    })
  ]),
  plans: Object.freeze([
    Object.freeze({ key: "free", name: "Free", price: "$0", detail: "Explore the system and create the first useful output.", route: "/signup" }),
    // The retired plan keys remain in the billing catalog for entitlement
    // compatibility, but the public brand registry must tell the same story as
    // the current pricing page.
    Object.freeze({ key: "workspace_monthly", name: "One workspace", price: "$29/mo", detail: "Any one of Business Builder, Creator Studio, or Growth Studio with saved records and launch workflows.", route: "/pricing" }),
    Object.freeze({ key: "all_three_monthly", name: "All three", price: "$59/mo", detail: "Business Builder, Creator Studio, and Growth Studio together with one login and one bill.", route: "/pricing" }),
    Object.freeze({ key: "team_monthly", name: "Team", price: "$109/mo", detail: "All three workspaces plus staff scheduling, tasks, and team records.", route: "/pricing" })
  ]),
  publicRoutes: Object.freeze({
    products: "/products",
    freeTools: "/free-tools",
    pricing: "/pricing",
    readiness: "/readiness",
    signup: "/signup",
    login: "/login",
    support: "/support"
  })
});

function getBrandProduct(slugOrKey) {
  const value = String(slugOrKey || "").trim().toLowerCase().replace(/_/g, "-");
  return SONARA_BRAND_REGISTRY.products.find((product) => product.slug === value) || null;
}

module.exports = { SONARA_BRAND_REGISTRY, getBrandProduct };
