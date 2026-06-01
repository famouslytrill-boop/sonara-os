import { brandTokens } from "./tokens.ts";
import { getProductTheme, type ProductThemeId } from "./product-themes.ts";

export type BrandBackgroundId =
  | "platform"
  | "public"
  | "admin"
  | "business-builder"
  | "creator-studio"
  | "growth-studio";

export type BrandBackgroundToken = Readonly<{
  id: BrandBackgroundId;
  description: string;
  css: string;
}>;

export const brandBackgrounds: readonly BrandBackgroundToken[] = Object.freeze([
  Object.freeze({
    id: "platform",
    description: "Default dark-first platform background.",
    css: `linear-gradient(135deg, ${brandTokens.color.surface0} 0%, ${brandTokens.color.surface2} 52%, ${brandTokens.color.surface0} 100%)`
  }),
  Object.freeze({
    id: "public",
    description: "Public marketing background with restrained brand depth.",
    css: `radial-gradient(circle at 18% 8%, rgba(111, 140, 255, 0.18), transparent 30rem), linear-gradient(135deg, ${brandTokens.color.surface0} 0%, ${brandTokens.color.surface2} 52%, ${brandTokens.color.surface0} 100%)`
  }),
  Object.freeze({
    id: "admin",
    description: "Admin background for review and control surfaces.",
    css: `linear-gradient(135deg, ${brandTokens.color.surface0} 0%, #101624 54%, ${brandTokens.color.surface0} 100%)`
  }),
  Object.freeze({
    id: "business-builder",
    description: "Business Builder trust and operations accent.",
    css: `linear-gradient(135deg, rgba(116, 217, 176, 0.14), transparent 40%), ${brandTokens.color.panel}`
  }),
  Object.freeze({
    id: "creator-studio",
    description: "Creator Studio creative media accent.",
    css: `linear-gradient(135deg, rgba(183, 156, 255, 0.14), transparent 40%), ${brandTokens.color.panel}`
  }),
  Object.freeze({
    id: "growth-studio",
    description: "Growth Studio campaign momentum accent.",
    css: `linear-gradient(135deg, rgba(244, 199, 107, 0.14), transparent 40%), ${brandTokens.color.panel}`
  })
]);

export function getProductBackground(productId: ProductThemeId): BrandBackgroundToken {
  const theme = getProductTheme(productId);
  const background = brandBackgrounds.find((item) => item.id === theme.id);
  if (!background) {
    throw new Error(`Missing product background for ${productId}`);
  }
  return background;
}
