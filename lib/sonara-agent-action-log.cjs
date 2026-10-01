// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
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

// Reading the log back, so the autonomy breaker in sonara-agent-authority.cjs
// has a history to judge.
//
// This table was written and never read into a decision. That is the half of
// this file that made an agent's record decorative: every outcome recorded,
// nothing consulted.
//
// Three things this must get right, and each is a defect this repository has
// already had somewhere else:
//
//   * organization_id=eq. is not optional. The service-role key bypasses
//     row-level security, so that filter IS the tenant boundary -- without it
//     this reads every organization's agent history and demotes one business's
//     agent on another's failures. scripts/report-tenant-scoped-queries.mjs
//     audits exactly this.
//   * agent_key must be filtered too, or one agent's failures demote all of
//     them.
//   * The outcome is carried, never a bare array. {ok:false} and {ok:true,
//     rows:[]} are different facts -- "the read failed" and "this agent has a
//     clean sheet" -- and a bare [] would collapse them into the second, which
//     is the more dangerous one to guess.
// How many rows one read fetches.
//
// The breaker wants the newest `window` rows; the volume limit in
// lib/sonara-agent-limits.cjs wants everything inside a time window, which is a
// different shape over the same rows. Fetching the larger of the two once and
// letting each consumer take what it needs keeps this to ONE read per run --
// adding a second query to the path every agent run goes through, for two
// numbers off the same index, would be the expensive way to answer the same
// question.
//
// 200 is sized against the volume cap rather than guessed: MAX_UNATTENDED_RUNS
// is 60 an hour, so 200 rows covers the window with room for an organization
// well over it, and the read stays on the (organization_id, created_at desc)
// index that migration 20260601090000 created.
const HISTORY_FETCH_ROWS = 200;

function createActionHistoryReader({ organizationId, agentKey, getSupabaseServerConfig, window = 10, fetchRows = HISTORY_FETCH_ROWS }) {
  return async function readRecentOutcomes() {
    if (!organizationId) return { ok: false, rows: [], reason: "no organization scope" };

    const config = typeof getSupabaseServerConfig === "function" ? getSupabaseServerConfig() : { ok: false };
    if (!config?.ok) return { ok: false, rows: [], reason: "supabase not configured" };

    const query =
      // `action` carries the action type (toRow writes it alongside tool_key), and
      // it is what gives the per-action cap in lib/sonara-agent-limits.cjs
      // anything to count. Without it that cap reports "not counted" rather than
      // zero -- which is honest, and useless.
      `select=result,created_at,action` +
      `&organization_id=eq.${encodeURIComponent(organizationId)}` +
      `&agent_key=eq.${encodeURIComponent(String(agentKey || "unassigned"))}` +
      `&approval_state=eq.not_required` +
      // The larger of the two, so a caller asking for a bigger breaker window than
      // the fetch cannot silently get a window the read never filled -- which
      // would be a breaker quietly judging fewer runs than it was told to.
      `&order=created_at.desc&limit=${Math.max(Number(window) || 0, Number(fetchRows) || HISTORY_FETCH_ROWS)}`;

    const response = await fetch(`${config.url}/rest/v1/${TABLE}?${query}`, {
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        Accept: "application/json"
      }
    }).catch(() => undefined);

    if (!response?.ok) return { ok: false, rows: [], reason: `read failed (${response?.status || 0})` };

    const body = await response.json().catch(() => null);
    if (!Array.isArray(body)) return { ok: false, rows: [], reason: "unreadable response" };

    // The breaker reads `status`; the column is `result`. Mapped here rather
    // than teaching the breaker this table's column names, so the breaker stays
    // a pure function over outcomes.
    //
    // `at` is new, and its absence was a real defect rather than an omission.
    // `created_at` was in the select list and in the order clause and was then
    // dropped by this map, so it was paid for on every agent run and read by
    // nothing -- the shape scripts/report-unused-selected-columns.mjs exists to
    // hunt, which rated it advisory because `order=created_at.desc` counts as
    // the column being "named elsewhere in the file".
    //
    // What it cost: the breaker could only count by row order, so three failures
    // from six months ago still demoted an organization today, and no limit over
    // a time window was possible at all. Both are fixed by carrying the one
    // value the query was already fetching.
    return {
      ok: true,
      rows: body.map((row) => ({
        status: String(row?.result || ""),
        at: row?.created_at ? String(row.created_at) : null,
        actionType: row?.action ? String(row.action) : undefined
      }))
    };
  };
}

module.exports = { TABLE, HISTORY_FETCH_ROWS, toRow, riskLevelFor, approvalStateFor, createActionLogRecorder, createActionHistoryReader };
