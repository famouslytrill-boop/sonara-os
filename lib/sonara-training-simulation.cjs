// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Fictional, turn-based operations exercises. Values are TRAINING POINTS, not
// dollars, credit, balances, betting chips or exchangeable game currency.
// No chance, prizes, deposits, wager acceptance, accounts, customer inputs,
// external services, payouts, payments, or real operational mutations.
const PACKS = Object.freeze({
  restaurant_shift: Object.freeze({ initialLimit: 1000, restockPointCost: 3, processPointCost: 2,
    scorePerCompletedUnit: 7, maxUnitsPerTurn: 20, label: "Fictional meal service" }),
  trades_dispatch: Object.freeze({ initialLimit: 1000, restockPointCost: 5, processPointCost: 4,
    scorePerCompletedUnit: 10, maxUnitsPerTurn: 8, label: "Fictional service dispatch" }),
  retail_fulfillment: Object.freeze({ initialLimit: 1000, restockPointCost: 2, processPointCost: 1,
    scorePerCompletedUnit: 4, maxUnitsPerTurn: 30, label: "Fictional store orders" }),
  creator_render: Object.freeze({ initialLimit: 1000, restockPointCost: 4, processPointCost: 3,
    scorePerCompletedUnit: 8, maxUnitsPerTurn: 12, label: "Fictional media render jobs" })
});
const MAX_TURNS = 48, MAX_POINTS = 1000000, MAX_STOCK = 10000;
function int(value, max) { return Number.isSafeInteger(value) && value >= 0 && value <= max; }
function fail(code) {
  return Object.freeze({ ok: false, code, fictionalOnly: true,
    monetaryValue: false, mayExecuteBusinessAction: false });
}
/**
 * Deterministic resource planning simulation. Every move and its cost is
 * explicit. A failed move invalidates the whole run rather than quietly
 * skipping one action and presenting misleading results.
 */
function simulateTrainingScenario({
  mode, scenario, startingPoints, startingStock, turns
} = {}) {
  if (mode !== "fictional_training") return fail("training_mode_required");
  const pack = PACKS[scenario];
  if (!pack) return fail("unsupported_training_scenario");
  if (!int(startingPoints, MAX_POINTS) || !int(startingStock, pack.initialLimit)
    || !Array.isArray(turns) || turns.length > MAX_TURNS) return fail("invalid_training_inputs");
  let points = startingPoints, stock = startingStock, score = 0, completed = 0;
  const history = [];
  for (let i = 0; i < turns.length; i += 1) {
    const move = turns[i];
    if (!move || !["replenish", "fulfill", "pass"].includes(move.action)
      || !int(move.units, pack.maxUnitsPerTurn)
      || (move.action === "pass" && move.units !== 0)
      || (move.action !== "pass" && move.units === 0)) return fail("invalid_training_move");
    if (move.action === "replenish") {
      const cost = move.units * pack.restockPointCost;
      if (cost > points) return fail("insufficient_fictional_points");
      if (stock + move.units > MAX_STOCK) return fail("fictional_inventory_limit");
      points -= cost;
      stock += move.units;
    } else if (move.action === "fulfill") {
      const cost = move.units * pack.processPointCost;
      if (move.units > stock) return fail("insufficient_fictional_stock");
      if (cost > points) return fail("insufficient_fictional_points");
      stock -= move.units;
      points -= cost;
      completed += move.units;
      score += move.units * pack.scorePerCompletedUnit;
    }
    history.push(Object.freeze({ turn: i + 1, action: move.action, units: move.units,
      remainingPoints: points, remainingStock: stock, completedUnits: completed, trainingScore: score }));
  }
  return Object.freeze({ ok: true, scenario, label: pack.label,
    fictionalOnly: true, monetaryValue: false, redeemable: false,
    hasWagers: false, prizesOffered: false, randomnessUsed: false,
    mayExecuteBusinessAction: false,
    completedUnits: completed, remainingPoints: points,
    remainingStock: stock, trainingScore: score, history: Object.freeze(history),
    caveat: "Fixed fictional training points and manually selected moves; not sales, wages, stock inventory, labor compliance, forecast or a gambling service." });
}
module.exports = { PACKS, simulateTrainingScenario };
