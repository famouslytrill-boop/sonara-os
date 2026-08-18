"use strict";

// A booking, as a file a calendar will actually open.
//
// business_bookings has starts_at, ends_at, a customer and a status, and
// nothing anywhere turned one into a calendar entry: a grep for VCALENDAR,
// text/calendar or .ics across server.js, lib/ and routes/ found nothing. So a
// business could take a booking and neither they nor their customer could put
// it in the calendar they actually use, which is the one thing a booking is
// for.
//
// This is deliberately a text builder and not a dependency. RFC 5545 is a few
// lines for a single event, it costs the customer nothing, it needs no service
// the owner runs, and it works with the browser closed. Everything this sweep
// found for media needed a server, a bundle, or both.
//
// The failure mode worth designing against is specific: a malformed .ics does
// not error. The calendar application silently declines to import it, or
// imports it at the wrong time, and the business finds out when nobody arrives.
// So the awkward parts of the spec are done rather than approximated:
//
// **CRLF, always.** RFC 5545 section 3.1 says lines end with CRLF. A file with
// bare newlines is read by some clients and rejected by others, which is worse
// than being rejected by all of them.
//
// **Folding at 75 octets, counted in octets.** Section 3.1 again. Counting
// characters instead splits a multi-byte character down the middle, and a name
// with an accent in it is enough to do it.
//
// **Escaping.** Backslash, semicolon, comma and newline are special inside a
// TEXT value. A customer note containing "table 4, window seat" becomes two
// values without it.
//
// **UTC only.** Times are written with a Z suffix from the stored timestamptz.
// Writing a local time without a VTIMEZONE block is the single most common way
// an invite lands an hour out.

const CRLF = "\r\n";

// RFC 5545 3.3.11: backslash first, or the escapes it adds get escaped again.
function escapeText(value) {
  return String(value === null || value === undefined ? "" : value)
    .replace(/\\/g, "\\\\")
    // "\\;" and not "\;" -- the second is just ";" once JavaScript has read the
    // string literal, so it compiles, runs, and silently emits an unescaped
    // semicolon. Caught by reading the generated file rather than the code.
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

// Fold to 75 octets, continuing with a single leading space. Octets, not
// characters: Buffer.byteLength is the measure the spec uses.
function foldLine(line) {
  if (Buffer.byteLength(line, "utf8") <= 75) return line;
  const out = [];
  let current = "";
  let limit = 75;
  for (const character of Array.from(line)) {
    if (Buffer.byteLength(current + character, "utf8") > limit) {
      out.push(current);
      current = character;
      // Continuation lines carry a leading space, which costs an octet.
      limit = 74;
    } else {
      current += character;
    }
  }
  if (current) out.push(current);
  return out.join(`${CRLF} `);
}

// A timestamptz as UTC basic format: 20260818T113000Z.
function toUtcStamp(value) {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(String(value));
  const time = date.getTime();
  if (!Number.isFinite(time)) return null;
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

// What a booking has to have before a calendar entry means anything.
//
// Returned as a reason rather than thrown, and rendered rather than swallowed:
// a booking with no start time is a real state of a real row, and the page has
// to say which field is missing instead of offering a download that produces an
// empty file.
function invitability(booking) {
  const row = booking && typeof booking === "object" ? booking : {};
  if (!row.id) return { ok: false, code: "no_identifier", message: "This booking has no identifier yet, so it cannot be added to a calendar." };
  const start = toUtcStamp(row.starts_at);
  if (!start) {
    return {
      ok: false,
      code: "no_start_time",
      message: "This booking has no start time, so there is nothing to put in a calendar. Add a start time first."
    };
  }
  const end = toUtcStamp(row.ends_at);
  if (!end) {
    return {
      ok: false,
      code: "no_end_time",
      // Guessing an hour would produce a calendar entry that looks right and is
      // not, and the business would never be told it was guessed.
      message: "This booking has no end time. Add one rather than letting a calendar guess how long it runs."
    };
  }
  if (end <= start) {
    return { ok: false, code: "ends_before_it_starts", message: "This booking ends before or when it starts, so a calendar cannot show it." };
  }
  return { ok: true, start, end };
}

// The stored status, in the words the spec uses. Anything unrecognised stays
// TENTATIVE rather than becoming CONFIRMED, because the failure that matters is
// a calendar showing a booking as agreed when it was not.
const STATUS = Object.freeze({
  requested: "TENTATIVE",
  confirmed: "CONFIRMED",
  completed: "CONFIRMED",
  cancelled: "CANCELLED",
  no_show: "CANCELLED",
  archived: "CANCELLED"
});

function calendarStatus(status) {
  return STATUS[String(status || "").toLowerCase()] || "TENTATIVE";
}

// Stable across regenerations. A calendar keyed on UID replaces the entry
// rather than adding a second one, so downloading twice must not double-book.
function uidFor(booking, domain) {
  return `${booking.id}@${String(domain || "sonara.industries").replace(/^https?:\/\//, "").replace(/\/.*$/, "")}`;
}

function buildCalendarInvite(booking, options) {
  const settings = options && typeof options === "object" ? options : {};
  const verdict = invitability(booking);
  if (!verdict.ok) return verdict;

  const now = toUtcStamp(settings.now || new Date());
  const summary = String(booking.service_name || settings.defaultSummary || "Booking").trim() || "Booking";
  const organiser = String(settings.businessName || "").trim();

  const description = [
    booking.customer_name ? `Customer: ${booking.customer_name}` : "",
    booking.customer_phone ? `Phone: ${booking.customer_phone}` : "",
    booking.notes ? `Notes: ${booking.notes}` : ""
  ].filter(Boolean).join("\n");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    // PRODID is required by RFC 5545 and identifies what wrote the file.
    "PRODID:-//SONARA Industries//Business Builder//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${escapeText(uidFor(booking, settings.domain))}`,
    `DTSTAMP:${now}`,
    `DTSTART:${verdict.start}`,
    `DTEND:${verdict.end}`,
    `SUMMARY:${escapeText(organiser ? `${summary} — ${organiser}` : summary)}`,
    `STATUS:${calendarStatus(booking.status)}`,
    // SEQUENCE lets a later download supersede an earlier one for the same UID.
    `SEQUENCE:${Number.isFinite(Number(booking.calendar_sequence)) ? Number(booking.calendar_sequence) : 0}`
  ];

  if (description) lines.push(`DESCRIPTION:${escapeText(description)}`);
  if (booking.location_name) lines.push(`LOCATION:${escapeText(booking.location_name)}`);
  if (booking.customer_email) lines.push(`ATTENDEE;CN=${escapeText(booking.customer_name || booking.customer_email)}:mailto:${escapeText(booking.customer_email)}`);

  lines.push("END:VEVENT", "END:VCALENDAR");

  return {
    ok: true,
    filename: `booking-${String(booking.id).replace(/[^a-zA-Z0-9-]/g, "")}.ics`,
    contentType: "text/calendar; charset=utf-8",
    // Trailing CRLF: the spec's content lines each end with one, including the
    // last.
    body: `${lines.map(foldLine).join(CRLF)}${CRLF}`
  };
}

module.exports = { buildCalendarInvite, invitability, escapeText, foldLine, toUtcStamp, calendarStatus, uidFor };
