"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const lifecycle = require("../lib/sonara-work-order-lifecycle.cjs");
const { ALL_OWNER_PAGES, childrenOf, REFERENCE_SOURCES } = require("../lib/sonara-owner-record-pages.cjs");
const { TENANT_SCOPED_TABLES } = require("../lib/sonara-tenant-scoped-tables.cjs");

const root = path.join(__dirname, "..");
const migrationPath = path.join(root, "supabase", "migrations", "20260923020000_business_work_order_job_lifecycle.sql");

describe("Business Builder canonical work-order lifecycle", () => {
  it("uses a fixed deterministic state graph", () => {
    const allowed = [
      ["draft", "scheduled"],
      ["draft", "cancelled"],
      ["scheduled", "dispatched"],
      ["scheduled", "in_progress"],
      ["dispatched", "in_progress"],
      ["in_progress", "blocked"],
      ["blocked", "in_progress"],
      ["in_progress", "completed"],
      ["completed", "invoiced"],
      ["invoiced", "closed"]
    ];
    for (const [from, to] of allowed) {
      const result = lifecycle.transitionDecision(from, to);
      assert.equal(result.ok, true, `${from} -> ${to}`);
    }

    for (const [from, to] of [
      ["draft", "completed"],
      ["scheduled", "closed"],
      ["blocked", "completed"],
      ["completed", "draft"],
      ["closed", "in_progress"],
      ["cancelled", "scheduled"]
    ]) {
      const result = lifecycle.transitionDecision(from, to);
      assert.equal(result.ok, false, `${from} -> ${to} must refuse`);
      assert.equal(result.code, "invalid_work_order_transition");
    }

    assert.equal(lifecycle.transitionDecision("unknown", "scheduled").code, "unknown_work_order_state");
    assert.equal(lifecycle.transitionDecision("draft", "draft").noop, true);
  });

  it("stamps first start and completion without overwriting the original start after unblock", () => {
    const first = lifecycle.transitionPatch("scheduled", "in_progress", new Date("2026-09-22T12:00:00Z"));
    assert.equal(first.patch.actual_start_at, "2026-09-22T12:00:00.000Z");

    const resumed = lifecycle.transitionPatch("blocked", "in_progress", new Date("2026-09-22T13:00:00Z"));
    assert.equal(Object.hasOwn(resumed.patch, "actual_start_at"), false);

    const completed = lifecycle.transitionPatch("in_progress", "completed", new Date("2026-09-22T14:00:00Z"));
    assert.equal(completed.patch.completed_at, "2026-09-22T14:00:00.000Z");
  });

  it("starts a work order only from an accepted, priced quote with a customer", () => {
    const base = {
      id: "11111111-1111-4111-8111-111111111111",
      customer_id: "22222222-2222-4222-8222-222222222222",
      title: "Replace rooftop unit",
      amount_cents: 245000,
      status: "accepted"
    };
    const built = lifecycle.workOrderFromQuote(base, {
      organizationId: "33333333-3333-4333-8333-333333333333",
      userId: "44444444-4444-4444-8444-444444444444"
    });
    assert.equal(built.ok, true);
    assert.equal(built.row.quote_id, base.id);
    assert.equal(built.row.customer_id, base.customer_id);
    assert.equal(built.row.agreed_amount_cents, 245000);
    assert.equal(built.row.status, "draft");

    assert.equal(lifecycle.workOrderFromQuote({ ...base, status: "sent" }, { organizationId: "org" }).code, "quote_not_accepted");
    assert.equal(lifecycle.workOrderFromQuote({ ...base, customer_id: null }, { organizationId: "org" }).code, "quote_customer_required");
    assert.equal(lifecycle.workOrderFromQuote({ ...base, amount_cents: 0 }, { organizationId: "org" }).code, "quote_amount_required");
  });

  it("computes job profitability only when every direct-cost input is known", () => {
    const work = {
      agreed_amount_cents: 100000,
      labor_cost_cents: 30000,
      travel_cost_cents: 5000,
      other_cost_cents: 2500
    };
    const materials = [
      { quantity_used: 2, unit_cost_cents: 10000 },
      { quantity_used: 1.5, unit_cost_cents: 5000 }
    ];
    const complete = lifecycle.profitability(work, materials);
    assert.equal(complete.materialCostCents, 27500);
    assert.equal(complete.directCostCents, 65000);
    assert.equal(complete.profitCents, 35000);
    assert.equal(complete.complete, true);

    const incomplete = lifecycle.profitability({ ...work, labor_cost_cents: null }, materials);
    assert.equal(incomplete.complete, false);
    assert.equal(incomplete.profitCents, null, "unknown labour must not become zero profit cost");
  });

  it("declares one tenant-safe operating schema with atomic state and invoice boundaries", () => {
    const sql = fs.readFileSync(migrationPath, "utf8").toLowerCase();
    for (const table of [
      "business_work_orders",
      "business_work_order_assignments",
      "business_work_order_materials",
      "business_work_order_evidence",
      "business_work_order_events"
    ]) {
      assert.match(sql, new RegExp(`create table if not exists public\\.${table}\\b`));
      assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`));
      assert.ok(TENANT_SCOPED_TABLES.has(table), `${table} is not in the tenant-scoped runtime guard`);
    }

    assert.match(sql, /organization_id uuid not null references public\.organizations/);
    assert.match(sql, /create unique index if not exists business_work_orders_org_quote_unique/);
    assert.match(sql, /add column if not exists work_order_id uuid references public\.business_work_orders/);
    assert.match(sql, /create unique index if not exists customer_invoices_org_work_order_unique/);

    assert.match(sql, /create or replace function public\.sonara_transition_work_order/);
    assert.match(sql, /create or replace function public\.sonara_invoice_work_order/);
    assert.match(sql, /for update/);
    assert.match(sql, /if auth\.role\(\) <> 'service_role'/);
    assert.match(sql, /revoke all on function public\.sonara_transition_work_order[\s\S]*from public, anon, authenticated/);
    assert.match(sql, /revoke all on function public\.sonara_invoice_work_order[\s\S]*from public, anon, authenticated/);
    assert.match(sql, /insert into public\.business_work_order_events/);
    assert.match(sql, /insert into public\.customer_invoices/);
    assert.match(sql, /insert into public\.customer_invoice_lines/);
  });

  it("exposes the operating record through the owner framework without inventing dispatch automation", () => {
    const page = ALL_OWNER_PAGES.find((candidate) => candidate.table === "business_work_orders");
    assert.ok(page, "Work Orders owner page is missing");
    assert.equal(page.path, "/business-builder/owner/work-orders");
    assert.equal(page.api, "/api/business/work-orders");
    assert.deepEqual(childrenOf(page).map((child) => child.table), [
      "business_work_order_assignments",
      "business_work_order_materials",
      "business_work_order_evidence"
    ]);
    assert.equal(REFERENCE_SOURCES.workOrders.table, "business_work_orders");

    const routeSource = fs.readFileSync(path.join(root, "routes", "sonara-last9-routes.cjs"), "utf8");
    assert.match(routeSource, /\/api\/business\/quotes\/:quoteId\/work-order/);
    assert.match(routeSource, /\/api\/business\/work-orders\/:workOrderId\/transition/);
    assert.match(routeSource, /\/api\/business\/work-orders\/:workOrderId\/invoice/);
    assert.match(routeSource, /organization_id=eq\.\$\{encodeURIComponent\(org\.organizationId\)\}/);
    assert.match(routeSource, /submitted\.status = "draft";[\s\S]*delete submitted\.quote_id/);
    assert.doesNotMatch(routeSource, /auto[_ -]?dispatch|optimi[sz]e[_ -]?route|consume[_ -]?inventory/i);
  });
});
