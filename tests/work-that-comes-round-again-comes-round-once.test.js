"use strict";

// Recurring operational work, and the four ways it goes wrong quietly.
//
// **It walks.** "The 31st of every month" clamps to the 28th in February, and
// stepping from the clamped result moves a monthly stock count three days
// earlier for ever. The anchor is stored for this reason, and the arithmetic is
// shared with lib/sonara-recurring-invoices.cjs rather than restated.
//
// **It catches up by repetition.** The invoice engine refuses to catch up: one
// run, one period, dated when it was due. Copied literally to tasks that is a
// worse bug than catching up, because a daily checklist three weeks behind then
// needs twenty-one presses, each producing a task for a day that has gone. This
// file asserts the opposite behaviour: one press, one task, for the most recent
// day it fell due, with the number skipped reported rather than swallowed.
//
// **It advances a template that issued nothing.** Writing last_issued_on before
// the task exists means a failed insert still moves the template on, and that
// occurrence never happens. It is the quiet one: nobody complains about a task
// they never saw.
//
// **It writes a column that does not exist.** Seventeen owner forms once
// shipped naming columns the tables did not have; every save failed in
// production while the tests passed against a stub. The first describe block
// reads supabase/migrations rather than trusting the route.
//
// The route assertions are driven against the route module with the guards
// stubbed. Through server.js every one of them would pass over a 303 from
// requireBusinessManager.

const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");
const registerRecurringTaskRoutes = require("../routes/sonara-recurring-task-routes.cjs");
const { hasColumn } = require("../lib/sonara-migration-columns.cjs");
const {
  CADENCES, PRIORITIES, FAST_FORWARD_LIMIT, PROBLEMS, PROBLEM_CODES, ANCHOR_DAY_PATTERN,
  nextOccurrence, latestDue, isDue, buildTask, describe: describeTemplate, normalizeTemplate, problemSentences
} = require("../lib/sonara-recurring-tasks.cjs");

const ORG = "a1a1a1a1-0000-4000-8000-00000000001a";
const OTHER_ORG = "a2a2a2a2-0000-4000-8000-00000000002a";
const USER = "b2b2b2b2-0000-4000-8000-00000000002b";
const EMPLOYEE = "c3c3c3c3-0000-4000-8000-00000000003c";
const TEMPLATE = "d4d4d4d4-0000-4000-8000-00000000004d";
const PAGE = "/business-builder/owner/recurring-work";

// Fixed so every assertion below reads against one day rather than against
// whenever the suite happens to run.
const TODAY = "2026-10-01";
const NOW = new Date(`${TODAY}T09:00:00.000Z`);

function template(overrides = {}) {
  return {
    id: TEMPLATE, organization_id: ORG, title: "Close the shop",
    description: "Till, lights, alarm.", cadence: "daily",
    starts_on: "2026-09-01", ends_on: null, anchor_day: null,
    assigned_employee_id: EMPLOYEE, priority: "normal",
    enabled: true, last_issued_on: "2026-09-30",
    ...overrides
  };
}

function buildApp({
  templates = [template()],
  employees = [{ id: EMPLOYEE, display_name: "Dale", status: "active" }],
  templatesOk = true, employeesOk = true,
  taskStatus = 201,
  patchOk = true,
  organization = ORG
} = {}) {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  const authenticate = (req, res, next) => { req.sonaraUser = { id: USER, email: "owner@example.com" }; return next(); };

  const calls = [];
  global.fetch = async (url, init) => {
    const href = String(url);
    const method = String(init?.method || "GET").toUpperCase();
    const body = init?.body ? JSON.parse(init.body) : null;
    calls.push({ href, method, body });

    if (method === "GET") {
      if (href.includes("/business_recurring_tasks")) {
        return { ok: templatesOk, status: templatesOk ? 200 : 500, json: async () => templates };
      }
      if (href.includes("/business_employee_profiles")) {
        return { ok: employeesOk, status: employeesOk ? 200 : 500, json: async () => employees };
      }
      return { ok: true, status: 200, json: async () => [] };
    }
    if (method === "PATCH") {
      return { ok: patchOk, status: patchOk ? 204 : 500, json: async () => [] };
    }
    if (href.includes("/employee_tasks")) {
      const ok = taskStatus >= 200 && taskStatus < 300;
      return { ok, status: taskStatus, json: async () => (ok ? [{ id: "task-created" }] : null) };
    }
    return { ok: true, status: 201, json: async () => [{ id: "row" }] };
  };

  registerRecurringTaskRoutes(app, {
    layout: ({ title, eyebrow, heading, body, sections = [] }) =>
      `<html><title>${title}</title><p>${eyebrow}</p><h1>${heading}</h1><p>${body}</p>${sections.join("")}</html>`,
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

const taskWrites = (calls) => calls.filter((call) => call.method === "POST" && call.href.includes("/employee_tasks"));
const templateUpdates = (calls) => calls.filter((call) => call.method === "PATCH" && call.href.includes("/business_recurring_tasks"));

describe("work that comes round again comes round once", () => {
  let savedFetch;
  before(() => { savedFetch = global.fetch; });
  after(() => { global.fetch = savedFetch; });

  describe("the schema it writes to", () => {
    it("names only columns the tables actually have", () => {
      for (const [table, columns] of [
        ["business_recurring_tasks", [
          "organization_id", "title", "description", "cadence", "starts_on", "ends_on",
          "anchor_day", "assigned_employee_id", "priority", "enabled", "last_issued_on",
          "created_by", "created_at", "updated_at"
        ]],
        ["employee_tasks", [
          "organization_id", "assigned_employee_id", "created_by", "title",
          "description", "due_at", "priority", "status", "metadata"
        ]]
      ]) {
        for (const column of columns) {
          assert.ok(hasColumn(table, column), `${table}.${column} is written but no migration creates it`);
        }
      }
    });

    it("writes exactly the columns the engine produces, and no more", () => {
      // The populations have to match in both directions. A column on the task
      // the migrations do not have fails above; a column buildTask stopped
      // producing would leave the list here passing over nothing.
      const built = buildTask({ template: template(), issueOn: TODAY, organizationId: ORG, createdBy: USER });
      assert.ok(built.ok, built.reason);
      for (const column of Object.keys(built.task)) {
        assert.ok(hasColumn("employee_tasks", column), `buildTask writes employee_tasks.${column}, which no migration creates`);
      }
      assert.ok(Object.keys(built.task).length >= 8, "buildTask produced almost nothing; this check has gone blind");
    });
  });

  describe("the cadence arithmetic", () => {
    it("names every cadence it accepts, so none is outside these tests", () => {
      assert.deepEqual([...CADENCES].sort(), ["daily", "fortnightly", "monthly", "quarterly", "weekly", "yearly"].sort());
    });

    it("has daily, which the invoice engine deliberately does not", () => {
      const invoices = require("../lib/sonara-recurring-invoices.cjs");
      assert.ok(CADENCES.includes("daily"));
      assert.ok(!invoices.CADENCES.includes("daily"), "recurring_invoices gained a daily cadence; the reason these are two engines has gone");
    });

    it("does not let a monthly anchor walk out of February", () => {
      const monthly = template({ cadence: "monthly", starts_on: "2026-01-31", anchor_day: "31" });
      let at = "2026-01-31";
      const walk = [];
      for (let step = 0; step < 6; step += 1) {
        const next = nextOccurrence(monthly, { after: at });
        walk.push(next.date);
        at = next.date;
      }
      assert.deepEqual(walk, ["2026-02-28", "2026-03-31", "2026-04-30", "2026-05-31", "2026-06-30", "2026-07-31"]);
    });

    it("returns to the anchor in a leap year rather than staying clamped", () => {
      const yearly = template({ cadence: "yearly", starts_on: "2024-02-29", anchor_day: "29" });
      let at = "2024-02-29";
      const walk = [];
      for (let step = 0; step < 4; step += 1) {
        const next = nextOccurrence(yearly, { after: at });
        walk.push(next.date);
        at = next.date;
      }
      assert.deepEqual(walk, ["2025-02-28", "2026-02-28", "2027-02-28", "2028-02-29"]);
    });

    it("stops at the end date instead of running on", () => {
      const ending = template({ cadence: "weekly", starts_on: "2026-10-06", ends_on: "2026-10-10", last_issued_on: "2026-10-06" });
      assert.equal(nextOccurrence(ending).date, null);
      assert.match(nextOccurrence(ending).reason, /finished/i);
    });
  });

  describe("falling behind", () => {
    it("issues one task for the most recent day due, not one per day missed", () => {
      const behind = template({ cadence: "daily", last_issued_on: "2026-09-10" });
      const due = isDue(behind, { now: NOW });
      assert.equal(due.due, true);
      assert.equal(due.issueOn, TODAY, "a daily template behind by three weeks must land on today, not on 11 September");
      assert.equal(due.passedOver, 20);
    });

    it("says how many it passed over rather than swallowing them", () => {
      const due = isDue(template({ cadence: "daily", last_issued_on: "2026-09-10" }), { now: NOW });
      assert.match(due.reason, /20 earlier occurrences were passed over/);
    });

    it("keeps the weekday when it fast-forwards", () => {
      // 4 August 2026 is a Tuesday. Behind by three weeks, the occurrence it
      // lands on must still be a Tuesday -- which is what fast-forwarding
      // through real occurrences buys over jumping to today.
      const weekly = template({ cadence: "weekly", starts_on: "2026-08-04", last_issued_on: "2026-09-08" });
      const due = isDue(weekly, { now: NOW });
      assert.equal(due.issueOn, "2026-09-29");
      assert.equal(new Date(`${due.issueOn}T00:00:00.000Z`).getUTCDay(), 2, "the fast-forward moved off Tuesday");
    });

    it("keeps the month anchor when it fast-forwards", () => {
      const monthly = template({ cadence: "monthly", starts_on: "2026-01-31", anchor_day: "31", last_issued_on: "2026-04-30" });
      const due = isDue(monthly, { now: NOW });
      assert.equal(due.issueOn, "2026-09-30");
      assert.equal(due.passedOver, 4);
    });

    it("refuses rather than reporting a date that is not the latest, past the bound", () => {
      const ancient = template({ cadence: "daily", starts_on: "2000-01-01", last_issued_on: "2000-01-01" });
      const due = isDue(ancient, { now: NOW });
      assert.equal(due.due, false, "a template 9,000 occurrences behind must not report a date");
      assert.match(due.reason, new RegExp(String(FAST_FORWARD_LIMIT)));
      assert.match(due.reason, /too far to work out safely/);
    });

    it("has a bound no live template reaches", () => {
      assert.ok(FAST_FORWARD_LIMIT >= 3650, `the fast-forward bound is ${FAST_FORWARD_LIMIT}, under ten years of daily work`);
    });
  });

  describe("saying no with a reason", () => {
    it("never answers 'not due' without saying why", () => {
      for (const broken of [
        template({ cadence: "hourly" }),
        template({ starts_on: "not a date" }),
        template({ cadence: "monthly", anchor_day: "41" }),
        template({ enabled: false })
      ]) {
        const due = isDue(broken, { now: NOW });
        assert.equal(due.due, false);
        assert.ok(due.reason && due.reason.length > 10, `answered no with "${due.reason}"`);
      }
    });

    it("distinguishes not yet from cannot be read", () => {
      assert.match(isDue(template({ starts_on: "2026-12-01", last_issued_on: null }), { now: NOW }).reason, /Not yet/);
      assert.match(isDue(template({ cadence: "hourly" }), { now: NOW }).reason, /not a cadence/);
    });

    it("reports a bad date rather than treating it as no date at all", () => {
      const read = latestDue(template(), { now: new Date("not a date") });
      assert.equal(read.date, null);
      assert.match(read.reason, /current date could not be read/);
    });
  });

  describe("the task it produces", () => {
    it("writes the day in words as well as in the timestamp", () => {
      // The timestamp is midday UTC, which is the right calendar day from
      // UTC-12 through UTC+11 and a day late east of that. The sentence is right
      // everywhere, which is why it is there.
      const built = buildTask({ template: template(), issueOn: "2026-10-05", organizationId: ORG });
      assert.match(built.task.description, /Scheduled for 2026-10-05\./);
      assert.equal(built.task.due_at, "2026-10-05T12:00:00.000Z");
    });

    it("refuses a task with no business rather than writing an unowned row", () => {
      const built = buildTask({ template: { ...template(), organization_id: null }, issueOn: TODAY });
      assert.equal(built.ok, false);
      assert.match(built.reason, /belong to nobody/);
      assert.equal(built.task, null);
    });

    it("refuses a task with no title and a date that is not one", () => {
      assert.equal(buildTask({ template: template({ title: "   " }), issueOn: TODAY, organizationId: ORG }).ok, false);
      assert.equal(buildTask({ template: template(), issueOn: "the fifth", organizationId: ORG }).ok, false);
      assert.equal(buildTask({ template: template(), issueOn: null, organizationId: ORG }).ok, false);
    });

    it("carries the template's priority, and falls back rather than writing a word the column refuses", () => {
      assert.equal(buildTask({ template: template({ priority: "urgent" }), issueOn: TODAY, organizationId: ORG }).task.priority, "urgent");
      assert.equal(buildTask({ template: template({ priority: "catastrophic" }), issueOn: TODAY, organizationId: ORG }).task.priority, "normal");
      for (const priority of PRIORITIES) {
        assert.equal(buildTask({ template: template({ priority }), issueOn: TODAY, organizationId: ORG }).task.priority, priority);
      }
    });

    it("issues work for somebody who has left, unassigned, rather than dropping it", () => {
      const built = buildTask({ template: template({ assigned_employee_id: null }), issueOn: TODAY, organizationId: ORG });
      assert.equal(built.ok, true);
      assert.equal(built.task.assigned_employee_id, null);
    });

    it("links the task back to what made it", () => {
      const built = buildTask({ template: template(), issueOn: TODAY, organizationId: ORG });
      assert.equal(built.task.metadata.recurring_task_id, TEMPLATE);
      assert.equal(built.task.metadata.issued_for, TODAY);
    });
  });

  describe("reading a form", () => {
    it("accepts a usable template", () => {
      const read = normalizeTemplate({ title: "Deep clean", cadence: "weekly", starts_on: "2026-10-06", priority: "high" });
      assert.equal(read.ok, true);
      assert.equal(read.values.cadence, "weekly");
      assert.equal(read.values.enabled, true);
      assert.deepEqual(read.problems, []);
    });

    it("refuses with codes, never with sentences that could cross a redirect", () => {
      const read = normalizeTemplate({ title: "", cadence: "nope" });
      assert.equal(read.ok, false);
      for (const problem of read.problems) {
        assert.ok(PROBLEM_CODES.includes(problem), `"${problem}" is not a known problem code`);
        assert.ok(!/\s/.test(problem), `"${problem}" looks like a sentence rather than a code`);
      }
    });

    it("turns codes into sentences and drops anything it did not write", () => {
      assert.deepEqual(problemSentences(["no_title"]), [PROBLEMS.no_title]);
      // The attack the codes exist to stop: a crafted link carrying its own text.
      assert.deepEqual(problemSentences("Your account is suspended, ring 0800 123"), []);
      assert.deepEqual(problemSentences("no_title.<script>alert(1)</script>"), [PROBLEMS.no_title]);
      assert.deepEqual(problemSentences(["no_title", "no_title"]), [PROBLEMS.no_title], "a repeated code printed twice");
    });

    it("has a sentence for every code and a code for every sentence", () => {
      assert.ok(PROBLEM_CODES.length >= 10, `only ${PROBLEM_CODES.length} problem codes; this check has gone blind`);
      for (const code of PROBLEM_CODES) {
        assert.ok(PROBLEMS[code] && PROBLEMS[code].length > 10, `${code} has no usable sentence`);
      }
    });

    it("never refuses without a problem to read", () => {
      for (const input of [{}, { title: "x" }, { title: "x", cadence: "weekly" }, { title: "x", cadence: "nope", starts_on: "2026-10-06" }]) {
        const read = normalizeTemplate(input);
        assert.equal(read.ok, false);
        assert.ok(read.problems.length >= 1, `refused ${JSON.stringify(input)} with no reason`);
        assert.equal(read.values, null);
      }
    });

    it("says a day of the month does not apply to weekly work instead of ignoring it", () => {
      const read = normalizeTemplate({ title: "Clean", cadence: "weekly", starts_on: "2026-10-06", anchor_day: "15" });
      assert.equal(read.ok, false);
      assert.ok(read.problems.includes("anchor_not_applicable"));
    });

    it("refuses an end date before the start", () => {
      const read = normalizeTemplate({ title: "Clean", cadence: "weekly", starts_on: "2026-10-06", ends_on: "2026-10-01" });
      assert.equal(read.ok, false);
      assert.ok(read.problems.includes("end_before_start"));
    });

    it("never produces an anchor the column would refuse", () => {
      // The column's check constraint rejects a leading zero, and "01" is a day
      // somebody can reasonably type. Stored verbatim it produced "that did not
      // save" with nothing to read -- the save failed in the database, not in the
      // validator, so no problem code was ever generated. Found by reading the
      // migration against the engine rather than by a failing test.
      const accepted = [];
      for (let day = 1; day <= 31; day += 1) {
        for (const typed of [String(day), String(day).padStart(2, "0")]) {
          const read = normalizeTemplate({ title: "Count stock", cadence: "monthly", starts_on: "2026-10-01", anchor_day: typed });
          assert.equal(read.ok, true, `"${typed}" was refused by the validator`);
          assert.match(read.values.anchor_day, ANCHOR_DAY_PATTERN,
            `the validator accepted "${typed}" and produced "${read.values.anchor_day}", which the column's check constraint refuses`);
          accepted.push(typed);
        }
      }
      assert.equal(accepted.length, 62, "the loop stopped reading days; this check has gone blind");
      assert.match("last", ANCHOR_DAY_PATTERN);
      // And the pattern is the column's, not a second copy that could drift.
      const migration = require("node:fs").readFileSync(
        require("node:path").join(__dirname, "..", "supabase", "migrations", "20261001160000_work_that_comes_round_again.sql"),
        "utf8"
      );
      assert.ok(migration.includes(ANCHOR_DAY_PATTERN.source.replace(/\\/g, "")),
        `the migration no longer carries the pattern ${ANCHOR_DAY_PATTERN.source}; the engine and the column can now disagree`);
    });

    it("refuses a day of the month that is not one", () => {
      for (const typed of ["0", "32", "99", "last day", "1.5", "-1"]) {
        const read = normalizeTemplate({ title: "Count stock", cadence: "monthly", starts_on: "2026-10-01", anchor_day: typed });
        assert.equal(read.ok, false, `"${typed}" was accepted as a day of the month`);
        assert.ok(read.problems.includes("bad_anchor"), `"${typed}" was refused for the wrong reason: ${read.problems.join(",")}`);
      }
    });

    it("accepts the word last as a day of the month", () => {
      const read = normalizeTemplate({ title: "Count stock", cadence: "monthly", starts_on: "2026-10-31", anchor_day: "last" });
      assert.equal(read.ok, true);
      assert.equal(read.values.anchor_day, "last");
    });
  });

  describe("the page", () => {
    it("lists what is set up and what is due", async () => {
      const { app } = buildApp();
      const response = await request(app).get(PAGE);
      assert.equal(response.status, 200);
      assert.match(response.text, /Close the shop/);
      assert.match(response.text, /Dale/);
      assert.match(response.text, /Every day/);
    });

    it("never says you have none when the read failed", async () => {
      const { app } = buildApp({ templatesOk: false });
      const response = await request(app).get(PAGE);
      assert.equal(response.status, 200);
      assert.match(response.text, /could not read your recurring work/i);
      assert.ok(!/have not set any up yet/i.test(response.text), "a failed read was reported as an empty list");
    });

    it("says you have none only when the read succeeded and was empty", async () => {
      const { app } = buildApp({ templates: [] });
      const response = await request(app).get(PAGE);
      assert.match(response.text, /have not set any up yet/i);
    });

    it("says so rather than offering an empty assignee list when employees cannot be read", async () => {
      const { app } = buildApp({ employeesOk: false });
      const response = await request(app).get(PAGE);
      assert.match(response.text, /could not read your employee list/i);
    });

    it("will not print text a crafted link supplied", async () => {
      // The page is behind requireBusinessManager, so the reader is the signed-in
      // owner and the address is the real one. Text of an attacker's choosing in a
      // card here would read as a product message, which is why the redirect
      // carries codes and the sentences live in the engine.
      const { app } = buildApp();
      const response = await request(app)
        .get(`${PAGE}?problem=invalid&why=${encodeURIComponent("Your account is suspended, ring 0800 123 4567")}`);
      assert.equal(response.status, 200);
      assert.ok(!/0800 123 4567/.test(response.text), "a crafted link put its own text on the page");
      assert.ok(!/suspended/i.test(response.text), "a crafted link put its own text on the page");
      assert.match(response.text, /could not be set up/i, "the refusal notice itself stopped appearing");
    });

    it("prints the engine's own sentence for a code it recognises", async () => {
      const { app } = buildApp();
      const response = await request(app).get(`${PAGE}?problem=invalid&why=no_title`);
      assert.match(response.text, /Give this a name/);
    });

    it("does not claim the jobs it cannot show are still being issued", async () => {
      // The first version of this card said the rest "still run and are still
      // counted when you press the button". The button reads the newest first
      // under the same cap, so they are not. A notice that is wrong is worse than
      // no notice: it is what somebody reads instead of checking.
      const many = Array.from({ length: 201 }, (unused, index) => template({ id: `d4d4d4d4-0000-4000-8000-${String(index).padStart(12, "0")}` }));
      const { app } = buildApp({ templates: many });
      const response = await request(app).get(PAGE);
      assert.match(response.text, /More than this page shows/i);
      assert.ok(!/are still counted when you press the button/.test(response.text),
        "the page claims unshown jobs are still issued, which the run cap makes false");
      assert.match(response.text, /also not issued/i);
    });

    it("says a name was not read rather than that somebody has left, past the employee cap", async () => {
      // "Somebody no longer on file" is a definite statement about a business's
      // own staff. Past the cap it would be printed about people who are still
      // employed, on the strength of a read that was cut short.
      const crowd = Array.from({ length: 501 }, (unused, index) => ({
        id: `c3c3c3c3-0000-4000-8000-${String(index).padStart(12, "0")}`,
        display_name: `Person ${index}`,
        status: "active"
      }));
      const { app } = buildApp({ employees: crowd });
      const response = await request(app).get(PAGE);
      assert.match(response.text, /More employees than this page reads/i);
      assert.match(response.text, /a name this page did not read/i);
      assert.ok(!/somebody no longer on file/i.test(response.text),
        "a truncated employee read reported a current employee as having left");
    });

    it("refuses to render figures for a workspace it cannot resolve", async () => {
      const { app } = buildApp({ organization: null });
      const response = await request(app).get(PAGE);
      assert.equal(response.status, 503);
      assert.match(response.text, /could not be read/i);
    });

    it("reads every column the engine needs to work out a date", async () => {
      const { app, calls } = buildApp();
      await request(app).get(PAGE);
      const read = calls.find((call) => call.method === "GET" && call.href.includes("/business_recurring_tasks"));
      assert.ok(read, "the page did not read its own table");
      const selected = decodeURIComponent(read.href).split("select=")[1].split("&")[0].split(",");
      for (const column of ["cadence", "starts_on", "ends_on", "anchor_day", "enabled", "last_issued_on", "title", "priority", "organization_id"]) {
        assert.ok(selected.includes(column), `${column} decides what the page prints or what is due, and is not selected`);
      }
      assert.ok(selected.length >= 9, `only ${selected.length} columns selected; this check has gone blind`);
    });

    it("asks for the same columns on the page as it does when issuing", async () => {
      // The reason the column list is a shared constant rather than a literal in
      // both places, and the reason scripts/report-unused-selected-columns.mjs
      // records these two as computed. If the run read lost anchor_day, nothing
      // would error: nextOccurrence would fall back to the day starts_on carries,
      // compute a different date from the one the page showed, and issue a task
      // for it.
      const pageCalls = buildApp();
      await request(pageCalls.app).get(PAGE);
      const runCalls = buildApp();
      await request(runCalls.app).post("/api/business/recurring-work/run").send({});

      const selectOf = (calls) => {
        const read = calls.find((call) => call.method === "GET" && call.href.includes("/business_recurring_tasks"));
        assert.ok(read, "no read of the template table was made");
        return decodeURIComponent(read.href).split("select=")[1].split("&")[0].split(",").sort();
      };
      assert.deepEqual(selectOf(runCalls.calls), selectOf(pageCalls.calls),
        "the page and the run button ask for different columns; one of them can now compute a date the other did not show");
    });
  });

  describe("pressing the button", () => {
    it("creates one task for a due template, carrying the business", async () => {
      const { app, calls } = buildApp();
      const response = await request(app).post("/api/business/recurring-work/run").send({});
      assert.equal(response.status, 303);
      assert.equal(response.headers.location, `${PAGE}?done=1`);
      const writes = taskWrites(calls);
      assert.equal(writes.length, 1);
      assert.equal(writes[0].body.organization_id, ORG);
      assert.equal(writes[0].body.status, "todo");
    });

    it("creates one task, for today, not one per day missed", async () => {
      // The count alone cannot fail on the bug this names: one press writes one
      // task whether the engine fast-forwards or steps a single occurrence. So
      // the day on the task is asserted too -- a template three weeks behind
      // that produces a task dated 11 September is the stepping bug, and the
      // count would have passed over it. Found by breaking the engine and
      // watching this test stay green.
      const { app, calls } = buildApp({ templates: [template({ cadence: "daily", last_issued_on: "2026-09-10" })] });
      await request(app).post("/api/business/recurring-work/run").send({});
      const writes = taskWrites(calls);
      assert.equal(writes.length, 1, "a template three weeks behind produced more than one task");
      assert.equal(writes[0].body.due_at, `${TODAY}T12:00:00.000Z`, "the task was dated the first missed day rather than the most recent one");
      assert.equal(writes[0].body.metadata.issued_for, TODAY);
      assert.match(writes[0].body.description, new RegExp(`Scheduled for ${TODAY}`));
    });

    it("moves the template on only after the task exists", async () => {
      const { app, calls } = buildApp({ taskStatus: 500 });
      const response = await request(app).post("/api/business/recurring-work/run").send({});
      assert.equal(templateUpdates(calls).length, 0, "the template advanced past an occurrence that produced no task");
      assert.match(response.headers.location, /problem=partial/);
    });

    it("records the occurrence it issued, not the day it was pressed", async () => {
      const { app, calls } = buildApp({ templates: [template({ cadence: "weekly", starts_on: "2026-08-04", last_issued_on: "2026-09-08" })] });
      await request(app).post("/api/business/recurring-work/run").send({});
      const patched = templateUpdates(calls);
      assert.equal(patched.length, 1);
      assert.equal(patched[0].body.last_issued_on, "2026-09-29");
    });

    it("scopes every write to the business, because the service key bypasses row level security", async () => {
      const { app, calls } = buildApp();
      await request(app).post("/api/business/recurring-work/run").send({});
      for (const call of calls.filter((entry) => entry.method === "PATCH")) {
        assert.ok(call.href.includes(`organization_id=eq.${ORG}`), `a PATCH went out without the organization filter: ${call.href}`);
      }
      for (const call of calls.filter((entry) => entry.method === "GET")) {
        assert.ok(call.href.includes("organization_id=eq."), `a read went out without the organization filter: ${call.href}`);
      }
    });

    it("reports a task it created but could not record, rather than counting it as a refusal", async () => {
      // Counting it as a refusal made the page say "0 tasks created" while a task
      // sat on somebody's list -- wrong in the direction that makes a business
      // press the button again and create it twice.
      const { app, calls } = buildApp({ patchOk: false });
      const response = await request(app).post("/api/business/recurring-work/run").send({});
      assert.equal(taskWrites(calls).length, 1, "the task was not created");
      assert.match(response.headers.location, /problem=unrecorded/);
      assert.match(response.headers.location, /done=1/, "a created task was not counted");
    });

    it("warns on the page that pressing again would duplicate an unrecorded task", async () => {
      const { app } = buildApp();
      const response = await request(app).get(`${PAGE}?done=1&unrecorded=1&problem=unrecorded`);
      assert.match(response.text, /before pressing this again/i);
      assert.match(response.text, /second time/i);
    });

    it("says so when there is more switched on than one press can work through", async () => {
      const many = Array.from({ length: 201 }, (unused, index) => template({ id: `d4d4d4d4-0000-4000-8000-${String(index).padStart(12, "0")}` }));
      const { app, calls } = buildApp({ templates: many });
      const response = await request(app).post("/api/business/recurring-work/run").send({});
      assert.equal(taskWrites(calls).length, 200, `issued ${taskWrites(calls).length} tasks; the cap was not applied`);
      assert.match(response.headers.location, /unseen=1/, "the run issued for a capped list without saying so");
    });

    it("tells the business on the page that not everything was looked at", async () => {
      const { app } = buildApp();
      const response = await request(app).get(`${PAGE}?done=200&unseen=1&problem=unseen`);
      assert.match(response.text, /Not everything was looked at/i);
      assert.match(response.text, /Pressing again reads the same ones/i);
    });

    it("creates nothing when nothing is due, and says so", async () =>{
      const { app, calls } = buildApp({ templates: [template({ last_issued_on: TODAY })] });
      const response = await request(app).post("/api/business/recurring-work/run").send({});
      assert.equal(taskWrites(calls).length, 0);
      assert.match(response.headers.location, /problem=nothing_due/);
    });

    it("does not report nothing due when the read failed", async () => {
      const { app, calls } = buildApp({ templatesOk: false });
      const response = await request(app).post("/api/business/recurring-work/run").send({});
      assert.equal(taskWrites(calls).length, 0);
      assert.match(response.headers.location, /problem=not_saved/);
      assert.ok(!/nothing_due/.test(response.headers.location), "a failed read was reported as nothing being due");
    });

    it("skips a template that is switched off", async () => {
      const { app, calls } = buildApp({ templates: [template({ enabled: false })] });
      await request(app).post("/api/business/recurring-work/run").send({});
      assert.equal(taskWrites(calls).length, 0);
    });
  });

  describe("switching one off and on", () => {
    it("switches off by id and by business together", async () => {
      const { app, calls } = buildApp();
      const response = await request(app).post("/api/business/recurring-work/disable").send({ id: TEMPLATE });
      assert.equal(response.headers.location, PAGE);
      const patched = templateUpdates(calls);
      assert.equal(patched.length, 1);
      assert.equal(patched[0].body.enabled, false);
      assert.ok(patched[0].href.includes(`id=eq.${TEMPLATE}`));
      assert.ok(patched[0].href.includes(`organization_id=eq.${ORG}`), "an id from a form body was trusted on its own");
    });

    it("switches back on", async () => {
      const { app, calls } = buildApp();
      await request(app).post("/api/business/recurring-work/enable").send({ id: TEMPLATE });
      assert.equal(templateUpdates(calls)[0].body.enabled, true);
    });

    it("never writes somebody else's organization onto the filter", async () => {
      const { app, calls } = buildApp({ organization: OTHER_ORG });
      await request(app).post("/api/business/recurring-work/disable").send({ id: TEMPLATE });
      assert.ok(templateUpdates(calls)[0].href.includes(`organization_id=eq.${OTHER_ORG}`));
      assert.ok(!templateUpdates(calls)[0].href.includes(ORG));
    });

    it("refuses an id that is not one without touching the database", async () => {
      const { app, calls } = buildApp();
      const response = await request(app).post("/api/business/recurring-work/disable").send({ id: "../../etc/passwd" });
      assert.equal(templateUpdates(calls).length, 0);
      assert.match(response.headers.location, /problem=not_saved/);
    });
  });

  describe("setting one up", () => {
    it("saves a usable template against the business", async () => {
      const { app, calls } = buildApp();
      const response = await request(app).post("/api/business/recurring-work")
        .send({ title: "Deep clean", cadence: "weekly", starts_on: "2026-10-06", priority: "high" });
      assert.equal(response.headers.location, PAGE);
      const created = calls.find((call) => call.method === "POST" && call.href.includes("/business_recurring_tasks"));
      assert.ok(created, "nothing was written");
      assert.equal(created.body.organization_id, ORG);
      assert.equal(created.body.created_by, USER);
      assert.equal(created.body.title, "Deep clean");
    });

    it("sends the reason back to the page instead of saving something unusable", async () => {
      const { app, calls } = buildApp();
      const response = await request(app).post("/api/business/recurring-work").send({ title: "", cadence: "weekly" });
      assert.equal(calls.filter((call) => call.method === "POST" && call.href.includes("/business_recurring_tasks")).length, 0);
      assert.match(response.headers.location, /problem=invalid&why=/);
      assert.match(response.headers.location, /no_title/);
      assert.ok(!/Give this a name/.test(decodeURIComponent(response.headers.location)),
        "the sentence crossed the redirect; only codes should");
    });

    it("refuses an employee id that is not one", async () => {
      const { app, calls } = buildApp();
      const response = await request(app).post("/api/business/recurring-work")
        .send({ title: "Clean", cadence: "weekly", starts_on: "2026-10-06", assigned_employee_id: "not-a-uuid" });
      assert.equal(calls.filter((call) => call.method === "POST" && call.href.includes("/business_recurring_tasks")).length, 0);
      assert.match(response.headers.location, /why=unknown_employee/);
    });

    it("tells the business it did not save rather than redirecting as if it had", async () => {
      const { app } = buildApp({ organization: ORG });
      global.fetch = async (url, init) => {
        if (String(init?.method || "GET").toUpperCase() === "POST") return { ok: false, status: 500, json: async () => null };
        return { ok: true, status: 200, json: async () => [] };
      };
      const response = await request(app).post("/api/business/recurring-work")
        .send({ title: "Clean", cadence: "weekly", starts_on: "2026-10-06" });
      assert.match(response.headers.location, /problem=not_saved/);
    });
  });

  describe("what the sentence on the page says", () => {
    it("describes every cadence in words", () => {
      for (const cadence of CADENCES) {
        const sentence = describeTemplate(template({ cadence, starts_on: "2026-10-06", anchor_day: null }));
        assert.ok(sentence.length > 5 && !/undefined/.test(sentence), `${cadence} described as "${sentence}"`);
      }
    });

    it("says which weekday a weekly template falls on", () => {
      assert.match(describeTemplate(template({ cadence: "weekly", starts_on: "2026-10-06" })), /Tuesday/);
    });

    it("says the last day of the month rather than a number for a last anchor", () => {
      assert.match(describeTemplate(template({ cadence: "monthly", starts_on: "2026-01-31", anchor_day: "last" })), /last day/);
    });

    it("says when it is switched off", () => {
      assert.match(describeTemplate(template({ enabled: false })), /switched off/);
    });

    it("says it will not come round when the cadence cannot be read", () => {
      assert.match(describeTemplate(template({ cadence: "hourly" })), /will not come round/);
    });
  });
});
