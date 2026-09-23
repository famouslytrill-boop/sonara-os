// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Deterministic state machine for Business Builder work orders.
//
// Models/agents may recommend a next step, but this module is the authority that
// decides whether a transition is legal. No prompt can invent a state edge.

const STATES = Object.freeze([
  "draft",
  "scheduled",
  "dispatched",
  "in_progress",
  "blocked",
  "completed",
  "invoiced",
  "closed",
  "cancelled"
]);

const TRANSITIONS = Object.freeze({
  draft: Object.freeze(["scheduled", "cancelled"]),
  scheduled: Object.freeze(["dispatched", "in_progress", "cancelled"]),
  dispatched: Object.freeze(["in_progress", "cancelled"]),
  in_progress: Object.freeze(["blocked", "completed", "cancelled"]),
  blocked: Object.freeze(["in_progress", "cancelled"]),
  completed: Object.freeze(["invoiced"]),
  invoiced: Object.freeze(["closed"]),
  closed: Object.freeze([]),
  cancelled: Object.freeze([])
});

function transitionDecision(currentStatus, requestedStatus) {
  const current = normalizeState(currentStatus);
  const requested = normalizeState(requestedStatus);
  if (!current || !requested) return { ok: false, code: "unknown_work_order_state", current, requested };
  if (current === requested) return { ok: true, noop: true, current, next: requested };
  const allowed = TRANSITIONS[current] || [];
  if (!allowed.includes(requested)) {
    return { ok: false, code: "invalid_work_order_transition", current, requested, allowed: [...allowed] };
  }
  return { ok: true, noop: false, current, next: requested };
}

function transitionPatch(currentStatus, requestedStatus, now = new Date()) {
  const decision = transitionDecision(currentStatus, requestedStatus);
  if (!decision.ok || decision.noop) return { decision, patch: {} };
  const at = now instanceof Date ? now.toISOString() : new Date(now).toISOString();
  const patch = { status: decision.next, updated_at: at };
  if (decision.next === "in_progress" && decision.current !== "blocked") patch.actual_start_at = at;
  if (decision.next === "completed") patch.completed_at = at;
  return { decision, patch };
}

function workOrderFromQuote(quote, { organizationId, userId = null } = {}) {
  if (!organizationId) throw new TypeError("work-order creation requires organizationId");
  if (!quote?.id) return { ok: false, code: "quote_required" };
  if (String(quote.status || "").toLowerCase() !== "accepted") return { ok: false, code: "quote_not_accepted" };
  if (!quote.customer_id) return { ok: false, code: "quote_customer_required" };
  const amount = finiteNonNegative(quote.amount_cents);
  if (amount === null || amount <= 0) return { ok: false, code: "quote_amount_required" };
  return {
    ok: true,
    row: {
      organization_id: organizationId,
      customer_id: quote.customer_id,
      quote_id: quote.id,
      title: String(quote.title || "").trim() || "Accepted work",
      agreed_amount_cents: amount,
      status: "draft",
      created_by: userId
    }
  };
}

function materialCost(materials = []) {
  let total = 0;
  let incomplete = 0;
  for (const line of Array.isArray(materials) ? materials : []) {
    const quantity = finiteNonNegative(line?.quantity_used ?? line?.quantity_planned);
    const unitCost = finiteNonNegative(line?.unit_cost_cents);
    if (quantity === null || unitCost === null) {
      incomplete += 1;
      continue;
    }
    total += quantity * unitCost;
  }
  return { cents: Math.round(total), incomplete };
}

function profitability(workOrder = {}, materials = []) {
  const revenue = finiteNonNegative(workOrder.agreed_amount_cents);
  const labor = finiteNonNegative(workOrder.labor_cost_cents);
  const travel = finiteNonNegative(workOrder.travel_cost_cents);
  const other = finiteNonNegative(workOrder.other_cost_cents);
  const material = materialCost(materials);
  const knownCosts = [labor, travel, other].filter((value) => value !== null);
  const directCostCents = material.cents + knownCosts.reduce((sum, value) => sum + value, 0);
  const complete = revenue !== null && labor !== null && travel !== null && other !== null && material.incomplete === 0;
  return {
    revenueCents: revenue,
    materialCostCents: material.cents,
    laborCostCents: labor,
    travelCostCents: travel,
    otherCostCents: other,
    directCostCents,
    profitCents: complete ? revenue - directCostCents : null,
    complete,
    incompleteMaterialLines: material.incomplete
  };
}

function normalizeState(value) {
  const state = String(value || "").trim().toLowerCase();
  return STATES.includes(state) ? state : null;
}

function finiteNonNegative(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

module.exports = {
  STATES,
  TRANSITIONS,
  transitionDecision,
  transitionPatch,
  workOrderFromQuote,
  materialCost,
  profitability
};
