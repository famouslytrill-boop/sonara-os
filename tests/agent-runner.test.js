"use strict";

// The runner is the only path from "an agent wants to do this" to "it
// happened". These checks are about the ways a caller could get around it.
//
// Before this existed, each page called classifyAction itself and then did the
// work regardless of the answer. That is a gate you walk past by not reading
// the return value, and nothing in a diff shows it.

const assert = require("node:assert/strict");
const { createRunner } = require("../lib/sonara-agent-runner.cjs");

const APPROVED = { status: "approved", approved_by: "owner-1", requested_by: "requester-1", proactive_action_id: "a1" };

describe("the agent runner", () => {
  it("runs an allowlisted action", async () => {
    const runner = createRunner({ handlers: { prepare_report: async () => ({ rows: 3 }) } });
    const result = await runner.run({ action: { id: "a1", action_type: "prepare_report" } });
    assert.equal(result.status, "completed");
    assert.deepEqual(result.result, { rows: 3 });
  });

  it("refuses a sensitive action with no approval, and never reaches the handler", async () => {
    let reached = false;
    const runner = createRunner({ handlers: { issue_refund: async () => { reached = true; return {}; } } });
    const result = await runner.run({ action: { id: "a1", action_type: "issue_refund" } });
    assert.equal(result.status, "refused");
    assert.equal(result.allowed, false);
    assert.equal(reached, false, "the handler ran despite the refusal, which makes the gate decorative");
  });

  it("cannot be bypassed by registering a handler", async () => {
    // Registering is not permission. If a handler could grant itself the right
    // to run by existing, the gate would only cover actions nobody had built.
    const runner = createRunner();
    let reached = false;
    runner.register("delete_customer_records", async () => { reached = true; return {}; });
    const result = await runner.run({ action: { id: "a1", action_type: "delete_customer_records" } });
    assert.equal(result.status, "refused");
    assert.equal(reached, false);
  });

  it("runs a sensitive action once a person has approved it", async () => {
    const runner = createRunner({ handlers: { issue_refund: async () => ({ refunded: true }) } });
    const result = await runner.run({
      action: { id: "a1", action_type: "issue_refund", proposed_by: null },
      approval: APPROVED
    });
    assert.equal(result.status, "completed");
  });

  it("separates 'allowed and unimplemented' from 'refused'", async () => {
    // These are different answers and send somebody to different files.
    const runner = createRunner();
    const result = await runner.run({ action: { id: "a1", action_type: "prepare_report" } });
    assert.equal(result.status, "unimplemented");
    assert.equal(result.allowed, true);
  });

  it("turns a throwing handler into a failed run, not a crash", async () => {
    const runner = createRunner({
      handlers: {
        check_data_quality: async () => {
          throw new Error("request failed https://p.supabase.co/rest/v1/x?apikey=abcdef123456");
        }
      }
    });
    const result = await runner.run({ action: { id: "a1", action_type: "check_data_quality" } });
    assert.equal(result.status, "failed");
    assert.doesNotMatch(result.reason, /apikey=abcdef123456/, "a handler error carries the URL it failed on, and that URL carries the key");
  });

  it("records every run, including the refused ones", async () => {
    // A refusal that leaves no trace is indistinguishable from nobody asking.
    const recorded = [];
    const runner = createRunner({
      handlers: { prepare_report: async () => ({}) },
      record: async (entry) => { recorded.push(entry.status); }
    });
    await runner.run({ action: { id: "a1", action_type: "prepare_report" } });
    await runner.run({ action: { id: "a2", action_type: "issue_refund" } });
    await runner.run({ action: { id: "a3", action_type: "summarise_records" } });
    assert.deepEqual(recorded, ["completed", "refused", "unimplemented"]);
  });

  it("does not let a broken recorder fail a run that succeeded", async () => {
    const runner = createRunner({
      handlers: { prepare_report: async () => ({ ok: true }) },
      record: async () => { throw new Error("the runs table is unreachable"); }
    });
    const result = await runner.run({ action: { id: "a1", action_type: "prepare_report" } });
    assert.equal(result.status, "completed", "the work happened; losing the note about it must not undo that");
  });

  it("is the only path the assistant pages take", async () => {
    // The gate is only a gate if nothing calls the classifier and then decides
    // for itself what to do with the answer. That is what these pages used to
    // do, and it is invisible in a diff.
    const fs = require("node:fs");
    const path = require("node:path");
    const source = fs.readFileSync(path.join(__dirname, "..", "routes", "sonara-assistant-routes.cjs"), "utf8");
    assert.match(source, /createRunner/, "the assistant routes must go through the runner");
    assert.doesNotMatch(
      source,
      /\bclassifyAction\s*\(/,
      "the assistant routes call classifyAction directly again; the decision belongs to the runner, which cannot be walked past"
    );
  });

  it("refuses an action with no type", async () => {
    const runner = createRunner();
    for (const action of [{}, { action_type: "" }, null]) {
      const result = await runner.run({ action });
      assert.equal(result.status, "refused", `${JSON.stringify(action)} must not run`);
    }
  });
});
