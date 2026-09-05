"use strict";

const SURFACES = Object.freeze({
  business_builder: Object.freeze({
    key: "business_builder",
    name: "Business Builder",
    route: "/business-builder/technology",
    fitLabels: Object.freeze([
      "Business Builder", "Founder Operations", "Support Center", "Customer Success",
      "Project Launch Checklist", "Files & Records", "Business Memory",
      "Business Memory Graph", "Graph Builder", "Developer Formula Studio"
    ])
  }),
  creator_studio: Object.freeze({
    key: "creator_studio",
    name: "Creator Studio",
    route: "/creator-studio/technology",
    fitLabels: Object.freeze([
      "Creator Studio", "Creator Studio analytics", "Creator Studio media analysis research",
      "Asset Vault", "Creator Tool Library", "Creator Knowledge Vault",
      "Voice Safety Review", "Render & Speed Tools"
    ])
  }),
  growth_studio: Object.freeze({
    key: "growth_studio",
    name: "Growth Studio",
    route: "/growth-studio/technology",
    fitLabels: Object.freeze([
      "Growth Studio", "Growth Studio content intelligence",
      "Growth Studio content intelligence research"
    ])
  }),
  shared_platform: Object.freeze({
    key: "shared_platform",
    name: "Shared SONARA platform",
    route: "/technology-radar",
    fitLabels: Object.freeze([
      "Admin Command Center", "Research Lab", "Smart Search", "Performance Planner",
      "Prompt Playbook Center", "AI Safety Review", "AI Governance", "AI Code Assistant",
      "Internal Development", "Secure Compute Layer", "Private Model Mode",
      "Worker Orchestration", "Workflow Brain", "System Design Intelligence"
    ])
  })
});

const SURFACE_ORDER = Object.freeze([
  SURFACES.business_builder,
  SURFACES.creator_studio,
  SURFACES.growth_studio,
  SURFACES.shared_platform
]);

const FIT_LABEL_TO_SURFACE = new Map();
for (const surface of SURFACE_ORDER) {
  for (const label of surface.fitLabels) FIT_LABEL_TO_SURFACE.set(label, surface);
}
FIT_LABEL_TO_SURFACE.set("None", null);

function surfacesFor(record) {
  const surfaces = new Map();
  for (const label of Array.isArray(record?.productFit) ? record.productFit : []) {
    const surface = FIT_LABEL_TO_SURFACE.get(label);
    if (surface) surfaces.set(surface.key, surface);
  }

  // A record with no customer fit still needs a visible governance home. This
  // does not promote it into a capability: its blocked/review status remains
  // authoritative and the Shared Platform page labels it as governance-only.
  if (surfaces.size === 0) surfaces.set(SURFACES.shared_platform.key, SURFACES.shared_platform);
  return SURFACE_ORDER.filter((surface) => surfaces.has(surface.key));
}

function primarySurfaceFor(record) {
  return surfacesFor(record)[0];
}

function unknownFitLabels(records) {
  const unknown = new Set();
  for (const record of Array.isArray(records) ? records : []) {
    for (const label of Array.isArray(record?.productFit) ? record.productFit : []) {
      if (!FIT_LABEL_TO_SURFACE.has(label)) unknown.add(label);
    }
  }
  return [...unknown].sort();
}

function getRepositoryProductPlacements(records) {
  return (Array.isArray(records) ? records : []).flatMap((record) =>
    surfacesFor(record).map((surface) => Object.freeze({ slug: record.slug, record, surface }))
  );
}

function getRepositoryPlacementCounts(records) {
  return getRepositoryProductPlacements(records).reduce((counts, placement) => {
    counts[placement.surface.key] = (counts[placement.surface.key] || 0) + 1;
    return counts;
  }, {});
}

function customerAvailability(record) {
  if (!record) return "Identity missing — unavailable";
  if (record.integrationStatus === "blocked") return "Not available — blocked";
  if (record.integrationStatus === "needs_security_review") return "Not available — security review required";
  if (record.integrationStatus === "needs_license_review") return "Not available — licence review required";
  if (record.integrationStatus === "research_only") return "Research reference only";
  return "Reviewed reference only";
}

module.exports = {
  SURFACES,
  SURFACE_ORDER,
  FIT_LABEL_TO_SURFACE,
  surfacesFor,
  primarySurfaceFor,
  unknownFitLabels,
  getRepositoryProductPlacements,
  getRepositoryPlacementCounts,
  customerAvailability
};
