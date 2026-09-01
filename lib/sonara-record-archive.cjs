"use strict";

// Retiring a record without deleting it.
//
// Eleven of the twenty-seven owner record pages have a terminal status in their
// own vocabulary -- a quote goes `declined`, an invoice goes `void`, a booking
// goes `cancelled` -- and those pages already offer a way to say a record is
// finished with. **The other sixteen have no status at all.** A customer entered
// twice, a vehicle sold, a supplier no longer used, stays on the list for ever.
//
// ## Which pages get it is derived, not listed
//
// A hand-written list of sixteen table names here would be the copy that
// drifts: a page gaining a status later would end up offering two ways to
// retire the same record, and nothing would report it. So this asks the page
// whether its status vocabulary already contains a terminal value, and offers
// archiving only where it does not.
//
// ## What archiving is, and what it is deliberately not
//
// It is a **display** decision: stop showing me this on my list. It is not a
// delete, and it changes nothing else in this application.
//
// Exactly one read filters on `archived_at`: the owner list page. Nothing that
// computes money looks at it. An archived vendor invoice is still in the
// payables total, an archived time entry is still in the labour cost of its
// day, an archived sales summary is still in the revenue figure, and every
// accounting export still contains all of them.
//
// The alternative -- hiding archived rows from the totals as well -- is how a
// business ends up with a figure on screen that does not match its books,
// discovered at the end of a tax year. Somebody who archives a supplier they
// stopped using in March must not thereby change what March cost.
//
// The page says so in words. "Archive" reads like "delete" to most people, and
// the difference here is the entire design.

const recordStatus = require("./sonara-record-status.cjs");

// The one column this feature reads, named once.
const COLUMN = "archived_at";

// A status value that means this record is finished with.
//
// Matched as whole words against the page's own declared options rather than by
// substring, so a future `uncancelled` or `unarchived` cannot be read as
// terminal by accident.
const TERMINAL_STATUS = Object.freeze([
  "archived",
  "cancelled",
  "void",
  "declined",
  "expired",
  "completed",
  "written_off",
  "no_show",
  "paid",
  "received",
  "approved"
]);

/** The terminal values a page's own status vocabulary already offers. */
function terminalStatusesFor(page) {
  return recordStatus.statusOptionsFor(page).filter((option) => TERMINAL_STATUS.includes(String(option)));
}

/**
 * Whether this page needs an archive control.
 *
 * False when the page already has a way to retire a record, so no page ever
 * offers two.
 */
function canArchive(page) {
  if (!page?.table || !page?.path) return false;
  return terminalStatusesFor(page).length === 0;
}

/**
 * Why a page has no archive control, for a page that has to say.
 *
 * Two sentences rather than one, because the pages divide in two. Seven of the
 * eleven already offer `archived` as a status value, and telling somebody those
 * are "retired by setting their status to archived, rather than archived" --
 * which is what the first version said -- is a sentence that reads as a bug.
 */
function reasonWithoutArchive(page) {
  if (canArchive(page)) return null;
  const terminal = terminalStatusesFor(page);
  if (!terminal.length) return null;
  if (terminal.includes("archived")) {
    return "These are archived through the status control on the record itself, so there is no separate button.";
  }
  const readable = terminal.map((value) => String(value).replaceAll("_", " "));
  const last = readable.pop();
  const list = readable.length ? `${readable.join(", ")} or ${last}` : last;
  return `These are retired by setting their status to ${list}, which is this record's own word for finished with.`;
}

/**
 * The page's own select list, plus the column this feature reads.
 *
 * Sixteen page declarations name their columns explicitly and **not one of them
 * listed `archived_at`** -- there was no such column when they were written. So
 * the row handed to the renderer had no `archived_at`, the button read it as
 * absent, and every archived record still showed "Archive" rather than "Put
 * back": a control reporting the opposite of the state it is in.
 *
 * Added here rather than to the sixteen declarations, so a page added tomorrow
 * cannot forget it and the archive concern stays in one file.
 */
function selectWith(page, select) {
  const declared = String(select ?? page?.select ?? "*");
  if (!canArchive(page) || declared === "*") return declared;
  const columns = declared.split(",").map((column) => column.trim()).filter(Boolean);
  if (columns.includes(COLUMN)) return declared;
  return [...columns, COLUMN].join(",");
}

/**
 * The PostgREST clause that hides archived rows.
 *
 * Empty for a page with no `archived_at` column, so asking for it on a page
 * that does not have one cannot produce a query the database refuses.
 */
function hiddenClause(page, { including = false } = {}) {
  if (!canArchive(page) || including) return "";
  return "&archived_at=is.null";
}

/** Whether a request asked to see archived rows too. */
function showingArchived(raw) {
  return String(raw ?? "") === "1";
}

/**
 * What to say about rows that are not on screen.
 *
 * Three states, not two. A count that could not be read is not a count of zero,
 * and telling somebody "nothing is archived" on the strength of a request that
 * failed is how they conclude a record they archived is gone.
 */
function describeHidden(count, { including = false } = {}) {
  if (including) return "Showing archived records as well as current ones.";
  if (count === null || count === undefined) return null;
  if (count === 0) return null;
  if (count === 1) return "1 archived record is not shown.";
  return `${count} archived records are not shown.`;
}

/** The value written to archive or to put back. */
function archivePatch(archived, at = Date.now() / 1000) {
  return { archived_at: archived ? new Date(at * 1000).toISOString() : null };
}

/** What to say after the change. */
function describeChange(archived) {
  return archived
    ? "Archived. It is off your list and still counted in every total it was part of."
    : "Put back on your list.";
}

module.exports = {
  COLUMN,
  TERMINAL_STATUS,
  selectWith,
  terminalStatusesFor,
  canArchive,
  reasonWithoutArchive,
  hiddenClause,
  showingArchived,
  describeHidden,
  archivePatch,
  describeChange
};
