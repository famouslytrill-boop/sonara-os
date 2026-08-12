"use strict";

// Which products have paid access the server actually enforces.
//
// This existed as a map inside createBilling(), where the catalog could not
// reach it. The catalog therefore answered the question "has paid access been
// verified for this product?" with:
//
//     const entitlementIntegrationVerified = planFloor === "free";
//
// which defines "verified" as "free". Every paid product was therefore
// permanently execution-restricted -- not pending a check somebody could run,
// but false by construction. Production showed it in every deploy:
// executionEnabled 3, executionRestricted 31, the three being the free ones.
//
// A customer could pay and find that all thirty-one paid products stayed shut,
// while the catalog described the state as "paid execution remains restricted
// until positive production entitlement verification" -- which reads like
// pending work rather than a definition that cannot come true.
//
// The map lives here so the billing code and the catalog answer from the same
// list. Adding a product key to it is a statement that the server checks a real
// entitlement before letting anybody run that product's paid work.
//
// This says nothing about whether a particular customer holds the plan. That is
// a per-request question, answered by getCustomerPaidEntitlement against the
// signed-in session; a static catalog cannot know it and should not pretend to.

// scripts/verify-production-product-catalog.mjs greps the deployed runtime for
// these three lines verbatim, to prove the entitlement mapping actually shipped
// rather than being asserted about in a test. Keep them written exactly as they
// are -- wrapping the arrays in Object.freeze broke the match and the gate said
// so, which is the check doing its job.
const PAID_ENTITLEMENT_KEYS = Object.freeze({
  business_builder: ["starter_monthly", "core_monthly", "pro_monthly", "business_builder_one_time"],
  creator_studio: ["core_monthly", "pro_monthly"],
  growth_studio: ["pro_monthly"]
});

function getPaidEntitlementKeys(productKey) {
  return PAID_ENTITLEMENT_KEYS[productKey] || [];
}

// True when paying for this product buys something the server will actually
// let the customer run. False for a product with no entitlement mapping --
// sonara_industries has none, so its paid entries stay restricted, which is the
// honest answer rather than a convenient one.
function hasEnforcedPaidAccess(productKey) {
  return getPaidEntitlementKeys(productKey).length > 0;
}

// The plan slug a catalog plan floor sends a customer to buy. Written here
// because the question below needs it and there is nowhere else both halves
// are in scope.
const PLAN_FLOOR_ENTITLEMENT_KEY = Object.freeze({
  starter: "starter_monthly",
  core: "core_monthly",
  pro: "pro_monthly"
});

// Whether the plan a product advertises is a plan that opens it.
//
// hasEnforcedPaidAccess above asks whether the product's family enforces any
// entitlement at all, and the catalog used that as its answer to "is paid
// access verified for this product?". Those are not the same question, and
// seven of fourteen paid products fell in the gap: Creator Studio enforces
// core_monthly and pro_monthly while three of its products advertised Starter,
// and Growth Studio enforces pro_monthly alone while four of its products
// advertised Starter or Core.
//
// The consequence was not a mislabelled card. getCustomerPaidEntitlement
// matches the subscriber's plan_slug against exactly this list, so a customer
// who bought the advertised plan, clicked the product, and got a 402
// upgrade_required was the expected behaviour of both halves working correctly
// and disagreeing about the price.
//
// This is the successor to `planFloor === "free"`. That one defined verified as
// free; this one defined it as somebody, somewhere in this product family, being
// able to get in. Both are true statements about something other than what the
// customer is being sold.
function planFloorOpensProduct(productKey, planFloor) {
  if (planFloor === "free") return true;
  const required = PLAN_FLOOR_ENTITLEMENT_KEY[planFloor];
  if (!required) return false;
  return getPaidEntitlementKeys(productKey).includes(required);
}

// The plan floors a product could honestly advertise, cheapest first. Used to
// report the gap rather than to guess at a price: which plan a product is sold
// on is the owner's decision, and the only thing derivable here is which ones
// the server would honour.
const PLAN_FLOOR_ORDER = Object.freeze(["starter", "core", "pro"]);
function honestPlanFloors(productKey) {
  return PLAN_FLOOR_ORDER.filter((floor) => planFloorOpensProduct(productKey, floor));
}

module.exports = {
  PAID_ENTITLEMENT_KEYS,
  PLAN_FLOOR_ENTITLEMENT_KEY,
  PLAN_FLOOR_ORDER,
  getPaidEntitlementKeys,
  hasEnforcedPaidAccess,
  planFloorOpensProduct,
  honestPlanFloors
};
