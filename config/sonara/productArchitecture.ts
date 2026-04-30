export const sonaraWebsiteSections = [
  {
    id: "hero",
    label: "Hero",
    title: "SONARA™ is the operating system artists use to build a real music business.",
    description:
      "Artists, creators, local businesses, and digital product builders can build brands, generate content, analyze ideas, map revenue paths, and launch with focused AI workflows.",
  },
  {
    id: "ecosystem",
    label: "Ecosystem",
    title: "One music-business ecosystem.",
    description:
      "SONARA™ connects songs, release assets, sound systems, broadcast materials, proof points, and export packages into one creator workflow.",
  },
  {
    id: "creator-business-os",
    label: "Creator Business OS",
    title: "SONARA Creator Business OS connects ideas, content, brands, and business decisions.",
    description:
      "A&R Intelligence, the Decision Engine, and the Revenue Pathway Engine help users evaluate ideas, choose the next move, and map realistic revenue paths without promising outcomes.",
  },
  {
    id: "active-tools",
    label: "Active Tools",
    title: "Five active tools turn strategy into daily creator work.",
    description:
      "Prompt Vault, Artist OS, Content Studio, Visual Builder, and Local Business Kits organize the practical work around the Creator Business OS.",
  },
  {
    id: "product-promise",
    label: "Product Promise",
    title: "Every song gets a fingerprint. Every release gets a plan.",
    description:
      "Every creator gets a cleaner path from idea to launch, with advanced systems hidden until they serve the work.",
  },
  {
    id: "workflow",
    label: "Workflow",
    title: "From idea to release, one step at a time.",
    description:
      "The workflow moves through fingerprint, quality, release, visuals, broadcast, sound pack, proof, and export.",
  },
  {
    id: "sound-vault",
    label: "Sound Vault",
    title: "Sound systems and digital assets stay organized.",
    description:
      "Loops, references, palettes, packs, and creator-ready files belong inside a clean vault layer, not scattered across a cluttered dashboard.",
  },
  {
    id: "pricing",
    label: "Pricing",
    title: "Simple tiers for real creator workflows.",
    description:
      "Pricing stays tied to workflow depth, team needs, storage, export capability, and studio operating discipline.",
  },
  {
    id: "brand-footer",
    label: "Brand Footer",
    title: "SONARA Industries™",
    description:
      "A focused music technology company building creator infrastructure, release tools, artist systems, sound workflows, and digital assets.",
  },
] as const;

export const sonaraCreatorBusinessModules = [
  {
    name: "A&R Intelligence",
    purpose: "Evaluates song identity, hook strength, audience signal, genre fit, and release-readiness evidence.",
    output: "Creator-facing notes for what to improve, what to keep, and what makes the record easier to position.",
  },
  {
    name: "Decision Engine",
    purpose: "Turns creative and business context into the next practical move for the song, release, artist system, or studio workflow.",
    output: "Clear go, improve, hold, or export guidance with blockers and next checks.",
  },
  {
    name: "Revenue Pathway Engine",
    purpose: "Maps plausible creator business routes such as releases, services, sound assets, bundles, licensing prep, and studio offers.",
    output: "Planning paths and readiness checks only. It never guarantees income, placements, or market results.",
  },
] as const;

export const sonaraActiveTools = [
  {
    name: "Prompt Vault",
    route: "/create",
    purpose: "Stores and shapes reusable song, release, content, and visual prompts.",
    output: "Copy-ready prompt systems for consistent creator execution.",
  },
  {
    name: "Artist OS",
    route: "/library",
    purpose: "Organizes artist identity, catalog direction, positioning, release history, and saved projects.",
    output: "A cleaner artist system that can grow across songs, releases, and business moves.",
  },
  {
    name: "Content Studio",
    route: "/dashboard",
    purpose: "Turns song and release strategy into content angles, rollout notes, and creator-facing campaign tasks.",
    output: "Practical content direction that supports the release without becoming a social-media clutter engine.",
  },
  {
    name: "Visual Builder",
    route: "/export",
    purpose: "Frames cover direction, visual references, brand consistency, and release asset needs.",
    output: "Visual planning notes and export-ready creative direction.",
  },
  {
    name: "Local Business Kits",
    route: "/settings",
    purpose: "Packages realistic local creator offers, studio workflows, service menus, and operational checklists.",
    output: "Business kit planning only. No guaranteed income, placements, or client outcomes.",
  },
] as const;

export const sonaraAppNavigation = [
  { label: "Home", route: "/", description: "Website entry and ecosystem overview" },
  { label: "Create", route: "/create", description: "Build a song and create a fingerprint" },
  { label: "Library", route: "/library", description: "Build an artist system" },
  { label: "Export", route: "/export", description: "Build a release package" },
  { label: "Settings", route: "/settings", description: "Configure providers, storage, and launch settings" },
] as const;

export const sonaraProjectWorkflow = [
  {
    label: "Fingerprint",
    description: "Define identity, mood, audience signal, sonic palette, and the song's durable release seed.",
  },
  {
    label: "Quality",
    description: "Check mix state, hook clarity, performance readiness, blockers, and next practical review steps.",
  },
  {
    label: "Release",
    description: "Shape positioning, rollout, metadata prep, checklist state, and launch sequence.",
  },
  {
    label: "Visuals",
    description: "Prepare cover direction, short-form proof, visual references, and release asset needs.",
  },
  {
    label: "Broadcast",
    description: "Package talking points, listener moment, hook framing, and creator-facing launch notes.",
  },
  {
    label: "Sound Pack",
    description: "Organize sound palette, loops, drums, references, presets, and reusable creator assets.",
  },
  {
    label: "Proof",
    description: "Capture the evidence that the release is ready: audience angle, asset list, credits, and blockers.",
  },
  {
    label: "Export",
    description: "Bundle structured data, human-readable plans, checklists, broadcast notes, and manifests.",
  },
] as const;

export const sonaraPricingTiers = [
  {
    name: "SONARA OS™ Free",
    description: "Start projects, build basic prompts, and explore local-rules release planning.",
  },
  {
    name: "SONARA OS™ Creator",
    description: "Add runtime targets, external generator settings, and stronger creator workflows.",
  },
  {
    name: "SONARA OS™ Pro",
    description: "Export full release bundles and sound-rights documentation for serious launches.",
  },
  {
    name: "SONARA OS™ Label",
    description: "Run brand governance, label workspace planning, and store product workflow.",
  },
] as const;
