"use strict";

// A catalog row names a product, a plan, and a route. Nothing checked the third
// against the first two, and three rows were wrong at once.
//
//   * "Records, Renewals & Exports" pointed at /business-builder/launch-readiness
//   * "Selling Your Work" pointed at /creator-studio/launch-readiness
//   * "Customer & Enquiry Tracker" and "Bookings, Staff & Day-to-Day" both
//     pointed at /business-builder/dashboard
//
// The first two are the same route, registered by server.js as the generic
// `/:product/launch-readiness`: one shared service setup checklist, per
// product, showing which providers are configured. It is not signed-in gated.
// So two paid products sent a paying customer to a public page about
// deployment status.
//
// Each was found by reading a row and then opening the page it named, which is
// a thing nobody does routinely and which no test did at all. These are the
// rules that fall out of the three failures.

const assert = require("node:assert/strict");
const { RECOMMENDED_PRODUCT_CATALOG } = require("../lib/sonara-recommended-product-catalog.cjs");
const { PLAN_FLOOR_ENTITLEMENT_KEY, getPaidEntitlementKeys, honestPlanFloors } = require("../lib/sonara-paid-access.cjs");

// Products advertising a plan the server will not accept for them.
//
// This is a work queue, not an exemption. Each one is currently reported as
// closed on /service-catalog, which is honest -- a customer is not invited to
// buy a plan that would bounce -- but closed is not where any of them should
// stay. Two ways out, and which one is right is a pricing decision rather than
// an engineering one: raise the plan floor to what the family already accepts,
// or add the cheaper plan to PAID_ENTITLEMENT_KEYS and sell the product at it.
//
// Emptying this list is the goal. Adding to it needs a reason as specific as
// these.
const PLAN_FLOOR_AWAITING_A_DECISION = {
  "brand-asset-system": "Starter; creator_studio accepts Core and Pro. Basic enough to be a Starter entry, so this is probably an entitlement change rather than a price rise.",
  "content-project-repurposing": "Starter; creator_studio accepts Core and Pro. Same call as brand-asset-system -- these two are the cheap way into Creator Studio or there is no cheap way in.",
  "creator-commerce-digital-products": "Starter; creator_studio accepts Core and Pro. Selling is where the money is, so Core is defensible here even if the other two open at Starter.",
  "customer-timeline-consent-center": "Core; growth_studio accepts Pro only. Consent and suppression are a safety feature, and pricing one at $39 is the version of this decision with a customer-harm side.",
  "lead-capture-segments-crm": "Starter; growth_studio accepts Pro only.",
  "campaign-journey-builder": "Core; growth_studio accepts Pro only.",
  "landing-conversion-tracking": "Starter; growth_studio accepts Pro only. Growth Studio has no entry below $39 today, which is the whole of this row and the three above it."
};

// The generic per-product pages. Each is registered once for every product and
// renders the same thing regardless of which one you came from, so none of
// them can be the destination of a specific product.
const SHARED_PRODUCT_PAGES = ["launch-readiness", "start", "tutorial", "help", "checklist"];

describe("every catalog route goes somewhere that is that product", () => {
  it("is measuring a catalog that exists", () => {
    assert.ok(RECOMMENDED_PRODUCT_CATALOG.length >= 20, "the catalog is empty; every check below would pass");
  });

  it("sends no product to a page shared by all of them", () => {
    const generic = RECOMMENDED_PRODUCT_CATALOG.filter((item) => {
      const tail = String(item.route).split("/").filter(Boolean).pop();
      return SHARED_PRODUCT_PAGES.includes(tail);
    });
    assert.deepEqual(
      generic.map((item) => `${item.name} -> ${item.route}`),
      [],
      "these products point at a page every product shares, so it cannot be about this one"
    );
  });

  it("gives each product its own destination", () => {
    const byRoute = new Map();
    for (const item of RECOMMENDED_PRODUCT_CATALOG) {
      if (!byRoute.has(item.route)) byRoute.set(item.route, []);
      byRoute.get(item.route).push(item.name);
    }
    const shared = [...byRoute.entries()]
      .filter(([, names]) => names.length > 1)
      .map(([route, names]) => `${route} <- ${names.join(" | ")}`);
    assert.deepEqual(
      shared,
      [],
      "two products sell the same destination, so a customer cannot tell which half they paid for"
    );
  });

  // Asked of the booted application rather than of lib/sonara-route-registry.cjs.
  // The registry is a hand-maintained list and is not complete -- /readiness is
  // a live public page, linked from three screens, with a plain-language title,
  // and it appears in none of the registry's route arrays. A check that reads
  // the registry would have called this catalog row broken and the page is fine.
  it("names a route that resolves, rather than a 404", async function openEveryRoute() {
    this.timeout(60000);
    const request = require("supertest");
    const app = require("../server");
    const dead = [];
    for (const item of RECOMMENDED_PRODUCT_CATALOG) {
      const response = await request(app).get(item.route).set("accept", "text/html");
      // A redirect to login is a real page behind a gate, which is the correct
      // answer for a paid product. 404 and 500 are not.
      if (response.status >= 400) dead.push(`${item.name} -> ${item.route} (HTTP ${response.status})`);
    }
    assert.deepEqual(dead, [], "these products point at a route that does not answer");
  });

  // The one that cost the most, because it does not look like a routing bug.
  //
  // getCustomerPaidEntitlement matches the subscriber's plan_slug against
  // getPaidEntitlementKeys(productKey). A product advertising a plan floor
  // outside that list is one where buying the advertised plan and clicking the
  // product returns 402 upgrade_required -- both halves working exactly as
  // written and disagreeing about the price.
  const mismatched = RECOMMENDED_PRODUCT_CATALOG
    .filter((item) => item.planFloor !== "free")
    .filter((item) => !getPaidEntitlementKeys(item.productKey).includes(PLAN_FLOOR_ENTITLEMENT_KEY[item.planFloor]));

  it("never sells a product on a plan the server will refuse", () => {
    // The rule that has to hold whatever the pricing decision turns out to be:
    // a product a customer is invited to buy must open on the plan it names.
    // A mispriced product may exist while somebody decides what to do with it,
    // but it may not be advertised as open.
    const sold = mismatched.filter((item) => item.executionEnabled === true);
    assert.deepEqual(
      sold.map((item) => `${item.name} is sold open on ${item.planFloor}; ${item.productKey} opens on ${honestPlanFloors(item.productKey).join(" or ") || "nothing"}`),
      [],
      "buying the advertised plan and clicking these would return 402 upgrade_required"
    );
  });

  it("accounts for every mispriced product with a stated decision", () => {
    const unexplained = mismatched
      .filter((item) => !PLAN_FLOOR_AWAITING_A_DECISION[item.serviceKey])
      .map((item) => `${item.serviceKey} (${item.name}) is sold on ${item.planFloor}; ${item.productKey} opens on ${honestPlanFloors(item.productKey).join(" or ") || "nothing"}`);
    assert.deepEqual(
      unexplained,
      [],
      "these products advertise a plan that will not open them and nobody has written down what to do about it:\n  " + unexplained.join("\n  ") +
        "\n\nEither raise the plan floor in lib/catalog/*.cjs, or add the plan to PAID_ENTITLEMENT_KEYS in lib/sonara-paid-access.cjs -- " +
        "the second is a decision about what a plan buys, so it is the owner's."
    );
  });

  it("keeps no entry for a product that has since been priced honestly", () => {
    // The other drift: a price gets fixed and the note stays, so the queue
    // overstates how much is open. Same reason tests/form-reachability.test.js
    // checks its own exception list both ways.
    const keys = new Set(mismatched.map((item) => item.serviceKey));
    const stale = Object.keys(PLAN_FLOOR_AWAITING_A_DECISION).filter((key) => !keys.has(key));
    assert.deepEqual(stale, [], `these are listed as mispriced and are not any more: ${stale.join(", ")}`);
  });

  // And the rule refuses one, so the list above being empty means something.
  it("would refuse a product priced below what its family enforces", () => {
    const { planFloorOpensProduct } = require("../lib/sonara-paid-access.cjs");
    assert.equal(planFloorOpensProduct("growth_studio", "starter"), false, "growth_studio enforces pro_monthly alone");
    assert.equal(planFloorOpensProduct("growth_studio", "pro"), true);
    assert.equal(planFloorOpensProduct("creator_studio", "starter"), false, "creator_studio enforces core_monthly and above");
    assert.equal(planFloorOpensProduct("creator_studio", "core"), true);
    assert.equal(planFloorOpensProduct("business_builder", "starter"), true);
    assert.equal(planFloorOpensProduct("sonara_industries", "core"), false, "sonara_industries enforces nothing");
    assert.equal(planFloorOpensProduct("sonara_industries", "free"), true);
  });
});
