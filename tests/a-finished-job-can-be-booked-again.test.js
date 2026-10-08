"use strict";

// The Business Builder chain ends ... -> invoice -> payment -> repeat job ->
// profitability. Nothing let a finished job become the next one, so a regular
// customer's second visit was typed in from nothing and nothing linked the two.
//
// "Book this job again" makes a new draft for the same customer, place and
// price, and leaves behind what belonged to the visit that happened: its dates,
// its recorded costs, its crew and its materials.

const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");
const { createFakeSupabase } = require("./helpers/fake-supabase.cjs");
const registerRoutes = require("../routes/sonara-last9-routes.cjs");
const lifecycle = require("../lib/sonara-work-order-lifecycle.cjs");

const ORG = "11111111-1111-4111-8111-111111111111";
const OTHER_ORG = "99999999-9999-4999-8999-999999999999";
const USER = "22222222-2222-4222-8222-222222222222";
const CUSTOMER = "33333333-3333-4333-8333-333333333333";
const FINISHED = "44444444-4444-4444-8444-444444444444";
const RUNNING = "55555555-5555-4555-8555-555555555555";
const ELSEWHERE = "66666666-6666-4666-8666-666666666666";

function job(id, status, extra = {}) {
  return {
    id, organization_id: ORG, status, customer_id: CUSTOMER, location_id: null, vehicle_id: null, quote_id: null, booking_id: null,
    work_order_number: `WO-${id.slice(0, 4)}`, title: "Service the boiler", description: "Annual service, back door key under the mat",
    priority: "normal", agreed_amount_cents: 12000, currency: "gbp",
    scheduled_start_at: "2026-09-01T09:00:00Z", scheduled_end_at: "2026-09-01T11:00:00Z", actual_start_at: "2026-09-01T09:05:00Z", completed_at: "2026-09-01T10:50:00Z",
    labor_cost_cents: 4000, travel_cost_cents: 800, other_cost_cents: 0, metadata: {}, created_at: "2026-08-20T00:00:00Z", ...extra
  };
}

function buildApp(fake) {
  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());
  const signedIn = (req, res, next) => { req.sonaraUser = { id: USER }; next(); };
  registerRoutes(app, {
    layout: ({ title, sections = [] }) => `<html><title>${title}</title>${sections.join("")}</html>`,
    brandCard: (title, body) => `<article><h2>${title}</h2><p>${body}</p></article>`,
    linkAction: (href, label) => `<a href="${href}">${label}</a>`,
    escapeHtml: (value) => String(value).replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char])),
    requireCustomer: signedIn,
    requireBusinessManager: signedIn,
    requireWorkspaceAccess: () => signedIn,
    getCustomerPrimaryOrganization: async () => ({ ok: true, organizationId: ORG, userId: USER, role: "owner" }),
    getSupabaseServerConfig: () => ({ ok: true, url: fake.url, serviceRoleKey: "server-only" })
  });
  return app;
}

describe("a finished job can be booked again", () => {
  it("carries over what describes the work and nothing that belonged to the visit", () => {
    const repeat = lifecycle.repeatWorkOrder(job(FINISHED, "invoiced", { quote_id: "77777777-7777-4777-8777-777777777777", booking_id: "88888888-8888-4888-8888-888888888888" }), { organizationId: ORG, userId: USER });
    assert.equal(repeat.ok, true);
    const row = repeat.row;
    assert.equal(row.status, "draft");
    assert.equal(row.customer_id, CUSTOMER);
    assert.equal(row.agreed_amount_cents, 12000);
    assert.equal(row.currency, "gbp");
    assert.equal(row.description, "Annual service, back door key under the mat");
    assert.deepEqual(row.metadata, { repeat_of: FINISHED });
    for (const visit of ["quote_id", "booking_id", "work_order_number", "scheduled_start_at", "actual_start_at", "completed_at", "labor_cost_cents", "travel_cost_cents", "other_cost_cents"]) {
      assert.equal(Object.hasOwn(row, visit), false, `${visit} belongs to the visit that happened and was copied into the next one`);
    }
    for (const status of ["draft", "scheduled", "in_progress", "blocked", "cancelled"]) {
      assert.equal(lifecycle.repeatWorkOrder(job(FINISHED, status), { organizationId: ORG }).code, "work_order_not_finished", `a ${status} job was booked again`);
    }
    assert.equal(lifecycle.repeatWorkOrder({ ...job(FINISHED, "closed"), organization_id: OTHER_ORG }, { organizationId: ORG }).code, "work_order_not_yours");
  });

  describe("from the job's page", () => {
    let fake;
    let savedFetch;
    beforeEach(() => {
      fake = createFakeSupabase({
        users: {},
        ids: "uuid",
        tables: {
          business_work_orders: [job(FINISHED, "completed"), job(RUNNING, "in_progress"), { ...job(ELSEWHERE, "closed"), organization_id: OTHER_ORG }],
          business_work_order_assignments: [], business_work_order_materials: [], customers: [], business_locations: [], business_bookings: [], vehicle_records: [], route_tracking_sessions: [], business_employee_profiles: [], inventory_items: []
        }
      });
      savedFetch = global.fetch;
      global.fetch = fake.install(savedFetch);
    });
    afterEach(() => { global.fetch = savedFetch; });

    it("offers it on a finished job only", async () => {
      const app = buildApp(fake);
      const finished = await request(app).get(`/business-builder/owner/work-orders/${FINISHED}`).set("accept", "text/html");
      assert.equal(finished.status, 200, finished.text.slice(0, 300));
      assert.ok(finished.text.includes(`action="/api/business/work-orders/${FINISHED}/repeat"`), "a finished job has no way to be booked again");
      const running = await request(app).get(`/business-builder/owner/work-orders/${RUNNING}`).set("accept", "text/html");
      assert.ok(!running.text.includes("/repeat"), "a job still in progress offered to be booked again");
    });

    it("makes a new draft for the same customer and opens it", async () => {
      const app = buildApp(fake);
      const booked = await request(app).post(`/api/business/work-orders/${FINISHED}/repeat`).set("accept", "text/html");
      assert.equal(booked.status, 303);
      const rows = fake.rows("business_work_orders");
      assert.equal(rows.length, 4);
      const created = rows[3];
      assert.match(booked.headers.location, new RegExp(`^/business-builder/owner/work-orders/${created.id}\\?work_done=`));
      assert.equal(created.organization_id, ORG);
      assert.equal(created.status, "draft");
      assert.equal(created.customer_id, CUSTOMER);
      assert.equal(created.metadata.repeat_of, FINISHED);
      assert.equal(created.labor_cost_cents ?? null, null, "the first visit's labour cost was copied into the second");
      assert.equal(rows.find((row) => row.id === FINISHED).status, "completed", "booking a job again changed the original");
    });

    it("refuses a job in progress, and another business's job, and creates nothing", async () => {
      const app = buildApp(fake);
      const running = await request(app).post(`/api/business/work-orders/${RUNNING}/repeat`).set("accept", "application/json");
      assert.equal(running.status, 409);
      assert.equal(running.body.code, "work_order_not_finished");
      const elsewhere = await request(app).post(`/api/business/work-orders/${ELSEWHERE}/repeat`).set("accept", "application/json");
      assert.equal(elsewhere.status, 404, "another business's job was found");
      assert.equal(fake.rows("business_work_orders").length, 3);
    });
  });
});
