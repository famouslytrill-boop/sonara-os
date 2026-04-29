export const sonaraWebsiteSections = [
  {
    id: "hero",
    label: "Hero",
    title: "SONARA™ is the operating system artists use to build a real music business.",
    description:
      "Build songs, prepare releases, organize artist systems, and run studio workflows without burying artists in extra systems.",
  },
  {
    id: "ecosystem",
    label: "Ecosystem",
    title: "One music-business ecosystem.",
    description:
      "SONARA™ connects songs, release assets, sound systems, broadcast materials, proof points, and export packages into one creator workflow.",
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
    name: "Starter",
    description: "Build songs and releases with Local Rules, fingerprints, release plans, and export bundles.",
  },
  {
    name: "Creator",
    description: "Add deeper artist-system organization, reusable sound-pack structure, and expanded release workflows.",
  },
  {
    name: "Studio",
    description: "Run studio workflows, quality gates, team review, and internal operating discipline.",
  },
] as const;
