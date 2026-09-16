"use strict";

// What a campaign send did, per recipient, and what may be concluded from it.
//
// `lib/growth-studio-dispatch.cjs` already distinguishes three outcomes per
// address -- accepted, failed, not attempted -- and until now it reported them
// and forgot them. That is the gap its own header names:
//
//   "Reaching only the remainder needs a per-recipient record of who was
//   accepted, which is also what the >1,000 cross-invocation queue needs and is
//   why both are still unbuilt."
//
// This module is the two halves of that record: `sendRowsFor` turns one
// dispatch result into rows for `public.growth_campaign_sends`, and
// `remainderFrom` answers "who still has not been reached" from rows read back.
//
// Both are pure. The writing and reading are injected by the caller, because a
// function that both decides and persists cannot be tested on the deciding.
//
// ## The one rule this file exists to enforce
//
// **An absent record must never read as "nobody was reached."**
//
// Those are opposite facts with the same shape: a campaign that sent nothing
// and a campaign whose record write failed both produce zero accepted rows. Get
// that wrong and the product tells an owner it is safe to resend to everybody,
// which is precisely the silent double-send the dispatcher was fixed to stop
// recommending on 15 September 2026.
//
// So `remainderFrom` takes a read OUTCOME, not an array. `{ ok: false }` returns
// `known: false` and an empty remainder -- refusing to answer rather than
// answering "everybody". A bare array is rejected outright, because accepting
// one would let a caller pass `[]` from a failed read and get back the whole
// list.
//
// That is shape 4 from .claude/skills/checks-that-cannot-lie: null is not [] is
// not 0, and three states rather than two wherever a thing may not be known.

const STATUSES = Object.freeze(["accepted", "failed", "not_attempted"]);

// The address as the unique index sees it. Mirrors
// `lower(email)` in growth_campaign_sends_accepted_once: if these two ever
// disagree, the database would accept a second row for one person and the
// remainder would silently shrink.
function normaliseEmail(value) {
  return String(value === null || value === undefined ? "" : value).trim().toLowerCase();
}

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

// One dispatch result becomes one row per address it has something to say
// about.
//
// `accepted` arrives as either a bare address or `{ email, providerMessageId }`
// -- the batch path can attribute an id and the individual path cannot, and the
// row records which rather than inventing one.
function sendRowsFor({ organizationId, campaignId, accepted, failed, notAttempted, leadIdByEmail } = {}) {
  if (!nonEmpty(organizationId)) {
    return { ok: false, code: "no_organization", detail: "A send record has to name the organization it belongs to.", rows: [] };
  }
  if (!nonEmpty(campaignId)) {
    return { ok: false, code: "no_campaign_id", detail: "A send record has to name the campaign it belongs to.", rows: [] };
  }

  const leads = leadIdByEmail instanceof Map
    ? leadIdByEmail
    : new Map(Object.entries(leadIdByEmail && typeof leadIdByEmail === "object" ? leadIdByEmail : {}));

  const rows = [];
  const seenAccepted = new Set();
  const dropped = [];

  const leadFor = (email) => leads.get(normaliseEmail(email)) || null;

  for (const entry of Array.isArray(accepted) ? accepted : []) {
    const email = typeof entry === "string" ? entry : entry?.email;
    if (!nonEmpty(email)) {
      // An acceptance with no address is a claim somebody was reached without
      // saying who. Counted rather than skipped: the count is what tells a
      // reader the record is incomplete.
      dropped.push({ status: "accepted", reason: "no_email" });
      continue;
    }
    const key = normaliseEmail(email);
    if (seenAccepted.has(key)) {
      // The partial unique index would reject this anyway. Collapsing it here
      // means one bad batch does not fail the whole insert and lose the rest.
      dropped.push({ status: "accepted", reason: "duplicate_in_one_send", email });
      continue;
    }
    seenAccepted.add(key);
    rows.push({
      organization_id: organizationId,
      campaign_id: campaignId,
      lead_id: leadFor(email),
      email: String(email).trim(),
      status: "accepted",
      provider_message_id: typeof entry === "string" ? null : (nonEmpty(entry?.providerMessageId) ? entry.providerMessageId : null),
      provider_status: null,
      reason: null
    });
  }

  for (const entry of Array.isArray(failed) ? failed : []) {
    if (!nonEmpty(entry?.email)) {
      dropped.push({ status: "failed", reason: "no_email" });
      continue;
    }
    rows.push({
      organization_id: organizationId,
      campaign_id: campaignId,
      lead_id: leadFor(entry.email),
      email: String(entry.email).trim(),
      status: "failed",
      provider_message_id: null,
      // 0 is the dispatcher's "no response at all", and it is a real state
      // rather than a missing one, so it is stored rather than nulled.
      provider_status: Number.isFinite(Number(entry.status)) ? Number(entry.status) : null,
      reason: nonEmpty(entry.reason) ? entry.reason : null
    });
  }

  for (const entry of Array.isArray(notAttempted) ? notAttempted : []) {
    if (!nonEmpty(entry?.email)) {
      dropped.push({ status: "not_attempted", reason: "no_email" });
      continue;
    }
    rows.push({
      organization_id: organizationId,
      campaign_id: campaignId,
      lead_id: leadFor(entry.email),
      email: String(entry.email).trim(),
      status: "not_attempted",
      provider_message_id: null,
      provider_status: null,
      reason: nonEmpty(entry.reason) ? entry.reason : "not_attempted"
    });
  }

  return {
    ok: true,
    code: rows.length ? "rows_built" : "nothing_to_record",
    rows,
    acceptedCount: seenAccepted.size,
    // Returned rather than swallowed. A caller that gets rows back and a
    // non-empty `dropped` knows the record it is about to write is incomplete,
    // which is a different thing from a record that failed to write.
    dropped
  };
}

// Who a campaign has still not reached.
//
// `outcome` is `{ ok, rows }` from the caller's read -- never a bare array. See
// the header: `[]` from a failed read and `[]` from a campaign nobody was
// reached in are the same value and opposite facts.
function remainderFrom(recipients, outcome) {
  const list = Array.isArray(recipients) ? recipients : [];

  if (Array.isArray(outcome)) {
    // Deliberately a refusal rather than a convenience. Accepting an array here
    // is what would let a failed read become "resend to everyone".
    return {
      known: false,
      code: "outcome_not_carried",
      detail: "remainderFrom needs the read outcome { ok, rows }, not the rows alone: an empty array from a failed read is indistinguishable from a campaign that reached nobody.",
      remainder: [],
      alreadyReached: 0
    };
  }

  if (!outcome || outcome.ok !== true) {
    return {
      known: false,
      code: outcome && outcome.code ? outcome.code : "record_unavailable",
      detail: "The send record could not be read, so who has already been reached is unknown. Sending again now would re-mail whoever was reached the first time.",
      remainder: [],
      alreadyReached: 0
    };
  }

  const rows = Array.isArray(outcome.rows) ? outcome.rows : null;
  if (!rows) {
    return {
      known: false,
      code: "rows_not_a_list",
      detail: "The send record read succeeded without returning rows, which is not an answer about who was reached.",
      remainder: [],
      alreadyReached: 0
    };
  }

  // Only an accepted row means an email is in somebody's inbox. A failed or
  // not-attempted row is precisely the person who still needs reaching, so
  // filtering on status here is the whole correctness of the remainder.
  const reached = new Set(
    rows
      .filter((row) => row && row.status === "accepted" && nonEmpty(row.email))
      .map((row) => normaliseEmail(row.email))
  );

  const remainder = list.filter((recipient) => {
    const email = typeof recipient === "string" ? recipient : recipient?.email;
    if (!nonEmpty(email)) return false;
    return !reached.has(normaliseEmail(email));
  });

  return {
    known: true,
    code: remainder.length ? "remainder" : "all_reached",
    remainder,
    alreadyReached: reached.size,
    detail: remainder.length
      ? `${reached.size} of ${list.length} were already reached; ${remainder.length} remain.`
      : `All ${list.length} were already reached, so there is nothing to send again.`
  };
}

const SEND_RECORD_TABLE = "growth_campaign_sends";

// How many rows may be re-inserted one at a time when a batch insert conflicts.
//
// A conflict means the partial unique index rejected at least one accepted row,
// and PostgREST fails the whole statement without saying which. That is an
// uninterpretable state, and this repository's own rule -- written in
// lib/growth-studio-dispatch.cjs about an undocumented batch-email response --
// is to retry in a form that cannot be ambiguous rather than to guess.
//
// Bounded for the reason the email fallback is bounded: Vercel's documented
// duration is 300 seconds, and a thousand sequential inserts would not finish.
// Past the bound the outcome is reported as partial rather than claimed.
const MAX_INDIVIDUAL_RETRIES = 200;

function postgrestHeaders(config, extra) {
  return {
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${config.serviceRoleKey}`,
    "Content-Type": "application/json",
    ...extra
  };
}

// Append the rows. Returns whether who-was-reached is now on record.
//
// A 409 is the unique index doing its job on a retried send: those acceptances
// are already recorded, which is success from the caller's point of view. But a
// 409 on a BATCH does not say which row conflicted, so the batch is re-inserted
// individually and each row's outcome is attributed -- the same choice, for the
// same reason, as the batch-email fallback.
function createSendRecorder({ getSupabaseServerConfig, fetchImpl = fetch }) {
  return async function record(rows) {
    const list = Array.isArray(rows) ? rows : [];
    if (!list.length) return { ok: true, code: "nothing_to_record", written: 0 };

    const config = typeof getSupabaseServerConfig === "function" ? getSupabaseServerConfig() : { ok: false };
    if (!config?.ok) return { ok: false, status: 503, code: "supabase_unconfigured", written: 0 };

    const endpoint = `${config.url}/rest/v1/${SEND_RECORD_TABLE}`;

    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: postgrestHeaders(config, { Prefer: "return=minimal" }),
      body: JSON.stringify(list)
    }).catch(() => undefined);

    if (response?.ok) return { ok: true, status: response.status, code: "recorded", written: list.length };

    if (response?.status !== 409) {
      return { ok: false, status: response?.status || 0, code: "send_record_write_failed", written: 0 };
    }

    if (list.length > MAX_INDIVIDUAL_RETRIES) {
      // Honest rather than convenient. Claiming `ok` here would tell a caller
      // the remainder is computable when part of the record may be missing.
      return {
        ok: false,
        status: 409,
        code: "send_record_conflict_too_large_to_attribute",
        written: 0,
        detail: `${list.length} rows conflicted and only ${MAX_INDIVIDUAL_RETRIES} can be re-inserted individually within one invocation, so which of them landed is unknown.`
      };
    }

    let written = 0;
    let duplicate = 0;
    const failures = [];

    for (const row of list) {
      const single = await fetchImpl(endpoint, {
        method: "POST",
        headers: postgrestHeaders(config, { Prefer: "return=minimal" }),
        body: JSON.stringify([row])
      }).catch(() => undefined);

      if (single?.ok) { written += 1; continue; }
      // Already on record from an earlier invocation. The fact this row asserts
      // is true and stored, so it counts towards the record being complete.
      if (single?.status === 409) { duplicate += 1; continue; }
      failures.push({ email: row?.email || null, status: single?.status || 0 });
    }

    if (failures.length) {
      return {
        ok: false,
        status: 409,
        code: "send_record_partially_written",
        written,
        duplicate,
        failures,
        detail: `${written} recorded, ${duplicate} already recorded, ${failures.length} could not be recorded, so who was reached is incomplete.`
      };
    }

    return { ok: true, status: 409, code: written ? "recorded_after_conflict" : "already_recorded", written, duplicate };
  };
}

// Read back one campaign's send record, organization-scoped.
//
// Returns `{ ok, rows }` and never a bare array, because remainderFrom refuses a
// bare array -- see this file's header for why.
//
// The organization filter is not a convenience here. The service-role key
// bypasses RLS, so `organization_id=eq.` IS the tenant boundary on this read.
function createSendRecordReader({ getSupabaseServerConfig, fetchImpl = fetch, rowLimit = 5000 }) {
  return async function read({ organizationId, campaignId } = {}) {
    if (!nonEmpty(organizationId)) return { ok: false, code: "no_organization", rows: [] };
    if (!nonEmpty(campaignId)) return { ok: false, code: "no_campaign_id", rows: [] };

    const config = typeof getSupabaseServerConfig === "function" ? getSupabaseServerConfig() : { ok: false };
    if (!config?.ok) return { ok: false, code: "supabase_unconfigured", rows: [] };

    const query = new URLSearchParams({
      select: "email,status,provider_message_id,created_at",
      organization_id: `eq.${organizationId}`,
      campaign_id: `eq.${campaignId}`,
      limit: String(rowLimit + 1)
    });

    const response = await fetchImpl(`${config.url}/rest/v1/${SEND_RECORD_TABLE}?${query}`, {
      headers: postgrestHeaders(config, { Accept: "application/json" })
    }).catch(() => undefined);

    if (!response?.ok) return { ok: false, code: `send_record_read_failed_${response?.status || 0}`, rows: [] };

    const body = await response.json().catch(() => null);
    if (!Array.isArray(body)) return { ok: false, code: "send_record_unreadable", rows: [] };

    if (body.length > rowLimit) {
      // A truncated record would understate who was reached, and understating
      // it is what re-mails somebody. Refused rather than returned short.
      return { ok: false, code: "send_record_too_large_to_read", rows: [] };
    }

    return { ok: true, code: "read", rows: body };
  };
}

module.exports = {
  STATUSES,
  SEND_RECORD_TABLE,
  MAX_INDIVIDUAL_RETRIES,
  normaliseEmail,
  sendRowsFor,
  remainderFrom,
  createSendRecorder,
  createSendRecordReader
};
