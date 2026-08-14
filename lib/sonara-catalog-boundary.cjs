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

module.exports = {
  RESTRICTED_LIFECYCLE_STATUSES,
  catalogItemToRow,
  catalogRowBoundaryViolations
};
