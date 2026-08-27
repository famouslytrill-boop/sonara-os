"use strict";

// Reading and writing the two call tables.
//
// Everything that decides anything lives in `lib/sonara-call-signalling.cjs`.
// This is the half that talks to PostgREST, and it exists separately for the
// same reason `sonara-push-subscriptions.cjs` is separate from
// `sonara-web-push.cjs`: the rules are worth testing without a database, and
// the queries are worth reading without the rules in the way.
//
// ## Every read carries its own scope, and there are two kinds
//
// The business side is scoped by `organization_id`, like every other tenant
// read in this codebase -- the service-role key bypasses row level security, so
// that filter is the tenant boundary.
//
// The customer side has no organization and no account. It is scoped by the
// join token alone, which is why `byToken` selects on the token and then
// re-checks the row it got back rather than trusting the query to have been
// written correctly. A single missing filter on this path is a stranger reading
// somebody else's call.
//
// ## What `{ ok, rows }` is for here
//
// A failed read of `call_signals` must never be reported as "the other side has
// not sent anything yet". The first is a call that is about to be abandoned by
// a person watching a spinner; the second is the ordinary state a hundred times
// per call. They arrive looking identical and only this file knows which
// happened.

const signalling = require("./sonara-call-signalling.cjs");

const REQUIRED = Object.freeze(["supabaseUrl", "serviceRoleHeaders"]);

const SESSIONS = "call_sessions";
const SIGNALS = "call_signals";

// The columns a caller actually reads. Not `*`: a select naming its columns is
// the difference between a query somebody can check and one that grows silently.
const SESSION_COLUMNS = "id,organization_id,customer_id,join_token,status,connected_at,ended_at,end_reason,created_at,expires_at";

// Deliberately without join_token. Everything the customer's page needs to know
// about its own call, minus the capability itself -- a token echoed back into a
// poll response is a token in a browser log.
const SAFE_SESSION_COLUMNS = "id,organization_id,customer_id,status,connected_at,ended_at,end_reason,created_at,expires_at";

async function request(deps, path, init = {}, fetchImpl = fetch) {
  let response;
  try {
    response = await fetchImpl(`${deps.supabaseUrl}/rest/v1/${path}`, {
      ...init,
      headers: { ...deps.serviceRoleHeaders(), ...(init.headers || {}) }
    });
  } catch {
    return { ok: false, code: "unreachable", rows: [] };
  }
  if (!response?.ok) return { ok: false, code: "unwritable", status: response?.status ?? null, rows: [] };
  let rows;
  try {
    rows = await response.json();
  } catch {
    // A write with no representation asked for legitimately returns nothing.
    return { ok: true, rows: [] };
  }
  return { ok: true, rows: Array.isArray(rows) ? rows : [rows] };
}

/**
 * Place a call, and return the row the caller needs to build a join link.
 *
 * The token and the expiry are generated here rather than accepted from the
 * caller. A route that could choose either could choose a weak one, and the
 * route is the part most likely to be copied for the next feature.
 */
async function place(deps, { organizationId, customerId = null, createdBy = null }, options = {}) {
  if (!organizationId) return { ok: false, code: "no_organization" };
  const now = options.now ?? Date.now();
  const row = {
    organization_id: organizationId,
    customer_id: customerId || null,
    created_by: createdBy || null,
    join_token: options.token || signalling.newJoinToken(),
    status: "ringing",
    expires_at: signalling.expiryFrom(now)
  };
  const written = await request(
    deps,
    SESSIONS,
    { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(row) },
    options.fetchImpl || fetch
  );
  if (!written.ok) return { ok: false, code: written.code || "unwritable" };
  const created = written.rows[0];
  if (!created?.id) return { ok: false, code: "unwritable", detail: "The call was not returned after being written." };
  return { ok: true, call: created };
}

/** One call, by id, belonging to this organization. */
async function byId(deps, { organizationId, callId }, fetchImpl = fetch) {
  if (!organizationId || !callId) return { ok: false, code: "no_call" };
  const found = await request(
    deps,
    `${SESSIONS}?select=${SESSION_COLUMNS}&id=eq.${encodeURIComponent(callId)}&organization_id=eq.${encodeURIComponent(organizationId)}&limit=1`,
    {},
    fetchImpl
  );
  if (!found.ok) return { ok: false, code: "unreadable" };
  // An empty list is a real answer -- no such call in this business -- and is
  // reported differently from a read that did not happen.
  if (!found.rows[0]) return { ok: false, code: "no_such_call" };
  return { ok: true, call: found.rows[0] };
}

/**
 * One call, by the token in a join link.
 *
 * The row is re-checked against the token it was fetched with. A query written
 * or edited wrongly on this path hands a stranger somebody else's call, and
 * that is not a failure any test of the happy path would notice.
 */
async function byToken(deps, token, fetchImpl = fetch) {
  const wanted = String(token || "");
  if (!/^[A-Za-z0-9_-]{40,64}$/.test(wanted)) return { ok: false, code: "no_such_call" };
  const found = await request(
    deps,
    `${SESSIONS}?select=${SESSION_COLUMNS}&join_token=eq.${encodeURIComponent(wanted)}&limit=1`,
    {},
    fetchImpl
  );
  if (!found.ok) return { ok: false, code: "unreadable" };
  const call = found.rows[0];
  if (!call) return { ok: false, code: "no_such_call" };
  if (call.join_token !== wanted) return { ok: false, code: "no_such_call" };
  return { ok: true, call };
}

/** Everything the far end has sent on this call since `after`. */
async function signalsFor(deps, { callId, organizationId, role, after = null }, fetchImpl = fetch) {
  if (!callId || !organizationId) return { ok: false, code: "no_call", rows: [] };
  if (!signalling.ROLES.includes(role)) return { ok: false, code: "unknown_role", rows: [] };
  const from = signalling.otherRole(role);
  const cursor = after ? `&created_at=gt.${encodeURIComponent(new Date(after).toISOString())}` : "";
  const found = await request(
    deps,
    `${SIGNALS}?select=id,kind,payload,created_at` +
      `&call_id=eq.${encodeURIComponent(callId)}` +
      `&organization_id=eq.${encodeURIComponent(organizationId)}` +
      `&from_role=eq.${encodeURIComponent(from)}${cursor}` +
      `&order=created_at.asc&limit=${signalling.MAX_SIGNALS_PER_POLL}`,
    {},
    fetchImpl
  );
  // Not `rows: []` on failure without saying so. "Nothing yet" and "we could
  // not look" are the same shape and different facts.
  if (!found.ok) return { ok: false, code: "unreadable", rows: [] };
  return { ok: true, rows: found.rows };
}

/** Store one offer, answer, candidate or hangup. */
async function addSignal(deps, { callId, organizationId, role, kind, payload }, fetchImpl = fetch) {
  const valid = signalling.validateSignal({ role, kind, payload });
  if (!valid.ok) return valid;
  if (!callId || !organizationId) return { ok: false, code: "no_call" };
  const written = await request(
    deps,
    SIGNALS,
    {
      method: "POST",
      body: JSON.stringify({ call_id: callId, organization_id: organizationId, from_role: role, kind, payload })
    },
    fetchImpl
  );
  if (!written.ok) return { ok: false, code: written.code || "unwritable" };
  return { ok: true };
}

/**
 * Move a call on: answered, or over.
 *
 * The status is checked against the table's own list rather than passed
 * through. A status PostgREST rejects surfaces as a check-constraint error
 * nobody outside this file can read, on a hangup nobody can retry.
 */
async function setStatus(deps, { callId, organizationId, status, reason = null }, options = {}) {
  if (!signalling.STATUSES.includes(status)) return { ok: false, code: "unknown_status" };
  if (!callId || !organizationId) return { ok: false, code: "no_call" };
  const now = new Date(options.now ?? Date.now()).toISOString();
  const patch = { status };
  if (status === "connected") patch.connected_at = now;
  // The table's own constraint requires it, and setting it here is what keeps
  // that constraint from being the thing that reports the bug.
  if (status === "ended" || status === "missed") patch.ended_at = now;
  if (reason) patch.end_reason = String(reason).slice(0, 200);

  const written = await request(
    deps,
    `${SESSIONS}?id=eq.${encodeURIComponent(callId)}&organization_id=eq.${encodeURIComponent(organizationId)}`,
    { method: "PATCH", body: JSON.stringify(patch) },
    options.fetchImpl || fetch
  );
  if (!written.ok) return { ok: false, code: written.code || "unwritable" };
  return { ok: true, status };
}

/** Recent calls placed against one customer record. */
async function forCustomer(deps, { organizationId, customerId, limit = 20 }, fetchImpl = fetch) {
  if (!organizationId || !customerId) return { ok: false, code: "no_customer", rows: [] };
  const found = await request(
    deps,
    `${SESSIONS}?select=${SAFE_SESSION_COLUMNS}` +
      `&organization_id=eq.${encodeURIComponent(organizationId)}` +
      `&customer_id=eq.${encodeURIComponent(customerId)}` +
      `&order=created_at.desc&limit=${Number(limit) || 20}`,
    {},
    fetchImpl
  );
  if (!found.ok) return { ok: false, code: "unreadable", rows: [] };
  return { ok: true, rows: found.rows };
}

module.exports = {
  REQUIRED, SESSIONS, SIGNALS, SESSION_COLUMNS, SAFE_SESSION_COLUMNS,
  place, byId, byToken, signalsFor, addSignal, setStatus, forCustomer
};
