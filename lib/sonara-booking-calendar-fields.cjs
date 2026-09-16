"use strict";

// The three fields a calendar file needs and `business_bookings` does not have.
//
// `lib/sonara-calendar-invite.cjs` reads `booking.service_name`,
// `booking.location_name` and `booking.calendar_sequence`. **None of the three
// is a column of `business_bookings`.** The table has `service_id` and
// `location_id` -- foreign keys -- and no revision counter at all. Checked
// against every `create table` and `add column` for that table across
// supabase/migrations: 013, 20260721213000 and 20260812000000 agree, and
// `service_name` appears in the schema only on a different table
// (`sonara_service_lifecycle_runtime_tables`).
//
// So every one of those reads returned `undefined`, and the consequences were
// each a quiet wrong answer rather than an error:
//
//   - `summary` fell through to `settings.defaultSummary || "Booking"`, and no
//     call site passes `defaultSummary`. **Every booking downloaded as a
//     calendar entry titled literally "Booking".** A salon with six
//     appointments in a day got six identical entries.
//   - the `LOCATION` line is written only `if (booking.location_name)`, so it
//     was **never written**, on bookings that carry a `location_id` pointing at
//     a row with a name and a full address.
//   - `SEQUENCE` is `Number.isFinite(Number(booking.calendar_sequence)) ? ... : 0`,
//     and `Number(undefined)` is `NaN`, so it was **always 0**. The comment
//     above that line says SEQUENCE "lets a later download supersede an earlier
//     one for the same UID" -- which is true of the property and was not true
//     of this file. A corrected booking re-downloaded on top of the old one is
//     exactly what SEQUENCE is for, and 0 every time is the one value that
//     cannot do it.
//
// All three were invisible to `pnpm run report:selected-columns` because the
// query was `select=*`. A star select does not name its columns, so nothing
// could compare the names read against the names asked for -- the report counts
// star selects precisely because it cannot audit them, and this is the defect it
// was counting the blindness *for*. The queries are named-column now.
//
// ## Why the names are resolved here and not by PostgREST
//
// `select=*,business_locations(name)` would work -- the foreign key is there --
// and `loadCampaignRecipients` in routes/growth-studio-control-routes.cjs
// already ruled on this pattern for the same reason it applies here: an embed
// puts the tenant filter on the outer table only and leaves the inner one to
// PostgREST's relationship detection. With the service-role key bypassing row
// level security that filter **is** the tenant boundary, so the lookups are
// separate organization-filtered reads and the join happens in JavaScript.

// What this module supplies rather than the table.
//
// Exported so a test can assert it, rather than restating the list: every
// `booking.<field>` the invite module reads must be a real column of
// `business_bookings` or one of these three.
const CALLER_SUPPLIED_FIELDS = Object.freeze(["calendar_sequence", "location_name", "service_name"]);

// SEQUENCE is an RFC 5545 INTEGER, and 3.3.8 puts its magnitude at no more than
// 2^31-1. Epoch seconds would fit today and stop fitting in 2038, so this is a
// per-booking count instead of an absolute clock.
const MAX_SEQUENCE = 2147483647;

function trimmed(value) {
  return String(value === null || value === undefined ? "" : value).trim();
}

// A location a phone can act on.
//
// RFC 5545 LOCATION is free text, and the useful text is the one that gets
// somebody to the door: the name alone identifies the branch, the address is
// what a maps application resolves. Composed from the parts that are present,
// so a location with only a name still produces a line.
function locationLabel(location) {
  const row = location && typeof location === "object" ? location : {};
  const street = [trimmed(row.address_line1), trimmed(row.address_line2)].filter(Boolean).join(" ");
  const area = [trimmed(row.city), [trimmed(row.region), trimmed(row.postal_code)].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  return [trimmed(row.name), street, area].filter(Boolean).join(", ");
}

// How many times this booking has been revised, as far as the row can say.
//
// `business_bookings` has no revision counter, and adding one would need every
// writer to remember to bump it -- which is the kind of obligation that holds
// until somebody adds a seventh writer. `updated_at` is already maintained by
// the writers that exist, so the elapsed seconds between creation and last
// change is a proxy that rises whenever the booking changes and never falls.
//
// It is a proxy and not a count, and the difference matters in one direction
// only: two edits a second apart may produce the same number, so a calendar
// client could keep the older entry. That is a worse outcome than a true
// counter and a much better one than 0 forever, which no client can ever act
// on.
//
// Absent, unparseable, and backwards timestamps all return 0. A negative
// SEQUENCE is not a valid INTEGER value for the property, and "we cannot tell
// how many times this changed" is honestly 0 rather than a guess.
function calendarSequence(booking) {
  const row = booking && typeof booking === "object" ? booking : {};
  const created = Date.parse(row.created_at);
  const updated = Date.parse(row.updated_at);
  if (!Number.isFinite(created) || !Number.isFinite(updated)) return 0;
  const seconds = Math.floor((updated - created) / 1000);
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  return Math.min(seconds, MAX_SEQUENCE);
}

function byId(rows) {
  const index = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    if (row && typeof row === "object" && row.id) index.set(String(row.id), row);
  }
  return index;
}

// The booking rows a calendar builder can read correctly.
//
// A new object per booking rather than a mutation. Decorating in place would
// put `location_name` on a row another reader holds, and a field that exists on
// a row only because something else ran first is the hardest kind of bug to
// see.
//
// A referenced row that is missing leaves the field **absent** rather than
// empty. `if (booking.location_name)` treats both the same today, and an empty
// string would be a claim that the location has no name.
function decorateBookings(bookings, lookups) {
  const sources = lookups && typeof lookups === "object" ? lookups : {};
  const locations = byId(sources.locations);
  const services = byId(sources.services);

  return (Array.isArray(bookings) ? bookings : []).map((booking) => {
    const row = booking && typeof booking === "object" ? booking : {};
    const decorated = { ...row, calendar_sequence: calendarSequence(row) };

    const location = row.location_id ? locations.get(String(row.location_id)) : undefined;
    const label = location ? locationLabel(location) : "";
    if (label) decorated.location_name = label;

    const service = row.service_id ? services.get(String(row.service_id)) : undefined;
    const serviceName = service ? trimmed(service.name) : "";
    if (serviceName) decorated.service_name = serviceName;

    return decorated;
  });
}

// The ids a decoration needs, so a route reads only the rows it will use.
//
// A booking list of 500 may reference three locations. Filtering the lookup by
// `id=in.(...)` keeps the read proportional to the references rather than to
// the business, and an empty list means there is nothing to ask for -- which
// the caller must check, because `id=in.()` is not a query.
function referencedIds(bookings, column) {
  const found = new Set();
  for (const booking of Array.isArray(bookings) ? bookings : []) {
    const value = booking && typeof booking === "object" ? booking[column] : undefined;
    if (value) found.add(String(value));
  }
  return [...found].sort();
}

module.exports = {
  CALLER_SUPPLIED_FIELDS,
  MAX_SEQUENCE,
  calendarSequence,
  decorateBookings,
  locationLabel,
  referencedIds
};
