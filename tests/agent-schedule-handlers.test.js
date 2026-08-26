"use strict";

// The agents that run on a schedule, and the two ways they lie.
//
// **A menu entry with nothing behind it.** /owner/agent-schedule offered five
// jobs a customer could put on a timer. One had a handler. The other four ran
// every week, answered `unimplemented`, and wrote that answer to a table the
// customer does not read -- so the product appeared to be working for them and
// was not. The first test here pairs the menu against the handler registry and
// fails if they disagree in either direction.
//
// **A clean report issued by a broken connection.** Every handler reads
// PostgREST. A read that fails and is treated as an empty list turns "the
// database was unreachable" into "you have no overdue invoices", which is the
// single most reassuring way for any of this to be wrong. The rest of the tests
// drive each handler with a fetch that fails and assert it either counts the
// failure or refuses, and never reports a clean result.
//
// No network and no database: fetch is replaced for the duration of each test.

const assert = require("node:assert/strict");
const register = require("../routes/sonara-agent-activity-routes.cjs");
const { createRunner } = require("../lib/sonara-agent-runner.cjs");
const { SELF_SERVE_ACTIONS } = require("../lib/sonara-agent-authority.cjs");

const CONFIG = { ok: true, url: "https://example.invalid", serviceRoleKey: "test-key" };
const CONTEXT = { config: CONFIG, organizationId: "11111111-1111-4111-8111-111111111111" };

function buildRunner() {
  const runner = createRunner({});
  register.registerApprovedHandlers(runner, { supabaseHeaders: () => ({}) });
  return runner;
}

// Every request fails. Nothing distinguishes "no rows" from "no answer" more
// sharply than a handler that has never had a successful read.
function withFailingFetch(run) {
  const original = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("network is down"); };
  return Promise.resolve()
    .then(run)
    .finally(() => { globalThis.fetch = original; });
}

describe("the agents that run on a schedule", () => {
  it("has a handler for every job the schedule page offers", () => {
    const runner = buildRunner();
    const registered = new Set(runner.registered());
    const offered = register.SCHEDULABLE.map((entry) => entry.action);

    assert.ok(offered.length > 0, "the schedule page offers nothing, so this test would pass by being empty");

    for (const action of offered) {
      assert.ok(
        registered.has(action),
        `/owner/agent-schedule offers "${action}" and nothing implements it, so every run of it reports unimplemented to a customer who chose it`
      );
    }
  });

  it("offers only jobs that are allowed to run unattended", () => {
    const allowed = new Set(SELF_SERVE_ACTIONS.map((entry) => entry.action));
    assert.ok(allowed.size > 0, "the self-serve list is empty, so this test would pass by being empty");
    for (const entry of register.SCHEDULABLE) {
      assert.ok(
        allowed.has(entry.action),
        `${entry.action} is on the schedule menu and is not on the self-serve list, so scheduling it would put an approval in front of the owner every period`
      );
    }
  });

  it("gives each offered job a label that is not its action name", () => {
    for (const entry of register.SCHEDULABLE) {
      assert.notEqual(entry.label, entry.action, `${entry.action} is offered to a customer under its internal name`);
      assert.ok(String(entry.label || "").trim().length > 3, `${entry.action} has no readable label`);
    }
  });

  describe("when nothing can be read", () => {
    it("suggest_next_step counts what it could not read instead of clearing the owner", async () => {
      const runner = buildRunner();
      await withFailingFetch(async () => {
        const result = await runner.registered().includes("suggest_next_step")
          ? runner.run({ action: { action_type: "suggest_next_step" }, context: CONTEXT })
          : null;
        const run = await result;
        assert.equal(run.status, "completed");
        assert.equal(run.result.suggestion, null, "it found nothing, which is true");
        assert.ok(run.result.unreadable > 0, "and it must say it read nothing, or 'no suggestion' reads as 'all clear'");
        assert.equal(run.result.checked, 0, "nothing was checked, so the checked count must be zero rather than the full list");
      });
    });

    it("prepare_report counts unreadable stages rather than reporting an empty funnel", async () => {
      const runner = buildRunner();
      await withFailingFetch(async () => {
        const run = await runner.run({ action: { action_type: "prepare_report" }, context: CONTEXT });
        assert.equal(run.status, "completed");
        assert.ok(run.result.unreadable > 0, "every stage failed and the report must say so");
        assert.equal(run.result.total, 0);
      });
    });

    it("summarise_records counts unreadable tables rather than reporting zero rows", async () => {
      const runner = buildRunner();
      await withFailingFetch(async () => {
        const run = await runner.run({ action: { action_type: "summarise_records" }, context: CONTEXT });
        assert.equal(run.status, "completed");
        assert.ok(run.result.unreadable > 0, "no table answered and the count must say so");
        assert.equal(run.result.tables, 0, "no table was counted, so none may be reported as counted");
      });
    });

    it("check_data_quality counts unreadable tables rather than reporting no problems", async () => {
      const runner = buildRunner();
      await withFailingFetch(async () => {
        const run = await runner.run({ action: { action_type: "check_data_quality" }, context: CONTEXT });
        assert.equal(run.status, "completed");
        assert.ok(run.result.unreadable > 0, "nothing was readable and the result must say so");
        assert.equal(run.result.problems, 0);
      });
    });

    it("draft_reply refuses rather than reporting that nothing needs chasing", async () => {
      const runner = buildRunner();
      await withFailingFetch(async () => {
        const run = await runner.run({ action: { action_type: "draft_reply" }, context: CONTEXT });
        // A failed run, not a completed one with zero drafts. Chasing is the one
        // job here where a wrong answer reaches a customer of the customer, so
        // it refuses on an unreadable read instead of counting it.
        assert.equal(run.status, "failed", "an unreadable invoice list must fail, not produce zero drafts");
        assert.match(String(run.reason), /could not be read/);
      });
    });
  });

  describe("when the payment records are missing", () => {
    it("draft_reply refuses rather than chasing an invoice that may be paid", async () => {
      const runner = buildRunner();
      const original = globalThis.fetch;
      // Invoices and customers read fine; the payments table does not. Reading
      // that as "nothing has been paid" would send a chaser for money already
      // received, which is worse than sending nothing.
      globalThis.fetch = async (url) => {
        if (String(url).includes("customer_invoice_payments")) throw new Error("no");
        return { ok: true, json: async () => [], headers: { get: () => null } };
      };
      try {
        const run = await runner.run({ action: { action_type: "draft_reply" }, context: CONTEXT });
        assert.equal(run.status, "failed");
        assert.match(String(run.reason), /already been paid/);
      } finally {
        globalThis.fetch = original;
      }
    });
  });

  describe("when a table answers without a count", () => {
    it("summarise_records treats a missing content-range as unread, not as zero rows", async () => {
      const runner = buildRunner();
      const original = globalThis.fetch;
      // PostgREST answers 200 and omits the range header when the Prefer was
      // not honoured. Number(undefined) is NaN, and the trap this guards is the
      // one where NaN or an absent header becomes 0.
      globalThis.fetch = async () => ({ ok: true, json: async () => [], headers: { get: () => null } });
      try {
        const run = await runner.run({ action: { action_type: "summarise_records" }, context: CONTEXT });
        assert.equal(run.status, "completed");
        assert.equal(run.result.tables, 0, "a table with no count must not be recorded as a table with zero rows");
        assert.ok(run.result.unreadable > 0);
      } finally {
        globalThis.fetch = original;
      }
    });

    it("summarise_records reports the count when the range header carries one", async () => {
      const runner = buildRunner();
      const original = globalThis.fetch;
      globalThis.fetch = async () => ({ ok: true, json: async () => [], headers: { get: () => "0-0/7" } });
      try {
        const run = await runner.run({ action: { action_type: "summarise_records" }, context: CONTEXT });
        assert.equal(run.status, "completed");
        assert.equal(run.result.unreadable, 0);
        assert.ok(run.result.tables > 0, "the tables must be counted, or the test above passes for the wrong reason");
        assert.equal(run.result.rows, run.result.tables * 7);
      } finally {
        globalThis.fetch = original;
      }
    });
  });
});
