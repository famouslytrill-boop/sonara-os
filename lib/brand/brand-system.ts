import type { CSSProperties } from "react";

export type BrandSlug = "parent-company" | "business-builder" | "creator-studio" | "growth-studio";

export type BrandCategory = "parent" | "company_product";

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
  "SONARA Industries and product marks must be legally reviewed before final trademark use.";

export const DEFAULT_PARENT_BRAND: BrandEntity = {
  id: "brand_parent_sonara",
  slug: "parent-company",
  displayName: "SONARA Industries",
  legalNameWarning,
  tagline: "Build. Create. Grow.",
  description: "Technology infrastructure for Business Builder, Creator Studio, and Growth Studio.",
  category: "parent",
  primaryColor: "#2DD4BF",
  secondaryColor: "#4F46E5",
  accentColor: "#FFB454",
  darkColor: "#08111F",
  lightColor: "#FFFFFF",
  iconConcept: "Shared infrastructure mark for the SONARA One platform.",
  positioning: "Parent company for shared trust, billing, launch, access, and data infrastructure.",
  keywords: ["business software", "creator software", "growth software", "shared infrastructure"],
  dashboardLabel: "SONARA One",
  publicLabel: "SONARA Industries",
};

export const BRAND_ENTITIES: BrandEntity[] = [
  DEFAULT_PARENT_BRAND,
  {
    id: "brand_business_builder",
    slug: "business-builder",
    displayName: "Business Builder",
    legalNameWarning,
    tagline: "Build. Prove. Get paid. Run clean.",
    description:
      "Create, launch, run, and manage a business with guided systems, payments, bookings, records, and operational intelligence.",
    category: "company_product",
    primaryColor: "#2DD4BF",
    secondaryColor: "#0F766E",
    accentColor: "#A7F3D0",
    darkColor: "#071B18",
    lightColor: "#FFFFFF",
    iconConcept: "Structured operations mark with proof and payment paths.",
    positioning: "Guided operating system for service businesses, local teams, and solo operators.",
    keywords: ["business setup", "customers", "bookings", "payments", "records"],
    dashboardLabel: "Business Builder",
    publicLabel: "Business Builder",
  },
  {
    id: "brand_creator_studio",
    slug: "creator-studio",
    displayName: "Creator Studio",
    legalNameWarning,
    tagline: "Organize, protect, publish, and monetize.",
    description:
      "Organize, protect, publish, monetize, and grow creative work, digital products, media, and creator operations.",
    category: "company_product",
    primaryColor: "#818CF8",
    secondaryColor: "#4F46E5",
    accentColor: "#C4B5FD",
    darkColor: "#121326",
    lightColor: "#FFFFFF",
    iconConcept: "Creative asset vault mark with rights and release paths.",
    positioning: "Creator workspace for assets, releases, offers, proof, and monetization readiness.",
    keywords: ["creator", "asset vault", "publishing", "digital products", "rights"],
    dashboardLabel: "Creator Studio",
    publicLabel: "Creator Studio",
  },
  {
    id: "brand_growth_studio",
    slug: "growth-studio",
    displayName: "Growth Studio",
    legalNameWarning,
    tagline: "Turn attention into follow-up and revenue.",
    description:
      "Attract customers, leads, fans, referrals, reviews, and revenue through campaigns, follow-up, offers, and growth systems.",
    category: "company_product",
    primaryColor: "#38BDF8",
    secondaryColor: "#0369A1",
    accentColor: "#FDE68A",
    darkColor: "#081827",
    lightColor: "#FFFFFF",
    iconConcept: "Momentum and signal mark for campaigns, reviews, and follow-up.",
    positioning: "Growth system for offers, referrals, reviews, campaigns, and customer follow-up.",
    keywords: ["growth", "campaigns", "reviews", "referrals", "offers"],
    dashboardLabel: "Growth Studio",
    publicLabel: "Growth Studio",
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
