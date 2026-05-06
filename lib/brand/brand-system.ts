import type { CSSProperties } from "react";

export type BrandSlug =
  | "parent-company"
  | "creator-music-technology"
  | "business-operations"
  | "community-public-information"
  | "launchpad";

export type BrandCategory = "parent" | "entity" | "standalone_product";

export type BrandEntity = {
  id: string;
  slug: BrandSlug;
  displayName: string;
  legalNameWarning: string;
  tagline: string;
  description: string;
  category: BrandCategory;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  darkColor: string;
  lightColor: string;
  iconConcept: string;
  positioning: string;
  keywords: string[];
  dashboardLabel: string;
  publicLabel: string;
};

const legalNameWarning =
  "Umbrella Technologies is a working brand name and must be legally reviewed before final trademark use.";

export const DEFAULT_PARENT_BRAND: BrandEntity = {
  id: "brand_parent_umbrella",
  slug: "parent-company",
  displayName: "Umbrella Technologies",
  legalNameWarning,
  tagline: "Connect. Build. Grow.",
  description: "Connected systems for creators, businesses, and communities.",
  category: "parent",
  primaryColor: "#00E5FF",
  secondaryColor: "#008FA3",
  accentColor: "#FFB020",
  darkColor: "#0B0F14",
  lightColor: "#FFFFFF",
  iconConcept: "Interlocking hex/connectivity mark.",
  positioning: "Parent ecosystem brand for shared infrastructure, governance, billing, and security.",
  keywords: ["adaptive identity", "connected systems", "governance", "infrastructure"],
  dashboardLabel: "Parent Company",
  publicLabel: "Umbrella Technologies",
};

export const BRAND_ENTITIES: BrandEntity[] = [
  DEFAULT_PARENT_BRAND,
  {
    id: "brand_creator_music_technology",
    slug: "creator-music-technology",
    displayName: "Creator Music Technology",
    legalNameWarning,
    tagline: "Create. Connect. Amplify.",
    description: "Tools for artists and creators to build the world around their work.",
    category: "entity",
    primaryColor: "#D100FF",
    secondaryColor: "#8A2BFF",
    accentColor: "#00E5FF",
    darkColor: "#0B0F14",
    lightColor: "#FFFFFF",
    iconConcept: "Shared geometric shape with waveform bars.",
    positioning: "Creator and music infrastructure for projects, assets, release readiness, and creator operations.",
    keywords: ["creator tools", "music workflow", "release readiness", "asset systems"],
    dashboardLabel: "Creator / Music Technology",
    publicLabel: "Creator Music Technology",
  },
  {
    id: "brand_business_operations",
    slug: "business-operations",
    displayName: "Business Operations",
    legalNameWarning,
    tagline: "Systems. Execute. Excel.",
    description: "Cleaner daily operations for restaurants and small businesses.",
    category: "entity",
    primaryColor: "#00B48A",
    secondaryColor: "#00D1B2",
    accentColor: "#667085",
    darkColor: "#0B0F14",
    lightColor: "#FFFFFF",
    iconConcept: "Shared geometric shape with cube/workflow center.",
    positioning: "Operational systems for restaurants, teams, vendors, documents, and daily execution.",
    keywords: ["operations", "restaurants", "workflows", "small business"],
    dashboardLabel: "Business Operations",
    publicLabel: "Business Operations",
  },
  {
    id: "brand_community_public_information",
    slug: "community-public-information",
    displayName: "Umbrella Community Info",
    legalNameWarning,
    tagline: "Inform. Connect. Empower.",
    description: "Useful local information organized in one place.",
    category: "entity",
    primaryColor: "#007BFF",
    secondaryColor: "#00B4C8",
    accentColor: "#F1F3F6",
    darkColor: "#0B0F14",
    lightColor: "#FFFFFF",
    iconConcept: "Shared geometric shape with beacon/signal center.",
    positioning:
      "Public and organization-submitted information workflows with source links, review, and approval boundaries.",
    keywords: ["public information", "community", "source-linked", "notices"],
    dashboardLabel: "Community / Public Information",
    publicLabel: "Umbrella Community Info",
  },
  {
    id: "brand_launchpad",
    slug: "launchpad",
    displayName: "Launchpad by Umbrella",
    legalNameWarning,
    tagline: "Ideate. Build. Launch.",
    description: "The fastest path from idea to launch-ready infrastructure.",
    category: "standalone_product",
    primaryColor: "#FFB020",
    secondaryColor: "#00E5FF",
    accentColor: "#6B7280",
    darkColor: "#0B0F14",
    lightColor: "#FFFFFF",
    iconConcept: "Shared geometric shape with arrow/launch chevron.",
    positioning: "Standalone launch-prep infrastructure product. It does not guarantee deployment success.",
    keywords: ["launch-ready", "infrastructure", "build", "systems"],
    dashboardLabel: "Launchpad",
    publicLabel: "Launchpad by Umbrella",
  },
];

export const ENTITY_SLUGS = BRAND_ENTITIES.map((brand) => brand.slug) as BrandSlug[];

export function getBrandBySlug(slug: string | undefined): BrandEntity | undefined {
  return BRAND_ENTITIES.find((brand) => brand.slug === slug);
}

export function getEntityBrand(slug: string | undefined): BrandEntity {
  return getBrandBySlug(slug) ?? DEFAULT_PARENT_BRAND;
}

export function getBrandCssVars(slug: string | undefined) {
  const brand = getEntityBrand(slug);
  return {
    "--entity-primary": brand.primaryColor,
    "--entity-secondary": brand.secondaryColor,
    "--entity-accent": brand.accentColor,
    "--entity-dark": brand.darkColor,
    "--entity-light": brand.lightColor,
  } as CSSProperties;
}
