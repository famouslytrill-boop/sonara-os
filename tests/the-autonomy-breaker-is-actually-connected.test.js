"use strict";

// The breaker was written, tested, documented at length, and wired to nothing.
//
// `evaluateAutonomyBreaker` reads an agent's recent outcomes and demotes an agent
// that keeps failing. `createActionHistoryReader` reads those outcomes out of
// agent_action_logs. Every test for the breaker injected a reader straight into
// `createRunner`, so the gate was proven to work WHEN GIVEN HISTORY -- and
// nothing anywhere asserted that the application gives it any.
//
// It did not. routes/sonara-agent-activity-routes.cjs built its runner with
// `record` and `publishEvent` and no `readHistory`; the assistant routes passed
// neither. So on every unattended run the breaker received null, returned
// "unavailable", left the classification untouched, and the action ran. The one
// line that would have said the safety check was blind was suppressed by
// `typeof readHistory === "function"` -- a condition that is false precisely when
// the check is unwired.
//
// A gate nobody connected is indistinguishable from a gate that keeps passing.
// This file is the difference: it drives the real Express route, with a database
// stub that answers the history read, and asserts the outcome CHANGES with the
// history. Nothing here injects a reader. If the wiring is removed, these fail.
//
// The same read now feeds the volume cap in lib/sonara-agent-limits.cjs, which
// answers the question the breaker cannot: an agent whose every run succeeds can
// loop ten thousand times and the breaker stays green, because nothing failed.

const assert = require("node:assert/strict");
const request = require("supertest");

const SUPABASE_ENV = Object.freeze({
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.stub-anon-for-breaker-wiring",
  SUPABASE_SERVICE_ROLE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.stub-service-for-breaker-wiring"
});
const original = Object.fromEntries(Object.keys(SUPABASE_ENV).map((key) => [key, process.env[key]]));
for (const [key, value] of Object.entries(SUPABASE_ENV)) process.env[key] = process.env[key] || value;

const app = require("../server");
const { CUSTOMER_SESSION_COOKIE } = require("../lib/sonara-customer-auth.cjs");
const { BREAKER_WINDOW, BREAKER_FAILURES, BREAKER_RECENCY_DAYS } = require("../lib/sonara-agent-authority.cjs");
const {
  LIMIT_WINDOW_MINUTES,
  MAX_UNATTENDED_RUNS_PER_WINDOW,
  MAX_UNATTENDED_RUNS_PER_ACTION_PER_WINDOW
} = require("../lib/sonara-agent-limits.cjs");

const USER = { id: "33333333-3333-4333-8333-333333333333", email: "owner@example.com" };
const ORGANIZATION_ID = "44444444-4444-4444-8444-444444444444";

// On the self-serve allowlist, so the only thing that can refuse it is a gate
// reading history. A gated action would be refused anyway and prove nothing.
const SELF_SERVE = "summarise_records";

const json = (body, status = 200) => ({ ok: status < 400, status, headers: { get: () => null }, json: async () => body });

const minutesAgo = (minutes) => new Date(Date.now() - minutes * 60000).toISOString();
const daysAgo = (days) => new Date(Date.now() - days * 86400000).toISOString();

function historyRows({ count, result, at, action = SELF_SERVE }) {
  return Array.from({ length: count }, () => ({ result, created_at: at, action }));
}

// The history read this is all about, kept honest about the filters the real
// query carries. A stub that answered every read with the same rows would pass
// these assertions while the live query asked for a different population --
// agent_key and approval_state are what make the counted set "this agent's
// unattended runs", and a stub ignoring them would hide a wiring mistake in
// exactly the place this file exists to check.
function stubFetch({ history = [], seen = [] } = {}) {
  return async (url, options = {}) => {
    const target = String(url);
    const method = (options.method || "GET").toUpperCase();
    if (target.includes("/auth/v1/user")) return json(USER);
    if (target.includes("/rest/v1/rpc/")) return json({});
    if (!target.includes("/rest/v1/")) return undefined;
    const table = (target.split("/rest/v1/")[1] || "").split("?")[0];

    if (table === "organization_memberships") {
      return json([{ organization_id: ORGANIZATION_ID, user_id: USER.id, role: "owner", status: "active" }]);
    }
    if (table === "business_memberships") {
      return json([{ id: "m", organization_id: ORGANIZATION_ID, workspace_id: "w", role: "owner", status: "active" }]);
    }
    if (table === "organizations") return json([{ id: ORGANIZATION_ID, name: "Breaker Ltd" }]);
    if (table === "billing_entitlements") {
      const asked = decodeURIComponent((target.match(/entitlement_key=in\.\(([^)]*)\)/) || ["", ""])[1]).split(",").filter(Boolean);
      return json(asked[0] ? [{ entitlement_key: asked[0], status: "active" }] : []);
    }

    if (table === "agent_action_logs") {
      if (method === "GET") {
        seen.push({ target });
        return json(history);
      }
      return json([], 201);
    }
    if (table === "agent_pending_actions") {
      if (method === "POST") return json([{ id: "99999999-9999-4999-8999-999999999999" }], 201);
      return json([]);
    }
    return json([]);
  };
}

const auth = (req) => req.set("Cookie", `${CUSTOMER_SESSION_COOKIE}=stub`);
const propose = (actionType) =>
  auth(request(app).post("/api/agents/queue/propose"))
    .set("Accept", "application/json")
    .type("json")
    .send({ action_type: actionType })
    .redirects(0);

describe("the autonomy breaker is actually connected", () => {
  let realFetch;
  let seen;

  beforeEach(() => {
    // Set per test, not once at module load, and the difference is a real
    // failure rather than caution. Mocha loads every spec file before running
    // any, and another file's `after()` restores the Supabase variables to what
    // they were when IT loaded -- which is to say it deletes them. These tests
    // sort after that file, so with the assignment only at load time they ran
    // against an unconfigured server, `getSupabaseServerConfig()` returned
    // { ok: false }, every propose answered 503, and the suite reported "no
    // history read was made" -- a true sentence about the wrong cause.
    for (const [key, value] of Object.entries(SUPABASE_ENV)) process.env[key] = value;
    realFetch = global.fetch;
    seen = [];
  });
  afterEach(() => { global.fetch = realFetch; });
  after(() => {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  describe("the history read happens at all", () => {
    it("reads the action log before running an unattended action", async () => {
      global.fetch = stubFetch({ history: [], seen });
      const response = await propose(SELF_SERVE);
      // Checked first, because "no history read" is also what a 503 looks like,
      // and the two have completely different causes.
      assert.equal(response.status, 200, `the request never reached the runner: ${response.status} ${JSON.stringify(response.body)}`);
      assert.ok(seen.length >= 1, "no history read was made; the breaker and the volume cap both evaluate nothing without one");
    });

    it("asks for this agent's own unattended runs, not everything in the table", async () => {
      global.fetch = stubFetch({ history: [], seen });
      await propose(SELF_SERVE);
      const read = decodeURIComponent(seen[0].target);
      assert.match(read, /organization_id=eq\./, "the history read is not scoped to an organization");
      assert.match(read, /agent_key=eq\.owner_queue/, "the history read does not name the agent whose record it is judging");
      assert.match(read, /approval_state=eq\.not_required/, "the history read counts approved runs as unattended ones");
      assert.match(read, /created_at/, "the history read does not ask for the timestamp the recency bound and the volume cap need");
      assert.match(read, /\baction\b/, "the history read does not ask for the action type the per-action cap counts");
    });

    it("uses the same agent key to read as the recorder uses to write", () => {
      // A mismatch here reads a population this runner never writes to, so the
      // record would be permanently clean and the gate permanently green. The
      // two strings live in one function and are checked rather than trusted.
      const source = require("node:fs").readFileSync(
        require("node:path").join(__dirname, "..", "routes", "sonara-agent-activity-routes.cjs"),
        "utf8"
      );
      const start = source.indexOf("function queueRunner");
      assert.ok(start > 0, "queueRunner is gone; this check is reading nothing");
      const block = source.slice(start, source.indexOf("return runner;", start));
      const keys = [...block.matchAll(/agentKey:\s*"([^"]+)"/g)].map((match) => match[1]);
      assert.ok(keys.length >= 2, `expected a recorder and a reader to both name an agentKey, found ${keys.length}`);
      assert.equal(new Set(keys).size, 1, `the recorder and the reader use different agent keys: ${keys.join(", ")}`);
    });
  });

  describe("a failing agent is actually demoted", () => {
    it("refuses an unattended action when the agent's recent record is bad", async () => {
      // THE test. With the reader unwired this returns queued:false status:completed,
      // because the breaker never sees the three failures it exists to catch.
      global.fetch = stubFetch({
        history: [
          ...historyRows({ count: BREAKER_FAILURES, result: "failed", at: minutesAgo(10) }),
          ...historyRows({ count: BREAKER_WINDOW - BREAKER_FAILURES, result: "completed", at: minutesAgo(20) })
        ]
      });
      const response = await propose(SELF_SERVE);
      assert.equal(response.status, 200);
      assert.equal(response.body.queued, true, "a self-serve action ran despite the agent's recent failures");
      // The category names which gate refused, so this cannot pass on a refusal
      // from some other rule.
      assert.equal(response.body.category, "demoted_after_failures");
      assert.match(String(response.body.reason), /failed/i);
    });

    it("runs the same action when the recent record is clean", async () => {
      global.fetch = stubFetch({ history: historyRows({ count: BREAKER_WINDOW, result: "completed", at: minutesAgo(10) }) });
      const response = await propose(SELF_SERVE);
      assert.equal(response.body.status, "completed", `a clean record was refused: ${response.body.reason}`);
      assert.equal(response.body.queued, false);
    });

    it("stops counting failures older than the recency bound", async () => {
      // The correction the dropped timestamp made impossible. An organization
      // that failed three times months ago and has barely run since was demoted
      // for as long as those rows stayed inside its last ten.
      global.fetch = stubFetch({
        history: [
          ...historyRows({ count: BREAKER_FAILURES, result: "failed", at: daysAgo(BREAKER_RECENCY_DAYS + 90) }),
          ...historyRows({ count: BREAKER_WINDOW - BREAKER_FAILURES, result: "completed", at: daysAgo(BREAKER_RECENCY_DAYS + 90) })
        ]
      });
      const response = await propose(SELF_SERVE);
      assert.equal(response.body.status, "completed", "failures from months ago still demoted the agent");
    });

    it("still counts failures inside the recency bound", async () => {
      global.fetch = stubFetch({
        history: [
          ...historyRows({ count: BREAKER_FAILURES, result: "failed", at: daysAgo(Math.max(1, BREAKER_RECENCY_DAYS - 2)) }),
          ...historyRows({ count: BREAKER_WINDOW - BREAKER_FAILURES, result: "completed", at: daysAgo(1) })
        ]
      });
      const response = await propose(SELF_SERVE);
      assert.equal(response.body.queued, true, "a failure just inside the window stopped counting");
      assert.equal(response.body.category, "demoted_after_failures");
    });
  });

  describe("an agent doing too much is held, even with nothing failing", () => {
    it("holds an unattended action at the volume cap", async () => {
      // Every row completed. The breaker is green and must stay green; this is
      // the question it cannot answer.
      global.fetch = stubFetch({
        history: historyRows({ count: MAX_UNATTENDED_RUNS_PER_WINDOW, result: "completed", at: minutesAgo(5), action: "other_action" })
      });
      const response = await propose(SELF_SERVE);
      assert.equal(response.body.queued, true, `${MAX_UNATTENDED_RUNS_PER_WINDOW} successful runs in an hour did not reach the cap`);
      assert.equal(response.body.category, "held_at_volume_limit", "the hold was attributed to the wrong gate");
      assert.match(String(response.body.reason), /Nothing has failed/i, "the owner is told this is a failure when it is a volume hold");
    });

    it("holds one action type repeating, below the overall cap", async () => {
      global.fetch = stubFetch({
        history: historyRows({ count: MAX_UNATTENDED_RUNS_PER_ACTION_PER_WINDOW, result: "completed", at: minutesAgo(5), action: SELF_SERVE })
      });
      const response = await propose(SELF_SERVE);
      assert.ok(MAX_UNATTENDED_RUNS_PER_ACTION_PER_WINDOW < MAX_UNATTENDED_RUNS_PER_WINDOW, "the per-action cap is not the tighter one");
      assert.equal(response.body.queued, true, "one action repeating past its own cap was not held");
      assert.equal(response.body.category, "held_at_volume_limit");
      assert.match(String(response.body.reason), new RegExp(SELF_SERVE));
    });

    it("does not hold the same volume spread outside the window", async () => {
      global.fetch = stubFetch({
        history: historyRows({ count: MAX_UNATTENDED_RUNS_PER_WINDOW, result: "completed", at: minutesAgo(LIMIT_WINDOW_MINUTES + 30) })
      });
      const response = await propose(SELF_SERVE);
      assert.equal(response.body.status, "completed", "runs from before the window counted against the cap");
    });

    it("does not hold ordinary use", async () => {
      global.fetch = stubFetch({ history: historyRows({ count: 6, result: "completed", at: minutesAgo(5) }) });
      const response = await propose(SELF_SERVE);
      assert.equal(response.body.status, "completed", "a normal day's unattended work was held");
    });
  });

  describe("the cap itself, on rows it cannot place", () => {
    const { withinWindow, evaluateVolumeLimit } = require("../lib/sonara-agent-limits.cjs");
    const selfServe = { actionType: SELF_SERVE, requiresOwnerApproval: false, category: "self_serve", reason: "allowed" };
    const NOW = new Date("2026-10-01T15:00:00.000Z");
    const at = (minutes) => new Date(NOW.getTime() - minutes * 60000).toISOString();

    it("does not count a row it cannot date, and says how many it skipped", () => {
      const read = withinWindow([{ at: at(5) }, { at: null }, { at: "not a date" }, { at: "" }], LIMIT_WINDOW_MINUTES, NOW);
      assert.equal(read.inside.length, 1);
      assert.equal(read.skippedUndated, 3);
      assert.equal(read.readable, true);
    });

    it("counts a future-dated row rather than letting a skewed clock spend the budget invisibly", () => {
      const read = withinWindow([{ at: new Date(NOW.getTime() + 600000).toISOString() }], LIMIT_WINDOW_MINUTES, NOW);
      assert.equal(read.inside.length, 1);
    });

    it("reports unavailable rather than within when no row carries a date", () => {
      // The direction that matters. Counting undated rows would put two hundred
      // of them inside one hour and demote every unattended action -- an outage
      // wearing a cap's clothing. Reporting zero as "within" would be a cap
      // satisfied by a list it never read. Neither; it says it cannot tell.
      const verdict = evaluateVolumeLimit(selfServe, { ok: true, rows: Array.from({ length: 200 }, () => ({ at: null })) }, { now: NOW });
      assert.equal(verdict.limit, "unavailable");
      assert.equal(verdict.requiresOwnerApproval, false);
      assert.equal(verdict.limitSkippedUndated, 200);
    });

    it("reports unavailable when the clock it is handed is not a date", () => {
      const verdict = evaluateVolumeLimit(selfServe, { ok: true, rows: [{ at: at(1) }] }, { now: "not a date" });
      assert.equal(verdict.limit, "unavailable");
    });

    it("leaves a gated classification byte-for-byte alone", () => {
      const gated = Object.freeze({ actionType: "issue_refund", requiresOwnerApproval: true, category: "refunds", reason: "needs you" });
      const verdict = evaluateVolumeLimit(gated, { ok: true, rows: Array.from({ length: 500 }, () => ({ at: at(1) })) }, { now: NOW });
      assert.equal(verdict.limit, "not_applicable");
      assert.equal(verdict.requiresOwnerApproval, true);
      assert.equal(verdict.category, "refunds");
      assert.equal(verdict.reason, "needs you");
    });

    it("counts only the action type it was asked about", () => {
      const rows = [
        ...Array.from({ length: MAX_UNATTENDED_RUNS_PER_ACTION_PER_WINDOW }, () => ({ at: at(2), actionType: "other_action" })),
        { at: at(2), actionType: SELF_SERVE }
      ];
      const verdict = evaluateVolumeLimit(selfServe, { ok: true, rows }, { now: NOW, actionType: SELF_SERVE });
      assert.equal(verdict.limit, "within", "a different action's volume was counted against this one");
      assert.equal(verdict.limitActionRuns, 1);
    });

    it("reports the per-action count as not counted, never as zero, when rows carry no action", () => {
      // Zero would read as "this action has not run", which is a different claim
      // from "these rows do not say".
      const verdict = evaluateVolumeLimit(selfServe, { ok: true, rows: [{ at: at(2) }] }, { now: NOW, actionType: SELF_SERVE });
      assert.equal(verdict.limitActionRuns, 0, "rows without an action type must not match the asked-about type");
      const unasked = evaluateVolumeLimit(selfServe, { ok: true, rows: [{ at: at(2) }] }, { now: NOW });
      assert.equal(unasked.limitActionRuns, null, "with no action type asked about, the per-action count is not a number");
    });
  });

  describe("a runner with no history reader says so", () => {
    // The condition that made the original defect invisible. The degraded line
    // used to be guarded on `typeof readHistory === "function"`, which is false
    // exactly when the gate is unwired -- so the one case that needed reporting
    // was the one case that reported nothing.
    const { createRunner } = require("../lib/sonara-agent-runner.cjs");

    it("reports an unwired breaker on a run that belongs to a business", async () => {
      const reported = [];
      const runner = createRunner({
        handlers: { [SELF_SERVE]: async () => ({ ok: true }) },
        onBreakerDegraded: (details) => reported.push(details)
      });
      const result = await runner.run({
        action: { action_type: SELF_SERVE },
        organizationId: ORGANIZATION_ID,
        scope: "organization"
      });
      assert.equal(result.status, "completed", "failing closed on an unwired breaker is the worse outage");
      assert.equal(reported.length, 1, "an unwired breaker said nothing, which is how this went unnoticed");
      assert.match(reported[0].reason, /no history reader/i);
    });

    it("stays quiet for a run with no business, where there is no history to read", async () => {
      // The drafting runner in routes/sonara-ai-integrations-routes.cjs runs
      // process-scoped on purpose. A line about a missing breaker on every draft
      // would be noise that teaches people to ignore the line.
      const reported = [];
      const runner = createRunner({
        handlers: { [SELF_SERVE]: async () => ({ ok: true }) },
        onBreakerDegraded: (details) => reported.push(details)
      });
      await runner.run({ action: { action_type: SELF_SERVE }, scope: "process" });
      assert.equal(reported.length, 0, "a process-scoped run reported a breaker it was never meant to have");
    });

    it("still reports a reader that was supplied and failed, whatever the scope", async () => {
      const reported = [];
      const runner = createRunner({
        handlers: { [SELF_SERVE]: async () => ({ ok: true }) },
        readHistory: async () => ({ ok: false, rows: [], reason: "read failed (503)" }),
        onBreakerDegraded: (details) => reported.push(details)
      });
      await runner.run({ action: { action_type: SELF_SERVE }, scope: "process" });
      assert.equal(reported.length, 1, "a safety check that was wired and then broke must say so regardless of scope");
      assert.match(reported[0].reason, /503/);
    });
  });

  describe("what the gates may not do", () => {
    it("never lets a volume count make a gated action ungated", async () => {
      // The property the breaker asserts about itself, asserted for the cap too:
      // it may escalate and never relax. An empty history must not turn a refund
      // into something that runs.
      global.fetch = stubFetch({ history: [] });
      const response = await propose("issue_refund");
      assert.equal(response.body.queued, true);
      assert.equal(response.body.category, "refunds", "a refund was refused for the wrong reason, so the cap reclassified it");
    });

    it("runs rather than blocking everything when the history read fails", async () => {
      // Failing closed here is the worse outage, and it is the trade
      // lib/sonara-agent-authority.cjs already documents. What must not happen is
      // doing it silently -- the structured log carries a degraded line, which
      // tests/agent-runner.test.js and the breaker file assert on directly.
      global.fetch = async (url, options = {}) => {
        const target = String(url);
        if (target.includes("/rest/v1/agent_action_logs") && (options.method || "GET").toUpperCase() === "GET") {
          return json(null, 503);
        }
        return stubFetch({ history: [] })(url, options);
      };
      const response = await propose(SELF_SERVE);
      assert.equal(response.body.status, "completed", "a transient history read failure blocked an agent entirely");
    });
  });
});
