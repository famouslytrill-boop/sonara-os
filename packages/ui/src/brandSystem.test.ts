import { describe, expect, it } from "vitest";
import {
  appIconSet,
  brandCssVariables,
  brandIdentity,
  brandLogos,
  brandProductThemes,
  getLogoAsset,
  getProductThemeByRoute,
  manifestIconSet,
  openGraphImages
} from "./index.ts";

describe("brand system", () => {
  it("centralizes SONARA identity", () => {
    expect(brandIdentity.parentName).toBe("SONARA Industries");
    expect(brandIdentity.platformName).toBe("SONARA Industries");
    expect(brandIdentity.platformDisplayName).toBe("SONARA Industries\u2122");
    expect(brandIdentity.tagline).toBe("Build. Create. Grow.");
    expect(Object.values(brandIdentity.products)).toEqual([
      "Business Builder",
      "Creator Studio",
      "Growth Studio"
    ]);
  });

  it("defines controlled logo and metadata assets", () => {
    expect(getLogoAsset("parent-logo").src).toBe("/brand/sonara-industries-logo.svg");
    expect(appIconSet.favicon.src).toBe("/favicon.svg");
    expect(openGraphImages.platform.src).toBe("/brand/sonara-one-og.svg");
    expect(manifestIconSet.map((icon) => icon.src)).toEqual([
      "/brand/sonara-one-app-icon.svg",
      "/favicon.svg"
    ]);
    expect(brandLogos.every((asset) => asset.src.startsWith("/"))).toBe(true);
  });

  it("keeps product accents restrained and route-aware", () => {
    expect(brandProductThemes.map((theme) => theme.publicName)).toEqual([
      "Business Builder",
      "Creator Studio",
      "Growth Studio"
    ]);
    expect(getProductThemeByRoute("/business-builder").identityWords).toContain("trust");
    expect(getProductThemeByRoute("/creator-studio").identityWords).toContain("media");
    expect(getProductThemeByRoute("/growth-studio").identityWords).toContain("campaigns");
  });

  it("exports CSS variable names used by the web shell", () => {
    expect(brandCssVariables["--sonara-surface-0"]).toBe("#070912");
    expect(brandCssVariables["--sonara-business-accent"]).toBeTruthy();
    expect(brandCssVariables["--sonara-creator-accent"]).toBeTruthy();
    expect(brandCssVariables["--sonara-growth-accent"]).toBeTruthy();
  });
});
