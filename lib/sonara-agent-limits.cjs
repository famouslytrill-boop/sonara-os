// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// How much unattended work one agent may do before an owner has to look.
//
// Pure. No clock of its own and no database -- `now` is passed in, and the rows
// come from the history read lib/sonara-agent-runner.cjs already performs for
// the failure breaker. That is the whole reason this needs no table and no second
// query: `agent_action_logs` is already the evidence history, already
// organization-scoped, already indexed on (organization_id, created_at desc),
// and already read once per run.
//
// ## What this is for, and what the breaker is for
//
// `evaluateAutonomyBreaker` in lib/sonara-agent-authority.cjs answers "is this
// agent failing?" -- three of its last ten unattended runs. It is a quality
// signal and it says nothing about volume. An agent whose every run succeeds can
// run ten thousand times on a cadence bug and the breaker stays green the whole
// way, because nothing failed.
//
// This answers the other question: "is this agent doing too much?" A schedule
// whose cadence arithmetic is wrong, a loop, a retry that re-proposes, a tick
// firing every minute instead of every day -- none of those look like failures.
// They look like a healthy agent working very hard.
//
// ## Exceeding a limit queues; it does not drop
//
// Over the cap, the action is demoted to requiring owner approval, which is the
// same mechanism the breaker uses, which means it lands in
// `agent_pending_actions` and on /owner/agent-activity. Nothing is silently
// discarded, and the owner sees what wanted to run. Dropping the work instead
// would make a runaway invisible, which is the failure mode this is meant to
// prevent rather than one to introduce.
//
// Once demoted, a run is recorded with approval_state 'pending', and the history
// read filters on 'not_required' -- so a demoted run leaves the counted
// population. The cap therefore does not sustain itself after the runaway stops.
//
// ## This counts one agent, not an organization
//
// The read it consumes is scoped to one `agent_key`, so these are per-agent
// caps. Said plainly because it is a real limit: twenty agents each at
// fifty-nine runs an hour pass. An organization-wide cap needs a second read,
// which is a deliberate decision about cost on the path every run takes, and is
// not smuggled in here as though per-agent covered it.

// One hour, and the caps are per agent inside it.
//
// Sized against what the product actually does rather than picked round. The
// self-serve allowlist in lib/sonara-agent-authority.cjs is seven read-and-report
// actions, and `agent_schedules` cadences are daily, weekly and monthly -- so a
// correct agent does single-digit unattended runs a day. Sixty an hour is far
// above anything legitimate and far below a loop, which is the gap a cap wants
// to sit in: high enough that no real workload meets it, low enough that a
// runaway hits it within the hour rather than after a weekend.
const LIMIT_WINDOW_MINUTES = 60;
const MAX_UNATTENDED_RUNS_PER_WINDOW = 60;

// A single action type repeating is the likelier shape, so it has a tighter cap.
// A cadence bug fires one schedule over and over; it does not cycle through the
// catalogue.
const MAX_UNATTENDED_RUNS_PER_ACTION_PER_WINDOW = 20;

/**
 * The rows that fall inside the window, and the ones that could not be placed.
 *
 * A row with no usable timestamp is NOT counted toward the cap, and is counted
 * as skipped instead. That direction is the opposite of the one
 * `withinRecency` takes in lib/sonara-agent-authority.cjs, and the difference is
 * deliberate rather than an inconsistency:
 *
 *   - For the breaker, an undated row counts, because counting it can only make
 *     the gate stricter and the worst case is an agent demoted for review.
 *   - For a volume cap, counting undated rows would make up to two hundred of
 *     them land inside one hour, put every agent instantly over the cap, and
 *     demote all unattended work to owner approval. That is not a strict cap; it
 *     is an outage wearing a cap's clothing.
 *
 * So undated rows are reported through `skippedUndated` and the state goes to
 * `unavailable` when nothing could be placed, which the caller reports out loud.
 * A cap that cannot see is never allowed to read as a cap that is satisfied.
 */
function withinWindow(rows, windowMinutes, now) {
  const reference = now instanceof Date ? now.getTime() : Date.parse(String(now));
  if (!Number.isFinite(reference)) return { inside: [], skippedUndated: 0, readable: false };

  const cutoff = reference - (Number(windowMinutes) || 0) * 60000;
  const inside = [];
  let skippedUndated = 0;

  for (const row of Array.isArray(rows) ? rows : []) {
    const raw = row?.at;
    if (raw === undefined || raw === null || raw === "") { skippedUndated += 1; continue; }
    const at = Date.parse(String(raw));
    if (!Number.isFinite(at)) { skippedUndated += 1; continue; }
    // Future-dated rows count. A clock skew that puts a row ahead of `now` is
    // still a run that happened, and excluding it would let a skewed writer
    // spend the budget invisibly.
    if (at >= cutoff) inside.push(row);
  }

  return { inside, skippedUndated, readable: true };
}

/**
 * Should this unattended action be held for the owner on volume grounds?
 *
 * Takes the classification the breaker has already produced and returns it
 * either untouched or demoted. It can escalate and never relax -- the same
 * property `evaluateAutonomyBreaker` asserts about itself, for the same reason:
 * a limit that could turn a gated action into an ungated one would be a hole in
 * the seven categories rather than a cap on them.
 *
 * Returns the classification plus `limit`, which is one of:
 *
 *   not_applicable  -- already needs owner approval; nothing to add
 *   unavailable     -- the history could not be read, or carried no usable dates
 *   within          -- counted, and under both caps
 *   tripped         -- counted, and over one of them
 */
function evaluateVolumeLimit(classification, history, { now = new Date(), actionType = null } = {}) {
  // Already gated. Nothing to add, and nothing here may subtract.
  if (classification?.requiresOwnerApproval) {
    return { ...classification, limit: "not_applicable" };
  }

  if (!history || history.ok !== true || !Array.isArray(history.rows)) {
    // Cannot tell, and saying "within" here would be a cap reporting success
    // over a list it never read.
    return { ...classification, limit: "unavailable" };
  }

  const { inside, skippedUndated, readable } = withinWindow(history.rows, LIMIT_WINDOW_MINUTES, now);
  if (!readable || (inside.length === 0 && skippedUndated > 0)) {
    return {
      ...classification,
      limit: "unavailable",
      limitSkippedUndated: skippedUndated,
      limitWindowMinutes: LIMIT_WINDOW_MINUTES
    };
  }

  const type = actionType === null || actionType === undefined ? null : String(actionType);
  // The per-action count is only meaningful when rows carry an action type. The
  // history read supplies status and date, so this is populated when a caller
  // hands richer rows and is otherwise reported as not counted -- rather than
  // reported as zero, which would read as "this action has not run".
  const sameAction = type === null
    ? null
    : inside.filter((row) => row?.actionType !== undefined && String(row.actionType) === type).length;

  const shared = {
    limitWindowMinutes: LIMIT_WINDOW_MINUTES,
    limitRuns: inside.length,
    limitActionRuns: sameAction,
    limitSkippedUndated: skippedUndated,
    limitCeiling: MAX_UNATTENDED_RUNS_PER_WINDOW,
    limitActionCeiling: MAX_UNATTENDED_RUNS_PER_ACTION_PER_WINDOW
  };

  if (inside.length >= MAX_UNATTENDED_RUNS_PER_WINDOW) {
    return {
      actionType: classification.actionType,
      requiresOwnerApproval: true,
      category: "held_at_volume_limit",
      reason:
        `This agent has run ${inside.length} times on its own in the last ${LIMIT_WINDOW_MINUTES} minutes, which is at the `
        + `limit of ${MAX_UNATTENDED_RUNS_PER_WINDOW}. Nothing has failed -- it is doing more than anything here should need to, `
        + "so the rest is waiting for you rather than running.",
      limit: "tripped",
      ...shared
    };
  }

  if (sameAction !== null && sameAction >= MAX_UNATTENDED_RUNS_PER_ACTION_PER_WINDOW) {
    return {
      actionType: classification.actionType,
      requiresOwnerApproval: true,
      category: "held_at_volume_limit",
      reason:
        `"${type}" has run ${sameAction} times on its own in the last ${LIMIT_WINDOW_MINUTES} minutes, which is at the `
        + `limit of ${MAX_UNATTENDED_RUNS_PER_ACTION_PER_WINDOW} for one action. Nothing has failed -- the same job is `
        + "repeating, so the rest is waiting for you rather than running.",
      limit: "tripped",
      ...shared
    };
  }

  return { ...classification, limit: "within", ...shared };
}

module.exports = {
  LIMIT_WINDOW_MINUTES,
  MAX_UNATTENDED_RUNS_PER_WINDOW,
  MAX_UNATTENDED_RUNS_PER_ACTION_PER_WINDOW,
  withinWindow,
  evaluateVolumeLimit
};
