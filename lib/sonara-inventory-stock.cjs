// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Stock that moves with orders and jobs.
//
// On-hand stock moves in two database functions, and this module calls neither
// of them for an order's shipment:
//
//   * `transition_merchant_order` (20261006035501, Codex's) is the order status
//     machine. Fulfilling a confirmed order takes its lines' stock off the shelf
//     and writes a stock receipt, in one transaction.
//   * `inventory_material_stock` (20261006040000) records a work-order material
//     used or returned.
//
// What this module adds for orders is the hold: `inventory_order_hold`, called
// when an order is placed, so stock already promised to one
// buyer is not sold to the next. It runs under the same row locks fulfilment
// takes, and a trigger settles the hold -- consumed or released -- in the same
// transaction as the status change, so held and on hand never disagree.
//
// This module decides nothing about stock itself -- a figure computed here from
// rows read a moment ago would be exactly the race the functions exist to close.
// `available` below is for showing, and for withholding a sold-out variant from
// the shop; the function is still the one that says yes or no.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function callFunction(config, supabaseHeaders, name, body, fetchImpl = fetch) {
  if (!config?.ok) return { ok: false, code: "unavailable" };
  let response;
  try {
    response = await fetchImpl(`${config.url}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: { ...supabaseHeaders(config), "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  } catch {
    return { ok: false, code: "unreachable" };
  }
  if (!response?.ok) return { ok: false, code: "rejected", status: response?.status || 0 };
  const result = await response.json().catch(() => null);
  // The functions always answer { ok, code }. Anything else is a failure, not a
  // success that happened to come back without a body.
  if (!result || typeof result !== "object" || typeof result.ok !== "boolean" || typeof result.code !== "string") {
    return { ok: false, code: "malformed" };
  }
  return result;
}

/**
 * Hold a storefront order's stock when it is placed.
 * `{ ok, code, ... }` exactly as the function answered, or a transport failure
 * with `ok: false` -- which the caller must never read as "nothing to hold".
 */
function holdOrderStock(config, supabaseHeaders, { organizationId, orderId }, fetchImpl) {
  if (!UUID.test(String(organizationId || "")) || !UUID.test(String(orderId || ""))) {
    return Promise.resolve({ ok: false, code: "invalid_stock_request" });
  }
  return callFunction(config, supabaseHeaders, "inventory_order_hold", { p_organization_id: organizationId, p_order_id: orderId }, fetchImpl);
}

/** Record a work-order material line as stock used or returned. */
function materialStock(config, supabaseHeaders, { organizationId, materialId }, fetchImpl) {
  if (!UUID.test(String(organizationId || "")) || !UUID.test(String(materialId || ""))) {
    return Promise.resolve({ ok: false, code: "invalid_stock_request" });
  }
  return callFunction(config, supabaseHeaders, "inventory_material_stock", { p_organization_id: organizationId, p_material_id: materialId }, fetchImpl);
}

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/**
 * On hand, held and available per inventory item, from rows already read.
 *
 * `items` are inventory_items (id, quantity, status); `held` are
 * inventory_reservations rows in state `held` (inventory_item_id, quantity).
 * Returns a Map item id -> { onHand, held, available, active }. An item whose
 * quantity was never recorded has `onHand: null` -- not zero -- and nothing is
 * available from it.
 */
function availabilityFor({ items = [], held = [] } = {}) {
  const holds = new Map();
  for (const row of held) {
    const quantity = finite(row.quantity);
    if (!row.inventory_item_id || quantity === null) continue;
    holds.set(row.inventory_item_id, (holds.get(row.inventory_item_id) || 0) + quantity);
  }
  const result = new Map();
  for (const item of items) {
    const onHand = finite(item.quantity);
    const heldHere = holds.get(item.id) || 0;
    const active = item.status === "active";
    result.set(item.id, Object.freeze({
      onHand,
      held: heldHere,
      available: active && onHand !== null ? Math.max(Math.floor(onHand - heldHere), 0) : 0,
      active
    }));
  }
  return result;
}

function shortageParts(result) {
  const shortages = Array.isArray(result?.shortages) ? result.shortages : [];
  return shortages.map((entry) => {
    const available = finite(entry.available) || 0;
    return available > 0 ? `${entry.name || "an item"}: only ${available} left` : `${entry.name || "an item"}: sold out`;
  });
}

/** What the buyer is told when the function refused for want of stock. */
function shortageSentence(result) {
  const parts = shortageParts(result);
  if (!parts.length) return "Something in your order sold out before it could be held for you. Nothing has been charged.";
  return `Not enough left to hold your order (${parts.join("; ")}). Nothing has been charged -- change the quantities and try again.`;
}

/** The work-order material page's sentence for what the stock did. */
function materialStockSentence(result) {
  if (!result?.ok) return "The material was saved, but the stock count could not be updated just now. Add it again later only if the count has not moved.";
  return ({
    consumed: `Taken from stock: ${finite(result.quantity)}. On hand is now ${finite(result.onHand)}${finite(result.onHand) < 0 ? " -- below zero, so the shelf has more than the count said, or less was used. Count it." : "."}`,
    returned: `Put back into stock: ${finite(result.quantity)}. On hand is now ${finite(result.onHand)}.`,
    untracked: "Not linked to a stock item, so no count moved.",
    not_a_stock_movement: "Planned, reserved and cancelled materials do not move the stock count. Record it as used when it is used.",
    already_recorded: "This line had already moved the stock count; it was not moved again.",
    no_quantity: "No quantity was recorded, so the stock count did not move."
  })[result.code] || "The stock count was not changed.";
}

module.exports = {
  holdOrderStock,
  materialStock,
  availabilityFor,
  shortageSentence,
  materialStockSentence
};
