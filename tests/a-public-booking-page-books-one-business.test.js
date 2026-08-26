"use strict";

// A booking page open to the internet, and the three things it must not do.
//
// **Book against the wrong business.** The service-role key bypasses row level
// security, so the organization_id filter is the entire tenant boundary, and a
// public page has no session to derive one from. The resolution order is what
// answers that: the slug in the URL finds one enabled `public_booking_pages`
// row, that row names the organization, and the services offered, the bookings
// that block a time, and the booking finally written are all filtered on it.
// The visitor never chooses an organization. They are told one by the row its
// owner published.
//
// **Show a stranger the diary.** Only free times are rendered. Not "10:30
// taken", not who took it -- "unavailable" and "Mrs Patel, boiler service" are
// the same fact at different resolutions, and one of them is a competitor's
// customer list.
//
// **Sell the same slot twice.** The list a visitor is looking at was computed
// when the page loaded. The time is checked again on submit against a fresh
// read, and re-derived rather than trusted, so a hand-made request cannot book
// outside opening hours either.
//
// Assertions come in two kinds on purpose, the same way the shared-link tests
// do. "The page did not contain the other customer's name" can be true because
// the render dropped it or the fixture was thin. "Nothing was written" and
// "what was written carries this organization" are the properties worth
// holding, and the fake Supabase records every request so they can be asserted
// directly.

const assert = require("node:assert/strict");
const request = require("supertest");
const { createFakeSupabase } = require("./helpers/fake-supabase.cjs");

// Real v4 UUIDs, version and variant nibbles included.
const ORG = "a1a1a1a1-0000-4000-8000-00000000001a";
const OTHER_ORG = "b2b2b2b2-0000-4000-8000-00000000002b";
const SERVICE = "c3c3c3c3-0000-4000-8000-00000000003c";
const OTHER_SERVICE = "d4d4d4d4-0000-4000-8000-00000000004d";
const NO_DURATION_SERVICE = "e5e5e5e5-0000-4000-8000-00000000005e";

const STAFFED_ORG = "f6f6f6f6-0000-4000-8000-00000000006f";
const STAFFED_SERVICE = "a7a7a7a7-0000-4000-8000-00000000007a";
const ALEX = "b8b8b8b8-0000-4000-8000-00000000008b";
const SAM = "c9c9c9c9-0000-4000-8000-00000000009c";

const SHOP = "aaaa1111-0000-4000-8000-0000000000a1";
const DEPOT = "bbbb2222-0000-4000-8000-0000000000b2";
const SHOP_SERVICE = "cccc3333-0000-4000-8000-0000000000c3";

const OTHER_CUSTOMER = "Nadia Okonkwo";
const OTHER_PHONE = "555-PRIVATE-9999";
const OTHER_NOTE = "ALWAYS-LATE-DO-NOT-CONFIRM";

// A Monday well inside British Summer Time, so the page's Europe/London hours
// are an hour ahead of UTC and a test that quietly used the server's clock
// would come out an hour wrong rather than accidentally right.
const OPEN_WEEKDAYS = [
  null,
  { open: "09:00", close: "17:00" },
  { open: "09:00", close: "17:00" },
  { open: "09:00", close: "17:00" },
  { open: "09:00", close: "17:00" },
  { open: "09:00", close: "17:00" },
  null
];

function seed() {
  return {
    organizations: [
      { id: ORG, name: "Bright Plumbing" },
      { id: OTHER_ORG, name: "Somebody Else Ltd" }
    ],
    public_booking_pages: [
      {
        id: "pbp-1", organization_id: ORG, slug: "bright-plumbing", enabled: true,
        headline: "Book Bright Plumbing", intro: "Pick a time.",
        time_zone: "Europe/London", opening_hours: OPEN_WEEKDAYS,
        slot_minutes: 30, lead_time_hours: 0, horizon_days: 14
      },
      // Reserved and switched off. Reserving an address must not publish it.
      {
        id: "pbp-2", organization_id: OTHER_ORG, slug: "somebody-else", enabled: false,
        time_zone: "Europe/London", opening_hours: OPEN_WEEKDAYS,
        slot_minutes: 30, lead_time_hours: 0, horizon_days: 14
      },
      // A firm of two, booking a person rather than the business.
      {
        id: "pbp-3", organization_id: STAFFED_ORG, slug: "two-plumbers", enabled: true,
        headline: "Book Two Plumbers", intro: "Pick a time.",
        time_zone: "Europe/London", opening_hours: OPEN_WEEKDAYS,
        slot_minutes: 30, lead_time_hours: 0, horizon_days: 14, assign_staff: true
      }
    ],
    employee_schedules: [
      // Both rostered across the whole window, so a slot's availability turns
      // on who is booked rather than on who happens to be working that day.
      { id: "sh-1", organization_id: STAFFED_ORG, employee_id: ALEX, location_id: SHOP, starts_at: "2020-01-01T00:00:00.000Z", ends_at: "2100-01-01T00:00:00.000Z", status: "scheduled" },
      { id: "sh-2", organization_id: STAFFED_ORG, employee_id: SAM, location_id: DEPOT, starts_at: "2020-01-01T00:00:00.000Z", ends_at: "2100-01-01T00:00:00.000Z", status: "confirmed" }
    ],
    business_service_catalog: [
      { id: SERVICE, organization_id: ORG, name: "Boiler service", description: "A yearly check.", duration_minutes: 60, price_cents: 9000, currency: "gbp", status: "active" },
      { id: NO_DURATION_SERVICE, organization_id: ORG, name: "Something with no length", description: "", duration_minutes: null, price_cents: 5000, currency: "gbp", status: "active" },
      { id: OTHER_SERVICE, organization_id: OTHER_ORG, name: "Another firm's job", description: "", duration_minutes: 30, price_cents: 1000, currency: "gbp", status: "active" },
      { id: STAFFED_SERVICE, organization_id: STAFFED_ORG, name: "Leak repair", description: "", duration_minutes: 60, price_cents: 12000, currency: "gbp", status: "active" },
      // Done at the shop only. Alex is rostered at the shop, Sam at the depot.
      { id: SHOP_SERVICE, organization_id: STAFFED_ORG, name: "Counter service", description: "", duration_minutes: 60, price_cents: 4000, currency: "gbp", status: "active", location_id: SHOP }
    ],
    business_bookings: [
      {
        id: "bk-1", organization_id: ORG,
        starts_at: "2099-06-01T09:00:00.000Z", ends_at: "2099-06-01T10:00:00.000Z",
        status: "confirmed", customer_name: OTHER_CUSTOMER, customer_phone: OTHER_PHONE, notes: OTHER_NOTE
      }
    ]
  };
}

describe("a public booking page books one business", () => {
  let app;
  let fake;
  let savedFetch;
  let savedEnv;

  before(() => {
    savedEnv = {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY
    };
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-placeholder";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-placeholder";
    fake = createFakeSupabase({ users: {}, tables: seed() });
    savedFetch = global.fetch;
    global.fetch = fake.install(savedFetch);
    app = require("../server");
  });

  after(() => {
    if (savedFetch) global.fetch = savedFetch;
    for (const [key, value] of Object.entries(savedEnv || {})) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  describe("who can open it", () => {
    it("opens for somebody with no account at all", async () => {
      const response = await request(app).get("/book/bright-plumbing").set("accept", "text/html").redirects(0);
      assert.equal(response.status, 200, "a public booking page that needs an account is not a public booking page");
      assert.ok(response.text.includes("Boiler service"), "the service it exists to book is not on the page");
    });

    it("does not open an address that is reserved but switched off", async () => {
      const response = await request(app).get("/book/somebody-else").set("accept", "text/html").redirects(0);
      assert.equal(response.status, 404, "reserving an address published it");
    });

    it("answers a slug that does not exist the same way as one that is off", async () => {
      const missing = await request(app).get("/book/nobody-at-all").set("accept", "text/html").redirects(0);
      const off = await request(app).get("/book/somebody-else").set("accept", "text/html").redirects(0);
      assert.equal(missing.status, off.status, "telling them apart tells somebody guessing addresses when they have guessed one that exists");
    });

    it("refuses a slug shaped like a query fragment before it reaches a filter", async () => {
      for (const bad of ["a", "-leading", "trailing-", "Has-Capitals", "with_underscore", "x&limit=99"]) {
        const response = await request(app).get(`/book/${encodeURIComponent(bad)}`).set("accept", "text/html").redirects(0);
        assert.equal(response.status, 404, `accepted ${bad}`);
      }
    });
  });

  describe("what it offers", () => {
    it("offers only services this business has marked active", async () => {
      const response = await request(app).get("/book/bright-plumbing").set("accept", "text/html").redirects(0);
      assert.ok(!response.text.includes("Another firm's job"), "another organisation's service catalogue reached this page");
    });

    it("leaves out a service with no length rather than offering a time it cannot work out", async () => {
      const response = await request(app).get("/book/bright-plumbing").set("accept", "text/html").redirects(0);
      assert.ok(!response.text.includes("Something with no length"));
    });

    it("sends a service id from another business back to the list rather than pricing it", async () => {
      const response = await request(app).get(`/book/bright-plumbing?service=${OTHER_SERVICE}`).set("accept", "text/html").redirects(0);
      assert.equal(response.status, 303);
      assert.equal(response.headers.location, "/book/bright-plumbing");
    });

    it("shows times, and shows them in the business's own zone", async () => {
      const response = await request(app).get(`/book/bright-plumbing?service=${SERVICE}`).set("accept", "text/html").redirects(0);
      assert.equal(response.status, 200);
      assert.ok(response.text.includes("Europe/London"), "the page does not say which clock these times are on");
      assert.match(response.text, /name="starts_at"/, "no times were offered, so every assertion about them below is vacuous");
    });

    it("never says who has the times that are taken", async () => {
      const response = await request(app).get(`/book/bright-plumbing?service=${SERVICE}`).set("accept", "text/html").redirects(0);
      for (const secret of [OTHER_CUSTOMER, OTHER_PHONE, OTHER_NOTE]) {
        assert.ok(!response.text.includes(secret), `a stranger can read ${secret} off the booking page`);
      }
    });

    it("asks the database only for the columns it needs to block a time", async () => {
      // The stronger form of the assertion above. "The name was not rendered"
      // can be true because the render dropped it; "the name was never fetched"
      // is the property.
      const reads = fake.queries.filter((entry) => entry.table === "business_bookings" && entry.method === "GET");
      assert.ok(reads.length > 0, "no booking read was recorded, so this check is looking at nothing");
      for (const read of reads) {
        assert.ok(!/customer_name|customer_email|customer_phone|notes/.test(read.search), `a public page selected contact details: ${read.search}`);
      }
    });

    it("windows the booking read on overlap, not on when a job started", async () => {
      await request(app).get(`/book/bright-plumbing?service=${SERVICE}`).set("accept", "text/html").redirects(0);
      // The first version of this read asked for bookings whose `starts_at`
      // fell inside the window, which misses the one that matters most: a job
      // that began before the window and is still running inside it. That
      // booking blocks a time and was invisible, so the page offered it -- a
      // double-booking hole created by the query rather than by the arithmetic.
      //
      // Asserted on the query rather than with a fixture, because a fixture
      // covering the whole window would block every slot and take the rest of
      // this file's assertions with it. The behaviour it protects is tested
      // against the module in tests/booking-availability.test.js.
      const reads = fake.queries.filter((entry) => entry.method === "GET" && entry.table === "business_bookings");
      assert.ok(reads.length > 0, "no booking read was recorded, so this check is looking at nothing");
      for (const read of reads) {
        assert.ok(!/starts_at=gte\./.test(read.search),
          `the window bounds starts_at, so a job running since before it is invisible: ${read.search}`);
        assert.ok(/ends_at\.is\.null/.test(read.search),
          `a booking with no end must survive the window, because the module gives it a real length: ${read.search}`);
      }
    });

    it("filters every read it makes by the organisation the slug named", async () => {
      const reads = fake.queries.filter((entry) => entry.method === "GET"
        && (entry.table === "business_bookings" || entry.table === "business_service_catalog"));
      assert.ok(reads.length > 0, "nothing was read, so this check is looking at nothing");
      for (const read of reads) {
        assert.ok(read.search.includes(`organization_id=eq.${ORG}`), `a public read carried no tenant filter: ${read.search}`);
      }
    });
  });

  describe("making a booking", () => {
    async function chooseATime() {
      const page = await request(app).get(`/book/bright-plumbing?service=${SERVICE}`).set("accept", "text/html").redirects(0);
      const match = /name="starts_at" value="([^"]+)"/.exec(page.text);
      assert.ok(match, "the page offered no time, so nothing below can be tested");
      return match[1];
    }

    it("writes one booking, against the organisation the slug named", async () => {
      const startsAt = await chooseATime();
      const before = fake.queries.length;
      const response = await request(app)
        .post("/book/bright-plumbing")
        .type("form")
        .send({ service_id: SERVICE, starts_at: startsAt, customer_name: "Sam Visitor", customer_email: "sam@example.com" })
        .redirects(0);
      assert.equal(response.status, 200, "a request that should have been accepted was not");

      const writes = fake.queries.slice(before).filter((entry) => entry.method === "POST" && entry.table === "business_bookings");
      assert.equal(writes.length, 1, "a booking form must write exactly one booking");
      const row = writes[0].body;
      assert.equal(row.organization_id, ORG, "the booking was written against the wrong business");
      assert.equal(row.service_id, SERVICE);
      assert.equal(row.starts_at, startsAt);
      // Requested, not confirmed. Confirming would commit a business to work on
      // the word of a stranger.
      assert.equal(row.status, "requested");
    });

    it("takes the organisation from the published page and not from the form", async () => {
      const startsAt = await chooseATime();
      const before = fake.queries.length;
      await request(app)
        .post("/book/bright-plumbing")
        .type("form")
        .send({
          service_id: SERVICE, starts_at: startsAt,
          customer_name: "Sam Visitor", customer_email: "sam@example.com",
          organization_id: OTHER_ORG
        })
        .redirects(0);
      const writes = fake.queries.slice(before).filter((entry) => entry.method === "POST" && entry.table === "business_bookings");
      assert.equal(writes.length, 1);
      assert.equal(writes[0].body.organization_id, ORG, "a field in the form moved a booking into another business");
    });

    it("refuses a time outside opening hours even though nothing is booked then", async () => {
      const before = fake.queries.length;
      const response = await request(app)
        .post("/book/bright-plumbing")
        .type("form")
        // 03:00 on a Sunday, years out. Empty diary, closed business.
        .send({ service_id: SERVICE, starts_at: "2099-06-07T03:00:00.000Z", customer_name: "Sam Visitor", customer_email: "sam@example.com" })
        .redirects(0);
      assert.equal(response.status, 303);
      assert.match(response.headers.location, /problem=taken/);
      const writes = fake.queries.slice(before).filter((entry) => entry.method === "POST" && entry.table === "business_bookings");
      assert.equal(writes.length, 0, "a hand-made request booked outside opening hours");
    });

    it("refuses a request with no way to reach the person, and writes nothing", async () => {
      const startsAt = await chooseATime();
      const before = fake.queries.length;
      const response = await request(app)
        .post("/book/bright-plumbing")
        .type("form")
        .send({ service_id: SERVICE, starts_at: startsAt, customer_name: "Sam Visitor" })
        .redirects(0);
      assert.equal(response.status, 303);
      assert.match(response.headers.location, /problem=details/);
      const writes = fake.queries.slice(before).filter((entry) => entry.method === "POST" && entry.table === "business_bookings");
      assert.equal(writes.length, 0, "a slot was held for somebody nobody can confirm with");
    });

    it("refuses a service belonging to another business, and writes nothing", async () => {
      const startsAt = await chooseATime();
      const before = fake.queries.length;
      const response = await request(app)
        .post("/book/bright-plumbing")
        .type("form")
        .send({ service_id: OTHER_SERVICE, starts_at: startsAt, customer_name: "Sam Visitor", customer_email: "sam@example.com" })
        .redirects(0);
      assert.equal(response.status, 303);
      const writes = fake.queries.slice(before).filter((entry) => entry.method === "POST" && entry.table === "business_bookings");
      assert.equal(writes.length, 0);
    });
  });

  describe("a firm with staff", () => {
    async function firstTime(slug, service) {
      const page = await request(app).get(`/book/${slug}?service=${service}`).set("accept", "text/html").redirects(0);
      const match = /name="starts_at" value="([^"]+)"/.exec(page.text);
      assert.ok(match, "the page offered no time, so nothing below can be tested");
      return match[1];
    }

    it("names the person the appointment goes to", async () => {
      const startsAt = await firstTime("two-plumbers", STAFFED_SERVICE);
      const before = fake.queries.length;
      const response = await request(app)
        .post("/book/two-plumbers")
        .type("form")
        .send({ service_id: STAFFED_SERVICE, starts_at: startsAt, customer_name: "Sam Visitor", customer_email: "sam@example.com" })
        .redirects(0);
      assert.equal(response.status, 200);
      const writes = fake.queries.slice(before).filter((entry) => entry.method === "POST" && entry.table === "business_bookings");
      assert.equal(writes.length, 1);
      assert.equal(writes[0].body.organization_id, STAFFED_ORG);
      assert.ok([ALEX, SAM].includes(writes[0].body.assigned_employee_id), "a staffed page booked nobody in particular");
    });

    it("never lets the visitor choose which of them it is", async () => {
      const startsAt = await firstTime("two-plumbers", STAFFED_SERVICE);
      const before = fake.queries.length;
      await request(app)
        .post("/book/two-plumbers")
        .type("form")
        .send({
          service_id: STAFFED_SERVICE, starts_at: startsAt,
          customer_name: "Sam Visitor", customer_email: "sam@example.com",
          // Not a field the form has. If it were honoured, a stranger could
          // book somebody who is not working.
          assigned_employee_id: "deadbeef-0000-4000-8000-00000000dead"
        })
        .redirects(0);
      const writes = fake.queries.slice(before).filter((entry) => entry.method === "POST" && entry.table === "business_bookings");
      assert.equal(writes.length, 1);
      assert.ok([ALEX, SAM].includes(writes[0].body.assigned_employee_id), "a form field chose who does the work");
    });

    it("never puts the rota on the page", async () => {
      const response = await request(app).get(`/book/two-plumbers?service=${STAFFED_SERVICE}`).set("accept", "text/html").redirects(0);
      assert.equal(response.status, 200);
      assert.match(response.text, /name="starts_at"/, "no times were offered, so this assertion is vacuous");
      for (const id of [ALEX, SAM]) {
        assert.ok(!response.text.includes(id), "a visitor can read which of the two is free, which is a staff rota");
      }
    });

    it("reads the rota scoped to the business the slug named", async () => {
      await request(app).get(`/book/two-plumbers?service=${STAFFED_SERVICE}`).set("accept", "text/html").redirects(0);
      const reads = fake.queries.filter((entry) => entry.method === "GET" && entry.table === "employee_schedules");
      assert.ok(reads.length > 0, "the rota was never read, so a staffed page is not actually staffed");
      for (const read of reads) {
        assert.ok(read.search.includes(`organization_id=eq.${STAFFED_ORG}`), `a rota read carried no tenant filter: ${read.search}`);
      }
    });

    it("does not read a rota for a page that books the business as a whole", async () => {
      fake.reset();
      await request(app).get(`/book/bright-plumbing?service=${SERVICE}`).set("accept", "text/html").redirects(0);
      const reads = fake.queries.filter((entry) => entry.table === "employee_schedules");
      assert.equal(reads.length, 0, "an unstaffed page costs every visitor an extra query for a rota it does not use");
      const bookingReads = fake.queries.filter((entry) => entry.table === "business_bookings");
      assert.ok(bookingReads.length > 0, "and it did read bookings, so this is not passing because nothing ran");
    });

    it("assigns nobody on a page that books the business as a whole", async () => {
      const startsAt = await firstTime("bright-plumbing", SERVICE);
      const before = fake.queries.length;
      await request(app)
        .post("/book/bright-plumbing")
        .type("form")
        .send({ service_id: SERVICE, starts_at: startsAt, customer_name: "Sam Visitor", customer_email: "sam@example.com" })
        .redirects(0);
      const writes = fake.queries.slice(before).filter((entry) => entry.method === "POST" && entry.table === "business_bookings");
      assert.equal(writes.length, 1);
      assert.equal(writes[0].body.assigned_employee_id, null, "a sole trader's booking was assigned to somebody");
    });
  });

  describe("two sites and one booking page", () => {
    it("books the person rostered where the service happens", async () => {
      const page = await request(app).get(`/book/two-plumbers?service=${SHOP_SERVICE}`).set("accept", "text/html").redirects(0);
      const match = /name="starts_at" value="([^"]+)"/.exec(page.text);
      assert.ok(match, "a service at the shop offered no time, though somebody is rostered there");

      const before = fake.queries.length;
      await request(app).post("/book/two-plumbers").type("form")
        .send({ service_id: SHOP_SERVICE, starts_at: match[1], customer_name: "Sam Visitor", customer_email: "sam@example.com" })
        .redirects(0);
      const writes = fake.queries.slice(before).filter((entry) => entry.method === "POST" && entry.table === "business_bookings");
      assert.equal(writes.length, 1);
      assert.equal(writes[0].body.assigned_employee_id, ALEX, "the appointment went to somebody rostered at the other site");
      assert.equal(writes[0].body.location_id, SHOP, "the booking does not record where it is");
    });

    it("reads the location on the rota, the catalogue and the diary", async () => {
      // Any one of the three missing makes the whole rule silently inert: an
      // unread location is the same as no location, which is what it did before.
      fake.reset();
      await request(app).get(`/book/two-plumbers?service=${SHOP_SERVICE}`).set("accept", "text/html").redirects(0);
      for (const table of ["employee_schedules", "business_service_catalog", "business_bookings"]) {
        const read = fake.queries.find((entry) => entry.method === "GET" && entry.table === table);
        assert.ok(read, `${table} was not read at all`);
        assert.ok(/location_id/.test(read.search), `${table} is read without its location: ${read.search}`);
      }
    });

    it("still offers a service that names no place to everybody rostered", async () => {
      // Every single-site business, and the reason this changes nothing there.
      const page = await request(app).get(`/book/two-plumbers?service=${STAFFED_SERVICE}`).set("accept", "text/html").redirects(0);
      assert.match(page.text, /name="starts_at"/, "a service with no location stopped being bookable");
    });
  });

  describe("the source itself", () => {
    const source = require("node:fs").readFileSync(require.resolve("../routes/sonara-public-booking-routes.cjs"), "utf8");

    it("never selects every column on a page a stranger can open", () => {
      assert.doesNotMatch(source, /select=\*/, "a public page selects every column somewhere");
    });

    it("rate limits the write, because it is a form open to the internet", () => {
      assert.match(source, /createRateLimiter\(/);
      assert.match(source, /app\.post\("\/book\/:slug", bookingLimiter/, "the booking form is not behind its limiter");
    });

    it("never writes a confirmed booking", () => {
      assert.doesNotMatch(source, /status:\s*"confirmed"/, "this page confirms an appointment on a stranger's word");
    });

    it("never takes the assignee from the request", () => {
      assert.doesNotMatch(source, /assigned_employee_id:\s*req\./, "a visitor can name the person who does the work");
    });

    it("never takes the location from the request", () => {
      assert.doesNotMatch(source, /location_id:\s*req\./, "a visitor can name which site the appointment is at");
    });
  });
});
