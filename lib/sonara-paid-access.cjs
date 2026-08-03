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

module.exports = { PAID_ENTITLEMENT_KEYS, getPaidEntitlementKeys, hasEnforcedPaidAccess };
