"use strict";

// What happens between "an agent proposed this" and "it ran".
//
// The runner classifies, decides, runs and records. When the decision is no, it
// recorded a refusal and stopped, and there it ended: nothing held the action,
// so nothing could re-run it, so an approval had nowhere to go.
// /owner/agent-activity said as much rather than showing a button that would
// have written "approved" and changed nothing.
//
// This is the missing half. A refused run becomes a row in
// agent_pending_actions carrying the action's own inputs; approving it calls
// the same runner again with an approval attached, and the outcome is written
// back. The gate is not bypassed and not re-implemented -- decideExecution is
// asked again, with the approval this time.
//
// Three things it is careful about.
//
// **The classification is never read from the row.** `category` is stored so
// the queue can be listed without re-classifying, and it is re-derived from
// action_type on every decision. A stored classification is a column the
// subject can write, and lib/sonara-agent-authority.cjs already refuses to
// trust requires_approval for exactly that reason.
//
// **Approving is not running.** They are separate outcomes and the page says
// which happened. Approving an action nothing implements produces
// `unimplemented`, and the owner is told so in as many words -- a screen that
// says a job was done when it was not is the failure this whole piece of work
// exists to avoid.
//
// **A decision is made once.** Approving claims the row out of `waiting`
// before running it, so two clicks run the action once.

const { classifyAction, decideExecution } = require("./sonara-agent-authority.cjs");
const { redactSensitiveText } = require("./sonara-redaction.cjs");

const TABLE = "agent_pending_actions";

// A refused run is worth queueing only if a person could change the answer.
//
// A run refused because the action has no name is not waiting on an approval --
// it is waiting on somebody fixing something, and putting it in front of an
// owner as a decision asks them to approve a bug. Failed and unimplemented runs
// are not queued either: they were allowed, so an approval would change nothing.
function shouldQueue(run) {
  if (!run || run.status !== "refused") return false;
  const category = run.classification?.category;
  return Boolean(category) && category !== "unnamed";
}

// The row for a refused run. `payload` is the whole reason this table exists:
// the action log deliberately stores no inputs, so without it there is nothing
// to re-run with.
function pendingRowFor({ run, organizationId, payload = {}, subject = "", agentKey = "unassigned", proposedBy = null }) {
  if (!organizationId) {
    // Loud, for the same reason lib/sonara-agent-action-log.cjs is loud. The
    // column is NOT NULL so this would fail at the database anyway, but the
    // mistake is at the wiring and that is where it should be reported.
    throw new TypeError("queueing an agent action requires an organizationId");
  }
  return {
    organization_id: organizationId,
    agent_key: String(agentKey || "unassigned"),
    action_type: String(run?.actionType || ""),
    payload: payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {},
    subject: redactSensitiveText(String(subject || "")).slice(0, 300),
    category: String(run?.classification?.category || "unrecognised"),
    reason: redactSensitiveText(String(run?.reason || "")),
    state: "waiting",
    proposed_by: proposedBy
  };
}

// The approval object decideExecution expects, built from a decision a person
// actually made.
//
// `requested_by` is the proposer, and is null when an agent proposed. It is
// deliberately not set to the deciding user to fill the field: decideExecution
// refuses when the same party requested and approved, so doing that would make
// every approval look like self-approval and refuse all of them.
function approvalFor({ pending, decidedBy }) {
  return {
    proactive_action_id: pending?.id || null,
    status: "approved",
    approved_by: decidedBy || null,
    requested_by: pending?.proposed_by || null
  };
}

function actionFor(pending) {
  return {
    id: pending?.id || null,
    action_type: String(pending?.action_type || ""),
    proposed_by: pending?.proposed_by || null
  };
}

// What a re-run leaves behind on the row. Approving and running are separate,
// and this is where the difference is written down.
function stateAfterRun(run) {
  if (!run) return { state: "failed", run_result: "unknown", run_reason: "The action did not report an outcome." };
  if (run.status === "completed") {
    return { state: "ran", run_result: "completed", run_reason: redactSensitiveText(String(run.reason || "Approved.")) };
  }
  if (run.status === "unimplemented") {
    return {
      state: "unimplemented",
      run_result: "unimplemented",
      // In the owner's words, because this is what they read after clicking
      // approve. "unimplemented" alone reads like a failure they caused.
      run_reason: "You approved this. Nothing in the product performs it yet, so nothing has happened and nothing was changed."
    };
  }
  if (run.status === "refused") {
    return {
      state: "refused",
      run_result: "refused",
      run_reason: redactSensitiveText(String(run.reason || "The rules still refuse this."))
    };
  }
  return { state: "failed", run_result: String(run.status || "failed"), run_reason: redactSensitiveText(String(run.reason || "")) };
}

function declineUpdate({ decidedBy, at = new Date().toISOString() } = {}) {
  return { state: "declined", decided_by: decidedBy || null, decided_at: at, run_result: null, run_reason: null, updated_at: at };
}

function approveUpdate({ decidedBy, run, at = new Date().toISOString() } = {}) {
  return { ...stateAfterRun(run), decided_by: decidedBy || null, decided_at: at, updated_at: at };
}

/**
 * Approve a claimed pending action and re-run it through the runner.
 *
 * `pending` must already have been taken out of `waiting` by the caller -- the
 * claim is a conditional PostgREST update and building URLs is not this
 * module's job. What is this module's job is asking the gate again, which it
 * does with the approval attached and with the classification re-derived from
 * the action type rather than read off the row.
 */
async function approveAndRun({ pending, decidedBy, runner, context = {} }) {
  const action = actionFor(pending);
  const approval = approvalFor({ pending, decidedBy });
  const classification = classifyAction(action.action_type);
  const decision = decideExecution({ action, approval });
  const run = await runner.run({ action, approval, context });
  return { classification, decision, run, update: approveUpdate({ decidedBy, run }) };
}

module.exports = {
  TABLE,
  shouldQueue,
  pendingRowFor,
  approvalFor,
  actionFor,
  stateAfterRun,
  declineUpdate,
  approveUpdate,
  approveAndRun
};
