// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Deterministic, read-only catering estimate. Never charge, send, reserve stock,
// claim tax/legal clearance, or turn an estimate into a booked event.
const MAX_CENTS = 1000000000000;
const MAX_GUESTS = 20000;

function integer(value, min, max) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= min && value <= max;
}

function money(value) { return integer(value, 0, MAX_CENTS); }

function safeMoney(value) {
  return value <= BigInt(MAX_CENTS) && value >= 0n ? Number(value) : null;
}

function roundRatio(numerator, denominator) {
  return (numerator + denominator / 2n) / denominator;
}

function invalid(issues) {
  return { ok: false, code: "invalid_catering_estimate_input", issues, charged: false, saved: false };
}

function estimateCatering(input = {}) {
  const errors = [];
  if (!input || typeof input !== "object" || Array.isArray(input)) return invalid(["invalid_request"]);
  if (input.currency !== "USD") errors.push("unsupported_currency");
  if (!integer(input.guests, 1, MAX_GUESTS)) errors.push("invalid_guest_count");
  if (input.capacityGuests !== null && input.capacityGuests !== undefined &&
      !integer(input.capacityGuests, 0, MAX_GUESTS)) errors.push("invalid_venue_capacity");
  if (!Array.isArray(input.menuItems) || input.menuItems.length < 1 || input.menuItems.length > 25) {
    errors.push("menu_items_required");
  }

  for (const name of ["staffingCostCents", "equipmentCostCents", "travelCostCents",
    "venueCostCents", "additionalCostCents", "serviceChargeCents", "taxAmountCents"]) {
    if (!money(input[name])) errors.push("invalid_" + name);
  }
  if (!integer(input.depositBasisPoints, 0, 10000)) errors.push("invalid_deposit_basis_points");

  const lines = [];
  if (Array.isArray(input.menuItems) && input.menuItems.length <= 25) {
    for (const [i, item] of input.menuItems.entries()) {
      if (!item || typeof item !== "object" ||
        typeof item.name !== "string" || !item.name.trim() || item.name.trim().length > 80 ||
        !integer(item.portionsPerGuest, 1, 20) ||
        !money(item.pricePerPortionCents) || !money(item.foodCostPerPortionCents) ||
        (item.availablePortions !== null && item.availablePortions !== undefined &&
         !integer(item.availablePortions, 0, 1000000))) {
        errors.push("invalid_menu_line_" + i);
      } else if (integer(input.guests, 1, MAX_GUESTS)) {
        lines.push({
          name: item.name.trim(),
          requiredPortions: input.guests * item.portionsPerGuest,
          availablePortions: item.availablePortions === undefined ? null : item.availablePortions,
          lineRevenue: BigInt(input.guests) * BigInt(item.portionsPerGuest) * BigInt(item.pricePerPortionCents),
          lineCost: BigInt(input.guests) * BigInt(item.portionsPerGuest) * BigInt(item.foodCostPerPortionCents)
        });
      }
    }
  }
  if (errors.length) return invalid(errors);

  let subtotal = 0n;
  let foodCost = 0n;
  const inventoryIssues = [];
  const menu = [];
  for (const line of lines) {
    subtotal += line.lineRevenue;
    foodCost += line.lineCost;
    const shortage = line.availablePortions === null ? null
      : Math.max(0, line.requiredPortions - line.availablePortions);
    if (shortage === null) inventoryIssues.push("inventory_unverified:" + line.name);
    else if (shortage > 0) inventoryIssues.push("inventory_shortage:" + line.name);
    menu.push({
      name: line.name,
      requiredPortions: line.requiredPortions,
      availablePortions: line.availablePortions,
      shortage,
      salesCents: safeMoney(line.lineRevenue),
      foodCostCents: safeMoney(line.lineCost)
    });
  }
  const extras = BigInt(input.staffingCostCents) + BigInt(input.equipmentCostCents) +
    BigInt(input.travelCostCents) + BigInt(input.venueCostCents) + BigInt(input.additionalCostCents);
  const cost = foodCost + extras;
  const total = subtotal + BigInt(input.serviceChargeCents) + BigInt(input.taxAmountCents);
  const deposit = roundRatio(total * BigInt(input.depositBasisPoints), 10000n);
  const contribution = subtotal - cost; // Excludes tax and service charge (not assumed profit).
  if ([subtotal, foodCost, cost, total, deposit].some((n) => safeMoney(n) === null) ||
      contribution > BigInt(Number.MAX_SAFE_INTEGER) ||
      contribution < -BigInt(Number.MAX_SAFE_INTEGER)) {
    return invalid(["estimate_exceeds_safe_money_limit"]);
  }

  const issues = [...inventoryIssues];
  if (input.capacityGuests === null || input.capacityGuests === undefined) {
    issues.push("venue_capacity_unverified");
  } else if (input.guests > input.capacityGuests) {
    issues.push("venue_capacity_shortage");
  }
  // Checkboxes supplied by a browser are evidence of neither compliance nor
  // delegated authorization. These are only questions for the owner to review.
  issues.push("food_safety_and_allergens_need_review", "local_tax_treatment_needs_review",
    "staff_and_delivery_capacity_need_review");

  const marginBasisPoints = subtotal === 0n ? null
    : Number((contribution * 10000n) / subtotal);
  return {
    ok: true,
    status: "draft_owner_review_required",
    currency: "USD",
    guests: input.guests,
    capacityGuests: input.capacityGuests ?? null,
    menu,
    issues,
    totals: {
      menuSubtotalCents: Number(subtotal),
      foodCostCents: Number(foodCost),
      plannedOperatingCostCents: Number(cost),
      serviceChargeCents: input.serviceChargeCents,
      taxAmountCents: input.taxAmountCents,
      customerEstimateCents: Number(total),
      suggestedDepositCents: Number(deposit),
      amountAfterDepositCents: Number(total - deposit),
      contributionBeforeServiceChargeAndTaxCents: Number(contribution),
      contributionMarginBasisPoints: marginBasisPoints
    },
    taxTreatmentVerified: false,
    foodSafetyVerified: false,
    stockReserved: false,
    venueBooked: false,
    customerQuoteSent: false,
    paymentCollected: false,
    charged: false,
    saved: false
  };
}

module.exports = { estimateCatering, MAX_CENTS, MAX_GUESTS };
