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

// A finished job, booked again: the next visit to the same customer.
//
// The chain this closes is ... -> invoice -> payment -> repeat job ->
// profitability. Nothing let a finished job become the next one, so a regular
// customer's second visit was typed in from nothing, and nothing linked the
// two.
//
// What carries over is what describes the work: the customer, the place, the
// vehicle, the title, the notes, the priority and the agreed price. What does
// not is what belongs to the visit that happened -- its schedule, its actual
// start and finish, its recorded labour, travel and other costs, its booking,
// route session and quote (one job per accepted quote is a unique index), and
// its number. Crew and materials are not copied either: who goes and what is
// used are decided for the next visit, and a copied material line would hold
// stock for a job nobody has scheduled.
//
// Only a finished job repeats. Repeating a job still in progress would make two
// jobs for one piece of work.
const REPEATABLE_STATES = Object.freeze(["completed", "invoiced", "closed"]);

function repeatWorkOrder(source, { organizationId, userId = null } = {}) {
  if (!organizationId) throw new TypeError("repeating a work order requires organizationId");
  if (!source?.id) return { ok: false, code: "work_order_required" };
  if (source.organization_id && source.organization_id !== organizationId) return { ok: false, code: "work_order_not_yours" };
  if (!REPEATABLE_STATES.includes(normalizeState(source.status))) return { ok: false, code: "work_order_not_finished" };
  const amount = finiteNonNegative(source.agreed_amount_cents);
  return {
    ok: true,
    row: {
      organization_id: organizationId,
      customer_id: source.customer_id || null,
      location_id: source.location_id || null,
      vehicle_id: source.vehicle_id || null,
      title: String(source.title || "").trim() || "Repeat job",
      description: source.description || null,
      priority: ["low", "normal", "high", "urgent"].includes(source.priority) ? source.priority : "normal",
      agreed_amount_cents: amount,
      currency: /^[a-z]{3}$/.test(String(source.currency || "")) ? source.currency : "usd",
      status: "draft",
      created_by: userId,
      metadata: { repeat_of: source.id }
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
  REPEATABLE_STATES,
  repeatWorkOrder,
  materialCost,
  profitability
};
