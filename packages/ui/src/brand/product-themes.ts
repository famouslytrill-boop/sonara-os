import { brandIdentity, brandTokens } from "./tokens.ts";
import { getLogoAsset, type BrandLogoId } from "./logos.ts";

export type ProductThemeId = "business-builder" | "creator-studio" | "growth-studio";

export type ProductTheme = Readonly<{
  id: ProductThemeId;
  publicName: string;
  route: "/business-builder" | "/creator-studio" | "/growth-studio";
  themeClassName: string;
  accent: string;
  accentSoft: string;
  identityWords: readonly string[];
  logoId: BrandLogoId;
  logoSrc: string;
}>;

export const brandProductThemes: readonly ProductTheme[] = Object.freeze([
  Object.freeze({
    id: "business-builder",
    publicName: brandIdentity.products.businessBuilder,
    route: "/business-builder",
    themeClassName: "product-theme--business-builder",
    accent: brandTokens.productAccent.businessBuilder,
    accentSoft: "rgba(116, 217, 176, 0.14)",
    identityWords: Object.freeze(["trust", "operations", "business"]),
    logoId: "business-builder-logo",
    logoSrc: getLogoAsset("business-builder-logo").src
  }),
  Object.freeze({
    id: "creator-studio",
    publicName: brandIdentity.products.creatorStudio,
    route: "/creator-studio",
    themeClassName: "product-theme--creator-studio",
    accent: brandTokens.productAccent.creatorStudio,
    accentSoft: "rgba(183, 156, 255, 0.14)",
    identityWords: Object.freeze(["creative", "media", "assets"]),
    logoId: "creator-studio-logo",
    logoSrc: getLogoAsset("creator-studio-logo").src
  }),
  Object.freeze({
    id: "growth-studio",
    publicName: brandIdentity.products.growthStudio,
    route: "/growth-studio",
    themeClassName: "product-theme--growth-studio",
    accent: brandTokens.productAccent.growthStudio,
    accentSoft: "rgba(244, 199, 107, 0.14)",
    identityWords: Object.freeze(["campaigns", "revenue", "momentum"]),
    logoId: "growth-studio-logo",
    logoSrc: getLogoAsset("growth-studio-logo").src
  })
]);

export const productThemeByRoute = Object.freeze(
  Object.fromEntries(brandProductThemes.map((theme) => [theme.route, theme])) as Record<
    ProductTheme["route"],
    ProductTheme
  >
);

export function getProductTheme(id: ProductThemeId): ProductTheme {
  const theme = brandProductThemes.find((productTheme) => productTheme.id === id);
  if (!theme) {
    throw new Error(`Unknown product theme: ${id}`);
  }
  return theme;
}

export function getProductThemeByRoute(route: ProductTheme["route"]): ProductTheme {
  return productThemeByRoute[route];
}
