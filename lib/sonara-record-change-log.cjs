"use strict";

// Who changed a record, and when.
//
// Until 1 September 2026 nothing on the Business Builder owner record pages
// could change a saved record, so there was nothing to log and the absence of a
// log was not a gap. Two changes that day ended that: a status control on eleven
// pages and an edit form on twenty-five, both behind `requireBusinessManager`,
// which is owners **and managers**. A business with two people can now have a
// price changed with no way to find out by whom.
//
// This module is the write and read of `record_change_log`. It arrives because
// of those two changes rather than in anticipation of them.
//
// ## Names of fields, never values
//
// The row records which columns changed and nothing about what they held. That
// costs a real answer -- "the price was 4500 and is now 450" is better than
// "somebody changed the price" -- and it is refused because these records carry
// people's contact details. A log with before-and-after values is a second copy
// of every customer's phone number in a table with different retention, and
// `/account/data` says erasure here is a request a person handles rather than an
// automated wipe. A second copy is a second place that person must remember to
// clear, and the one they will not think of.
//
// ## A failed log is reported, not swallowed
//
// `record()` returns `{ ok }` and the caller says so. A log that quietly drops
// the writes it could not make is worse than no log, because it reads as
// complete: somebody looking for a change that is missing concludes it never
// happened. The change itself is already saved by then and must not be undone,
// so the only honest option left is to say the change was made and the record of
// it was not.

const TABLE = "record_change_log";
const KINDS = Object.freeze(["status", "fields"]);

/**
 * Record one change.
 *
 * `list` and `insert` are passed in rather than imported so this stays testable
 * without a database and so the caller keeps ownership of the Supabase config —
 * the same shape the rest of these modules use.
 *
 * Returns `{ ok }`, or `{ ok: false, code }` when there was nothing to record or
 * the write failed. `nothing_to_record` is not a failure: it is what an empty
 * field list means, and the caller decides whether that is worth saying.
 */
async function record(insert, { organizationId, table, recordId, changedBy, kind, fields }) {
  if (!organizationId) return { ok: false, code: "no_organization" };
  if (!table || !recordId) return { ok: false, code: "no_record" };
  if (!KINDS.includes(kind)) return { ok: false, code: "unknown_kind" };

  const named = (Array.isArray(fields) ? fields : [])
    .map((field) => String(field || "").trim())
    .filter(Boolean);
  // The database refuses an empty array too. Refusing here as well means the
  // caller gets a reason rather than a Postgres constraint message.
  if (!named.length) return { ok: false, code: "nothing_to_record" };

  const written = await insert(TABLE, {
    organization_id: organizationId,
    record_table: table,
    record_id: recordId,
    // Absent rather than empty: a change nobody could be attributed to is still
    // a change, and a placeholder id would name somebody who did not do it.
    changed_by: changedBy || null,
    change_kind: kind,
    changed_fields: named
  });

  return written?.ok === false ? { ok: false, code: "not_recorded" } : { ok: true };
}

/**
 * This record's history, newest first.
 *
 * Returns `{ ok, entries }`. The outcome travels with the rows because a read
 * that failed is not a record with no history, and rendering the two the same
 * way tells somebody a definite thing about their own data on the strength of a
 * request that did not happen.
 */
async function historyOf(list, { organizationId, table, recordId, limit = 20 }) {
  if (!organizationId || !table || !recordId) return { ok: false, entries: [] };
  const query = `?select=change_kind,changed_fields,changed_by,created_at`
    + `&organization_id=eq.${encodeURIComponent(organizationId)}`
    + `&record_table=eq.${encodeURIComponent(table)}`
    + `&record_id=eq.${encodeURIComponent(recordId)}`
    + `&order=created_at.desc&limit=${Math.min(Number(limit) || 20, 100)}`;
  const found = await list(TABLE, query);
  if (!found?.ok) return { ok: false, entries: [] };
  return { ok: true, entries: (found.rows || []).map(describe) };
}

/** One entry, as a sentence and a time. */
function describe(row) {
  const fields = Array.isArray(row?.changed_fields) ? row.changed_fields : [];
  const readable = fields.map((field) => String(field).replaceAll("_", " "));
  const what = row?.change_kind === "status"
    ? "Status changed"
    : readable.length === 1
      ? `${readable[0]} changed`
      : `${readable.length} fields changed: ${readable.join(", ")}`;
  return {
    what,
    // Three states, not two. Somebody may have made this change through a path
    // that could not name them, and "unknown" is a different answer from "the
    // owner did it".
    who: row?.changed_by ? "someone signed in to this business" : "not recorded",
    when: row?.created_at || null
  };
}

module.exports = { TABLE, KINDS, record, historyOf, describe };
