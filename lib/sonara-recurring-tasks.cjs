// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Work that comes round again: opening, closing, the weekly deep clean, the
// monthly stock count, the yearly equipment check.
//
// Pure. No clock of its own, no database, no writes -- `now` is passed in on
// every call, for the reason lib/sonara-recurring-invoices.cjs gives about
// itself: the only way to test a yearly procedure across a leap day is to hand
// the engine the date.
//
// ## There is no second task table, and there must not be
//
// An occurrence is a row in `employee_tasks` -- the table /staff/tasks already
// serves. A recurring procedure is a **template**; what it produces is the task
// an employee already sees on the page they already use.
// `lib/sonara-database-retirement-contract.cjs` records employee_tasks as
// queried by /staff/tasks (it is one of the four names that migration found on
// an archival list while live code depended on them), so the instance table
// exists and works. What was missing was anything to fill it on a cadence: on
// 1 October 2026 `employee_tasks` was written from exactly one place,
// routes/sonara-last9-routes.cjs, one task at a time by hand.
//
// This mirrors recurring invoices on purpose: `recurring_invoices` is the
// template and `customer_invoices` is the instance. Same shape, and for the
// same reason -- a template table plus the product's own record table beats a
// parallel record table that half the application does not know about.
//
// ## What is shared with recurring invoices, and what is deliberately not
//
// **Shared:** the month-anchor arithmetic. "The 31st of every month" clamps to
// the 28th in February and then walks three days earlier for ever if you step
// from the clamped result instead of the stored anchor. That trap is solved
// once, in lib/sonara-recurring-invoices.cjs, and `dateInMonth`, `parseDay` and
// `toIsoDay` are imported from there rather than restated here. Restating them
// is how two copies of one rule start to disagree.
//
// **Not shared:** the cadence set, and that is the reason this is a separate
// engine rather than a flag on the other one. This one has `daily`, because
// opening and closing happen every day; invoices deliberately do not, because
// nothing in this product bills daily and a cadence nobody uses is a cadence
// nobody tests. Adding "daily" to the invoice engine would widen the money path
// to serve a cleaning rota.
//
// It also does not reuse the invoice `isDue`, which refuses a schedule with no
// `customer_id`. A procedure has no customer; it has a business.
//
// ## What it will not do
//
// **It will not catch up, and it will not walk.** A daily template nobody
// issued for three weeks produces **one** task, for the most recent day it was
// due, and says that twenty earlier occurrences were passed over.
//
// Copying the invoice rule here was wrong and the probe that found it is worth
// recording. Invoices are dated the day they were due and step one period per
// run, which is right for billing: a period that was invoiced late was still
// that period. A closing checklist is not. Dating it three weeks ago produces a
// task nobody can do, and stepping one occurrence per press means twenty-one
// presses to get to today -- catch-up by repetition, which is the thing the
// invoice engine refuses in one place and would have reintroduced in another.
//
// So the backlog is discarded rather than queued, the occurrence issued is the
// most recent one that has actually fallen due, and the number skipped is
// reported rather than swallowed. The weekday survives, because the fast-forward
// lands on a real occurrence of the template rather than on today.
//
// **It will not issue twice for one occurrence.** The next date is computed
// from `last_issued_on`, so pressing the button twice in a day produces one
// task. This is what keeps a button from becoming a loop with an assignee.
//
// **It will not assign work to somebody who has left.** An occurrence for a
// template whose employee is gone is still issued -- unassigned, and saying so
// -- because the work still needs doing. Dropping it silently is how a closing
// checklist stops happening the week somebody resigns.

const {
  dateInMonth,
  parseDay,
  toIsoDay
} = require("./sonara-recurring-invoices.cjs");

// Includes `daily`; see the note above on why this list is not the invoice one.
const CADENCES = Object.freeze(["daily", "weekly", "fortnightly", "monthly", "quarterly", "yearly"]);

// Cadences that step a fixed number of days, and therefore keep whatever
// weekday `starts_on` fell on. "Every Tuesday" is expressed by starting on a
// Tuesday -- there is no separate weekday column, because two places to say
// which day it is are two places that can disagree.
const DAY_STEP = Object.freeze({ daily: 1, weekly: 7, fortnightly: 14 });

// Cadences that step whole months and therefore need an anchor day.
const MONTH_STEP = Object.freeze({ monthly: 1, quarterly: 3, yearly: 12 });

// Mirrors the check constraint on employee_tasks.priority (migration 013).
const PRIORITIES = Object.freeze(["low", "normal", "high", "urgent"]);

// The exact pattern the anchor_day check constraint in
// supabase/migrations/20261001160000_work_that_comes_round_again.sql accepts.
// Held here so a test can assert that nothing normalizeTemplate produces would be
// refused by the column -- the failure that otherwise reads as "that did not save"
// with no reason anybody can act on.
const ANCHOR_DAY_PATTERN = /^(last|[1-9]|[12][0-9]|3[01])$/;

const TITLE_MAX = 200;
const DESCRIPTION_MAX = 2000;

// How a date-only intention is written into a timestamptz column.
//
// `employee_tasks.due_at` is timestamptz and an occurrence is a calendar day,
// so something has to be chosen and every choice is wrong somewhere. Midnight
// UTC is wrong for the whole western hemisphere -- a task due 5 October renders
// as 4 October at 19:00 in New York. Midday UTC is the correct calendar day
// from UTC-12 through UTC+11, and lands a day late in UTC+12 and east, which is
// New Zealand, Fiji and Kiribati. There is no hour that covers all of them: the
// inhabited offsets span twenty-six hours and a day has twenty-four.
//
// So the date is also written into the task's own description, in words, by
// `buildTask` below. Whatever a client does with the timestamp, the day the
// work is for is legible on the task.
const DUE_HOUR_UTC = 12;

// How many occurrences the fast-forward below will step through before giving
// up. Stepping is a date computation and nothing else, so this is about
// refusing to loop for ever on an unreadable row rather than about cost: 4,000
// daily occurrences is close to eleven years, which no live template reaches,
// and a template that does reach it is a data problem rather than work somebody
// is waiting on. Reported as a refusal with a reason, never as "not due" --
// that is the shape where a page says nothing is scheduled because the loop
// quietly ran out.
const FAST_FORWARD_LIMIT = 4000;

function isCadence(value) {
  return CADENCES.includes(String(value || ""));
}

/**
 * The anchor day a month-stepping template uses.
 *
 * Returns the stored `anchor_day` when there is one, and otherwise the day
 * `starts_on` fell on -- which is what somebody means by "monthly from the
 * 9th" without having said the word anchor.
 */
function anchorFor(template, start) {
  const stored = template?.anchor_day;
  if (stored === null || stored === undefined || stored === "") return start.getUTCDate();
  const text = String(stored);
  if (text === "last") return "last";
  const day = Number(text);
  return Number.isInteger(day) && day >= 1 && day <= 31 ? day : null;
}

/**
 * The next day this template should produce a task on, strictly after the last
 * one it produced.
 *
 * Returns `{ date, reason }` and never a bare null: a template that silently
 * yields no date looks exactly like one that is not due yet, and the page has
 * to be able to tell a business which it is.
 */
function nextOccurrence(template, { after = null } = {}) {
  const cadence = String(template?.cadence || "");
  if (!isCadence(cadence)) {
    return { date: null, reason: `"${cadence}" is not a cadence this understands.` };
  }

  const start = parseDay(template?.starts_on);
  if (!start) return { date: null, reason: "This has no start date, so nothing can be worked out from it." };

  const ends = template?.ends_on ? parseDay(template.ends_on) : null;
  const last = after
    ? parseDay(after)
    : (template?.last_issued_on ? parseDay(template.last_issued_on) : null);

  if (!last) {
    if (ends && start > ends) return { date: null, reason: "This finished before it began." };
    return { date: toIsoDay(start), reason: "The first time this comes round." };
  }

  let next;
  if (DAY_STEP[cadence]) {
    next = new Date(last.getTime() + DAY_STEP[cadence] * 86400000);
  } else {
    // The stored anchor, not the day `last` happens to carry. Stepping from the
    // clamped result is the walking-backwards bug the invoice engine documents
    // at length, and it is the same bug here.
    const anchor = anchorFor(template, start);
    if (anchor === null) return { date: null, reason: `"${template?.anchor_day}" is not a day of the month.` };
    const step = MONTH_STEP[cadence];
    const month = last.getUTCMonth() + 1 + step;
    const year = last.getUTCFullYear() + Math.floor((month - 1) / 12);
    const wrapped = ((month - 1) % 12) + 1;
    next = dateInMonth(year, wrapped, anchor);
    if (!next) return { date: null, reason: `"${template?.anchor_day}" is not a day of the month.` };
  }

  if (ends && next > ends) return { date: null, reason: "This has finished." };
  return { date: toIsoDay(next), reason: "Due on this date." };
}

/**
 * The most recent occurrence that has fallen due, and how many were skipped.
 *
 * Steps forward from the last one issued while the next is on or before today,
 * keeping the furthest. Returns `{ date, passedOver, reason }` where `date` is
 * null when nothing is due yet -- with the reason from `nextOccurrence`, so a
 * template that cannot be read says why rather than reading as "not yet".
 */
function latestDue(template, { now = new Date(), limit = FAST_FORWARD_LIMIT } = {}) {
  const today = toIsoDay(now instanceof Date ? now : new Date(now));
  if (!today) return { date: null, passedOver: 0, reason: "The current date could not be read." };

  const first = nextOccurrence(template);
  if (!first.date) return { date: null, passedOver: 0, reason: first.reason };
  if (first.date > today) return { date: null, passedOver: 0, reason: `Not yet: the next one is ${first.date}.` };

  let found = first.date;
  let passedOver = 0;
  for (let step = 0; step < limit; step += 1) {
    const next = nextOccurrence(template, { after: found });
    if (!next.date || next.date > today) {
      return { date: found, passedOver, reason: passedOver
        ? `Due since ${found}. ${passedOver} earlier ${passedOver === 1 ? "occurrence was" : "occurrences were"} passed over rather than queued up.`
        : `Due since ${found}.` };
    }
    found = next.date;
    passedOver += 1;
  }

  // The bound was reached. Said as a refusal: a template this far behind would
  // otherwise report a date that is not actually its latest, which is a wrong
  // answer wearing the shape of a right one.
  return {
    date: null,
    passedOver,
    reason: `This has been behind for more than ${limit} occurrences, which is too far to work out safely. Switch it off and set it up again from today.`
  };
}

/**
 * Should this template produce a task now?
 *
 * Answers with a reason either way. "No" with no reason is what leaves somebody
 * refreshing a page wondering why the closing checklist never appeared.
 */
function isDue(template, { now = new Date() } = {}) {
  if (!template) return { due: false, reason: "There is nothing here to work out." };
  if (template.enabled === false) return { due: false, reason: "This is switched off." };

  const latest = latestDue(template, { now });
  if (!latest.date) return { due: false, reason: latest.reason, passedOver: latest.passedOver };

  return { due: true, reason: latest.reason, issueOn: latest.date, passedOver: latest.passedOver };
}

/**
 * The employee_tasks row a due template produces.
 *
 * Returns `{ ok, task, reason }`. The row is built for the existing table and
 * nothing else: title, description, due_at, priority, assignment, and a
 * metadata link back to the template so a task can be traced to what made it.
 */
function buildTask({ template, issueOn, organizationId = null, createdBy = null } = {}) {
  if (!issueOn) return { ok: false, reason: "No date was worked out for this, so there is nothing to issue.", task: null };
  if (!parseDay(issueOn)) return { ok: false, reason: `"${issueOn}" is not a date.`, task: null };

  const title = String(template?.title || "").trim();
  if (!title) return { ok: false, reason: "This has no title, so the task would have nothing on it.", task: null };

  const organization = organizationId || template?.organization_id || null;
  // Not defaulted and not guessed. A task with no organization is a row no
  // business owns, and lib/sonara-tenant-guard.cjs would refuse the write
  // anyway -- refusing here says why.
  if (!organization) return { ok: false, reason: "This is not attached to a business, so the task would belong to nobody.", task: null };

  const described = String(template?.description || "").trim();
  // The date in words, for the reason DUE_HOUR_UTC explains: the timestamp
  // below is the right calendar day in most of the world and not all of it, and
  // this sentence is right everywhere.
  const scheduled = `Scheduled for ${issueOn}.`;
  const description = described ? `${described}\n\n${scheduled}` : scheduled;

  const priority = PRIORITIES.includes(String(template?.priority || ""))
    ? String(template.priority)
    : "normal";

  return {
    ok: true,
    reason: `Task for ${issueOn}.`,
    task: {
      organization_id: organization,
      assigned_employee_id: template?.assigned_employee_id || null,
      created_by: createdBy,
      title: title.slice(0, TITLE_MAX),
      description: description.slice(0, DESCRIPTION_MAX),
      due_at: `${issueOn}T${String(DUE_HOUR_UTC).padStart(2, "0")}:00:00.000Z`,
      priority,
      status: "todo",
      // Why the link lives in metadata rather than a new column on
      // employee_tasks: adding a foreign key to the table /staff/tasks serves
      // would make every existing task carry a null column for a feature it
      // predates, and the link is for tracing rather than for querying.
      metadata: { recurring_task_id: template?.id || null, issued_for: issueOn }
    }
  };
}

/** A sentence a business can read, rather than a cadence word and a date. */
function describe(template) {
  const cadence = String(template?.cadence || "");
  if (!isCadence(cadence)) return "This has no cadence set, so it will not come round.";

  const start = parseDay(template?.starts_on);
  const every = {
    daily: "Every day",
    weekly: "Every week",
    fortnightly: "Every two weeks",
    monthly: "Every month",
    quarterly: "Every three months",
    yearly: "Every year"
  }[cadence];

  const parts = [every];
  if (MONTH_STEP[cadence] && start) {
    const anchor = anchorFor(template, start);
    if (anchor === "last") parts.push("on the last day");
    else if (anchor !== null) parts.push(`on day ${anchor}`);
  }
  if (DAY_STEP[cadence] && cadence !== "daily" && start) {
    const weekday = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][start.getUTCDay()];
    parts.push(`on a ${weekday}`);
  }
  if (template?.ends_on) parts.push(`until ${toIsoDay(parseDay(template.ends_on)) || String(template.ends_on)}`);
  if (template?.enabled === false) parts.push("-- switched off");
  return `${parts.join(" ")}.`;
}

// Every reason this can refuse a form, keyed by a short stable code.
//
// Codes rather than sentences because the sentence has to survive a redirect.
// The first version of routes/sonara-recurring-task-routes.cjs put the joined
// sentences into the query string and the page printed them, which meant a
// crafted link could put any text inside a card on a signed-in owner's own page.
// `brandCard` escapes, so it was never script -- it was worse-shaped than that:
// plausible text in the application's own voice, on the real page, at the real
// address. A phone number to ring would have looked exactly like a product
// message.
//
// So the wire carries codes, the sentences live here, and `problemSentences`
// drops anything it does not recognise. Nothing a caller supplies reaches the
// page.
const PROBLEMS = Object.freeze({
  no_title: "Give this a name, so it is recognisable on somebody's task list.",
  title_too_long: `The name is longer than ${TITLE_MAX} characters.`,
  no_cadence: `Choose how often this happens: ${CADENCES.join(", ")}.`,
  no_start: "Give the first date this should happen, as YYYY-MM-DD.",
  bad_end: "The last date is not a date. Leave it empty for something with no end.",
  end_before_start: "The last date is before the first one.",
  bad_anchor: 'The day of the month must be 1 to 31, or the word "last".',
  // Deliberately does not name the cadence. Naming it would interpolate a
  // submitted value into a sentence the page prints, which is the shape this
  // whole table exists to remove.
  anchor_not_applicable: "A day of the month only applies to monthly, quarterly and yearly work. Anything more often than that repeats from its first date.",
  bad_priority: `Priority must be one of ${PRIORITIES.join(", ")}.`,
  description_too_long: `The description is longer than ${DESCRIPTION_MAX} characters.`,
  unknown_employee: "That is not an employee this recognises."
});

const PROBLEM_CODES = Object.freeze(Object.keys(PROBLEMS));

/**
 * The sentences for a list of codes, in the order given, unknown codes dropped.
 *
 * Dropping rather than echoing is the point: a code this does not know came from
 * somewhere other than this module.
 */
function problemSentences(codes) {
  const list = Array.isArray(codes) ? codes : String(codes ?? "").split(".");
  const seen = new Set();
  const sentences = [];
  for (const code of list) {
    const key = String(code || "");
    if (!Object.prototype.hasOwnProperty.call(PROBLEMS, key) || seen.has(key)) continue;
    seen.add(key);
    sentences.push(PROBLEMS[key]);
  }
  return sentences;
}

/**
 * Read a submitted form into a template row, or say what is wrong with it.
 *
 * Returns `{ ok, values, problems }`, where `problems` is a list of codes from
 * PROBLEMS above -- never sentences, so nothing that crosses a redirect can be
 * chosen by the caller. `problems` is never empty when `ok` is false, because a
 * refusal with no reason is a form that cannot be filled in.
 */
function normalizeTemplate(input = {}) {
  const problems = [];

  const title = String(input.title ?? "").trim();
  if (!title) problems.push("no_title");
  if (title.length > TITLE_MAX) problems.push("title_too_long");

  const cadence = String(input.cadence ?? "").trim();
  if (!isCadence(cadence)) problems.push("no_cadence");

  const startsOn = String(input.starts_on ?? "").trim();
  if (!parseDay(startsOn)) problems.push("no_start");

  const endsOnRaw = String(input.ends_on ?? "").trim();
  const endsOn = endsOnRaw ? endsOnRaw : null;
  if (endsOn && !parseDay(endsOn)) problems.push("bad_end");
  if (endsOn && parseDay(endsOn) && parseDay(startsOn) && parseDay(endsOn) < parseDay(startsOn)) {
    problems.push("end_before_start");
  }

  const anchorRaw = String(input.anchor_day ?? "").trim();
  let anchorDay = null;
  if (anchorRaw) {
    if (anchorRaw === "last") anchorDay = "last";
    // Canonicalised through Number rather than stored as typed. "01" is a day
    // somebody can reasonably type and is not a value the column's check
    // constraint accepts, so storing it verbatim would turn a usable form into
    // "that did not save" with nothing to read.
    else if (/^\d{1,2}$/.test(anchorRaw) && Number(anchorRaw) >= 1 && Number(anchorRaw) <= 31) anchorDay = String(Number(anchorRaw));
    else problems.push("bad_anchor");
    // Said rather than silently ignored. An anchor on a weekly template is
    // somebody expecting it to mean something, and it does not.
    if (anchorDay && DAY_STEP[cadence]) {
      problems.push("anchor_not_applicable");
    }
  }

  const priorityRaw = String(input.priority ?? "normal").trim();
  const priority = PRIORITIES.includes(priorityRaw) ? priorityRaw : null;
  if (!priority) problems.push("bad_priority");

  const description = String(input.description ?? "").trim();
  if (description.length > DESCRIPTION_MAX) problems.push("description_too_long");

  const assigned = String(input.assigned_employee_id ?? "").trim();

  if (problems.length) return { ok: false, values: null, problems };

  return {
    ok: true,
    problems: [],
    values: {
      title,
      description: description || null,
      cadence,
      starts_on: startsOn,
      ends_on: endsOn,
      anchor_day: anchorDay,
      priority,
      assigned_employee_id: assigned || null,
      enabled: true
    }
  };
}

module.exports = {
  CADENCES, DAY_STEP, MONTH_STEP, PRIORITIES,
  TITLE_MAX, DESCRIPTION_MAX, DUE_HOUR_UTC, FAST_FORWARD_LIMIT, ANCHOR_DAY_PATTERN,
  PROBLEMS, PROBLEM_CODES, problemSentences,
  isCadence, anchorFor, nextOccurrence, latestDue, isDue, buildTask, describe, normalizeTemplate
};
