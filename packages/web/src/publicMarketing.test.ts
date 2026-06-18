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
import {
  publicPricingCatalog,
  validateCatalogPriceValues
} from "./lib/product-catalog/product-catalog.ts";

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
      ["Free", "$0"],
      ["SONARA One Starter", "$9/mo"],
      ["SONARA One Core", "$29/mo"],
      ["Creator Studio", "$29/mo"],
      ["SONARA One Growth", "$59/mo"],
      ["SONARA One Pro", "$99/mo"],
      ["SONARA One Agency/Scale", "$199/mo or custom"]
    ]);
    expect(setupServiceTiers.map((tier) => [tier.name, tier.price])).toEqual([
      ["Profile Setup", "$99 one-time"],
      ["Business Launch Setup", "$299 one-time"],
      ["Premium Setup", "$499 one-time"],
      ["Complete Launch Setup", "$999 one-time"]
    ]);
    expect(pricingSafetyNotes.join(" ")).toMatch(/No hidden fees/i);
    expect(pricingSafetyNotes.join(" ")).toMatch(
      /does not provide legal, tax, or financial advice/i
    );
  });

  it("maps public pricing cards to safe Stripe plan identifiers", () => {
    expect(
      publicPricingCatalog.map((item) => [item.id, item.name, item.stripeEnvVar ?? "included"])
    ).toEqual([
      ["included-plan", "Free", "included"],
      ["sonara-one-starter", "SONARA One Starter", "STRIPE_PRICE_STARTER"],
      ["sonara-one-core", "SONARA One Core", "STRIPE_PRICE_CORE"],
      ["creator-studio-monthly", "Creator Studio", "STRIPE_PRICE_CREATOR"],
      ["sonara-one-growth", "SONARA One Growth", "STRIPE_PRICE_GROWTH"],
      ["sonara-one-pro", "SONARA One Pro", "STRIPE_PRICE_PRO"],
      ["sonara-one-agency-scale", "SONARA One Agency/Scale", "STRIPE_PRICE_AGENCY_SCALE"],
      ["profile-setup", "Profile Setup", "STRIPE_PRICE_SETUP_99"],
      ["business-launch-setup", "Business Launch Setup", "STRIPE_PRICE_SETUP_299"],
      ["premium-setup", "Premium Setup", "STRIPE_PRICE_SETUP_499"],
      ["complete-launch-setup", "Complete Launch Setup", "STRIPE_PRICE_SETUP_999"]
    ]);

    expect(
      validateCatalogPriceValues({
        STRIPE_PRICE_SONARA_ONE_STARTER_MONTHLY: "price_alias_starter",
        STRIPE_PRICE_CORE: "$29/mo"
      })
    ).toMatchObject({
      STRIPE_PRICE_STARTER: { valid: true },
      STRIPE_PRICE_CORE: { valid: false, label: "Invalid price ID" }
    });
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
