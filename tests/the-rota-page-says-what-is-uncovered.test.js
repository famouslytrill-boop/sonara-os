"use strict";

// The rota as a week, and the two sentences it must never say wrongly.
//
// **"Covered for every hour you are open."** A business reads that and stops
// looking. It has to be false whenever a read failed, whenever the business has
// not said when it is open, and whenever a shift could not be understood --
// because in all three cases nothing checked.
//
// **"Nobody is on."** An unreadable rota rendering as an empty week is the most
// alarming way for this page to be wrong, and a business would go and re-enter
// a rota it already has.
//
// Driven against the route module with the guards stubbed. Through server.js
// every assertion would pass over a 303 from requireBusinessManager.

const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");
const registerRotaRoutes = require("../routes/sonara-rota-routes.cjs");
const { hasColumn, tableColumns } = require("../lib/sonara-migration-columns.cjs");

const ORG = "a1a1a1a1-0000-4000-8000-00000000001a";
const USER = "b2b2b2b2-0000-4000-8000-00000000002b";
const ALEX = "c3c3c3c3-0000-4000-8000-00000000003c";
const PAGE = "/business-builder/owner/schedules/week";

// Open 09:00-17:00 Monday to Friday, Sunday-first as the booking page stores it.
const OPEN = [
  null,
  { open: "09:00", close: "17:00" },
  { open: "09:00", close: "17:00" },
  { open: "09:00", close: "17:00" },
  { open: "09:00", close: "17:00" },
  { open: "09:00", close: "17:00" },
  null
];

function buildApp({
  shifts = [{ id: "sh-1", employee_id: ALEX, starts_at: "2026-06-01T08:00:00Z", ends_at: "2026-06-01T16:00:00Z", status: "scheduled", role_label: null }],
  staff = [{ id: ALEX, display_name: "Alex" }],
  bookingPage = [{ time_zone: "Europe/London", opening_hours: OPEN, enabled: true, assign_staff: true }],
  shiftsOk = true, staffOk = true, bookingPageOk = true,
  organization = ORG
} = {}) {
  const app = express();
  app.use(express.json());
  const authenticate = (req, res, next) => { req.sonaraUser = { id: USER, email: "owner@example.com" }; return next(); };

  const calls = [];
  global.fetch = async (url) => {
    const href = String(url);
    calls.push(href);
    if (href.includes("/employee_schedules")) return { ok: shiftsOk, json: async () => shifts };
    if (href.includes("/business_employee_profiles")) return { ok: staffOk, json: async () => staff };
    if (href.includes("/public_booking_pages")) return { ok: bookingPageOk, json: async () => bookingPage };
    return { ok: true, json: async () => [] };
  };

  registerRotaRoutes(app, {
    layout: ({ title, heading, sections = [] }) => `<html><title>${title}</title><h1>${heading}</h1>${sections.join("")}</html>`,
    brandCard: (cardTitle, cardBody) => `<article><h2>${cardTitle}</h2><p>${cardBody}</p></article>`,
    linkAction: (href, label) => `<a href="${href}">${label}</a>`,
    escapeHtml: (value) => String(value).replace(/[&<>"']/g, ""),
    requireBusinessManager: authenticate,
    getCustomerPrimaryOrganization: async () => (organization ? { ok: true, organizationId: organization } : { ok: false }),
    getSupabaseServerConfig: () => ({ ok: true, url: "https://project.supabase.co", serviceRoleKey: "server-only" }),
    supabaseHeaders: () => ({ apikey: "server-only" })
  });
  return { app, calls };
}

const WEEK = "?week=2026-06-01";

describe("the rota page says what is uncovered", () => {
  let savedFetch;
  before(() => { savedFetch = global.fetch; });
  after(() => { global.fetch = savedFetch; });

  describe("the columns it reads", () => {
    it("names only columns the tables actually have", () => {
      for (const [table, columns] of [
        ["employee_schedules", ["id", "organization_id", "employee_id", "starts_at", "ends_at", "status", "role_label"]],
        ["business_employee_profiles", ["id", "organization_id", "display_name"]],
        ["public_booking_pages", ["organization_id", "time_zone", "opening_hours", "enabled", "assign_staff"]]
      ]) {
        assert.ok((tableColumns(table)?.size || 0) > 0, `no columns found for ${table}, so this check is looking at nothing`);
        for (const column of columns) assert.ok(hasColumn(table, column), `${table} has no column ${column}`);
      }
    });
  });

  describe("what it shows", () => {
    it("lays out the week in the business's own zone", async () => {
      const { app } = buildApp();
      const response = await request(app).get(`${PAGE}${WEEK}`).redirects(0);
      assert.equal(response.status, 200);
      assert.ok(response.text.includes("Europe/London"));
      assert.ok(response.text.includes("Monday 2026-06-01"));
      assert.ok(response.text.includes("Sunday 2026-06-07"), "the week is not seven days");
      // 08:00 UTC is 09:00 in London in June.
      assert.ok(response.text.includes("09:00"));
      assert.ok(response.text.includes("Alex"));
    });

    it("names the days the business is open with nobody on", async () => {
      const { app } = buildApp();
      const response = await request(app).get(`${PAGE}${WEEK}`).redirects(0);
      assert.ok(response.text.includes("Open with nobody on"), "an empty Tuesday was not reported");
      assert.ok(response.text.includes("Covered for every hour you are open"), "and Monday, which is covered, was not said to be");
    });

    it("says plainly that the booking page is showing those hours as unavailable", async () => {
      // The sentence the page exists for. A business that has ticked "book a
      // member of staff" and left a day empty has a page reading as full.
      const { app } = buildApp();
      const response = await request(app).get(`${PAGE}${WEEK}`).redirects(0);
      assert.ok(response.text.includes("showing these hours as unavailable"));
      assert.ok(response.text.includes("they read as full"));
    });

    it("does not say that when the page books the business as a whole", async () => {
      const { app } = buildApp({ bookingPage: [{ time_zone: "Europe/London", opening_hours: OPEN, enabled: true, assign_staff: false }] });
      const response = await request(app).get(`${PAGE}${WEEK}`).redirects(0);
      assert.ok(!response.text.includes("showing these hours as unavailable"),
        "an unstaffed booking page does not depend on the rota, so this warning would be false");
    });
  });

  describe("what it refuses to claim", () => {
    it("does not say the week is covered when it could not read the rota", async () => {
      const { app } = buildApp({ shiftsOk: false });
      const response = await request(app).get(`${PAGE}${WEEK}`).redirects(0);
      assert.equal(response.status, 503);
      assert.ok(response.text.includes("could not read your rota"));
      assert.ok(!response.text.includes("Nobody is on."), "an unreadable rota rendered as an empty week");
      assert.ok(response.text.includes("do not re-enter shifts"));
    });

    it("does not say the week is covered when the business has not said when it is open", async () => {
      const { app } = buildApp({ bookingPage: [] });
      const response = await request(app).get(`${PAGE}${WEEK}`).redirects(0);
      assert.equal(response.status, 200);
      assert.ok(response.text.includes("Nothing to compare your rota against"));
      assert.ok(!response.text.includes("Covered for every hour"), "a business with no opening hours was told it was fully covered");
      assert.ok(!response.text.includes("Every hour you are open has somebody on it"));
    });

    it("does not say the week is covered when the booking settings could not be read", async () => {
      const { app } = buildApp({ bookingPageOk: false });
      const response = await request(app).get(`${PAGE}${WEEK}`).redirects(0);
      assert.ok(response.text.includes("could not be read"));
      assert.ok(!response.text.includes("Every hour you are open has somebody on it"));
    });

    it("counts a shift it could not understand instead of dropping it", async () => {
      const { app } = buildApp({
        shifts: [
          { id: "sh-1", employee_id: ALEX, starts_at: "2026-06-01T08:00:00Z", ends_at: null, status: "scheduled" },
          { id: "sh-2", employee_id: ALEX, starts_at: "2026-06-02T08:00:00Z", ends_at: "2026-06-02T07:00:00Z", status: "scheduled" }
        ]
      });
      const response = await request(app).get(`${PAGE}${WEEK}`).redirects(0);
      assert.ok(response.text.includes("2 shifts are not shown"), "cover the business believes it has was dropped in silence");
      assert.ok(response.text.includes("not counted as cover anywhere, including on your booking page"));
    });

    it("shows the rota without names rather than dropping it when the staff list fails", async () => {
      const { app } = buildApp({ staffOk: false });
      const response = await request(app).get(`${PAGE}${WEEK}`).redirects(0);
      assert.equal(response.status, 200);
      assert.ok(response.text.includes("could not read your staff list"));
      assert.ok(response.text.includes("09:00"), "the shift itself vanished because a name could not be found");
    });

    it("says a whole week is covered only when it is", async () => {
      const { app } = buildApp({
        shifts: [1, 2, 3, 4, 5].map((day) => ({
          id: `sh-${day}`, employee_id: ALEX,
          starts_at: `2026-06-0${day}T08:00:00Z`, ends_at: `2026-06-0${day}T16:00:00Z`,
          status: "scheduled"
        }))
      });
      const response = await request(app).get(`${PAGE}${WEEK}`).redirects(0);
      assert.ok(response.text.includes("Every hour you are open has somebody on it"));
      assert.ok(!response.text.includes("Open with nobody on"));
    });
  });

  describe("choosing a week", () => {
    it("filters every read by the business", async () => {
      const { app, calls } = buildApp();
      await request(app).get(`${PAGE}${WEEK}`).redirects(0);
      const reads = calls.filter((href) => href.includes("/rest/v1/"));
      assert.ok(reads.length >= 3, "not every table was read, so this check is looking at nothing");
      for (const read of reads) {
        assert.ok(read.includes(`organization_id=eq.${ORG}`), `a read carried no tenant filter: ${read}`);
      }
    });

    it("windows the rota read on overlap, not on when a shift started", async () => {
      // A shift that began before Monday and runs into the week still has to be
      // found -- the same correction the booking reads needed.
      const { app, calls } = buildApp();
      await request(app).get(`${PAGE}${WEEK}`).redirects(0);
      const read = calls.find((href) => href.includes("/employee_schedules"));
      assert.ok(!/starts_at=gte\./.test(read), `the window bounds starts_at, so a shift running since before it is invisible: ${read}`);
      assert.ok(/ends_at=gte\./.test(read));
    });

    it("ignores a week that only looks like a date", async () => {
      // Date.UTC rolls "2026-13-40" over into February 2027. Falling back to
      // this week is right; laying out a week eight months away is not.
      const { app } = buildApp();
      const response = await request(app).get(`${PAGE}?week=2026-13-40`).redirects(0);
      assert.equal(response.status, 200);
      assert.ok(!response.text.includes("2027-02"), "a malformed week was rolled over into a different year");
    });

    it("offers the week before and after", async () => {
      const { app } = buildApp();
      const response = await request(app).get(`${PAGE}${WEEK}`).redirects(0);
      assert.ok(response.text.includes("week=2026-05-25"));
      assert.ok(response.text.includes("week=2026-06-08"));
    });

    it("answers without a workspace rather than showing an empty rota", async () => {
      const { app } = buildApp({ organization: null });
      const response = await request(app).get(`${PAGE}${WEEK}`).redirects(0);
      assert.equal(response.status, 503);
      assert.ok(response.text.includes("It is not saying nobody is"));
    });
  });
});
