"use strict";

// The loop: classify, decide, run, record.
//
// lib/sonara-agent-authority.cjs says what an agent may do.
// lib/sonara-record-checks.cjs and lib/sonara-customer-journey.cjs are work an
// agent can actually do. Nothing joined them, so each page called
// classifyAction itself and then did the work regardless of the answer -- which
// is a gate a caller can walk past by not asking.
//
// This is the one path. A caller hands over an action and a context; it comes
// back with a run. Skipping the gate now means not calling this, which is
// visible in a diff in a way that "forgot to check the return value" is not.
//
// Two things it deliberately does not do.
//
// It does not persist runs itself. The recorder is injectable, and
// lib/sonara-agent-action-log.cjs is the one that writes to agent_action_logs.
// That table is organization-scoped, which the nineteen entity_* agent tables
// from migration 008 are not -- they key on entity_id, and `entities` has no
// organization_id, so writing an organization's run into one would mean either
// inventing an entity per organization or leaving a NOT NULL foreign key null.
// The recorder stays injectable so a caller that has no organization in hand
// cannot half-write a run into the wrong tenancy model.
//
// It does not execute anything sensitive. A handler is registered against an
// action name, and the name is classified before the handler is reached. A
// handler registered under a sensitive name still needs an approval; there is
// no way to register past the gate.

const { classifyAction, decideExecution, evaluateAutonomyBreaker } = require("./sonara-agent-authority.cjs");
const { redactSensitiveText } = require("./sonara-redaction.cjs");

function now() {
  return new Date().toISOString();
}

// A safety check that has stopped working must not do so quietly. The same
// default that lib/sonara-rate-limit.cjs grew after three of its four limiters
// were found failing open without a line in any log.
function defaultBreakerDegradedReport({ actionType, reason }) {
  // Redacted, because `reason` can carry a fetch error and a provider error
  // carries the URL it failed on -- and that URL carries the service-role key.
  // The redaction-boundary gate caught this line on its first run, which is the
  // same defect this repository fixed in the global route-error log and in
  // lib/sonara-rate-limit.cjs. Third time; the boundary is the reason it was
  // cheap to find.
  const safeReason = redactSensitiveText(String(reason == null ? "unknown" : reason));
  const safeAction = redactSensitiveText(String(actionType || "(unnamed)"));
  console.error(`[agent-breaker] could not read run history for ${safeAction}: ${safeReason}. Base classification stands.`);
}

// `readHistory` is optional and returns {ok, rows} -- see
// createActionHistoryReader in sonara-agent-action-log.cjs. When it is absent
// the breaker reports "unavailable" and the base classification stands, which
// is what every existing caller gets: adding this could not change any decision
// already being made.
function createRunner({ handlers = {}, record = null, readHistory = null, onBreakerDegraded = defaultBreakerDegradedReport } = {}) {
  const registry = new Map(Object.entries(handlers));

  function register(actionType, handler) {
    if (typeof handler !== "function") throw new TypeError(`handler for ${actionType} must be a function`);
    registry.set(String(actionType), handler);
    return registry.size;
  }

  // `action` is shaped like an entity_proactive_actions row. `approval` is an
  // entity_action_approvals row or null. `context` is whatever the handler
  // needs -- an organization id, a Supabase config -- and is never inspected
  // here, because a runner that understands the work is a runner that has to
  // change every time the work does.
  async function run({ action, approval = null, context = {} } = {}) {
    const startedAt = now();
    const actionType = String(action?.action_type || "");
    const baseClassification = classifyAction(actionType);

    // The autonomy breaker, applied here rather than inside classifyAction so
    // that classifyAction stays a pure function of the action type -- it is
    // called from several places that have no agent and no history, and giving
    // it an async dependency would make the gate harder to reason about.
    //
    // It can only ever escalate. A failed history read leaves the base
    // classification untouched and is REPORTED, not swallowed: three of the four
    // rate limiters in this codebase failed open in silence and nobody knew for
    // months, so a degraded safety check says so out loud.
    let history = null;
    if (typeof readHistory === "function" && !baseClassification.requiresOwnerApproval) {
      history = await readHistory({ action, context }).catch((error) => ({ ok: false, rows: [], reason: String(error?.message || error) }));
    }
    const classification = evaluateAutonomyBreaker(baseClassification, history);

    if (classification.breaker === "unavailable" && typeof readHistory === "function") {
      onBreakerDegraded({ actionType, reason: history?.reason || "history unreadable" });
    }

    const decision = classification.requiresOwnerApproval && !baseClassification.requiresOwnerApproval
      // Demoted by the breaker. The action type itself is still self-serve, so
      // decideExecution would wave it through; the breaker's answer is the
      // stricter one and the stricter answer wins, exactly as it does when an
      // action matches both a sensitive pattern and the allowlist.
      ? { allowed: false, classification, reason: classification.reason }
      : decideExecution({ action, approval });

    const base = {
      actionType,
      classification,
      startedAt,
      finishedAt: startedAt,
      logs: []
    };

    if (!decision.allowed) {
      const refused = { ...base, status: "refused", allowed: false, reason: decision.reason, result: null };
      await persist(refused);
      return refused;
    }

    const handler = registry.get(actionType);
    if (!handler) {
      // Allowed and unimplemented are different answers. Reporting this as a
      // refusal would blame the gate for a missing handler and send somebody
      // to read the wrong file.
      const missing = {
        ...base,
        status: "unimplemented",
        allowed: true,
        reason: `${actionType} is allowed to run and nothing implements it.`,
        result: null
      };
      await persist(missing);
      return missing;
    }

    try {
      const result = await handler(context, action);
      const done = {
        ...base,
        finishedAt: now(),
        status: "completed",
        allowed: true,
        reason: decision.reason,
        result
      };
      await persist(done);
      return done;
    } catch (error) {
      // A handler that throws is a failed run, not a crashed page. The message
      // goes through the redaction boundary because a handler talks to
      // Supabase and a Supabase error carries the URL it failed on.
      const { redactError } = require("./sonara-redaction.cjs");
      const failed = {
        ...base,
        finishedAt: now(),
        status: "failed",
        allowed: true,
        reason: redactError(error, { includeStack: false }),
        result: null
      };
      await persist(failed);
      return failed;
    }
  }

  async function persist(runRecord) {
    if (typeof record !== "function") return;
    // A recorder that throws must not turn a completed run into a failed page.
    try {
      await record(runRecord);
    } catch {
      // Deliberately swallowed. The run happened; losing the note about it is
      // worse than nothing but far better than losing the run.
    }
  }

  return { register, run, registered: () => [...registry.keys()].sort() };
}

module.exports = { createRunner };
