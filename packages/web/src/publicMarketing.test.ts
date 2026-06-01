import { describe, expect, it } from "vitest";
import {
  pricingSafetyNotes,
  pricingTiers,
  productMarketingPages,
  publicMarketingRoutes,
  publicNavigationLinks,
  setupServiceTiers,
  sonaraParentStatement,
  sonaraProductPromise,
  sonaraTagline
} from "./lib/public-marketing/index.ts";

describe("public SONARA marketing pages", () => {
  it("uses the approved parent statement, tagline, and product promise", () => {
    expect(sonaraParentStatement).toBe(
      "SONARA Industries is a technology holding company that owns independent software companies."
    );
    expect(sonaraTagline).toBe("Build. Create. Grow.");
    expect(sonaraProductPromise).toBe("Build. Prove. Get paid. Grow.");
  });

  it("defines understandable pricing and setup services", () => {
    expect(pricingTiers.map((tier) => [tier.name, tier.price])).toEqual([
      ["Free", "$0/mo"],
      ["Starter", "$9-$15/mo"],
      ["Core", "$29/mo"],
      ["Growth", "$49-$59/mo"],
      ["Pro/Business", "$79-$99/mo"],
      ["Agency/Scale", "$149-$199/mo or custom"]
    ]);
    expect(setupServiceTiers.map((tier) => [tier.name, tier.price])).toEqual([
      ["Profile Setup", "$99"],
      ["Business Launch Setup", "$299"],
      ["Premium Setup", "$499+"]
    ]);
    expect(pricingSafetyNotes.join(" ")).toMatch(/No hidden fees/i);
    expect(pricingSafetyNotes.join(" ")).toMatch(
      /does not provide legal, tax, or financial advice/i
    );
  });

  it("keeps public CTAs on known public marketing routes", () => {
    for (const page of productMarketingPages) {
      for (const cta of page.ctas) {
        expect(publicMarketingRoutes).toContain(cta.href);
      }
    }
    expect(publicNavigationLinks.map((link) => link.route)).toEqual(publicMarketingRoutes);
  });

  it("keeps customer-facing copy away from internal or inflated claims", () => {
    const copy = [
      sonaraParentStatement,
      sonaraTagline,
      sonaraProductPromise,
      ...pricingSafetyNotes,
      ...pricingTiers.flatMap((tier) => [tier.name, tier.price, tier.description, tier.fit]),
      ...setupServiceTiers.flatMap((tier) => [tier.name, tier.price, tier.description]),
      ...productMarketingPages.flatMap((page) => [
        page.title,
        page.eyebrow,
        page.promise,
        page.description,
        ...page.features
      ])
    ].join(" ");

    expect(copy).not.toMatch(
      /guaranteed revenue|fully automated|autonomous infrastructure|multi-agent|formula reconstruction|enterprise-grade security/i
    );
  });
});
