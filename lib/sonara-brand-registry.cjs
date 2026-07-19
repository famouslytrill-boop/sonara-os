"use strict";

const SONARA_BRAND_REGISTRY = Object.freeze({
  parent: Object.freeze({
    name: "SONARA Industries",
    platform: "SONARA One",
    message: "Build. Create. Grow.",
    promise: "Build what matters. Keep it moving.",
    logo: "/brand/sonara-industries-mark.svg"
  }),
  products: Object.freeze([
    Object.freeze({
      key: "business_builder",
      slug: "business-builder",
      name: "Business Builder",
      action: "Launch and operate",
      description: "Create the offer, connect records, publish the customer path, verify payment readiness, and run the business through one guided workflow.",
      route: "/business-builder",
      dashboardRoute: "/business-builder/dashboard",
      primaryRoute: "/business-builder/launch-readiness",
      logo: "/brand/business-builder-mark.svg",
      accent: "green",
      milestones: Object.freeze(["Identity", "Offer", "Records", "Customer path", "Payment", "Readiness", "Operate"])
    }),
    Object.freeze({
      key: "creator_studio",
      slug: "creator-studio",
      name: "Creator Studio",
      action: "Create and release",
      description: "Organize assets, rights notes, offers, release planning, monetization readiness, and creator records in one connected studio.",
      route: "/creator-studio",
      dashboardRoute: "/creator-studio/dashboard",
      primaryRoute: "/creator-studio/assets",
      logo: "/brand/creator-studio-mark.svg",
      accent: "violet"
    }),
    Object.freeze({
      key: "growth_studio",
      slug: "growth-studio",
      name: "Growth Studio",
      action: "Understand and grow",
      description: "Turn campaigns, leads, reviews, referrals, and consent-safe customer signals into explainable next actions.",
      route: "/growth-studio",
      dashboardRoute: "/growth-studio/dashboard",
      primaryRoute: "/growth-studio/campaigns",
      logo: "/brand/growth-studio-mark.svg",
      accent: "cyan"
    })
  ]),
  plans: Object.freeze([
    Object.freeze({ key: "free", name: "Free", price: "$0", detail: "Explore the system and create the first useful output.", route: "/signup" }),
    Object.freeze({ key: "starter_monthly", name: "Starter", price: "$7/mo", detail: "One workspace, basic offer, intake, checklist tools, and limited records.", route: "/pricing" }),
    Object.freeze({ key: "core_monthly", name: "Core", price: "$19/mo", detail: "Customer records, offer records, launch readiness, and support queue.", route: "/pricing" }),
    Object.freeze({ key: "pro_monthly", name: "Pro", price: "$39/mo", detail: "All three studios, deeper records, campaign planning, and priority support.", route: "/pricing" })
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
