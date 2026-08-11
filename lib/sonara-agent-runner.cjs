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
// It does not persist runs yet, and the reason is worth writing down rather
// than fixing badly. entity_action_runs is scoped by entity_id, and `entities`
// has no organization_id -- the nineteen agent tables use entity membership as
// their tenancy model while every other table in this product scopes by
// organization. Writing an organization's run into an entity-scoped table would
// mean either inventing an entity per organization or leaving the column null
// on a NOT NULL foreign key. Both are worse than not writing yet. The recorder
// is injectable so that decision can be made once, somewhere it is visible.
//
// It does not execute anything sensitive. A handler is registered against an
// action name, and the name is classified before the handler is reached. A
// handler registered under a sensitive name still needs an approval; there is
// no way to register past the gate.

const { classifyAction, decideExecution } = require("./sonara-agent-authority.cjs");

function now() {
  return new Date().toISOString();
}

function createRunner({ handlers = {}, record = null } = {}) {
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
    const classification = classifyAction(actionType);
    const decision = decideExecution({ action, approval });

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
