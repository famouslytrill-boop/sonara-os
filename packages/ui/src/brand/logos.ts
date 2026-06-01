export type BrandLogoId =
  | "parent-logo"
  | "app-icon"
  | "favicon"
  | "open-graph"
  | "business-builder-logo"
  | "creator-studio-logo"
  | "growth-studio-logo";

export type BrandLogoAsset = Readonly<{
  id: BrandLogoId;
  label: string;
  src: string;
  width: number;
  height: number;
  usage: "parent" | "platform" | "product" | "metadata";
}>;

export const brandLogos: readonly BrandLogoAsset[] = Object.freeze([
  Object.freeze({
    id: "parent-logo",
    label: "SONARA Industries logo",
    src: "/brand/sonara-industries-logo.svg",
    width: 320,
    height: 80,
    usage: "parent"
  }),
  Object.freeze({
    id: "app-icon",
    label: "SONARA One app icon",
    src: "/brand/sonara-one-app-icon.svg",
    width: 512,
    height: 512,
    usage: "platform"
  }),
  Object.freeze({
    id: "favicon",
    label: "SONARA One favicon",
    src: "/favicon.svg",
    width: 64,
    height: 64,
    usage: "metadata"
  }),
  Object.freeze({
    id: "open-graph",
    label: "SONARA One Open Graph preview",
    src: "/brand/sonara-one-og.svg",
    width: 1200,
    height: 630,
    usage: "metadata"
  }),
  Object.freeze({
    id: "business-builder-logo",
    label: "Business Builder logo placeholder",
    src: "/brand/business-builder-logo.svg",
    width: 320,
    height: 80,
    usage: "product"
  }),
  Object.freeze({
    id: "creator-studio-logo",
    label: "Creator Studio logo placeholder",
    src: "/brand/creator-studio-logo.svg",
    width: 320,
    height: 80,
    usage: "product"
  }),
  Object.freeze({
    id: "growth-studio-logo",
    label: "Growth Studio logo placeholder",
    src: "/brand/growth-studio-logo.svg",
    width: 320,
    height: 80,
    usage: "product"
  })
]);

export const appIconSet = Object.freeze({
  favicon: getLogoAsset("favicon"),
  appIcon: getLogoAsset("app-icon")
});

export const manifestIconSet = Object.freeze([getLogoAsset("app-icon"), getLogoAsset("favicon")]);

export const openGraphImages = Object.freeze({
  platform: getLogoAsset("open-graph")
});

export function getLogoAsset(id: BrandLogoId): BrandLogoAsset {
  const asset = brandLogos.find((logo) => logo.id === id);
  if (!asset) {
    throw new Error(`Unknown logo asset: ${id}`);
  }
  return asset;
}
