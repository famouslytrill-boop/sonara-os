// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
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
const { evaluateVolumeLimit } = require("./sonara-agent-limits.cjs");
const { redactSensitiveText } = require("./sonara-redaction.cjs");

const { emitEvent } = require("./sonara-structured-log.cjs");

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
function createRunner({ handlers = {}, record = null, publishEvent = null, readHistory = null, onBreakerDegraded = defaultBreakerDegradedReport } = {}) {
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
  // `organizationId` and `scope` are passed EXPLICITLY rather than read out of
  // `context`, because the paragraph above says context "is never inspected
  // here" and that is a property worth keeping: a runner that understands the
  // work is a runner that has to change every time the work does.
  //
  // Scope defaults to "organization" on purpose. A caller that forgets to
  // attribute a run gets a loud `log.event_rejected` line from the emitter
  // rather than a plausible process-scoped one -- a forgotten tenant must not
  // look like an absent one. The one runner with genuinely no organization is
  // the admin drafting runner in routes/sonara-ai-integrations-routes.cjs,
  // which passes `scope: "process"` deliberately.
  async function run({ action, approval = null, context = {}, organizationId = null, scope = "organization" } = {}) {
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
    const afterBreaker = evaluateAutonomyBreaker(baseClassification, history);

    // The volume cap, over the same history read. The breaker answers "is this
    // agent failing?"; this answers "is it doing too much?", and an agent whose
    // every run succeeds can loop ten thousand times without the breaker
    // noticing, because nothing failed.
    //
    // Applied after the breaker so a demotion by either reaches the same exit
    // below, and it can only escalate -- lib/sonara-agent-limits.cjs returns the
    // classification untouched whenever it already requires approval.
    const classification = evaluateVolumeLimit(afterBreaker, history, {
      now: new Date(startedAt),
      actionType
    });

    // Reported whether or not a reader was supplied, and that is the correction.
    //
    // This condition used to be `breaker === "unavailable" && typeof readHistory
    // === "function"`, so a runner wired WITHOUT a history reader said nothing at
    // all -- and that is exactly the state every runner in this application was
    // in. routes/sonara-agent-activity-routes.cjs passed `record` and
    // `publishEvent` and no `readHistory`; the assistant routes passed neither.
    // So the breaker returned "unavailable" on every unattended run, the base
    // classification stood, the action ran, and the one line that would have said
    // the safety check was blind was suppressed by the only condition that is
    // false precisely when the check is unwired.
    //
    // A gate nobody connected is not a gate, and it looked identical to a working
    // one. The two cases are now told apart by `reason` instead of one of them
    // being silent:
    //
    //   no_history_reader   -- nothing was wired in. A deployment gap.
    //   history_unreadable  -- a reader was wired in and the read failed.
    //
    // The two cases have different eligibility, and conflating them was a bug the
    // existing breaker tests caught immediately.
    //
    // A reader that was supplied and then failed is ALWAYS reported: somebody
    // wired a safety check and it broke, and that is worth saying whether or not
    // the run carries a tenant.
    //
    // A reader that was never supplied is only worth reporting on an
    // organization-scoped run with an organization. The drafting runner in
    // routes/sonara-ai-integrations-routes.cjs deliberately runs with
    // `scope: "process"` and no tenant, where an agent's own failure history is
    // not a thing that exists, and a line about it on every draft would be noise
    // that teaches people to ignore the line.
    const unwired = typeof readHistory !== "function";
    const tenantScoped = scope === "organization" && Boolean(organizationId);
    const reportBreaker = classification.breaker === "unavailable" && (unwired ? tenantScoped : true);
    if (reportBreaker) {
      onBreakerDegraded({
        actionType,
        reason: unwired
          ? "no history reader was supplied to this runner, so the autonomy breaker cannot evaluate anything"
          : (history?.reason || "history unreadable")
      });
      // Counted separately from the run's own outcome. A run can complete
      // perfectly while the safety check in front of it was blind, and those
      // are two facts -- three of the four rate limiters in this codebase
      // failed open in silence for months, which is the reason this module
      // reports a degraded breaker out loud at all.
      emitEvent({
        event: "agent.autonomy_breaker",
        scope,
        organizationId,
        capability: "agent_action",
        outcome: "degraded",
        reason: unwired ? "no_history_reader" : "history_unreadable",
        correlationId: actionType || null,
        detail: {
          detail: unwired
            ? "this runner was constructed without readHistory; the breaker and the volume limit both evaluate nothing"
            : (history?.reason || "history unreadable")
        }
      });
    }

    // A cap that cannot see says so, for the reason the breaker's own degraded
    // line gives: three of the four rate limiters in this codebase failed open
    // in silence and nobody knew for months.
    if (classification.limit === "unavailable" && (unwired ? tenantScoped : true)) {
      emitEvent({
        event: "agent.volume_limit",
        scope,
        organizationId,
        capability: "agent_action",
        outcome: "degraded",
        reason: unwired ? "no_history_reader" : "history_undated",
        correlationId: actionType || null,
        detail: {
          skipped_undated: classification.limitSkippedUndated ?? null,
          detail: unwired
            ? "this runner was constructed without readHistory; no volume cap is being applied"
            : (history?.reason || "no usable timestamps on the recent runs")
        }
      });
    }

    // A tripped cap is not an error and is not a failure. It is this code
    // working, and it is the one signal that says a runaway is in progress --
    // so it is emitted whether or not anybody is watching the queue.
    if (classification.limit === "tripped") {
      emitEvent({
        event: "agent.volume_limit",
        scope,
        organizationId,
        capability: "agent_action",
        outcome: "refused",
        reason: "volume_limit_reached",
        correlationId: actionType || null,
        detail: {
          runs_in_window: classification.limitRuns ?? null,
          action_runs_in_window: classification.limitActionRuns ?? null,
          window_minutes: classification.limitWindowMinutes ?? null,
          ceiling: classification.limitCeiling ?? null,
          action_ceiling: classification.limitActionCeiling ?? null
        }
      });
    }

    const decision = classification.requiresOwnerApproval && !baseClassification.requiresOwnerApproval
      // Demoted by the breaker or by the volume cap. The action type itself is
      // still self-serve, so decideExecution would wave it through; the stricter
      // answer wins, exactly as it does when an action matches both a sensitive
      // pattern and the allowlist.
      //
      // One condition covers both on purpose. Either gate demoting means the
      // same thing to everything downstream -- the run is refused, queued, and
      // shown to the owner -- and `classification.reason` carries which one it
      // was, so the owner reads "3 of the last 10 failed" or "it has run 60
      // times in the last hour" rather than a shared sentence that says neither.
      ? { allowed: false, classification, reason: classification.reason }
      : decideExecution({ action, approval });

    const base = {
      actionType,
      classification,
      startedAt,
      finishedAt: startedAt,
      logs: []
    };

    // One emit for the four exits, so they cannot drift in how they report.
    //
    // The outcome mapping, and the one that took thinking:
    //
    //   completed     -> ok
    //   failed        -> failed        a handler threw
    //   refused       -> refused       a gate said no, which is this code
    //                                  working; counting it against an error
    //                                  budget would make the budget measure
    //                                  how often owners propose gated actions
    //   unimplemented -> degraded      and this is the arguable one
    //
    // `unimplemented` is "allowed to run and nothing implements it". It is not
    // `refused` -- the gate said yes. It is not `failed` either, or a known
    // capability gap would spend error budget every time somebody presses the
    // button, and the resulting rate would measure the roadmap rather than
    // reliability. `degraded` is the closest true member: the run was accepted
    // and the guarantee that approving an action changes something did not
    // hold, which is exactly what CLAUDE.md says this state exists to say --
    // "the one thing a button here must never do is report a job as done when
    // it was not."
    //
    // If an owner wants it counted on its own, the place to add a member is
    // OUTCOMES in lib/sonara-structured-log.cjs, deliberately. It is recorded
    // here as a decision somebody can disagree with rather than as an obvious
    // mapping, because it is not obvious.
    const emitRun = (runRecord) => {
      const outcome = runRecord.status === "completed"
        ? "ok"
        : runRecord.status === "refused"
          ? "refused"
          : runRecord.status === "unimplemented"
            ? "degraded"
            : "failed";
      emitEvent({
        event: "agent.run",
        scope,
        organizationId,
        capability: "agent_action",
        outcome,
        reason: runRecord.status === "unimplemented" ? "unimplemented" : (runRecord.reason || runRecord.status),
        // The action type, so one agent action's runs can be followed across
        // proposals and approvals.
        correlationId: actionType || null,
        detail: {
          status: runRecord.status,
          requires_owner_approval: Boolean(classification.requiresOwnerApproval),
          // Whether the autonomy breaker could be evaluated at all. A safety
          // check running blind is worth counting separately from one that ran.
          breaker: classification.breaker || null,
          duration_ms: Math.max(0, Date.parse(runRecord.finishedAt) - Date.parse(runRecord.startedAt)) || 0
        }
      });
    };

    if (!decision.allowed) {
      const refused = { ...base, status: "refused", allowed: false, reason: decision.reason, result: null };
      emitRun(refused);
      await persist(refused);
      await publish(refused, action, context);
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
      emitRun(missing);
      await persist(missing);
      await publish(missing, action, context);
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
      emitRun(done);
      await persist(done);
      await publish(done, action, context);
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
      emitRun(failed);
      await persist(failed);
      await publish(failed, action, context);
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

  // A durable event improves diagnosis and worker coordination, but it is not
  // allowed to turn an already-completed customer operation into a failed page.
  // The source action log remains the owner-facing execution record; the event
  // only records compact routing/status evidence through an injected publisher.
  async function publish(runRecord, action, context) {
    if (typeof publishEvent !== "function") return;
    try {
      await publishEvent({ run: runRecord, action, context });
    } catch {
      // Identical fault boundary to the injectable run recorder above. A
      // later worker/operations view can surface a failed outbox write; the
      // action itself must not be reclassified after its handler has run.
    }
  }

  return { register, run, registered: () => [...registry.keys()].sort() };
}

module.exports = { createRunner };
