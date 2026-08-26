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
//
// Widened 13 August 2026, on the owner's decision, after seven of fourteen paid
// products turned out to advertise a plan this map refuses. Creator Studio
// moves down to Starter and Growth Studio down to Core. What that ladder now
// buys:
//
//   Starter  Business Builder + Creator Studio
//   Core     + Growth Studio
//   Pro      no exclusive workspace of its own yet
//
// Pro having nothing exclusive is a real consequence and is stated rather than
// left to be discovered: with three workspaces and three paid tiers, a
// cumulative ladder has exactly three rungs, and moving two workspaces down
// spends two of them. The tier is where the staff and scheduling features go --
// they exist, they are given away today, and docs/2026-08-12-WHAT-ELSE-CAN-WE-SELL.md
// has the comparison. Until that happens Pro is priced above what it uniquely
// opens.
// The breadth plans are added to every family, and the depth plans stay exactly
// where they were. Nobody already paying loses access, and the three retired
// keys remain valid entitlements for as long as somebody holds one.
//
// workspace_monthly appears in all three and is *not* three workspaces for $19.
// It buys one, chosen by the customer and recorded on their subscription, and
// choosesOneWorkspace below is what makes that true. Listing it here is what
// lets the gate reach the check; leaving it out would have made the $19 plan
// buy nothing at all, which is the failure this whole restructure exists to
// remove.
const PAID_ENTITLEMENT_KEYS = Object.freeze({
  business_builder: ["starter_monthly", "core_monthly", "pro_monthly", "business_builder_one_time", "workspace_monthly", "all_three_monthly", "team_monthly"],
  creator_studio: ["starter_monthly", "core_monthly", "pro_monthly", "workspace_monthly", "all_three_monthly", "team_monthly"],
  growth_studio: ["core_monthly", "pro_monthly", "workspace_monthly", "all_three_monthly", "team_monthly"]
});

// The plans that buy one workspace rather than all of them.
//
// A customer on this plan has paid for exactly one of the three, so matching
// the key alone would hand them all three for the price of one. Which one they
// chose lives on the subscription or entitlement row, and the answer when it is
// absent is no -- a customer whose choice was never recorded gets a message
// telling them to pick, not silent access to everything.
const SINGLE_WORKSPACE_PLANS = Object.freeze(["workspace_monthly"]);

function choosesOneWorkspace(entitlementKey) {
  return SINGLE_WORKSPACE_PLANS.includes(String(entitlementKey || ""));
}

// Whether a matched billing row actually opens this product.
//
// `row` is the billing_entitlements or billing_subscriptions row that matched.
// For every plan except the single-workspace one the answer is yes: matching
// the key is the whole test. For that one it is yes only if the workspace
// recorded on the row is this product.
function billingRowOpensProduct(row, productKey) {
  const key = row?.entitlement_key || row?.plan_slug || "";
  if (!choosesOneWorkspace(key)) return { ok: true };
  const chosen = String(row?.metadata?.workspace || row?.metadata?.workspace_key || "");
  if (!chosen) {
    return {
      ok: false,
      code: "workspace_not_chosen",
      message: "Your plan includes one workspace and no choice is recorded against it yet. Choose which one and it will open."
    };
  }
  if (chosen !== productKey) {
    return {
      ok: false,
      code: "different_workspace_chosen",
      message: "Your plan includes one workspace, and this is not the one it is set to."
    };
  }
  return { ok: true };
}

// Features that are sold, but are not one of the three workspaces.
//
// Kept apart from PAID_ENTITLEMENT_KEYS above because that map's keys are
// product keys: tests/catalog-routes-go-somewhere-real.test.js iterates them as
// products, and lib/sonara-product-catalog reads them the same way. A feature
// listed there would be treated as a fourth workspace by everything that walks
// the map.
//
// The staff portal is the one entry, and it exists because the Team plan is
// otherwise hollow. docs/pricing/2026-08-11-PRICING-RESTRUCTURE.md is explicit
// about what it is selling: "The staff portal, per-person schedules, time
// entries and assigned tasks already exist and **are given away**." Charging
// $79 for something every free account already has is not a plan, it is a
// sentence on a pricing page.
const FEATURE_ENTITLEMENT_KEYS = Object.freeze({
  staff_portal: ["team_monthly"]
});

function getPaidEntitlementKeys(productKey) {
  return PAID_ENTITLEMENT_KEYS[productKey] || FEATURE_ENTITLEMENT_KEYS[productKey] || [];
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


// The strings the production deploy gate requires to be present in the shipped
// runtime, as proof the fail-closed paid-access path actually deployed rather
// than merely being asserted about in a test.
//
// They lived as literals inside scripts/verify-production-product-catalog.mjs,
// and tests/product-catalog-production-boundary.test.js resolved them by
// parsing that file's source with a regex over quoted strings. Two copies and a
// parser between them: widening PAID_ENTITLEMENT_KEYS meant the gate's three
// entitlement lines had to be rewritten by hand, and generating them instead
// broke the parser, which reported the check had "gone blind" -- correctly, and
// for a reason that was not a defect.
//
// One list, imported by both. The entitlement lines are derived from the map
// above so they cannot disagree with it; the rest are literals because they are
// literals in the runtime too.
const PAID_ACCESS_RUNTIME_MARKERS = Object.freeze([
  "/rest/v1/billing_entitlements?select=entitlement_key,status",
  "/rest/v1/billing_subscriptions?select=plan_slug,status",
  "status=in.(active,trialing)",
  ...Object.entries(PAID_ENTITLEMENT_KEYS).map(
    ([productKey, keys]) => `${productKey}: [${keys.map((key) => `"${key}"`).join(", ")}]`
  ),
  "Paid access is locked until payment updates show an active or trialing plan"
]);

module.exports = {
  PAID_ENTITLEMENT_KEYS,
  FEATURE_ENTITLEMENT_KEYS,
  SINGLE_WORKSPACE_PLANS,
  choosesOneWorkspace,
  billingRowOpensProduct,
  PAID_ACCESS_RUNTIME_MARKERS,
  PLAN_FLOOR_ENTITLEMENT_KEY,
  PLAN_FLOOR_ORDER,
  getPaidEntitlementKeys,
  hasEnforcedPaidAccess,
  planFloorOpensProduct,
  honestPlanFloors
};
