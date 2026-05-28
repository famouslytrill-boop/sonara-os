export const brandSystem = {
  parentCompany: {
    name: "SONARA Industries™",
    shortName: "SONARA",
    type: "Technology Holding Company",
    slogan: "Build. Create. Grow.",
    premiumSlogan: "Build. Create. Grow.",
    streetSlogan: "Build. Prove. Get paid. Grow.",
    description:
      "SONARA Industries™ owns the shared infrastructure behind Business Builder, Creator Studio, and Growth Studio.",
  },
  divisions: {
    records: {
      name: "Files & Records™",
      route: "/app/files",
      type: "Shared Infrastructure",
      description: "Files & Records organizes operational documents, asset records, customer records, and launch materials.",
    },
    os: {
      name: "SONARA One™",
      route: "/app",
      type: "Shared App Platform",
      description: "SONARA One™ connects Business Builder, Creator Studio, and Growth Studio through shared infrastructure.",
    },
    core: {
      name: "Business Builder™",
      route: "/business-builder",
      type: "Business Operations Product",
      description: "Business Builder™ helps users create, launch, run, and manage a business with guided systems.",
    },
    vault: {
      name: "Creator Studio™",
      route: "/creator-studio",
      type: "Creator Operations Product",
      description: "Creator Studio™ helps users organize, protect, publish, monetize, and grow creative work.",
    },
    engine: {
      name: "Growth Studio™",
      route: "/growth-studio",
      type: "Growth Systems Product",
      description: "Growth Studio™ helps users prepare campaigns, follow-up, offers, reviews, referrals, and recommendations.",
    },
    exchange: {
      name: "Proof-to-Payment™",
      route: "/trust",
      type: "Shared Trust Infrastructure",
      description: "Proof-to-Payment™ keeps payment paths, proof, reviews, and claims visible without taking custody of funds.",
    },
    labs: {
      name: "Research Lab™",
      route: "/trust",
      type: "Shared Research Infrastructure",
      description: "Research Lab™ supports explainable recommendations, market notes, and launch-readiness review.",
    },
  },
  legal: {
    footer:
      "SONARA Industries™, SONARA One™, Business Builder™, Creator Studio™, Growth Studio™, Trust Shield™, Proof-to-Payment™, and Research Lab™ are claimed trademarks of SONARA Industries. All rights reserved.",
    trademarkNotice:
      "All SONARA brand names marked with ™ are claimed trademarks of SONARA Industries. Do not use the registered trademark symbol unless the mark has been officially registered.",
    allowedSymbol: "™",
    restrictedSymbol: String.fromCharCode(174),
  },
  publicCopy: {
    homepageHeroTitle: "SONARA Industries™",
    homepageHeroSubtitle: "Build. Create. Grow.",
    homepageHeroBody:
      "SONARA Industries powers Business Builder, Creator Studio, and Growth Studio through shared infrastructure engineered for trust, speed, and scale.",
    appStoreShort:
      "SONARA One™ connects business, creator, and growth workflows from one shared app platform.",
    appStoreLong:
      "SONARA One™ is the app platform from SONARA Industries™, built for Business Builder, Creator Studio, and Growth Studio workflows with shared infrastructure, approval gates, and launch-readiness systems.",
  },
  productTiers: [
    {
      name: "Free",
      features: ["Product path selection", "Setup checklist", "Public page previews", "Setup-required billing state"],
    },
    {
      name: "Starter",
      features: ["Business or creator profile", "Payment and booking link records", "Basic customer records", "Trust checklist"],
    },
    {
      name: "Core",
      features: ["Files & Records", "Offer builder", "Review request drafts", "Launch readiness warnings"],
    },
    {
      name: "Growth",
      features: ["Growth Studio access", "Campaign drafts", "Referral builder", "Recommendation transparency"],
    },
  ],
} as const;

export const ecosystemNavItems = [
  { label: "SONARA One™", route: "/app", description: "Shared app platform" },
  { label: "Business Builder™", route: "/business-builder", description: "Business setup and operations" },
  { label: "Creator Studio™", route: "/creator-studio", description: "Creator assets, rights, launches, and offers" },
  { label: "Growth Studio™", route: "/growth-studio", description: "Campaigns, reviews, referrals, and next best actions" },
  { label: "Trust Shield™", route: "/trust", description: "Security, safety, and approval posture" },
  { label: "Pricing", route: "/pricing", description: "Plans and setup services" },
] as const;
