import type { BrandSlug } from "./brand-system";

export type LogoAsset = {
  slug: BrandSlug;
  markPath: string;
  iconPath: string;
  concept: string;
};

export const LOGO_REGISTRY: Record<BrandSlug, LogoAsset> = {
  "parent-company": {
    slug: "parent-company",
    markPath: "/brand/sonara-logo.svg",
    iconPath: "/brand/sonara-mark.svg",
    concept: "Shared SONARA infrastructure mark",
  },
  "business-builder": {
    slug: "business-builder",
    markPath: "/brand/business-builder-icon.svg",
    iconPath: "/brand/business-builder-icon.svg",
    concept: "Operations, proof, payment, and records mark",
  },
  "creator-studio": {
    slug: "creator-studio",
    markPath: "/brand/creator-studio-icon.svg",
    iconPath: "/brand/creator-studio-icon.svg",
    concept: "Creative asset, release, and rights mark",
  },
  "growth-studio": {
    slug: "growth-studio",
    markPath: "/brand/growth-studio-icon.svg",
    iconPath: "/brand/growth-studio-icon.svg",
    concept: "Campaign, review, referral, and follow-up mark",
  },
};

export const LOGO_ASSETS = Object.values(LOGO_REGISTRY);

export function getLogoAsset(slug: string | undefined) {
  return LOGO_REGISTRY[slug as BrandSlug] ?? LOGO_REGISTRY["parent-company"];
}
