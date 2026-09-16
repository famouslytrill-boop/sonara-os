"use strict";

// Every field an export builder reads must be a column, or be supplied.
//
// `lib/sonara-calendar-invite.cjs` read `booking.service_name`,
// `booking.location_name` and `booking.calendar_sequence` for a week. None of
// the three is a column of `business_bookings`. Each read returned `undefined`
// and each fell through silently: every calendar download was titled "Booking",
// carried no LOCATION line, and had SEQUENCE 0 -- the value that stops a
// corrected booking replacing the entry it corrects.
//
// The query was `select=*`, which is why nothing caught it.
// `report-unused-selected-columns.mjs` compares the columns a query asks for
// against the columns a function uses, and a star select does not name its
// columns, so there was nothing to compare. That report counts star selects
// rather than auditing them precisely because of this blindness, and this is
// the defect it was counting the blindness for.
//
// So this test does the comparison the other way round, which works under a
// star select and would have caught it on day one: take the field names the
// module reads, take the column names the migrations create, and require every
// read to be one of them or to be declared as caller-supplied.
//
// Everything here is derived. Nothing restates a list that lives somewhere
// else, because a copied list is a list that drifts.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { withoutComments } = require("../lib/sonara-comment-stripping.cjs");
const {
  CALLER_SUPPLIED_FIELDS,
  MAX_SEQUENCE,
  calendarSequence,
  decorateBookings,
  locationLabel,
  referencedIds
} = require("../lib/sonara-booking-calendar-fields.cjs");
const { buildCalendarInvite } = require("../lib/sonara-calendar-invite.cjs");
const { buildContactCard } = require("../lib/sonara-contact-card.cjs");

const root = path.join(__dirname, "..");
const migrationsDir = path.join(root, "supabase", "migrations");

// Every column any migration gives a table, whether by `create table` or by
// `alter table ... add column`.
//
// The repository creates several of these tables more than once -- 013 and
// 20260721213000 both hold `business_bookings`, and 20260812000000 adds the
// same columns again through dynamic SQL -- so this unions rather than taking
// the first definition. A column present in any of them is a column the
// database has after a replay.
function columnsOf(table) {
  const found = new Set();
  const createPattern = new RegExp(`create table (?:if not exists )?(?:public\\.)?${table}\\s*\\(([\\s\\S]*?)\\n\\);`, "gi");
  const addPattern = new RegExp(`alter table (?:public\\.)?${table} add column (?:if not exists )?([a-z0-9_]+)`, "gi");

  for (const name of fs.readdirSync(migrationsDir).sort()) {
    if (!name.endsWith(".sql")) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, name), "utf8");

    for (const match of sql.matchAll(createPattern)) {
      for (const line of match[1].split("\n")) {
        // A column definition opens the line with its name. Table-level
        // constraints open with a keyword, and taking those as columns would
        // make this check pass on names no row has.
        const column = line.trim().match(/^([a-z][a-z0-9_]*)\s+[a-z]/i);
        if (!column) continue;
        const word = column[1].toLowerCase();
        if (["primary", "unique", "foreign", "constraint", "check", "exclude"].includes(word)) continue;
        found.add(word);
      }
    }

    for (const match of sql.matchAll(addPattern)) found.add(match[1].toLowerCase());
  }

  return found;
}

// The `<name>.<field>` reads in a module, for a given receiver name.
//
// Optional chaining included: the first pass of a similar derivation elsewhere
// in this repository matched `job.` only, missed a `job?.title`, and would have
// shipped a wrong title on every page. Comments stripped first -- a field named
// in a comment is a field discussed, not read.
function fieldsRead(file, receivers) {
  const source = withoutComments(fs.readFileSync(path.join(root, file), "utf8"));
  const found = new Set();
  for (const receiver of receivers) {
    const pattern = new RegExp(`\\b${receiver}(?:\\?)?\\.([a-z_][a-z0-9_]*)\\b`, "g");
    for (const match of source.matchAll(pattern)) found.add(match[1]);
  }
  return found;
}

// The literal `select=a,b,c` list each `supabaseList` call on a table sends.
//
// Read off the query strings rather than out of a constant, because the queries
// are what reach PostgREST and because `report-unused-selected-columns.mjs` can
// only audit a select whose columns are named in the source. The route's own
// comment explains why they are inline; this reads them from there.
//
// A table read in more than one place must read the same columns in each. Two
// copies of one list is how the single-invite download and the whole-diary feed
// come to disagree about what a calendar entry contains.
function selectListsFor(file, table) {
  const source = withoutComments(fs.readFileSync(path.join(root, file), "utf8"));
  const pattern = new RegExp(`"${table}",\\s*\`\\?select=([a-z0-9_,]+)&`, "g");
  const lists = [...source.matchAll(pattern)].map((match) => match[1]);
  assert.ok(lists.length >= 1, `no literal select list found for ${table} in ${file}; this check has gone blind`);
  const distinct = [...new Set(lists)];
  assert.equal(
    distinct.length,
    1,
    `the ${lists.length} reads of ${table} in ${file} ask for ${distinct.length} different column lists: ${distinct.join(" / ")}`
  );
  return { columns: distinct[0].split(","), readCount: lists.length };
}

function selectListIn(file, table) {
  return selectListsFor(file, table).columns;
}

const BOOKING_COLUMNS = columnsOf("business_bookings");
const CUSTOMER_COLUMNS = columnsOf("customers");
const LOCATION_COLUMNS = columnsOf("business_locations");
const SERVICE_COLUMNS = columnsOf("business_service_catalog");

describe("the migrations are being read at all", () => {
  // Shape one in .claude/skills/checks-that-cannot-lie: a check satisfied by an
  // empty population. If `columnsOf` stops matching -- a migration reformatted,
  // a table renamed -- every assertion below passes over nothing.
  it("finds a plausible column set for each table this test reasons about", () => {
    for (const [table, columns] of [
      ["business_bookings", BOOKING_COLUMNS],
      ["customers", CUSTOMER_COLUMNS],
      ["business_locations", LOCATION_COLUMNS],
      ["business_service_catalog", SERVICE_COLUMNS]
    ]) {
      assert.ok(columns.size >= 8, `only ${columns.size} columns parsed for ${table}; this check has gone blind`);
      assert.ok(columns.has("id"), `${table} parsed without an id column; this check has gone blind`);
      assert.ok(columns.has("organization_id"), `${table} parsed without organization_id; this check has gone blind`);
    }
  });

  it("does not credit business_bookings with the three columns it does not have", () => {
    // The inverse assertion, and the one that keeps the test honest. If a
    // future migration really adds these, this fails and the decoration should
    // be deleted rather than this line relaxed.
    for (const absent of CALLER_SUPPLIED_FIELDS) {
      assert.ok(
        !BOOKING_COLUMNS.has(absent),
        `business_bookings now has a ${absent} column. lib/sonara-booking-calendar-fields.cjs exists to supply it and should be removed rather than left to shadow the real column.`
      );
    }
  });
});

describe("a calendar file cannot read a column that does not exist", () => {
  const readByInvite = fieldsRead("lib/sonara-calendar-invite.cjs", ["booking", "row"]);

  it("reads a plausible number of fields off the booking", () => {
    assert.ok(readByInvite.size >= 6, `only ${readByInvite.size} booking fields found; this check has gone blind`);
    assert.ok(readByInvite.has("starts_at"), "starts_at not among the fields read; this check has gone blind");
  });

  it("reads only real columns and declared caller-supplied fields", () => {
    const unexplained = [...readByInvite]
      .filter((field) => !BOOKING_COLUMNS.has(field))
      .filter((field) => !CALLER_SUPPLIED_FIELDS.includes(field))
      .sort();
    assert.deepEqual(
      unexplained,
      [],
      `lib/sonara-calendar-invite.cjs reads ${unexplained.join(", ")} off a booking. business_bookings has no such column and lib/sonara-booking-calendar-fields.cjs does not supply it, so the read is undefined and whatever it falls back to is what every customer gets.`
    );
  });

  it("asks the database for every real column it goes on to read", () => {
    const selected = new Set(selectListIn("routes/sonara-last9-routes.cjs", "business_bookings"));
    const missing = [...readByInvite]
      .filter((field) => BOOKING_COLUMNS.has(field))
      .filter((field) => !selected.has(field))
      .sort();
    assert.deepEqual(missing, [], `the booking calendar select does not ask for ${missing.join(", ")}, so those reads are undefined`);
  });

  it("asks for the four columns the decoration needs to do its work", () => {
    const selected = new Set(selectListIn("routes/sonara-last9-routes.cjs", "business_bookings"));
    for (const needed of ["location_id", "service_id", "created_at", "updated_at"]) {
      assert.ok(selected.has(needed), `the booking calendar select omits ${needed}, which the decoration needs`);
    }
  });

  it("asks only for columns that exist", () => {
    for (const column of selectListIn("routes/sonara-last9-routes.cjs", "business_bookings")) {
      assert.ok(BOOKING_COLUMNS.has(column), `the booking calendar select names ${column}, which business_bookings does not have. PostgREST answers 400 and the download fails outright.`);
    }
  });
});

describe("a contact card cannot read a column that does not exist", () => {
  const readByCard = fieldsRead("lib/sonara-contact-card.cjs", ["customer", "row"]);

  it("reads only real columns of customers", () => {
    const unexplained = [...readByCard].filter((field) => !CUSTOMER_COLUMNS.has(field)).sort();
    assert.deepEqual(unexplained, [], `lib/sonara-contact-card.cjs reads ${unexplained.join(", ")}, which customers does not have`);
  });

  it("asks for every column it reads, and only columns that exist", () => {
    const selected = selectListIn("routes/sonara-last9-routes.cjs", "customers");
    for (const column of selected) {
      assert.ok(CUSTOMER_COLUMNS.has(column), `the contact card select names ${column}, which customers does not have`);
    }
    const missing = [...readByCard].filter((field) => !selected.includes(field)).sort();
    assert.deepEqual(missing, [], `the contact card select does not ask for ${missing.join(", ")}`);
  });

  it("does not fetch communication_preference", () => {
    // Not a consent gate, and the reason is the point. Nothing in the
    // repository reads or writes that column, so it is 'unknown' on every row
    // and gating an owner's own address-book download on it would refuse every
    // download while looking like enforcement. It is simply no longer fetched.
    const selected = selectListIn("routes/sonara-last9-routes.cjs", "customers");
    assert.ok(CUSTOMER_COLUMNS.has("communication_preference"), "the column is gone from the schema; this assertion no longer means anything");
    assert.ok(!selected.includes("communication_preference"), "the contact card select fetches communication_preference and nothing compares it to anything");
  });

  it("asks only for columns that exist in the lookup tables too", () => {
    // The two reads loadBookingCalendarLookups makes. Named in the route as
    // literal select lists, so they are checked the same way.
    const source = withoutComments(fs.readFileSync(path.join(root, "routes/sonara-last9-routes.cjs"), "utf8"));
    const locationSelect = source.match(/table: "business_locations",[^}]*select: "([a-z0-9_,]+)"/);
    const serviceSelect = source.match(/table: "business_service_catalog",[^}]*select: "([a-z0-9_,]+)"/);
    assert.ok(locationSelect && serviceSelect, "the lookup select lists were not found; this check has gone blind");
    for (const column of locationSelect[1].split(",")) {
      assert.ok(LOCATION_COLUMNS.has(column), `the location lookup names ${column}, which business_locations does not have`);
    }
    for (const column of serviceSelect[1].split(",")) {
      assert.ok(SERVICE_COLUMNS.has(column), `the service lookup names ${column}, which business_service_catalog does not have`);
    }
  });
});

describe("what the decoration supplies", () => {
  const BOOKING = Object.freeze({
    id: "11111111-2222-3333-4444-555555555555",
    starts_at: "2026-09-01T10:00:00Z",
    ends_at: "2026-09-01T11:30:00Z",
    status: "confirmed",
    customer_name: "Ada Lovelace",
    location_id: "loc-1",
    service_id: "svc-1",
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-01T00:10:00Z"
  });
  const LOOKUPS = Object.freeze({
    locations: [{ id: "loc-1", name: "Marsh Street", address_line1: "14 Marsh Street", city: "Bristol", region: "Somerset", postal_code: "BS1 4AA" }],
    services: [{ id: "svc-1", name: "Deep tissue massage" }]
  });

  it("supplies exactly the fields it declares", () => {
    const [decorated] = decorateBookings([BOOKING], LOOKUPS);
    const added = Object.keys(decorated).filter((key) => !(key in BOOKING)).sort();
    assert.deepEqual(added, [...CALLER_SUPPLIED_FIELDS].sort());
  });

  it("does not mutate the row it was given", () => {
    const row = { ...BOOKING };
    decorateBookings([row], LOOKUPS);
    assert.deepEqual(row, { ...BOOKING }, "the decoration wrote onto the caller's row, so a field exists elsewhere only because this ran first");
  });

  it("titles the entry with the service and places it at the location", () => {
    const [decorated] = decorateBookings([BOOKING], LOOKUPS);
    const invite = buildCalendarInvite(decorated, { now: new Date("2026-08-20T00:00:00Z") });
    assert.equal(invite.ok, true);
    assert.match(invite.body, /SUMMARY:Deep tissue massage/);
    assert.match(invite.body, /LOCATION:Marsh Street/);
    assert.match(invite.body, /14 Marsh Street/);
    assert.match(invite.body, /BS1 4AA/);
  });

  it("is the difference between a titled entry and one called Booking", () => {
    // The state this shipped in, asserted rather than described, so nobody
    // reverts the decoration believing it was cosmetic.
    const plain = buildCalendarInvite(BOOKING, { now: new Date("2026-08-20T00:00:00Z") });
    assert.equal(plain.ok, true);
    assert.match(plain.body, /SUMMARY:Booking\r\n/);
    assert.ok(!/LOCATION:/.test(plain.body), "an undecorated booking should have no LOCATION line; if it does, this test is measuring the wrong thing");
    assert.match(plain.body, /SEQUENCE:0/);
  });

  it("raises SEQUENCE when the booking is edited and never lowers it", () => {
    assert.equal(calendarSequence(BOOKING), 600);
    assert.equal(calendarSequence({ ...BOOKING, updated_at: "2026-08-02T00:00:00Z" }), 86400);
    // Absent, unparseable and backwards all mean "cannot tell", and 0 is the
    // honest answer. A negative SEQUENCE is not a valid RFC 5545 INTEGER value.
    assert.equal(calendarSequence({}), 0);
    assert.equal(calendarSequence({ created_at: "not a date", updated_at: "2026-08-02T00:00:00Z" }), 0);
    assert.equal(calendarSequence({ created_at: "2026-08-02T00:00:00Z", updated_at: "2026-08-01T00:00:00Z" }), 0);
    assert.equal(calendarSequence({ created_at: "1970-01-01T00:00:00Z", updated_at: "2999-01-01T00:00:00Z" }), MAX_SEQUENCE);
  });

  it("leaves the field absent when the referenced row is missing", () => {
    // Absent rather than empty. `if (booking.location_name)` treats both the
    // same, and an empty string would be a claim that the location has no name.
    const [decorated] = decorateBookings([BOOKING], { locations: [], services: [] });
    assert.ok(!("location_name" in decorated));
    assert.ok(!("service_name" in decorated));
  });

  it("composes a location out of whatever parts are there", () => {
    assert.equal(locationLabel({ name: "Marsh Street" }), "Marsh Street");
    assert.equal(locationLabel({ name: "Marsh Street", city: "Bristol" }), "Marsh Street, Bristol");
    assert.equal(locationLabel({}), "");
    assert.equal(locationLabel(null), "");
  });

  it("asks for each referenced id once, and for none when there are none", () => {
    assert.deepEqual(referencedIds([BOOKING, BOOKING], "location_id"), ["loc-1"]);
    assert.deepEqual(referencedIds([{ id: "a" }], "location_id"), []);
    assert.deepEqual(referencedIds(null, "location_id"), []);
  });
});

describe("the contact card still reads what it always did", () => {
  it("builds from the narrowed column set alone", () => {
    // The narrowed select is what a route now hands it. If any of the six
    // dropped columns mattered, this fails.
    const customer = { id: "c-1", name: "Ada Lovelace", email: "ada@example.com", phone: "+441170000000", status: "active", source: "referral", tags: ["vip"] };
    const card = buildContactCard(customer, {});
    assert.equal(card.ok, true);
    assert.match(card.body, /FN:Ada Lovelace/);
    assert.match(card.body, /TEL;TYPE=CELL:\+441170000000/);
    assert.match(card.body, /Status: active/);
    assert.match(card.body, /Tags: vip/);
  });
});
