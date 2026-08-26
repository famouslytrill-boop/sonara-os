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
  business_builder_one_time: 1,

  // The breadth plans, added 13 August 2026 with the pricing restructure.
  //
  // docs/pricing/2026-08-11-PRICING-RESTRUCTURE.md sets what each one is, and
  // these allowances follow from that rather than from a fresh ladder:
  //
  //   workspace_monthly  $19  one workspace        succeeds Starter -> 1
  //   all_three_monthly  $39  all three workspaces succeeds Pro     -> unlimited
  //   team_monthly       $79  all three plus staff above Pro        -> unlimited
  //
  // all_three_monthly gets Pro's allowance and not the middle of a new ladder
  // because the doc is explicit that it *is* Pro: "Pro $39 -> All three $39.
  // Same price, honest name." Giving it three locations would make the rename a
  // reduction, at the same price, discovered by a customer at the moment they
  // open their fourth site.
  //
  // The one consequence worth writing down: a core_monthly holder moving to
  // workspace_monthly pays the same $19 and goes from three locations to one.
  // The doc's promise is about price, and it holds. Nobody should be migrated
  // across automatically on the strength of that.
  workspace_monthly: 1,
  all_three_monthly: null,
  team_monthly: null
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

// ---------------------------------------------------------------------------
// Cinematic scroll sites
// ---------------------------------------------------------------------------
//
// How many published sites a plan includes. Drafts are deliberately not
// counted: an unpublished site costs nothing to serve, and a limit that stops
// somebody *starting* a second one is a limit that gets in the way of the work
// rather than of the resource. What is metered is what is on the internet under
// this application's domain.
//
// Free gets one, not zero. A builder somebody cannot publish from is a demo,
// and the export exists precisely so that a free customer is not stuck -- they
// can download the folder and host it themselves.
const INCLUDED_SCROLL_SITES = Object.freeze({
  free: 1,
  starter_monthly: 1,
  core_monthly: 5,
  pro_monthly: null,
  business_builder_one_time: 1,

  // The breadth plans, matching the ladder INCLUDED_LOCATIONS uses.
  workspace_monthly: 1,
  studio_monthly: 5,
  team_monthly: null,

  creator_studio_monthly: 5,
  growth_studio_monthly: 5
});

function includedScrollSites(entitlementKey) {
  const key = String(entitlementKey || "free");
  return Object.prototype.hasOwnProperty.call(INCLUDED_SCROLL_SITES, key)
    ? INCLUDED_SCROLL_SITES[key]
    : INCLUDED_SCROLL_SITES.free;
}

// Three answers, for the same reason locationAllowance has three. A customer
// who has hit their limit should be told so; a customer whose sites could not
// be counted must not be told they have hit a limit nobody measured.
function scrollSiteAllowance(entitlementKey, countResult) {
  const included = includedScrollSites(entitlementKey);
  if (included === null) return { allowed: true, included: null, used: countResult?.count ?? null };
  if (!countResult || countResult.ok !== true || typeof countResult.count !== "number") {
    return { allowed: false, unknown: true, included, used: null };
  }
  return { allowed: countResult.count < included, included, used: countResult.count };
}

// What the customer reads. Names the export, because that is the way out of
// this limit that does not cost them anything -- and a limit message that only
// says "pay us" when there is a free answer is one this product should not send.
function scrollSiteLimitMessage(allowance) {
  if (allowance.unknown) {
    return "We could not check how many sites you have published just now. Nothing has changed; try again shortly.";
  }
  const noun = allowance.included === 1 ? "one published site" : `${allowance.included} published sites`;
  return `Your plan includes ${noun}, and you are using ${allowance.used}. `
    + "You can unpublish one, move up a plan, or export this site and host it yourself -- the download works anywhere and costs nothing.";
}

module.exports = {
  INCLUDED_LOCATIONS, includedLocations, locationAllowance, locationLimitMessage,
  INCLUDED_SCROLL_SITES, includedScrollSites, scrollSiteAllowance, scrollSiteLimitMessage
};
