// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Who gets a seat, and what we are allowed to tell them.
//
// Every decision about an event lives here and nothing else does. The routes read
// and write; they do not decide whether somebody is confirmed, because a page that
// asks the question and then renders "You're confirmed" regardless is a gate that
// was never there -- the shape routes/sonara-agent-activity-routes.cjs already
// shipped once and lib/sonara-agent-runner.cjs exists to replace.
//
// ## The three invariants
//
// **1. A confirmation must be true.** Accepting more people than the room holds
// hands somebody a sentence they travel on. So `admit` waitlists past capacity
// rather than confirming, and it counts seats rather than rows: one row for a
// family of four takes four.
//
// **2. An unrecorded capacity is not a number.** Three states -- a figure, or
// nobody has recorded one. Reading absent as unlimited silently oversells a real
// room; reading it as zero refuses every event whose owner left the box empty.
// Neither is acceptable, so the third answer is the honest one: record the RSVP
// and say, in words the person reads, that no capacity is recorded and this is a
// registration of interest rather than a confirmed seat. `admit` returns
// `capacity_not_recorded` for exactly that case, and it is a distinct outcome from
// `confirmed` so a page cannot print the wrong sentence by accident.
//
// **3. An unanswered question is not a no.** `attending` is null until somebody
// answers it. `attendanceOf` returns three values and never coerces.
//
// ## What is deliberately not here
//
// No sending. AGENTS.md: "Sounds, voice announcements, haptics, SMS, push, and
// email alerts must be off or explicitly user-controlled by default." An RSVP is
// recorded and nobody is messaged. There is no notify function in this file to
// call by mistake.
//
// No money. An RSVP is not a ticket. A paid ticket needs the connected payment
// path and an owner decision, and the migration asserts against the live
// catalogue that no column here holds a price, an amount or a card.

const EVENT_KINDS = Object.freeze(["event", "concert", "meetup", "announcement", "broadcast"]);
const EVENT_STATUSES = Object.freeze(["draft", "published", "cancelled"]);
const RSVP_STATES = Object.freeze(["confirmed", "waitlisted", "withdrawn"]);

// The states a seat request can land in. Named rather than booleans, because
// "confirmed" and "recorded but we cannot promise a seat" are different sentences
// and a boolean cannot carry the difference.
const ADMISSION = Object.freeze({
  confirmed: "confirmed",
  waitlisted: "waitlisted",
  capacity_not_recorded: "capacity_not_recorded",
  refused: "refused"
});

const ATTENDANCE = Object.freeze({
  going: "going",
  not_going: "not_going",
  not_answered: "not_answered"
});

const TITLE_MAX = 200;
const NOTE_MAX = 2000;
const PARTY_MAX = 50;
// The slug shape the migration's check constraint enforces. Restated here so a
// form refuses before PostgREST does, and kept identical on purpose -- a form
// that accepts what the table rejects is a save that fails in production.
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$/;
// The email shape, from lib/sonara-email-shape.cjs rather than a regular
// expression here. The one that was here could be made to run slowly on a long
// run of dots -- CodeQL raised it as high severity on this very file -- and it
// runs on whatever a stranger types into a public form.
const { looksLikeEmail } = require("./sonara-email-shape.cjs");

function finiteInteger(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

/**
 * The capacity that applies to this event, and whether one applies at all.
 *
 * `{ ok, capacity, source, reason }`. `capacity` is null when nobody has recorded
 * one, and `source` says which row the figure came from so a page can explain it.
 *
 * The event's own figure wins when set, because the same hall is 300 standing and
 * 120 seated. Zero is a real answer -- a room that holds nobody -- and is not
 * treated as absent, which is why this reads `=== null` rather than falsiness.
 */
function capacityFor(event, venue) {
  const eventCapacity = finiteInteger(event?.capacity);
  if (eventCapacity !== null) {
    return Object.freeze({
      ok: true,
      capacity: eventCapacity,
      source: "event",
      reason: `This event is set to hold ${eventCapacity}.`
    });
  }
  const venueCapacity = finiteInteger(venue?.capacity);
  if (venueCapacity !== null) {
    return Object.freeze({
      ok: true,
      capacity: venueCapacity,
      source: "venue",
      reason: `No capacity is set on the event, so the venue's ${venueCapacity} applies.`
    });
  }
  return Object.freeze({
    ok: true,
    capacity: null,
    source: "not_recorded",
    reason: "Nobody has recorded how many this holds. That is not the same as unlimited and not the same as none."
  });
}

/**
 * Seats already taken, which is not the number of rows.
 *
 * Only `confirmed` rows count. A waitlisted row is not holding a seat, and a
 * withdrawn one has given theirs back -- counting either would make an owner turn
 * people away from a room with space in it.
 *
 * Carries `{ ok }` so a read that failed is never rendered as zero taken. Zero
 * taken and "we could not count" are different, and only one of them is safe to
 * confirm somebody against.
 */
function seatsTaken(rsvps) {
  if (!Array.isArray(rsvps)) {
    return Object.freeze({ ok: false, seats: null, confirmed: 0, waitlisted: 0, reason: "The list of who is coming could not be read." });
  }
  let seats = 0;
  let confirmed = 0;
  let waitlisted = 0;
  for (const rsvp of rsvps) {
    const state = String(rsvp?.state || "");
    const party = finiteInteger(rsvp?.partySize);
    const size = party === null || party < 1 ? 1 : party;
    if (state === "confirmed") {
      seats += size;
      confirmed += 1;
    } else if (state === "waitlisted") {
      waitlisted += 1;
    }
  }
  return Object.freeze({ ok: true, seats, confirmed, waitlisted, reason: `${seats} seats are held by ${confirmed} confirmed bookings.` });
}

/**
 * Whether this event is taking RSVPs at all, and what to say if not.
 *
 * A cancelled event answers rather than disappearing -- somebody holding an RSVP
 * needs to be told. What cancellation stops is new ones.
 */
function rsvpWindow(event) {
  const status = String(event?.status || "");
  if (!EVENT_STATUSES.includes(status)) {
    return Object.freeze({ ok: false, open: false, code: "status_unknown", sentence: "We cannot tell what state this event is in, so we are not taking anybody's name for it." });
  }
  if (status === "draft") {
    return Object.freeze({ ok: true, open: false, code: "not_published", sentence: "This event has not been published yet." });
  }
  if (status === "cancelled") {
    const reason = String(event?.cancellation_reason || "").trim();
    return Object.freeze({
      ok: true,
      open: false,
      code: "cancelled",
      sentence: reason
        ? `This event has been cancelled: ${reason}`
        : "This event has been cancelled. No reason was recorded."
    });
  }
  return Object.freeze({ ok: true, open: true, code: "open", sentence: "This event is taking names." });
}

/**
 * Does this seat request get in?
 *
 * The one function this file exists for. `{ outcome, seatsAfter, sentence }`,
 * where `outcome` is one of ADMISSION and the sentence is what a person is told.
 *
 * Partial admission is refused rather than split. A party of four against two
 * remaining seats is waitlisted whole -- confirming two of four and saying
 * "confirmed" would be the exact lie this guards against, and splitting the row
 * silently decides which two of somebody's family are coming.
 */
function admit({ event, venue, rsvps, partySize } = {}) {
  const window = rsvpWindow(event);
  if (!window.open) {
    return Object.freeze({
      outcome: ADMISSION.refused,
      code: window.code,
      seatsAfter: null,
      sentence: window.sentence
    });
  }

  const wanted = finiteInteger(partySize);
  if (wanted === null || wanted < 1 || wanted > PARTY_MAX) {
    return Object.freeze({
      outcome: ADMISSION.refused,
      code: "party_size_unusable",
      seatsAfter: null,
      sentence: `Tell us how many people are coming, as a whole number between 1 and ${PARTY_MAX}.`
    });
  }

  const taken = seatsTaken(rsvps);
  if (!taken.ok) {
    // An unreadable list is not an empty one. Confirming against a count we do not
    // have is how the room gets oversold by a page that looked like it checked.
    return Object.freeze({
      outcome: ADMISSION.refused,
      code: "attendance_unreadable",
      seatsAfter: null,
      sentence: "We could not read who is already coming, so we are not going to tell you there is room. Nothing has been recorded -- try again shortly."
    });
  }

  const limit = capacityFor(event, venue);
  if (limit.capacity === null) {
    // The third state, and the whole reason this is not a boolean. The RSVP is
    // real and recorded; the promise is the thing withheld.
    return Object.freeze({
      outcome: ADMISSION.capacity_not_recorded,
      code: "capacity_not_recorded",
      seatsAfter: taken.seats + wanted,
      sentence: "We have your name down. Nobody has recorded how many this event holds, so this is a registration of interest rather than a confirmed seat -- the organiser will be in touch if that changes."
    });
  }

  const seatsAfter = taken.seats + wanted;
  if (seatsAfter > limit.capacity) {
    const remaining = Math.max(0, limit.capacity - taken.seats);
    return Object.freeze({
      outcome: ADMISSION.waitlisted,
      code: "over_capacity",
      seatsAfter,
      sentence: remaining === 0
        ? `This event is full at ${limit.capacity}. You are on the waiting list, in the order people joined it.`
        : `There ${remaining === 1 ? "is 1 seat" : `are ${remaining} seats`} left and you asked for ${wanted}, so your whole party is on the waiting list rather than part of it being let in.`
    });
  }

  return Object.freeze({
    outcome: ADMISSION.confirmed,
    code: "confirmed",
    seatsAfter,
    sentence: `You are confirmed for ${wanted === 1 ? "one place" : `${wanted} places`}. ${limit.capacity - seatsAfter} of ${limit.capacity} still free.`
  });
}

/**
 * Has this person said whether they are coming?
 *
 * Three answers. `null` is not `false`: somebody who registered and left the
 * question alone has not declined.
 */
function attendanceOf(rsvp) {
  const answer = rsvp && rsvp.attending;
  if (answer === true) return ATTENDANCE.going;
  if (answer === false) return ATTENDANCE.not_going;
  return ATTENDANCE.not_answered;
}

/**
 * What the public page is allowed to show.
 *
 * Counts, never people. Who said they are coming is the organization's record and
 * not public content -- a page listing names turns an RSVP into a disclosure
 * nobody agreed to, and listing email addresses turns it into a leak.
 *
 * The returned object is what a template renders. It carries no name and no email
 * by construction, so a template cannot print one by reaching for a field.
 */
function publicSummary({ event, venue, rsvps } = {}) {
  const window = rsvpWindow(event);
  const taken = seatsTaken(rsvps);
  const limit = capacityFor(event, venue);

  if (!taken.ok) {
    return Object.freeze({
      ok: false,
      open: window.open,
      statusSentence: window.sentence,
      countSentence: "We could not read how many people are coming just now. That is a problem on our side, and it does not mean nobody is.",
      capacitySentence: limit.reason
    });
  }

  const countSentence = limit.capacity === null
    ? `${taken.confirmed} ${taken.confirmed === 1 ? "person has" : "people have"} registered. No capacity is recorded for this event.`
    : `${taken.seats} of ${limit.capacity} places taken${taken.waitlisted ? `, and ${taken.waitlisted} on the waiting list` : ""}.`;

  return Object.freeze({
    ok: true,
    open: window.open,
    statusSentence: window.sentence,
    countSentence,
    capacitySentence: limit.reason,
    full: limit.capacity !== null && taken.seats >= limit.capacity
  });
}

/**
 * Read an event out of a form, refusing rather than guessing.
 *
 * Returns `{ ok, event }` or `{ ok: false, problems }` where problems are codes.
 * Codes and not sentences, because these round-trip through a query string and a
 * sentence in a URL is text a crafted link can put in this product's own voice on
 * a customer's authenticated page.
 */
function normalizeEvent(input = {}) {
  const problems = [];
  const title = String(input.title ?? "").trim();
  if (!title) problems.push("title_missing");
  else if (title.length > TITLE_MAX) problems.push("title_long");

  const kind = String(input.kind ?? "event").trim().toLowerCase() || "event";
  if (!EVENT_KINDS.includes(kind)) problems.push("kind_unknown");

  const startsAt = String(input.starts_at ?? input.startsAt ?? "").trim();
  const start = startsAt ? new Date(startsAt) : null;
  if (!start || Number.isNaN(start.getTime())) problems.push("start_unreadable");

  const endsAtRaw = String(input.ends_at ?? input.endsAt ?? "").trim();
  let end = null;
  if (endsAtRaw) {
    end = new Date(endsAtRaw);
    if (Number.isNaN(end.getTime())) problems.push("end_unreadable");
    else if (start && !Number.isNaN(start.getTime()) && end < start) problems.push("end_before_start");
  }

  // Absent capacity stays absent. An empty box is "nobody has recorded one", and
  // turning it into 0 here would make the schema's whole three-state design
  // pointless at the one place it is written.
  const capacityRaw = input.capacity;
  let capacity = null;
  if (capacityRaw !== undefined && String(capacityRaw).trim() !== "") {
    capacity = finiteInteger(capacityRaw);
    if (capacity === null || capacity < 0) problems.push("capacity_unusable");
  }

  const slugRaw = String(input.slug ?? "").trim().toLowerCase();
  let slug = null;
  if (slugRaw) {
    if (!SLUG_PATTERN.test(slugRaw)) problems.push("slug_shape");
    else slug = slugRaw;
  }

  const summary = String(input.summary ?? "").trim();
  if (summary.length > NOTE_MAX) problems.push("summary_long");

  if (problems.length) return { ok: false, problems: Object.freeze(problems) };
  return {
    ok: true,
    event: Object.freeze({
      title,
      summary: summary || null,
      kind,
      startsAt: start.toISOString(),
      endsAt: end ? end.toISOString() : null,
      capacity,
      slug
    })
  };
}

/**
 * Read an RSVP out of a public form.
 *
 * `attending` is the three-state read: "true"/"false" answer it, and anything else
 * -- including absent -- leaves it unanswered rather than declining on somebody's
 * behalf.
 */
function normalizeRsvp(input = {}) {
  const problems = [];
  const displayName = String(input.display_name ?? input.displayName ?? "").trim();
  if (!displayName) problems.push("name_missing");
  else if (displayName.length > TITLE_MAX) problems.push("name_long");

  const email = String(input.email ?? "").trim().toLowerCase();
  if (!email) problems.push("email_missing");
  else if (!looksLikeEmail(email)) problems.push("email_shape");

  let partySize = 1;
  const partyRaw = input.party_size ?? input.partySize;
  if (partyRaw !== undefined && String(partyRaw).trim() !== "") {
    partySize = finiteInteger(partyRaw);
    if (partySize === null || partySize < 1 || partySize > PARTY_MAX) problems.push("party_size_unusable");
  }

  const answer = String(input.attending ?? "").trim().toLowerCase();
  const attending = answer === "true" ? true : answer === "false" ? false : null;

  const note = String(input.note ?? "").trim();
  if (note.length > NOTE_MAX) problems.push("note_long");

  if (problems.length) return { ok: false, problems: Object.freeze(problems) };
  return {
    ok: true,
    rsvp: Object.freeze({ displayName, email, partySize, attending, note: note || null })
  };
}

function problemSentence(code) {
  return Object.freeze({
    title_missing: "An event needs a title.",
    title_long: `An event title has to be ${TITLE_MAX} characters or fewer.`,
    kind_unknown: "That is not a kind of event this understands.",
    start_unreadable: "We could not read when this starts.",
    end_unreadable: "We could not read when this ends.",
    end_before_start: "This event ends before it starts.",
    capacity_unusable: "Capacity has to be a whole number, or left empty if you do not know it.",
    slug_shape: "A web address can use lowercase letters, numbers and hyphens, and has to be 3 to 48 characters.",
    slug_taken: "Another event already uses that web address.",
    summary_long: `A summary has to be ${NOTE_MAX} characters or fewer.`,
    name_missing: "We need a name to put against the booking.",
    name_long: `A name has to be ${TITLE_MAX} characters or fewer.`,
    email_missing: "We need an email address so the organiser can reach you.",
    email_shape: "That does not look like an email address.",
    party_size_unusable: `Tell us how many people are coming, as a whole number between 1 and ${PARTY_MAX}.`,
    note_long: `A note has to be ${NOTE_MAX} characters or fewer.`,
    already_rsvped: "You already have a booking for this event. Nothing has been changed.",
    event_missing: "That event could not be found in this workspace.",
    venue_missing: "That venue could not be found in this workspace.",
    status_unknown: "That is not a state an event can be in.",
    publish_needs_slug: "An event needs a web address before it can be published, or there would be no page to publish it to.",
    save_failed: "That did not save. Nothing has changed, and it is worth trying again."
  })[code] || null;
}

module.exports = {
  EVENT_KINDS,
  EVENT_STATUSES,
  RSVP_STATES,
  ADMISSION,
  ATTENDANCE,
  TITLE_MAX,
  NOTE_MAX,
  PARTY_MAX,
  SLUG_PATTERN,
  capacityFor,
  seatsTaken,
  rsvpWindow,
  admit,
  attendanceOf,
  publicSummary,
  normalizeEvent,
  normalizeRsvp,
  problemSentence
};
