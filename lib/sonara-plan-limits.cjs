"use strict";

// How much of a thing each plan includes.
//
// The first of these is locations, and it exists because the product charged
// per account no matter how many sites a business ran, while every comparable
// in docs/2026-08-12-WHAT-ELSE-CAN-WE-SELL.md prices per location -- Homebase
// at $24.95 and MarginEdge at $350. business_locations, location_transfers and
// the transfer lines were all built and none of them cost anything.
//
// The owner's decision on 13 August 2026 was a limit per plan rather than a
// per-location add-on. That matters for what this file can be: an add-on needs
// a Stripe price object, and nothing here can create one. A limit needs only
// the count and the plan, both of which are already available on the request.
//
// null means no limit. It is not the same as 0 and the two must not be
// conflated -- `limit || Infinity` would turn a deliberate zero into unlimited,
// which is the direction that gives away the product.
const INCLUDED_LOCATIONS = Object.freeze({
  // No paid entitlement. Held at the Starter allowance rather than at zero: a
  // business with no location record cannot use bookings, staff or stock, so
  // zero would not be a limit on a paid feature, it would be an unusable
  // workspace.
  free: 1,
  starter_monthly: 1,
  core_monthly: 3,
  pro_monthly: null,
  // The one-time Business Builder setup purchase is not a subscription tier and
  // buys the same workspace Starter does.
  business_builder_one_time: 1
});

function includedLocations(entitlementKey) {
  const key = String(entitlementKey || "free");
  return Object.prototype.hasOwnProperty.call(INCLUDED_LOCATIONS, key) ? INCLUDED_LOCATIONS[key] : INCLUDED_LOCATIONS.free;
}

// Whether one more may be created, given what is already there.
//
// Three answers rather than two, deliberately. `unknown` is what comes back
// when the existing rows could not be counted, and it is a separate result from
// "no" because the two need opposite handling: a customer who has hit their
// limit should be told so, and a customer whose count could not be read should
// not be told they have hit a limit nobody measured. The second is the failure
// this codebase keeps finding -- a check that reports a definite answer it did
// not establish.
function locationAllowance(entitlementKey, countResult) {
  const included = includedLocations(entitlementKey);
  if (included === null) return { allowed: true, included: null, used: countResult?.count ?? null };
  if (!countResult || countResult.ok !== true || typeof countResult.count !== "number") {
    return { allowed: false, unknown: true, included, used: null };
  }
  return { allowed: countResult.count < included, included, used: countResult.count };
}

// What the customer reads. Written for somebody who wants a second shop, not
// for somebody reading an error code.
function locationLimitMessage(allowance) {
  if (allowance.unknown) return "We could not check how many locations you have just now. Try again shortly.";
  const included = allowance.included;
  const noun = included === 1 ? "one location" : `${included} locations`;
  return `Your plan includes ${noun}, and you are using ${allowance.used}. Move up a plan to add another.`;
}

module.exports = { INCLUDED_LOCATIONS, includedLocations, locationAllowance, locationLimitMessage };
