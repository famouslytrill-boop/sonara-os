"use strict";

// The staff portal shows one person their own working life.
//
// Six pages used to render three cards explaining what they would show. The
// owner area could already add people, shifts, time entries and tasks; the
// people themselves saw none of it.
//
// The boundary that matters here is one level in from the tenant boundary fixed
// for the owner endpoints. An organization filter is not enough, because a
// colleague is inside the same organization. Shifts, hours, tasks and check-ins
// belong to one person and are scoped by that person's employee record.
// Announcements are addressed to the business and are scoped by organization on
// purpose -- that difference is asserted rather than assumed.

const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");
const registerRoutes = require("../routes/sonara-last9-routes.cjs");

const ORGANIZATION_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const EMPLOYEE_ID = "33333333-3333-4333-8333-333333333333";

const PERSONAL_PAGES = [
  ["/staff/schedule", "employee_schedules", "employee_id"],
  ["/staff/time", "employee_time_entries", "employee_id"],
  ["/staff/tasks", "employee_tasks", "assigned_employee_id"],
  ["/staff/location", "location_events", "employee_id"]
];

function buildApp({ rows = {}, employee = true, organization = ORGANIZATION_ID } = {}) {
  const reads = [];
  const app = express();
  app.use(express.json());
  const authenticate = (req, res, next) => {
    req.sonaraUser = { id: USER_ID };
    return next();
  };
  registerRoutes(app, {
    layout: ({ title, heading, body, sections = [] }) => `<html><title>${title}</title><h1>${heading}</h1><p>${body}</p>${sections.join("")}</html>`,
    brandCard: (cardTitle, cardBody) => `<article><h2>${cardTitle}</h2><p>${cardBody}</p></article>`,
    linkAction: (href, label) => `<a href="${href}">${label}</a>`,
    escapeHtml: (value) => String(value).replace(/[&<>"']/g, ""),
    requireCustomer: authenticate,
    requireBusinessManager: authenticate,
    requireWorkspaceAccess: () => authenticate,
    getCustomerPrimaryOrganization: async () => (organization ? { ok: true, organizationId: organization } : { ok: false, code: "organization_setup_required" }),
    getSupabaseServerConfig: () => ({ ok: true, url: "https://project.supabase.co", serviceRoleKey: "server-only" })
  });
  global.fetch = async (url) => {
    const target = String(url);
    reads.push(target);
    const table = (target.split("/rest/v1/")[1] || "").split("?")[0];
    if (table === "business_employee_profiles") {
      return { ok: true, status: 200, headers: { get: () => null }, json: async () => (employee ? [{ id: EMPLOYEE_ID, display_name: "Alex Doe", job_title: "Chef", employment_type: "employee", status: "active" }] : []) };
    }
    return { ok: true, status: 200, headers: { get: () => null }, json: async () => rows[table] || [] };
  };
  return { app, reads };
}

describe("the staff portal shows one person their own work", () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("names the person, not just the business, on everything personal", async () => {
    const unscoped = [];
    for (const [path, table, column] of PERSONAL_PAGES) {
      const { app, reads } = buildApp();
      await request(app).get(path).set("accept", "text/html");
      const query = reads.find((url) => url.includes(`/rest/v1/${table}`));
      if (!query || !query.includes(`${column}=eq.${EMPLOYEE_ID}`)) unscoped.push(`${path} -> ${query ? query.split("/rest/v1/")[1] : "(no read)"}`);
    }
    assert.deepEqual(
      unscoped,
      [],
      `These pages read a personal table without naming the person:\n  ${unscoped.join("\n  ")}\n\n` +
        "An organization filter is not enough here -- a colleague is inside the same organization."
    );
  });

  it("shows nothing at all to somebody with no employee record", async () => {
    // Better to show one person nothing than to show them the whole workplace.
    for (const [path, table] of PERSONAL_PAGES) {
      const { app, reads } = buildApp({ employee: false });
      const result = await request(app).get(path).set("accept", "text/html");
      assert.equal(result.status, 200, `${path} did not render`);
      assert.match(result.text, /not set up as staff here yet/i, `${path} did not explain why it is empty`);
      assert.equal(reads.some((url) => url.includes(`/rest/v1/${table}`)), false, `${path} read ${table} without knowing who was asking`);
    }
  });

  it("scopes announcements to the business, because they are addressed to it", async () => {
    const { app, reads } = buildApp({ rows: { employee_announcements: [{ title: "Closing early Friday", message: "We shut at 4pm.", published_at: "2026-03-01T00:00:00Z", status: "published" }] } });
    const result = await request(app).get("/staff/announcements").set("accept", "text/html");
    assert.match(result.text, /Closing early Friday/);
    const query = reads.find((url) => url.includes("/rest/v1/employee_announcements"));
    assert.match(query, new RegExp(`organization_id=eq\\.${ORGANIZATION_ID}`));
    assert.doesNotMatch(query, /employee_id/);
  });

  it("shows announcements even to somebody with no employee record", async () => {
    // They are addressed to the workplace, so not being on the staff list yet
    // is not a reason to hide them.
    const { app } = buildApp({ employee: false, rows: { employee_announcements: [{ title: "Welcome", message: "Hello.", status: "published" }] } });
    const result = await request(app).get("/staff/announcements").set("accept", "text/html");
    assert.match(result.text, /Welcome/);
  });

  it("renders every staff page with something real on it", async () => {
    const { app } = buildApp({
      rows: {
        employee_schedules: [{ role_label: "Kitchen", starts_at: "2026-03-02T09:00:00Z", ends_at: "2026-03-02T17:00:00Z", status: "confirmed" }],
        employee_time_entries: [{ clock_in_at: "2026-03-02T09:00:00Z", clock_out_at: "2026-03-02T17:30:00Z", break_minutes: 30, status: "approved" }],
        employee_tasks: [{ title: "Stock check", due_at: "2026-03-03T09:00:00Z", priority: "high", status: "todo" }]
      }
    });
    const schedule = await request(app).get("/staff/schedule").set("accept", "text/html");
    assert.match(schedule.text, /Kitchen/);
    const time = await request(app).get("/staff/time").set("accept", "text/html");
    assert.match(time.text, /8\.00 hours/); // 8.5 hours less a 30 minute break.
    const tasks = await request(app).get("/staff/tasks").set("accept", "text/html");
    assert.match(tasks.text, /Stock check/);
    assert.match(tasks.text, /high priority/);
    const home = await request(app).get("/staff").set("accept", "text/html");
    assert.match(home.text, /Alex Doe/);
    assert.match(home.text, /You do not see other people's/);
  });

  it("says plainly that check-ins are not background tracking", async () => {
    const { app } = buildApp();
    const result = await request(app).get("/staff/location").set("accept", "text/html");
    assert.match(result.text, /Nothing here tracks you in the background/);
  });

  it("renders rather than failing when the workplace cannot be resolved", async () => {
    const { app } = buildApp({ organization: null });
    const result = await request(app).get("/staff/schedule").set("accept", "text/html");
    assert.equal(result.status, 200);
    assert.match(result.text, /could not tell which workplace/i);
  });
});
