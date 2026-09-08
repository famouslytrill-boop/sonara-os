"use strict";

// The paid-access boundary, written once, in the shape the database stores.
//
// It was written twice. lib/sonara-recommended-product-catalog.cjs decided what
// the catalog claims, and scripts/verify-production-product-catalog.mjs decided
// what production is allowed to contain -- and the second one still held the
// rule the first one had just dropped:
//
//     assert.equal(paidRows.some((row) => row.entitlement_integration_verified === true), false,
//       "Paid product verification must remain false until a real subscribed-user production test is recorded");
//
// The same gate, forty lines earlier, requires every row to match the catalog
// field for field. So once the catalog marked thirteen paid products verified,
// one assertion required true and the other required false for the same rows.
// The gate could not pass in either direction, and the only thing that could
// tell us was a production deploy -- which is where it was found, with the
// migration already applied and the deploy step skipped.
//
// Both now call this. Feed it live rows and it checks production; feed it the
// catalog projected into row shape and it checks what the next deploy will ask
// for, which is a thing a test can do before the push.

const { planFloorOpensProduct } = require("./sonara-paid-access.cjs");
const { EXECUTABLE_LIFECYCLE_STATUSES } = require("./sonara-recommended-product-catalog.cjs");
const { ACCESS_REASONS } = require("./sonara-plain-language.cjs");

const RESTRICTED_LIFECYCLE_STATUSES = Object.freeze(["planned", "validation_required", "setup_required"]);

// The row shape the catalog sync migration writes, so the same predicates can
// run against the code catalog without a database.
function catalogItemToRow(item) {
  return {
    service_key: item.serviceKey,
    product_key: item.productKey,
    plan_floor: item.planFloor,
    lifecycle_status: item.lifecycleStatus,
    entitlement_integration_verified: item.entitlementIntegrationVerified === true,
    execution_enabled: item.executionEnabled === true
  };
}

// Why a catalog row is or is not open to a customer.
//
// This lived only in routes/sonara-service-lifecycle-routes.cjs, on the item
// shape, where the page renders. That was fine until something outside the
// router needed the same answer: scripts/verify-production-product-catalog.mjs
// checks the live catalog page against production's rows, and to know whether
// the page *should* be saying "not open yet" it has to work out, from the rows,
// whether anything is shut.
//
// Written here rather than copied there, because the file it came from already
// carries the note about what happens when it is copied: "Both the card body and
// the card buttons used to work this out separately from the same four fields,
// and drifted apart; they now share one answer." A third copy in a deploy gate
// would drift the same way, and would do it where nobody looks until a
// deployment fails.
//
// `catalogItemToRow` converts the other shape, so the router keeps its
// item-shaped entry point and both end up here.
function catalogRowAccessReason(row) {
  if (!row.service_key) return "open";
  if (RESTRICTED_LIFECYCLE_STATUSES.includes(String(row.lifecycle_status || ""))) return "awaiting_review";
  if (row.plan_floor !== "free" && row.entitlement_integration_verified !== true) return "awaiting_paid_access";
  if (row.execution_enabled !== true) return "awaiting_setup";
  return "open";
}

// Every way a row may not sit, as plain sentences. Returns [] when the boundary
// holds. A list rather than a throw so both callers can report all of it at once
// instead of the first one.
function catalogRowBoundaryViolations(rows) {
  const violations = [];
  for (const row of rows) {
    const key = row.service_key;
    const paid = row.plan_floor !== "free";
    const verified = row.entitlement_integration_verified === true;
    const enabled = row.execution_enabled === true;
    const enforced = planFloorOpensProduct(row.product_key, row.plan_floor);

    // Verified means the plan this product is sold on is a plan the server will
    // accept for it -- not that a customer holds it, and not that the product
    // is free. This asked `hasEnforcedPaidAccess(product_key)`, which is
    // whether anything in the family is enforced; seven products advertised a
    // plan floor outside their family's list and passed on the strength of a
    // different plan being enforced for a different product.
    if (paid && verified !== enforced) {
      violations.push(
        `${key}: paid product is marked ${verified ? "verified" : "unverified"}, but ${row.product_key} ` +
          `${enforced ? "does" : "does not"} accept a ${row.plan_floor} plan`
      );
    }
    if (paid && !enforced && enabled) {
      violations.push(`${key}: paid product executes on a ${row.plan_floor} plan ${row.product_key} does not accept`);
    }
    if (enabled && !verified) {
      violations.push(`${key}: executes without verified paid access`);
    }
    if (enabled && !EXECUTABLE_LIFECYCLE_STATUSES.includes(row.lifecycle_status)) {
      violations.push(`${key}: executes while still ${row.lifecycle_status}`);
    }
    if (enabled && RESTRICTED_LIFECYCLE_STATUSES.includes(row.lifecycle_status)) {
      violations.push(`${key}: restricted lifecycle ${row.lifecycle_status} cannot execute`);
    }
  }
  return violations;
}


// What a customer must be told on /service-catalog, checked against the state
// production is actually in.
//
// A list rather than a throw, for the reason the row version gives: both
// callers report all of it at once. Pure, so it can be exercised against a real
// page without a deployment -- which is the point. The rule this replaces lived
// inline in scripts/verify-production-product-catalog.mjs, where nothing could
// reach it without production credentials, and it was wrong for a month before
// a deployment got far enough to say so.
//
// `accessReasonCounts` is optional: pass it to cross-check the page against the
// database, omit it when only the page is being read.
const CALL_TO_ACTION = Object.freeze({
  awaiting_review: "Ask about this one",
  awaiting_paid_access: "Ask us to open access"
});
const READY_ELSEWHERE = "See what is ready now";

function plainText(value) {
  return String(value).toLowerCase().replace(/\s+/g, " ").trim();
}

function catalogPageAccessViolations({ visibleText, accessReasonCounts } = {}) {
  const violations = [];
  const text = plainText(visibleText || "");
  const notesOnPage = Object.keys(ACCESS_REASONS).filter((reason) => text.includes(plainText(ACCESS_REASONS[reason])));

  // Every card carries an access note, so a page with none did not render them.
  // Without this the loop below is empty and this reports success having
  // measured nothing.
  if (notesOnPage.length === 0) {
    violations.push(
      "the catalog page carries no access note at all, so it did not render its cards -- " +
        "not a page with nothing to say"
    );
    return violations;
  }

  for (const reason of notesOnPage) {
    if (reason === "open") continue;
    if (!text.includes(plainText(READY_ELSEWHERE))) {
      violations.push(`a product is shown as ${reason} but the page does not offer "${READY_ELSEWHERE}"`);
    }
    const action = CALL_TO_ACTION[reason];
    if (action && !text.includes(plainText(action))) {
      violations.push(`a product is shown as ${reason} but the page does not offer "${action}", so a customer is told no and given no way to ask`);
    }
  }

  // The page and the database must agree about whether anything is shut.
  if (accessReasonCounts) {
    const shutOnPage = notesOnPage.filter((reason) => reason !== "open");
    const shutInDatabase = Object.entries(accessReasonCounts).filter(([reason, count]) => reason !== "open" && count > 0);
    if (shutInDatabase.length > 0 && shutOnPage.length === 0) {
      violations.push(
        `production has rows that are not open (${shutInDatabase.map(([r, c]) => `${r}: ${c}`).join(", ")}) ` +
          "and the catalog page says so for none of them"
      );
    }
    if (shutInDatabase.length === 0 && shutOnPage.length > 0) {
      violations.push(
        `the catalog page shows products as ${shutOnPage.join(", ")} while every production row is open`
      );
    }
  }

  return violations;
}

module.exports = {
  RESTRICTED_LIFECYCLE_STATUSES,
  catalogItemToRow,
  catalogRowAccessReason,
  catalogPageAccessViolations,
  catalogRowBoundaryViolations
};
