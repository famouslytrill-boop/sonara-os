"use strict";

// How long a business actually takes to answer, measured rather than typed.
//
// /growth-studio/tools/response-time already tells a customer what a slow first
// reply costs them, and it asks them to type in their own average -- which is a
// number nobody has, and the one people are most generous to themselves about.
// service_requests carries created_at and service_comments carries the replies,
// so the real figure is a subtraction.
//
// Same terms as the other science modules here: no model call, no provider, no
// network, no cost per use, same inputs always the same answer.
//
// ## Two things this refuses to do
//
// **A request nobody has answered yet is not a fast reply.** It has no first
// reply, and averaging over only the answered ones is how a business measures
// itself as excellent while its worst cases sit untouched. Unanswered requests
// are counted and reported separately, and the oldest one is named.
//
// **The median is reported next to the mean, and leads.** One request left for a
// fortnight moves a mean of ten enough to make a good week look bad, and one
// answered in a minute moves it the other way. The median is what a customer
// would actually experience.

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 60 * 24;

function minutesBetween(from, to) {
  const start = new Date(from);
  const end = new Date(to);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const minutes = (end.getTime() - start.getTime()) / 60000;
  // A reply stamped before the request it answers is a clock problem, not a
  // negative wait. Dropped and counted rather than folded into an average.
  return minutes >= 0 ? minutes : null;
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

// A duration somebody can act on. "1,847 minutes" is a number; "1 day 6 hours" is
// a fact about a customer waiting.
function humanDuration(minutes) {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes)) return null;
  if (minutes < 1) return "under a minute";
  if (minutes < MINUTES_PER_HOUR) return `${Math.round(minutes)} minute${Math.round(minutes) === 1 ? "" : "s"}`;
  if (minutes < MINUTES_PER_DAY) {
    const hours = Math.floor(minutes / MINUTES_PER_HOUR);
    const rest = Math.round(minutes % MINUTES_PER_HOUR);
    return rest ? `${hours}h ${rest}m` : `${hours} hour${hours === 1 ? "" : "s"}`;
  }
  const days = Math.floor(minutes / MINUTES_PER_DAY);
  const hours = Math.round((minutes % MINUTES_PER_DAY) / MINUTES_PER_HOUR);
  return hours ? `${days}d ${hours}h` : `${days} day${days === 1 ? "" : "s"}`;
}

/**
 * Measure first-reply time across a set of requests and their comments.
 * @param {Array<{id: string, service_name?: string, created_at: string, status?: string}>} requests
 * @param {Array<{service_request_id: string, created_at: string, user_id?: string}>} comments
 * @param {{now?: Date|string, staffUserIds?: string[]}} options
 */
function firstReplyTimes(requests, comments, options = {}) {
  const now = options.now ? new Date(options.now) : new Date();
  const list = Array.isArray(requests) ? requests : [];
  const replies = Array.isArray(comments) ? comments : [];

  // The earliest comment on each request. Sorting once and keeping the minimum
  // is cheaper than sorting per request, and the result is the same.
  const earliest = new Map();
  let clockProblems = 0;
  for (const comment of replies) {
    const key = String(comment?.service_request_id || "");
    if (!key || !comment?.created_at) continue;
    const at = new Date(comment.created_at);
    if (Number.isNaN(at.getTime())) continue;
    const held = earliest.get(key);
    if (!held || at < held) earliest.set(key, at);
  }

  const answered = [];
  const waiting = [];
  const unreadable = [];
  for (const request of list) {
    const id = String(request?.id || "");
    if (!id || !request?.created_at) {
      unreadable.push(String(request?.service_name || "a request with no date"));
      continue;
    }
    const reply = earliest.get(id);
    if (reply) {
      const minutes = minutesBetween(request.created_at, reply);
      if (minutes === null) {
        // A reply before its request. Counted so the total still adds up, and
        // never averaged in as a fast answer.
        clockProblems += 1;
        continue;
      }
      answered.push({ id, name: String(request.service_name || "Request"), minutes });
      continue;
    }
    const openFor = minutesBetween(request.created_at, now);
    waiting.push({ id, name: String(request.service_name || "Request"), waitingMinutes: openFor === null ? null : openFor });
  }

  if (!answered.length && !waiting.length) {
    return { ok: false, code: "nothing_to_measure", unreadable, message: "There are no requests with a date on them yet, so there is nothing to measure." };
  }

  const minutes = answered.map((entry) => entry.minutes);
  const total = answered.length + waiting.length;
  const stillWaiting = waiting
    .filter((entry) => entry.waitingMinutes !== null)
    .sort((a, b) => b.waitingMinutes - a.waitingMinutes);

  return {
    ok: true,
    requests: total,
    answered: answered.length,
    waiting: waiting.length,
    clockProblems,
    unreadable,
    // Median first, and the mean beside it. One request left for a fortnight
    // moves a mean of ten far enough to misdescribe a normal week.
    medianMinutes: median(minutes),
    meanMinutes: minutes.length ? minutes.reduce((sum, value) => sum + value, 0) / minutes.length : null,
    fastestMinutes: minutes.length ? Math.min(...minutes) : null,
    slowestMinutes: minutes.length ? Math.max(...minutes) : null,
    // Named, not counted. "Three are still waiting" makes somebody open all
    // three; naming the oldest makes them open the one that matters.
    longestWaiting: stillWaiting[0] || null,
    stillWaiting: stillWaiting.slice(0, 5),
    // The share answered within an hour and within a day, which is what a
    // customer notices rather than an average they never see.
    withinAnHour: minutes.length ? minutes.filter((value) => value <= MINUTES_PER_HOUR).length / minutes.length : null,
    withinADay: minutes.length ? minutes.filter((value) => value <= MINUTES_PER_DAY).length / minutes.length : null,
    basis: "the time from a request arriving to the first reply on it. It does not measure whether the reply answered anything."
  };
}

module.exports = {
  MINUTES_PER_DAY,
  MINUTES_PER_HOUR,
  firstReplyTimes,
  humanDuration,
  median,
  minutesBetween
};
