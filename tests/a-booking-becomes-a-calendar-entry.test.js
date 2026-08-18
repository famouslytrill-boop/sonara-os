"use strict";

// A malformed .ics does not error. The calendar application declines to import
// it, or imports it at the wrong time, and the business finds out when nobody
// arrives. So these assert the parts of RFC 5545 that fail silently, not the
// parts that would be obvious.

const assert = require("node:assert/strict");
const {
  buildCalendarInvite,
  invitability,
  escapeText,
  foldLine,
  toUtcStamp,
  calendarStatus
} = require("../lib/sonara-calendar-invite.cjs");

const BOOKING = Object.freeze({
  id: "11111111-2222-3333-4444-555555555555",
  starts_at: "2026-09-01T10:00:00Z",
  ends_at: "2026-09-01T11:30:00Z",
  status: "confirmed",
  customer_name: "Ada Lovelace",
  customer_email: "ada@example.com",
  service_name: "Consultation"
});

function linesOf(body) {
  return body.split("\r\n");
}

describe("a booking becomes a calendar entry", () => {
  it("ends every line with CRLF, including the last", () => {
    const invite = buildCalendarInvite(BOOKING, { now: "2026-08-18T11:00:00Z" });
    assert.equal(invite.ok, true);
    // A bare newline anywhere is the failure: some clients accept it and some
    // reject it, which is worse than all of them rejecting it.
    assert.equal(/(^|[^\r])\n/.test(invite.body), false, "found a newline that was not preceded by a carriage return");
    assert.ok(invite.body.endsWith("\r\n"), "the final content line must end with CRLF too");
  });

  it("escapes the characters that would otherwise split a value", () => {
    // The expected value here is "\\;" and not "\;". The second is just ";"
    // once JavaScript has read the literal, so it compiles, runs, and asserts
    // that a semicolon stays a semicolon.
    //
    // Worth the comment because it happened twice in a row. escapeText was
    // written with .replace(/;/g, "\;") -- which does nothing at all -- and then
    // this assertion was written with the same literal, so it agreed with the
    // broken implementation. Reading the generated .ics caught the first;
    // running the test caught the second. Neither would have caught itself.
    assert.equal(escapeText("Table 4; window seat"), "Table 4\\; window seat");
    assert.equal(escapeText("Ada, of Ashby"), "Ada\\, of Ashby");
    assert.equal(escapeText("line one\nline two"), "line one\\nline two");
    // Backslash first, or the escapes added afterwards get escaped again.
    assert.equal(escapeText("a\\b"), "a\\\\b");
  });

  it("folds long lines by octet, not by character", () => {
    // A name with an accent is enough to break character counting: folding at
    // 75 characters can split a multi-byte character in half, and the result is
    // invalid UTF-8 rather than a long line.
    const folded = foldLine(`SUMMARY:${"é".repeat(80)}`);
    for (const segment of folded.split("\r\n")) {
      assert.ok(Buffer.byteLength(segment, "utf8") <= 75, `folded segment is ${Buffer.byteLength(segment, "utf8")} octets`);
    }
    assert.match(folded, /\r\n /, "continuation lines must begin with a single space");
    // Unfolding must give back exactly what went in.
    assert.equal(folded.split("\r\n ").join(""), `SUMMARY:${"é".repeat(80)}`);
  });

  it("writes times as UTC with a Z suffix", () => {
    const invite = buildCalendarInvite(BOOKING, { now: "2026-08-18T11:00:00Z" });
    const lines = linesOf(invite.body);
    assert.ok(lines.includes("DTSTART:20260901T100000Z"), lines.join(" | "));
    assert.ok(lines.includes("DTEND:20260901T113000Z"));
    // A local time without a VTIMEZONE block is the commonest way an invite
    // lands an hour out, so there must not be one.
    assert.equal(invite.body.includes("BEGIN:VTIMEZONE"), false);
    assert.equal(/DTSTART:\d{8}T\d{6}(?!Z)/.test(invite.body), false, "a DTSTART without Z is a local time");
  });

  it("keeps the same UID when the same booking is downloaded twice", () => {
    // A calendar keyed on UID replaces the entry rather than adding a second
    // one. If the UID moved, downloading twice would double-book the day.
    const first = buildCalendarInvite(BOOKING, { now: "2026-08-18T11:00:00Z" });
    const second = buildCalendarInvite(BOOKING, { now: "2026-08-18T15:00:00Z" });
    const uid = (invite) => linesOf(invite.body).find((line) => line.startsWith("UID:"));
    assert.equal(uid(first), uid(second));
    // DTSTAMP is when the file was written and is expected to differ.
    assert.notEqual(
      linesOf(first.body).find((line) => line.startsWith("DTSTAMP:")),
      linesOf(second.body).find((line) => line.startsWith("DTSTAMP:"))
    );
  });

  it("never calls an unrecognised status confirmed", () => {
    assert.equal(calendarStatus("confirmed"), "CONFIRMED");
    assert.equal(calendarStatus("requested"), "TENTATIVE");
    assert.equal(calendarStatus("cancelled"), "CANCELLED");
    assert.equal(calendarStatus("no_show"), "CANCELLED");
    // The failure that matters is a calendar showing a booking as agreed when
    // it was not, so anything unknown stays tentative.
    assert.equal(calendarStatus("something_added_later"), "TENTATIVE");
    assert.equal(calendarStatus(null), "TENTATIVE");
    assert.equal(calendarStatus(""), "TENTATIVE");
  });

  it("refuses a booking a calendar cannot show, and says which field is missing", () => {
    const noStart = buildCalendarInvite({ id: "a", ends_at: "2026-09-01T11:00:00Z" }, {});
    assert.equal(noStart.ok, false);
    assert.equal(noStart.code, "no_start_time");
    assert.match(noStart.message, /start time/i);

    // Guessing an hour would produce an entry that looks right, is not, and
    // never tells the business it was guessed.
    const noEnd = buildCalendarInvite({ id: "a", starts_at: "2026-09-01T10:00:00Z" }, {});
    assert.equal(noEnd.ok, false);
    assert.equal(noEnd.code, "no_end_time");

    const backwards = buildCalendarInvite({ id: "a", starts_at: "2026-09-01T11:00:00Z", ends_at: "2026-09-01T10:00:00Z" }, {});
    assert.equal(backwards.ok, false);
    assert.equal(backwards.code, "ends_before_it_starts");

    const noId = buildCalendarInvite({ starts_at: "2026-09-01T10:00:00Z", ends_at: "2026-09-01T11:00:00Z" }, {});
    assert.equal(noId.ok, false);
    assert.equal(noId.code, "no_identifier");
  });

  it("treats an unparseable timestamp as missing rather than as zero", () => {
    // new Date("not a date") is Invalid Date, and an invitability check that
    // read its getTime() as a number would write 1970 into somebody's calendar.
    assert.equal(toUtcStamp("not a date"), null);
    assert.equal(toUtcStamp(""), null);
    assert.equal(toUtcStamp(null), null);
    const verdict = invitability({ id: "a", starts_at: "not a date", ends_at: "2026-09-01T11:00:00Z" });
    assert.equal(verdict.ok, false);
    assert.equal(verdict.code, "no_start_time");
  });

  it("carries the structure a calendar needs to parse it at all", () => {
    const invite = buildCalendarInvite(BOOKING, { now: "2026-08-18T11:00:00Z", businessName: "Ashby Studio" });
    const lines = linesOf(invite.body);
    for (const required of ["BEGIN:VCALENDAR", "VERSION:2.0", "BEGIN:VEVENT", "END:VEVENT", "END:VCALENDAR"]) {
      assert.ok(lines.includes(required), `missing ${required}`);
    }
    // PRODID is required by the spec and is what a client names when it
    // complains, so it has to identify this application.
    assert.ok(lines.some((line) => line.startsWith("PRODID:") && line.includes("SONARA")));
    assert.equal(invite.contentType, "text/calendar; charset=utf-8");
    assert.match(invite.filename, /^booking-[a-zA-Z0-9-]+\.ics$/);
  });
});
