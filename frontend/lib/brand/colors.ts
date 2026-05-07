import { BRAND_ENTITIES } from "./brand-system";

export const BRAND_COLORS = Object.fromEntries(
  BRAND_ENTITIES.map((brand) => [
    brand.slug,
    {
      primary: brand.primaryColor,
      secondary: brand.secondaryColor,
      accent: brand.accentColor,
      dark: brand.darkColor,
      light: brand.lightColor,
    },
  ]),
);
