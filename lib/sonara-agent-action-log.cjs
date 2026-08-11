"use strict";

// Where an agent run is written down.
//
// createRunner in lib/sonara-agent-runner.cjs takes an injectable recorder and
// shipped with none. The note in that file said the agent tables are scoped by
// entity_id while the rest of the product scopes by organization, so there was
// nowhere correct to write. That was true of the nineteen entity_* tables from
// migration 008. It was not true of the whole schema: agent_action_logs, from
// the platform foundation migration, has organization_id, has an
// (organization_id, created_at desc) index, is listed in TENANT_SCOPED_TABLES,
// and nothing in the codebase reads or writes it. It is the right table and it
// was already there.
//
// Two things this deliberately does not persist.
//
// The handler's return value. A handler talks to Supabase and to customer
// records; its result can carry an email address, an invoice, a draft reply. An
// action log is read by anyone who can see the organization's activity, and it
// is kept after the record it describes is deleted. Storing the status of a run
// answers "what did the agent do"; storing the payload turns an audit trail
// into a second copy of the data with different retention. Only the status is
// written.
//
// The row's own approval column as a source of truth. approval_state here is
// derived from classifyAction every time, for the same reason decideExecution
// ignores requires_approval: a column the subject can write is not a control.

const { redactSensitiveText } = require("./sonara-redaction.cjs");

const TABLE = "agent_action_logs";

// agent_action_logs.risk_level is free text with a 'medium' default. These three
// values are what the queue page filters on, so they are fixed here rather than
// at each call site.
function riskLevelFor(classification) {
  if (!classification?.requiresOwnerApproval) return "low";
  // An action nobody has named is not known to be dangerous -- it is known to be
  // unchecked. Ranking it alongside a refund would bury refunds.
  if (classification.category === "unrecognised" || classification.category === "unnamed") return "medium";
  return "high";
}

// What the owner needs to know about a run, in the vocabulary of the table.
//
//   pending      -- gated, and it did not run
//   approved     -- gated, an approval existed, it ran
//   not_required -- on the self-serve allowlist
function approvalStateFor(run) {
  if (!run?.classification?.requiresOwnerApproval) return "not_required";
  return run.status === "refused" ? "pending" : "approved";
}

function toRow({ run, organizationId, agentKey = "unassigned", actorUserId = null }) {
  if (!organizationId) {
    // Loud rather than a row with a null tenant. agent_action_logs.organization_id
    // is nullable, so a missing scope would insert cleanly and become a row
    // belonging to nobody that every organization's query misses.
    throw new TypeError("recording an agent run requires an organizationId");
  }

  const classification = run?.classification || null;

  return {
    organization_id: organizationId,
    actor_user_id: actorUserId,
    agent_key: String(agentKey || "unassigned"),
    tool_key: String(run?.actionType || "unnamed"),
    action: String(run?.actionType || "unnamed"),
    risk_level: riskLevelFor(classification),
    approval_state: approvalStateFor(run),
    result: String(run?.status || "unknown"),
    metadata: {
      category: classification?.category || "unknown",
      // The reason is assembled from the authority module's own sentences, but
      // a failed run's reason is a redacted handler error, and redaction is
      // cheap enough to apply twice rather than depend on the caller's path.
      reason: redactSensitiveText(String(run?.reason || "")),
      started_at: run?.startedAt || null,
      finished_at: run?.finishedAt || null
    }
  };
}

/**
 * A recorder for createRunner({ record }).
 *
 * Returns { ok } and never throws on a network failure -- the runner swallows
 * recorder errors so that losing the note about a run cannot turn a completed
 * run into a failed page, and a recorder that relies on being swallowed is one
 * that hides its own breakage. toRow still throws on a missing organizationId,
 * because that is a programming error at wiring time, not a runtime condition.
 */
function createActionLogRecorder({ organizationId, agentKey, actorUserId = null, getSupabaseServerConfig }) {
  return async function record(run) {
    const row = toRow({ run, organizationId, agentKey, actorUserId });
    const config = typeof getSupabaseServerConfig === "function" ? getSupabaseServerConfig() : { ok: false };
    if (!config?.ok) return { ok: false, status: 503 };

    const response = await fetch(`${config.url}/rest/v1/${TABLE}`, {
      method: "POST",
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      },
      body: JSON.stringify(row)
    }).catch(() => undefined);

    return { ok: Boolean(response?.ok), status: response?.status || 0 };
  };
}

module.exports = { TABLE, toRow, riskLevelFor, approvalStateFor, createActionLogRecorder };
