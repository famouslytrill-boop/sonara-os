// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const sql = fs.readFileSync(
  path.join(__dirname, "..", "supabase", "migrations",
    "20261009153000_procurement_receipts_exactly_once.sql"), "utf8"
);

describe("Physical goods: staged procurement SQL contract", () => {
  it("is one transactional, append-only migration without legacy-movement assumptions", () => {
    assert.match(sql, /^begin;/m);
    assert.match(sql, /^commit;\s*$/m);
    assert.doesNotMatch(sql, /\b(?:drop table|truncate table|alter table\s+public\.inventory_items\s+drop)\b/i);
    assert.doesNotMatch(sql, /\bpublic\.inventory_movements\b/);
  });

  it("adds separate, durable records for goods receipt and accepted-stock delta", () => {
    assert.match(sql, /create table public\.procurement_receipt_entries/i);
    assert.match(sql, /create table public\.inventory_procurement_receipt_ledger/i);
    assert.match(sql, /unique \(organization_id, idempotency_key\)/i);
    assert.match(sql, /receipt_id uuid not null unique references public\.procurement_receipt_entries/i);
    assert.match(sql, /accepted_quantity \+ rejected_quantity > 0/i);
    assert.match(sql, /balance_after = balance_before \+ delta_quantity/i);
  });

  it("rejects anonymous and authenticated callers and disallows receipt modifications", () => {
    assert.match(sql, /alter table public\.procurement_receipt_entries enable row level security/i);
    assert.match(sql, /alter table public\.inventory_procurement_receipt_ledger enable row level security/i);
    assert.match(sql, /revoke all on public\.procurement_receipt_entries from public, anon, authenticated, service_role/i);
    assert.match(sql, /revoke all on public\.inventory_procurement_receipt_ledger from public, anon, authenticated, service_role/i);
    assert.match(sql, /grant select, insert on public\.procurement_receipt_entries to service_role/i);
    assert.match(sql, /grant select, insert on public\.inventory_procurement_receipt_ledger to service_role/i);
    assert.doesNotMatch(sql, /grant (?:update|delete|all) on public\.(?:procurement_receipt_entries|inventory_procurement_receipt_ledger)/i);
    assert.match(sql, /revoke all on function public\.sonara_receive_purchase_order_line\([\s\S]*?from public, anon, authenticated;/i);
    assert.match(sql, /grant execute on function public\.sonara_receive_purchase_order_line\([\s\S]*?to service_role;/i);
  });

  it("keeps every stored-procedure authority boundary security-invoker and search-path pinned", () => {
    assert.doesNotMatch(sql, /security definer/i);
    const functions = sql.match(/create function public\./g) || [];
    const boundaries = sql.match(/language plpgsql\s+security invoker\s+set search_path = ''/g) || [];
    assert.equal(functions.length, 3);
    assert.equal(boundaries.length, functions.length);
    // Match exact dollar delimiters; a single dollar is invalid SQL.
    const dollar = String.fromCharCode(36);
    const delimiter = dollar + dollar;
    assert.equal(sql.split("as " + delimiter).length - 1, functions.length);
    assert.equal(sql.split("end;" + String.fromCharCode(10) + delimiter + ";").length - 1, functions.length);
    assert.ok(!sql.includes(" as " + dollar + String.fromCharCode(10)));
    assert.ok(!sql.includes("end;" + String.fromCharCode(10) + dollar + ";"));
    assert.match(sql, /create trigger procurement_receipt_enforce_tenant/i);
    assert.match(sql, /create trigger procurement_ledger_enforce_receipt/i);
  });

  it("locks PO, line and item before posting and enforces tenant lineage", () => {
    const po = sql.indexOf("select * into v_po from public.purchase_orders");
    const line = sql.indexOf("select * into v_line from public.purchase_order_lines");
    const item = sql.indexOf("select * into v_item from public.inventory_items");
    assert.ok(po >= 0 && line > po && item > line);
    assert.match(sql.slice(po, line), /for update;/i);
    assert.match(sql.slice(line, item), /for update;/i);
    assert.match(sql.slice(item), /for update;/i);
    assert.match(sql, /l\.organization_id = new\.organization_id/i);
    assert.match(sql, /i\.organization_id = l\.organization_id/i);
    assert.match(sql, /r\.organization_id = new\.organization_id/i);
  });

  it("fail-closes on unapproved POs, incompatible units, and unmatched legacy counts", () => {
    for (const value of [
      "purchase_order_not_receivable", "purchase_order_approval_evidence_missing",
      "purchase_order_line_invalid", "inventory_item_invalid",
      "purchase_order_location_mismatch", "legacy_receipt_reconciliation_required",
      "receipt_exceeds_ordered_quantity", "receipt_balance_out_of_range"
    ]) assert.ok(sql.includes(value), value);
    assert.match(sql, /v_po\.approval_status is distinct from 'approved'/i);
    assert.match(sql, /v_po\.status not in \('sent', 'partially_received'\)/i);
    assert.match(sql, /v_line\.quantity_received, 0\) <> v_prior_accepted/i);
    assert.match(sql, /p_accepted_quantity <> trunc\(p_accepted_quantity, 3\)/i);
    assert.match(sql, /p_rejected_quantity <> trunc\(p_rejected_quantity, 3\)/i);
  });

  it("makes exact retries no-ops and payload-changing retries conflicts", () => {
    assert.match(sql, /select \* into v_existing from public\.procurement_receipt_entries/i);
    assert.match(sql, /v_existing\.actor_user_id is distinct from p_actor_user_id/i);
    assert.match(sql, /raise exception 'receipt_idempotency_conflict'/i);
    assert.match(sql, /'code', 'already_recorded'/i);
    assert.match(sql, /'stock_posted', false/i);
  });

  it("never credits rejected units and updates line/status only after receipt capture", () => {
    assert.match(sql, /if p_accepted_quantity > 0 then[\s\S]+?set quantity = v_new_stock/i);
    assert.match(sql, /delta_quantity[\s\S]*?p_accepted_quantity, v_item\.quantity, v_new_stock/i);
    assert.match(sql, /update public\.purchase_order_lines set quantity_received = v_line_accepted/i);
    assert.match(sql, /'received' else 'partially_received'/i);
    assert.match(sql, /'rejected', p_rejected_quantity/i);
  });
});
