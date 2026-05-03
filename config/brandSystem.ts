export const brandSystem = {
  parentCompany: {
    name: "SONARA Industries™",
    shortName: "SONARA",
    type: "Music Technology Company",
    slogan: "Build the sound. Own the system.",
    premiumSlogan: "The creator infrastructure for modern music.",
    streetSlogan: "From sound to system. From idea to release.",
    description:
      "SONARA Industries™ is a music technology company building creator infrastructure through records, software, sound systems, artist workflows, and release tools.",
  },
  divisions: {
    records: {
      name: "SONARA Records™",
      route: "/records",
      type: "Record Label Division",
      description:
        "SONARA Records™ is the music division of SONARA Industries™, focused on original releases, artist development, cinematic branding, and modern sound design.",
    },
    os: {
      name: "SONARA OS™",
      route: "/dashboard",
      type: "Creator Operating System",
      description:
        "SONARA OS™ is a creator operating system for building songs, prompts, sounds, visuals, release plans, and music brand workflows from one organized platform.",
    },
    core: {
      name: "SONARA Core™",
      route: "/create",
      type: "All-Genre Music Operating Base",
      description:
        "SONARA Core™ reads genre, rhythm, harmony, drums, vocals, sound identity, runtime, and release goals into a clear system for modern music creators.",
    },
    vault: {
      name: "SONARA Vault™",
      route: "/vault",
      type: "Sound Library and Asset System",
      description:
        "SONARA Vault™ organizes, classifies, verifies, packages, and exports user-owned or rights-cleared sounds, MIDI, presets, templates, and production assets.",
    },
    engine: {
      name: "SONARA Engine™",
      route: "/engine",
      type: "Creative Intelligence and Automation System",
      description:
        "SONARA Engine™ powers the creative intelligence behind SONARA OS™, analyzing rhythm, harmony, emotion, genre, vocals, sound design, and release strategy.",
    },
    exchange: {
      name: "SONARA Exchange™",
      route: "/exchange",
      type: "Future Marketplace and Licensing Platform",
      description:
        "SONARA Exchange™ is delayed for launch and requires seller onboarding, rights verification, payout compliance, moderation, marketplace terms, and support policy before public kit sales.",
    },
    labs: {
      name: "SONARA Labs™",
      route: "/labs",
      type: "Research and Development Division",
      description:
        "SONARA Labs™ is the research and development division of SONARA Industries™, focused on music technology, creator automation, sonic tools, and future-facing product systems.",
    },
  },
  legal: {
    footer:
      "SONARA Industries™, SONARA Records™, SONARA OS™, SONARA Core™, SONARA Vault™, SONARA Engine™, SONARA Exchange™, and SONARA Labs™ are trademarks of SONARA Industries. All rights reserved.",
    trademarkNotice:
      "All SONARA brand names marked with ™ are claimed trademarks of SONARA Industries. Do not use the registered trademark symbol unless the mark has been officially registered.",
    allowedSymbol: "™",
    restrictedSymbol: String.fromCharCode(174),
  },
  publicCopy: {
    homepageHeroTitle: "SONARA Industries™",
    homepageHeroSubtitle: "The creator infrastructure for modern music.",
    homepageHeroBody:
      "Build songs, release music, design sounds, organize artist systems, and power your creative business from one platform.",
    appStoreShort:
      "SONARA OS™ helps creators build songs, sounds, prompts, release plans, and music brands from one organized workspace.",
    appStoreLong:
      "SONARA OS™ is the creator operating system from SONARA Industries™, built for artists, producers, labels, and music entrepreneurs. Create songs, organize rights-aware Vault assets, structure lyrics, build release plans, manage creative assets, and develop music brands inside one streamlined platform.",
  },
  productTiers: [
    {
      name: "SONARA OS™ Free",
      features: ["Basic song prompt builder", "Basic lyric workspace", "Artist profile starter", "Limited release planner", "Basic brand kit"],
    },
    {
      name: "SONARA OS™ Creator",
      features: ["Advanced song prompt system", "SONARA Engine™ analysis", "Genre and emotion mapping", "Album planning", "Export tools", "Vault organizer"],
    },
    {
      name: "SONARA OS™ Pro",
      features: ["Full SONARA Engine™ access", "SONARA Vault™ management", "Store readiness tools", "Artist ecosystem builder", "Release campaign planner", "PDF and metadata exports", "Commercial creator workflows"],
    },
    {
      name: "SONARA OS™ Label",
      features: ["Multi-artist management", "Catalog planning", "Release pipeline", "Brand governance", "Team workspace", "Advanced analytics", "SONARA Exchange™ planning"],
    },
  ],
} as const;

export const ecosystemNavItems = [
  { label: "SONARA OS™", route: "/dashboard", description: "Main creator operating system" },
  { label: "SONARA Records™", route: "/records", description: "Artist releases, albums, singles, catalog planning" },
  { label: "SONARA Core™", route: "/create", description: "All-genre idea-to-arrangement operating base" },
  { label: "SONARA Vault™", route: "/vault", description: "Organize, classify, verify, package, and export rights-cleared assets" },
  { label: "SONARA Engine™", route: "/engine", description: "Prompt generation, music analysis, automation" },
  { label: "SONARA Exchange™", route: "/exchange", description: "Future marketplace and licensing platform after rights/payout readiness" },
  { label: "SONARA Labs™", route: "/labs", description: "Research, experiments, testing, product innovation" },
  { label: "Brand System™", route: "/brand-system", description: "Trademark, legal, and brand identity control" },
] as const;
