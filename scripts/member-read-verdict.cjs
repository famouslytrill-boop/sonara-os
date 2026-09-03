"use strict";

/**
 * What two row counts mean, when one was taken as service_role and the other as
 * the organization's own member.
 *
 * Split out of `verify-member-read-access.mjs` so it can be tested. That script
 * is a command-line tool with top-level `await` and `process.exit`, and it
 * cannot run at all without a real database -- so the one function in it that
 * makes a *decision* could not be exercised, and it was wrong.
 *
 * ## What the decision is for
 *
 * Every Supabase call this application makes uses the service-role key, which
 * bypasses row level security entirely. The plan is to forward the caller's JWT
 * on user-facing reads so RLS becomes a real second line of defence. The danger
 * in that switch is quiet: if a table's policy does not match, a user-scoped
 * read returns **zero rows and HTTP 200**. Nothing errors. The workspace simply
 * renders empty, and it looks like the customer has no data rather than like a
 * bug.
 *
 * So this is what stands between somebody and switching a read that will blank
 * a page. It is worth being exact.
 *
 * ## The bug this had
 *
 * The count comes out of PostgREST's `Content-Range` header, parsed as
 * `Number(range.split("/")[1])`, and the caller turns a non-finite result into
 * `null` -- a header that is missing or malformed gives no count.
 *
 * The original compared counts with `===` and had no case for that. With both
 * counts `null`:
 *
 *   asService.count === 0   ->  null === 0    ->  false
 *   asUser.count === 0      ->  null === 0    ->  false
 *   asUser.count !== asService.count  ->  null !== null  ->  false
 *   -> { state: "ready", why: "member sees all null rows" }
 *
 * and the script prints that table under **"Safe to add to the user-scoped read
 * list, on this evidence"**. Two counts it could not read, reported as proof.
 * `null` is not a number and not a zero; it is "we could not tell", and that is
 * a third state.
 */

/** Is this a count we actually read, rather than one we failed to parse? */
function counted(value) {
  return Number.isInteger(value) && value >= 0;
}

/**
 * @param {{ asService: {ok: boolean, status: number, count: number|null},
 *           asUser:    {ok: boolean, status: number, count: number|null} }} row
 * @returns {{ state: "ready"|"partial"|"blocked"|"no-evidence"|"unknown", why: string }}
 */
function verdict(row) {
  if (!row.asService.ok) {
    return { state: "unknown", why: `service-role read failed (HTTP ${row.asService.status}); the table may not exist` };
  }
  if (!row.asUser.ok) {
    return { state: "blocked", why: `member read failed (HTTP ${row.asUser.status}); the role lacks a grant, not just a policy` };
  }

  // Both requests succeeded. Whether they said anything is a separate question,
  // and it has to be asked before the counts are compared -- comparing two
  // values that were never read agrees with itself.
  const missing = [];
  if (!counted(row.asService.count)) missing.push("service-role");
  if (!counted(row.asUser.count)) missing.push("member");
  if (missing.length) {
    return {
      state: "unknown",
      why: `the ${missing.join(" and ")} read returned no usable row count, so this proves nothing either way ` +
        "(PostgREST reports it in Content-Range; a proxy that strips the header looks exactly like this)"
    };
  }

  if (row.asService.count === 0) {
    return { state: "no-evidence", why: "this organization has no rows here, so an empty member read proves nothing" };
  }
  if (row.asUser.count === 0) {
    return {
      state: "blocked",
      why: `service-role sees ${row.asService.count} rows, the member sees 0 -- switching this read would blank the page`
    };
  }
  if (row.asUser.count !== row.asService.count) {
    return { state: "partial", why: `member sees ${row.asUser.count} of ${row.asService.count} rows` };
  }
  return { state: "ready", why: `member sees all ${row.asService.count} rows` };
}

// Every state this can return. The script prints one mark per state and would
// otherwise print `undefined` for a state added here and not there.
const STATES = Object.freeze(["ready", "partial", "blocked", "no-evidence", "unknown"]);

module.exports = { verdict, counted, STATES };
