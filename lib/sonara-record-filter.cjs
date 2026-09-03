"use strict";

// Finding a record on the page you are already on.
//
// The twenty-seven owner record pages list a hundred rows at a time with
// "Previous" and "Next" and nothing else. A business with eight hundred
// customers looking for one of them pages through eight screens, reading a
// hundred names each time, and the product's answer to "where is Ada" is
// "keep clicking".
//
// `/search` exists and covers twenty of these tables, but it is a different
// page reached from a different link, and it returns ten rows per table across
// every table at once. It answers "is this person anywhere in my records". It
// does not answer "show me the customers whose name has Ada in it", which is
// the question somebody standing on the customers page is asking.
//
// ## The columns come from the search module, not from a second list here
//
// `lib/sonara-search.cjs` already decides which columns of each table are worth
// matching text against, and `NOT_SEARCHABLE` already records, table by table,
// why the other seven are not — *"a shift is found by who and when, not by
// text"*. A second list here would be the copy that drifts, and the drift would
// show up as a filter box quietly matching fewer columns than the search page
// for the same records.
//
// So this reads that module. A page whose table is not searchable gets no
// filter box and **says why**, in the words already written for it, rather than
// rendering a control that would find nothing.
//
// ## What has to stay true once a filter exists
//
// Two things, and both are easy to get wrong because both are silent.
//
// **The count must count the filtered rows.** The caption is built from a
// separate `count=exact` request. Left unfiltered it would say "812 records"
// over a table showing three, which is a bigger lie than no caption.
//
// **The pager must carry the filter.** `?page=2` without the term drops it, so
// "Next" would take somebody from three matching customers to a hundred
// arbitrary ones with no indication anything changed.

const search = require("./sonara-search.cjs");

const BY_TABLE = new Map(search.SEARCHABLE.map((entry) => [entry.table, entry]));

/** The columns a page's filter matches against, or null when it has none. */
function filterColumnsFor(page) {
  const entry = BY_TABLE.get(page?.table);
  const columns = entry?.columns;
  return Array.isArray(columns) && columns.length ? [...columns] : null;
}

/** Whether this page can offer a filter at all. */
function canFilter(page) {
  return filterColumnsFor(page) !== null;
}

/**
 * Why this page has no filter, in the words already recorded for that table.
 *
 * Returned rather than invented, and null when the table is filterable or when
 * nobody has recorded a reason. A page saying "you cannot search this" with no
 * reason is worse than saying nothing: it reads as a limitation of the product
 * rather than a fact about the record.
 */
function reasonWithoutFilter(page) {
  if (canFilter(page)) return null;
  return search.NOT_SEARCHABLE[page?.table] || null;
}

/**
 * The term a request is filtering by, or null.
 *
 * `null` rather than `""`, because "no filter" and "a filter that matched
 * nothing" are different states and the caption below says different things
 * about them. A term below the minimum is treated as no filter and the page
 * says so — one letter matches almost everything, which is a list nobody can
 * use.
 */
function termFrom(raw) {
  const text = typeof raw === "string" ? raw.trim() : "";
  if (!text) return { ok: true, term: null, tooShort: false };
  if (!search.isUsableTerm(text)) return { ok: true, term: null, tooShort: true, typed: text.slice(0, 80) };
  return { ok: true, term: text.slice(0, 80), tooShort: false };
}

/**
 * The PostgREST clause matching that term across the page's columns.
 *
 * Escaped through the search module's own escaper rather than a second one:
 * a `,` or `)` in the term would otherwise end the `or=(...)` list early and
 * silently change which columns are matched.
 */
function clauseFor(page, term) {
  const columns = filterColumnsFor(page);
  if (!columns || !term) return "";
  const safe = search.escapeTerm(term);
  if (!safe) return "";
  return `&or=(${columns.map((column) => `${column}.ilike.*${safe}*`).join(",")})`;
}

/**
 * The caption's subject, when a filter is on.
 *
 * "3 records" over a filtered list is true and useless — the reader cannot tell
 * whether they have three customers or three matches. This makes the sentence
 * say which.
 */
function describeFilter(term, count) {
  if (!term) return null;
  const quoted = `"${term}"`;
  if (count === 0) return `Nothing matches ${quoted}.`;
  if (count === 1) return `1 record matches ${quoted}.`;
  if (typeof count === "number") return `${count} records match ${quoted}.`;
  // The count read failed. Saying how many matched would be inventing it.
  return `Showing what matches ${quoted}. We could not count them.`;
}

/** A page's own address, carrying the filter. Used by the form and the pager. */
function pathWith(path, { term = null, page = null } = {}) {
  const query = [];
  if (term) query.push(`q=${encodeURIComponent(term)}`);
  if (page && page > 1) query.push(`page=${page}`);
  return query.length ? `${path}?${query.join("&")}` : path;
}

module.exports = {
  MINIMUM_TERM: search.MINIMUM_TERM,
  filterColumnsFor,
  canFilter,
  reasonWithoutFilter,
  termFrom,
  clauseFor,
  describeFilter,
  pathWith
};
