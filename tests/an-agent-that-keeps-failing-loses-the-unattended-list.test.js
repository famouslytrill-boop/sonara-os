"use strict";

const assert = require("node:assert/strict");
const {
  SELF_SERVE_ACTIONS,
  SENSITIVE_CATEGORY_NAMES,
  BREAKER_WINDOW,
  BREAKER_FAILURES,
  classifyAction,
  evaluateAutonomyBreaker,
} = require("../lib/sonara-agent-authority.cjs");

// Everything in sonara-agent-authority.cjs was static: an action type is
// self-serve or it is not, and it stayed that way however badly the agent
// performed it. agent_action_logs recorded every outcome and nothing read it
// back into a decision, so an agent whose draft_reply runs had failed twenty
// times running kept draft_reply.
//
// The demotion idea is borrowed from AI-SDLC Framework's AutonomyPolicy
// (registered reference_only, Apache 2.0). Their ordered levels are deliberately
// NOT adopted -- AGENTS.md is binary and a ladder would blur it -- only the
// demotion half, written against our own module.
//
// The property that makes this safe to add at all is that it can escalate and
// never relax, and that is the first thing asserted here.
function outcomes(statuses) {
  return { ok: true, rows: statuses.map((status) => ({ status })) };
}

function runsOf(status, count) {
  return new Array(count).fill(status);
}

describe("an agent that keeps failing loses the unattended list", () => {
  it("has a window and a threshold that make a sentence an owner can check", () => {
    assert.ok(BREAKER_WINDOW >= 5, `a window of ${BREAKER_WINDOW} is too small to mean anything`);
    assert.ok(
      BREAKER_FAILURES >= 2 && BREAKER_FAILURES <= BREAKER_WINDOW,
      `${BREAKER_FAILURES} failures out of ${BREAKER_WINDOW} is not a coherent threshold`
    );
    assert.ok(SELF_SERVE_ACTIONS.length > 0, "there are no self-serve actions, so this check is measuring nothing");
  });

  // The one that matters. If this can ever go the other way, the breaker is a
  // hole in the seven categories rather than an addition to them.
  it("can never turn an action that needs approval into one that does not", () => {
    const gated = [
      "issue_refund",
      "change_payout_account",
      "publish_privacy_policy",
      "send_campaign",
      "publish_review",
      "grant_role",
      "delete_customer",
      "something_nobody_listed",
      "",
    ];

    for (const actionType of gated) {
      const base = classifyAction(actionType);
      assert.equal(base.requiresOwnerApproval, true, `${actionType || "(empty)"} should already be gated`);

      // A perfect record is the strongest possible argument for relaxing, so it
      // is the case to try.
      const spotless = evaluateAutonomyBreaker(base, outcomes(runsOf("completed", BREAKER_WINDOW)));
      assert.equal(
        spotless.requiresOwnerApproval,
        true,
        `a clean history must not unlock ${actionType || "(empty)"} -- the breaker may only ever add refusals`
      );
      assert.equal(spotless.category, base.category, "the breaker must not rewrite why an action is gated");
      assert.equal(spotless.breaker, "not_applicable");
    }
  });

  it("covers every sensitive category, so the guarantee is not proven on a subset", () => {
    // Guard against the case above passing because the sample happened to miss
    // a category: the seven names come from the module itself.
    assert.equal(SENSITIVE_CATEGORY_NAMES.length, 7, `expected seven categories, found ${SENSITIVE_CATEGORY_NAMES.length}`);
  });

  it("demotes a self-serve action once enough of its recent runs failed", () => {
    const base = classifyAction("draft_reply");
    assert.equal(base.requiresOwnerApproval, false, "draft_reply should start unattended");

    const failing = runsOf("failed", BREAKER_FAILURES).concat(runsOf("completed", BREAKER_WINDOW - BREAKER_FAILURES));
    const decided = evaluateAutonomyBreaker(base, outcomes(failing));

    assert.equal(decided.requiresOwnerApproval, true, "an agent this unreliable must not keep running unattended");
    assert.equal(decided.category, "demoted_after_failures");
    assert.equal(decided.breaker, "tripped");
    assert.match(decided.reason, new RegExp(`${BREAKER_FAILURES} of this agent's last ${BREAKER_WINDOW}`));
  });

  it("leaves a reliable agent alone", () => {
    const base = classifyAction("draft_reply");
    const decided = evaluateAutonomyBreaker(base, outcomes(runsOf("completed", BREAKER_WINDOW)));

    assert.equal(decided.requiresOwnerApproval, false, "a clean record must not be demoted");
    assert.equal(decided.breaker, "healthy");
    assert.equal(decided.breakerFailures, 0);
  });

  it("does not trip one failure short of the threshold", () => {
    const base = classifyAction("draft_reply");
    const justUnder = runsOf("failed", BREAKER_FAILURES - 1).concat(runsOf("completed", BREAKER_WINDOW - BREAKER_FAILURES + 1));
    const decided = evaluateAutonomyBreaker(base, outcomes(justUnder));

    assert.equal(decided.requiresOwnerApproval, false, "the threshold must be the threshold, not one below it");
    assert.equal(decided.breaker, "healthy");
  });

  // Two failures that look identical from the outside and must not.
  it("treats too little history as unmeasured, not as a clean record", () => {
    const base = classifyAction("draft_reply");
    const decided = evaluateAutonomyBreaker(base, outcomes(runsOf("failed", BREAKER_WINDOW - 1)));

    assert.equal(
      decided.breaker,
      "insufficient_history",
      "an agent with less than a full window has not been measured; reporting it healthy is a check passing on a short list"
    );
    assert.notEqual(decided.breaker, "healthy");
  });

  it("says it could not read the history rather than assuming a clean one", () => {
    const base = classifyAction("draft_reply");

    for (const history of [null, undefined, { ok: false, rows: [] }, { ok: false }, [], { rows: [] }]) {
      const decided = evaluateAutonomyBreaker(base, history);
      assert.equal(
        decided.breaker,
        "unavailable",
        `a history of ${JSON.stringify(history)} must report as unreadable, never as healthy`
      );
    }

    // A bare array is the shape this codebase has been bitten by: it cannot say
    // whether the read succeeded, so it must not be accepted as one that did.
    const bare = evaluateAutonomyBreaker(base, outcomes(runsOf("completed", BREAKER_WINDOW)).rows);
    assert.equal(bare.breaker, "unavailable", "a bare array carries no outcome and must not read as a successful read");
  });

  it("does not count an unimplemented action as the agent's failure", () => {
    // The runner writes "unimplemented" when the gate approved something nothing
    // implements. That is a missing feature, not an agent behaving badly, and
    // counting it would demote an agent for the catalogue's gap.
    const base = classifyAction("draft_reply");
    const decided = evaluateAutonomyBreaker(base, outcomes(runsOf("unimplemented", BREAKER_WINDOW)));

    assert.equal(decided.requiresOwnerApproval, false, "unimplemented runs must not demote the agent");
    assert.equal(decided.breakerFailures, 0);
  });

  // The pure function being right is not the same as the runner using it. A
  // safety check nothing calls is the shape this codebase already shipped once:
  // a page that asked the gate and then did the work regardless of the answer.
  describe("and the runner actually refuses it", () => {
    const { createRunner } = require("../lib/sonara-agent-runner.cjs");

    const action = { id: "act-1", action_type: "draft_reply" };
    let ran;
    const handlers = {
      draft_reply: async () => {
        ran = true;
        return { drafted: true };
      }
    };

    beforeEach(() => {
      ran = false;
    });

    it("runs the action when the agent's record is clean", async () => {
      const runner = createRunner({
        handlers,
        readHistory: async () => outcomes(runsOf("completed", BREAKER_WINDOW))
      });
      const result = await runner.run({ action });

      assert.equal(result.status, "completed", `expected the run to proceed, got ${result.status}: ${result.reason || ""}`);
      assert.equal(ran, true, "the handler should have been called");
    });

    it("refuses the action, and does not call the handler, once the breaker trips", async () => {
      const failing = runsOf("failed", BREAKER_FAILURES).concat(runsOf("completed", BREAKER_WINDOW - BREAKER_FAILURES));
      const runner = createRunner({ handlers, readHistory: async () => outcomes(failing) });
      const result = await runner.run({ action });

      assert.equal(result.status, "refused", "a demoted agent's unattended action must not execute");
      assert.equal(ran, false, "the handler must never be reached once the breaker has tripped");
      assert.equal(result.classification.category, "demoted_after_failures");
    });

    it("changes nothing for a caller that supplies no history", async () => {
      // Every existing call site. Adding the breaker must not alter a single
      // decision already being made.
      const runner = createRunner({ handlers });
      const result = await runner.run({ action });

      assert.equal(result.status, "completed");
      assert.equal(ran, true);
    });

    it("reports a degraded breaker rather than failing silently", async () => {
      const reported = [];
      const runner = createRunner({
        handlers,
        readHistory: async () => ({ ok: false, rows: [], reason: "read failed (503)" }),
        onBreakerDegraded: (details) => reported.push(details)
      });
      const result = await runner.run({ action });

      assert.equal(result.status, "completed", "a failed history read must not block the agent; failing closed is the worse outage");
      assert.equal(reported.length, 1, "a safety check that stopped working must say so");
      assert.match(reported[0].reason, /503/);
    });

    it("does not let a thrown history read pass as a clean record", async () => {
      const reported = [];
      const runner = createRunner({
        handlers,
        readHistory: async () => {
          throw new Error("connection reset");
        },
        onBreakerDegraded: (details) => reported.push(details)
      });
      const result = await runner.run({ action });

      assert.equal(reported.length, 1, "a throwing reader must be reported, not swallowed into a healthy verdict");
      assert.equal(result.classification.breaker, "unavailable");
    });

    it("never consults history for an action that is already gated", async () => {
      // The breaker may only add refusals, so there is nothing to gain from the
      // read -- and a sensitive action must not become dependent on a table
      // being reachable.
      let consulted = false;
      const runner = createRunner({
        handlers: { issue_refund: async () => ({}) },
        readHistory: async () => {
          consulted = true;
          return outcomes(runsOf("completed", BREAKER_WINDOW));
        }
      });
      const result = await runner.run({ action: { id: "act-2", action_type: "issue_refund" } });

      assert.equal(result.status, "refused", "a refund still needs an approval");
      assert.equal(consulted, false, "a gated action must not depend on the history table being readable");
    });
  });

  it("reads only the most recent window, so old failures age out", () => {
    const base = classifyAction("draft_reply");
    const recentCleanThenOldFailures = runsOf("completed", BREAKER_WINDOW).concat(runsOf("failed", 50));
    const decided = evaluateAutonomyBreaker(base, outcomes(recentCleanThenOldFailures));

    assert.equal(decided.requiresOwnerApproval, false, "failures outside the window must not hold an agent down forever");
    assert.equal(decided.breakerRuns, BREAKER_WINDOW);
  });
});
