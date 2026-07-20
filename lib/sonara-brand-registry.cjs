"use strict";

const SONARA_BRAND_REGISTRY = Object.freeze({
  parent: Object.freeze({
    name: "SONARA Industries",
    platform: "SONARA Nexus",
    message: "Make work move.",
    promise: "Build what moves you.",
    audience: "Founders, creators, and small teams.",
    logo: "/brand/sonara-industries-mark.svg"
  }),
  products: Object.freeze([
    Object.freeze({
      key: "business_builder",
      slug: "business-builder",
      name: "Business Builder",
      experienceMode: "Forge",
      action: "Shape and operate",
      description: "Turn an idea into an offer, customer path, records system, payment-ready workflow, and repeatable operating rhythm.",
      route: "/business-builder",
      dashboardRoute: "/business-builder/dashboard",
      primaryRoute: "/business-builder/launch-readiness",
      logo: "/brand/business-builder-mark.svg",
      accent: "ember",
      milestones: Object.freeze(["Identity", "Offer", "Records", "Customer path", "Payment", "Readiness", "Operate"])
    }),
    Object.freeze({
      key: "creator_studio",
      slug: "creator-studio",
      name: "Creator Studio",
      experienceMode: "Canvas",
      action: "Create and release",
      description: "Organize assets, rights, offers, releases, media systems, and monetization readiness in one responsive creative workspace.",
      route: "/creator-studio",
      dashboardRoute: "/creator-studio/dashboard",
      primaryRoute: "/creator-studio/assets",
      logo: "/brand/creator-studio-mark.svg",
      accent: "orchid"
    }),
    Object.freeze({
      key: "growth_studio",
      slug: "growth-studio",
      name: "Growth Studio",
      experienceMode: "Signal",
      action: "Reach and learn",
      description: "Plan campaigns, manage leads, protect consent, review outcomes, and convert real customer signals into the next useful action.",
      route: "/growth-studio",
      dashboardRoute: "/growth-studio/dashboard",
      primaryRoute: "/growth-studio/campaigns",
      logo: "/brand/growth-studio-mark.svg",
      accent: "electric"
    })
  ]),
  plans: Object.freeze([
    Object.freeze({ key: "free", name: "Free", price: "$0", detail: "Explore the system and create the first useful output.", route: "/signup" }),
    Object.freeze({ key: "starter_monthly", name: "Starter", price: "$7/mo", detail: "One workspace, essential tools, intake, checklists, and limited records.", route: "/pricing" }),
    Object.freeze({ key: "core_monthly", name: "Core", price: "$19/mo", detail: "Saved records, launch workflows, customer operations, and support.", route: "/pricing" }),
    Object.freeze({ key: "pro_monthly", name: "Pro", price: "$39/mo", detail: "Business Builder, Creator Studio, and Growth Studio with deeper records and priority support.", route: "/pricing" })
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
