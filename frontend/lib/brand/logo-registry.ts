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
    markPath: "/brand/logos/parent-mark.svg",
    iconPath: "/brand/icons/parent-icon.svg",
    concept: "Interlocking hex/connectivity mark",
  },
  "creator-music-technology": {
    slug: "creator-music-technology",
    markPath: "/brand/logos/creator-mark.svg",
    iconPath: "/brand/icons/creator-icon.svg",
    concept: "Waveform bars inside shared geometry",
  },
  "business-operations": {
    slug: "business-operations",
    markPath: "/brand/logos/business-mark.svg",
    iconPath: "/brand/icons/business-icon.svg",
    concept: "Cube/workflow center inside shared geometry",
  },
  "community-public-information": {
    slug: "community-public-information",
    markPath: "/brand/logos/community-mark.svg",
    iconPath: "/brand/icons/community-icon.svg",
    concept: "Beacon/signal center inside shared geometry",
  },
  launchpad: {
    slug: "launchpad",
    markPath: "/brand/logos/launchpad-mark.svg",
    iconPath: "/brand/icons/launchpad-icon.svg",
    concept: "Launch chevron inside shared geometry",
  },
};

export const LOGO_ASSETS = Object.values(LOGO_REGISTRY);

export function getLogoAsset(slug: string | undefined) {
  return LOGO_REGISTRY[slug as BrandSlug] ?? LOGO_REGISTRY["parent-company"];
}
