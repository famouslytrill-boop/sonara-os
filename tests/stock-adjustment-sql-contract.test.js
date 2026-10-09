// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const migration = fs.readFileSync(path.join(__dirname,"..","supabase","migrations","20261009170000_versioned_stock_adjustment_journal.sql"),"utf8");
const replay = fs.readFileSync(path.join(__dirname,"..","scripts","verify-migration-replay.mjs"),"utf8");

describe("Staged inventory stock version and journal SQL contract", () => {
  it("uses a transactional non-destructive, versioned migration", () => {
    assert.match(migration,/^begin;/m);
    assert.match(migration,/^commit;\s*$/m);
    assert.match(migration,/add column stock_version bigint not null default 0/i);
    assert.doesNotMatch(migration,/\bdrop table\b|\btruncate table\b|\bdelete from public\.inventory_items\b/i);
  });
  it("records all subsequent inserts and changed quantities without inventing source attribution", () => {
    assert.match(migration,/create trigger inventory_items_stock_version_guard\s+before insert or update on public\.inventory_items/i);
    assert.match(migration,/create trigger inventory_items_stock_change_journal\s+after insert or update on public\.inventory_items/i);
    assert.match(migration,/unattributed_quantity_change/i);
    assert.match(migration,/opening_snapshot/i);
    assert.match(migration,/from public\\.inventory_items i;/i);
    assert.match(migration,/coalesce\(i\.quantity,0\),coalesce\(i\.quantity,0\),0/i);
    assert.match(migration,/unique \(inventory_item_id,version_after\)/i);
    assert.match(migration,/if new\.quantity is distinct from old\.quantity then/i);
  });
  it("keeps the audit independent of inventory item deletion", () => {
    assert.match(migration,/create table public\.inventory_stock_events \([\s\S]*?inventory_item_id uuid not null references public\.inventory_items\(id\),/i);
    assert.doesNotMatch(migration,/inventory_item_id uuid not null references public\.inventory_items\(id\) on delete cascade/i);
  });
  it("makes service-only stock receipt evidence and reviewer decisions append-only", () => {
    for (const table of ["inventory_stock_events","inventory_stock_adjustments","inventory_stock_adjustment_approvals"]) {
      assert.match(migration,new RegExp("alter table public\\."+table+" enable row level security","i"));
      assert.match(migration,new RegExp("revoke all on public\\."+table+" from public,anon,authenticated,service_role","i"));
      assert.match(migration,new RegExp("create policy stock_\\w+_service_read on public\\."+table,"i"));
    }
    assert.match(migration,/grant select on public\.inventory_stock_events to service_role/i);
    assert.match(migration,/grant select,insert on public\.inventory_stock_adjustments to service_role/i);
    assert.doesNotMatch(migration,/grant (?:all|update|delete)[^;]*inventory_stock_(?:events|adjustments|adjustment_approvals)/i);
  });
  it("restricts any database posting function to trusted service callers", () => {
    assert.match(migration,/create function public\.sonara_apply_stock_count_adjustment\(/i);
    assert.match(migration,/language plpgsql security invoker set search_path = ''/i);
    assert.match(migration,/revoke all on function public\.sonara_apply_stock_count_adjustment\(/i);
    assert.match(migration,/\) from public,anon,authenticated;/i);
    assert.match(migration,/\) to service_role;/i);
    assert.match(migration,/p_approval_id uuid/i);
  });
  it("uses a narrow fixed-table SECURITY DEFINER exception only for universal journaling", () => {
    const count=(migration.match(/security definer/gi)||[]).length;
    assert.ok(count>=1);
    assert.match(migration,/create function public\.sonara_record_inventory_stock_change\(\)[\s\S]*?security definer set search_path = ''/i);
    assert.match(migration,/insert into public\.inventory_stock_events/i);
    assert.doesNotMatch(migration,/\bEXECUTE\s+format\s*\(/i);
  });
  it("requires recorded independent reviewer evidence and fresh identity checks", () => {
    assert.match(migration,/create table public\.inventory_stock_adjustment_approvals/i);
    assert.match(migration,/constraint stock_approval_distinct_people check \(actor_user_id<>reviewer_user_id\)/i);
    assert.match(migration,/v_approval\.idempotency_key <> p_idempotency_key/i);
    assert.match(migration,/v_approval\.counted_quantity <> p_counted_quantity/i);
    assert.match(migration,/m\.status = 'active' and lower\(m\.role\) in \('owner','admin','business_owner'\)/i);
    assert.match(migration,/stock_adjustment_approval_evidence_missing/i);
  });
  it("serializes stock updates and checks all outstanding holds before no-change return", () => {
    const rowLock=migration.indexOf("where id = p_inventory_item_id and organization_id = p_organization_id\n    for update;");
    const held=migration.indexOf("select coalesce(sum(r.quantity),0) into v_held");
    const noChange=migration.indexOf("if v_item.quantity = p_counted_quantity");
    const update=migration.indexOf("update public.inventory_items set quantity=p_counted_quantity");
    assert.ok(rowLock>0 && held>rowLock && noChange>held && update>noChange);
    assert.match(migration,/stock_version_conflict/i);
    assert.match(migration,/stock_adjustment_violates_holds/i);
    assert.match(migration,/stock_adjustment_idempotency_conflict/i);
  });
  it("ties immutable adjustment receipt to the underlying stock change event", () => {
    assert.match(migration,/stock_event_id uuid not null unique references public\.inventory_stock_events\(id\)/i);
    assert.match(migration,/approval_id uuid not null unique references public\.inventory_stock_adjustment_approvals\(id\)/i);
    assert.match(migration,/create trigger inventory_adjustment_event_lineage/i);
    assert.match(migration,/a\.organization_id = new\.organization_id/i);
    assert.match(migration,/a\.actor_user_id = new\.actor_user_id/i);
    assert.match(migration,/a\.counted_quantity = new\.balance_after/i);
    assert.match(migration,/stock_adjustment_approval_lineage_invalid/i);
    assert.match(migration,/e\.version_before = new\.stock_version_before/i);
    assert.match(migration,/e\.balance_after = new\.balance_after/i);
  });
  it("executes fixtures plus independent-connection races in the required database replay", () => {
    assert.match(replay,/tests\/sql\/stock-adjustment-journal\.sql/);
    assert.match(replay,/tests\/sql\/stock-adjustment-concurrency\.sql/);
    assert.match(replay,/for \(const scenario of \["duplicate", "stale_version"\]\)/);
    assert.match(replay,/stock_race_adjustments_2/);
    assert.match(replay,/stock_race_events_3/);
  });
});
