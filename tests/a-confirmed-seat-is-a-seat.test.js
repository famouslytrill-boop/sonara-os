"use strict";

// An RSVP system that oversells hands somebody a sentence they travel on.
//
// Growth Studio could plan a campaign and capture a lead. It could not hold a
// date, a place, and the people who said they would be there — which is what a lot
// of small businesses and most creators actually run on. It can now, and the
// failure worth guarding is specific: **a confirmation that is not true**. This is
// the recurring defect of this codebase in its most expensive form, because the
// person who believes it got in a car.
//
// Three invariants, each with a way of quietly stopping:
//
// **A confirmation must be true.** `admit` waitlists past capacity rather than
// confirming, and it counts seats rather than rows — one row for a family of four
// takes four. A party that does not fit whole is waitlisted whole, because
// confirming two of four and saying "confirmed" is the lie, and splitting the row
// silently decides which two of somebody's family are coming.
//
// **An unrecorded capacity is not a number.** Absent read as unlimited oversells a
// real room; absent read as zero refuses every event whose owner left the box
// empty. The third answer is the honest one: record it, and say in words that no
// capacity is recorded so this is a registration of interest. `capacity_not_recorded`
// is a distinct outcome from `confirmed` so a page cannot print the wrong sentence
// by accident.
//
// **An unanswered question is not a no.** `attending` is null until somebody
// answers.
//
// And two things this must never start doing, both from AGENTS.md: send anything
// (alerts are off or user-controlled by default) and hold money (an RSVP is not a
// ticket, and raw card data must not be stored).

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const request = require("supertest");
const registerGrowthEventRoutes = require("../routes/sonara-growth-event-routes.cjs");
const events = require("../lib/sonara-growth-events.cjs");

const ORG = "a1a1a1a1-0000-4000-8000-00000000001a";
const OTHER_ORG = "a2a2a2a2-0000-4000-8000-00000000002a";
const USER = "b2b2b2b2-0000-4000-8000-00000000002b";
const VENUE = "c3c3c3c3-0000-4000-8000-00000000003c";
const EVENT = "d4d4d4d4-0000-4000-8000-00000000004d";
const OWNER_PAGE = "/growth-studio/owner/events";
const SLUG = "autumn-session";

const MIGRATION = path.join(__dirname, "..", "supabase", "migrations", "20261002060000_public_events_and_rsvps.sql");
const ROUTES = path.join(__dirname, "..", "routes", "sonara-growth-event-routes.cjs");
const MODULE = path.join(__dirname, "..", "lib", "sonara-growth-events.cjs");

const seat = (state, partySize = 1) => ({ state, partySize });
const published = (overrides = {}) => ({
  id: EVENT, organization_id: ORG, venue_id: VENUE, title: "Autumn Session",
  summary: "An evening of it.", kind: "concert", status: "published",
  starts_at: "2026-11-01T19:30:00.000Z", ends_at: null, capacity: null,
  slug: SLUG, cancellation_reason: null, ...overrides
});

function buildApp({
  venues = [{ id: VENUE, organization_id: ORG, name: "The Hall", address: "1 Road", capacity: 10, time_zone: "UTC" }],
  eventRows = [published()],
  rsvps = [],
  venuesOk = true, eventsOk = true, rsvpsOk = true,
  writeOk = true, writeStatus = 201,
  organization = ORG,
  configOk = true
} = {}) {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  const calls = [];
  global.fetch = async (url, init) => {
    const href = String(url);
    const method = String(init?.method || "GET").toUpperCase();
    calls.push({ href, method, body: init?.body ? JSON.parse(init.body) : null });

    if (method === "GET") {
      if (href.includes("/growth_event_rsvps")) return { ok: rsvpsOk, status: rsvpsOk ? 200 : 500, json: async () => rsvps };
      if (href.includes("/growth_events")) return { ok: eventsOk, status: eventsOk ? 200 : 500, json: async () => eventRows };
      if (href.includes("/growth_venues")) return { ok: venuesOk, status: venuesOk ? 200 : 500, json: async () => venues };
      return { ok: true, status: 200, json: async () => [] };
    }
    const ok = writeOk && writeStatus >= 200 && writeStatus < 300;
    return { ok, status: writeStatus, json: async () => [] };
  };

  registerGrowthEventRoutes(app, {
    layout: ({ title, heading, body, sections = [] }) => `<html><title>${title}</title><h1>${heading}</h1><p>${body}</p>${sections.join("")}</html>`,
    brandCard: (cardTitle, cardBody) => `<article><h2>${cardTitle}</h2><div>${cardBody}</div></article>`,
    linkAction: (href, label) => `<a href="${href}">${label}</a>`,
    escapeHtml: (value) => String(value).replace(/[&<>"']/g, ""),
    requireWorkspaceAccess: () => (req, res, next) => { req.sonaraUser = { id: USER }; return next(); },
    getCustomerPrimaryOrganization: async () => (organization ? { ok: true, organizationId: organization } : { ok: false }),
    getSupabaseServerConfig: () => (configOk ? { ok: true, url: "https://project.supabase.co", serviceRoleKey: "server-only" } : { ok: false }),
    supabaseHeaders: () => ({ apikey: "server-only" }),
    createRateLimiter: () => (req, res, next) => next()
  });
  return { app, calls };
}

const writes = (calls, table) => calls.filter((call) => call.method === "POST" && call.href.includes(`/${table}`));
const patches = (calls, table) => calls.filter((call) => call.method === "PATCH" && call.href.includes(`/${table}`));

describe("a confirmed seat is a seat", () => {
  let savedFetch;
  beforeEach(() => { savedFetch = global.fetch; });
  afterEach(() => { global.fetch = savedFetch; });

  describe("the schema it writes to", () => {
    const sql = fs.readFileSync(MIGRATION, "utf8");

    it("reads a migration that is actually there", () => {
      assert.ok(sql.length > 4000, `the events migration is ${sql.length} bytes; these assertions have gone blind`);
    });

    it("keeps capacity nullable on both tables", () => {
      assert.equal((sql.match(/capacity integer check \(capacity is null or capacity >= 0\)/g) || []).length, 2);
      assert.doesNotMatch(sql, /capacity integer not null/i);
      assert.doesNotMatch(sql, /capacity integer[^,]*default/i);
    });

    it("keeps the attendance answer nullable", () => {
      assert.match(sql, /\battending boolean,/);
      assert.doesNotMatch(sql, /attending boolean[^,]*(not null|default)/i);
    });

    it("lets one person hold one RSVP per event, case-insensitively", () => {
      assert.match(sql, /create unique index if not exists growth_event_rsvps_person_key[\s\S]{0,120}\(event_id, lower\(email\)\)/);
    });

    it("refuses to publish an event with no address", () => {
      assert.match(sql, /check \(status <> 'published' or slug is not null\)/);
      assert.match(sql, /create unique index if not exists growth_events_slug_key/);
    });

    it("holds no money and no card anywhere in the schema", () => {
      // The schema half only. The do-block below it names '%price%' and '%card%'
      // in order to assert no such column exists, and matching that would be
      // reading the assertion as the thing it forbids.
      const schema = sql.split("do $$")[0];
      assert.ok(schema.length > 2000, "the split on do $$ has stopped working");
      assert.doesNotMatch(schema, /\b(card_number|cvv_|price_cents|amount_cents|payment_intent|stripe_)/i);
    });

    it("grants no delete on any of the three", () => {
      for (const table of ["growth_venues", "growth_events", "growth_event_rsvps"]) {
        assert.ok(sql.includes(`create table if not exists public.${table}`), `${table} is not created`);
        assert.doesNotMatch(sql, new RegExp(`grant[^;]*delete[^;]*${table}`, "i"), `${table} grants DELETE`);
      }
    });
  });

  describe("which capacity applies", () => {
    it("lets the event override the venue, because the same hall seats fewer than it stands", () => {
      assert.equal(events.capacityFor({ capacity: 120 }, { capacity: 300 }).capacity, 120);
      assert.equal(events.capacityFor({ capacity: 120 }, { capacity: 300 }).source, "event");
    });

    it("falls back to the venue when the event says nothing", () => {
      assert.equal(events.capacityFor({ capacity: null }, { capacity: 300 }).capacity, 300);
      assert.equal(events.capacityFor({}, { capacity: 300 }).source, "venue");
    });

    it("treats zero as a real answer rather than as absent", () => {
      // A room that holds nobody is a statement. Reading it as "not recorded"
      // would silently let people in.
      assert.equal(events.capacityFor({ capacity: 0 }, { capacity: 300 }).capacity, 0);
      assert.equal(events.capacityFor({ capacity: 0 }, {}).source, "event");
    });

    it("says not recorded when neither has one, and neither zero nor unlimited", () => {
      const limit = events.capacityFor({}, {});
      assert.equal(limit.capacity, null);
      assert.equal(limit.source, "not_recorded");
      assert.match(limit.reason, /not the same as unlimited and not the same as none/);
    });
  });

  describe("counting seats rather than rows", () => {
    it("counts a party of four as four", () => {
      const taken = events.seatsTaken([seat("confirmed", 4), seat("confirmed", 1)]);
      assert.equal(taken.seats, 5);
      assert.equal(taken.confirmed, 2);
    });

    it("counts neither a waitlisted nor a withdrawn row against the room", () => {
      const taken = events.seatsTaken([seat("confirmed", 2), seat("waitlisted", 5), seat("withdrawn", 3)]);
      assert.equal(taken.seats, 2, "a waitlisted or withdrawn row is holding a seat it should not");
      assert.equal(taken.waitlisted, 1);
    });

    it("reports a failed read rather than counting zero", () => {
      const unreadable = events.seatsTaken(null);
      assert.equal(unreadable.ok, false);
      assert.equal(unreadable.seats, null, "an unreadable list came back as zero seats taken");
    });

    it("treats a missing party size as one rather than as zero", () => {
      assert.equal(events.seatsTaken([{ state: "confirmed" }]).seats, 1);
      assert.equal(events.seatsTaken([{ state: "confirmed", partySize: 0 }]).seats, 1);
    });
  });

  describe("who gets in", () => {
    const event = published({ capacity: 10 });

    it("confirms a party that fits, and says what is left", () => {
      const decision = events.admit({ event, rsvps: [seat("confirmed", 4)], partySize: 2 });
      assert.equal(decision.outcome, events.ADMISSION.confirmed);
      assert.match(decision.sentence, /4 of 10 still free/);
    });

    it("waitlists past capacity rather than confirming", () => {
      const decision = events.admit({ event, rsvps: [seat("confirmed", 10)], partySize: 1 });
      assert.equal(decision.outcome, events.ADMISSION.waitlisted);
      assert.match(decision.sentence, /full at 10/);
    });

    it("waitlists a party whole rather than letting part of it in", () => {
      // Two seats left, four asked for. Confirming two and saying "confirmed" is
      // the lie; splitting the row decides which two of somebody's family come.
      const decision = events.admit({ event, rsvps: [seat("confirmed", 8)], partySize: 4 });
      assert.equal(decision.outcome, events.ADMISSION.waitlisted);
      assert.match(decision.sentence, /your whole party is on the waiting list rather than part of it/);
    });

    it("records but does not promise when no capacity is recorded", () => {
      const decision = events.admit({ event: published({ capacity: null }), venue: {}, rsvps: [], partySize: 2 });
      assert.equal(decision.outcome, events.ADMISSION.capacity_not_recorded);
      assert.notEqual(decision.outcome, events.ADMISSION.confirmed, "an unrecorded capacity was treated as room");
      assert.match(decision.sentence, /registration of interest rather than a confirmed seat/);
    });

    it("refuses rather than confirming when it could not read who is coming", () => {
      const decision = events.admit({ event, rsvps: null, partySize: 1 });
      assert.equal(decision.outcome, events.ADMISSION.refused);
      assert.equal(decision.code, "attendance_unreadable");
      assert.match(decision.sentence, /not going to tell you there is room/);
    });

    it("refuses on a draft and on a cancelled event, with different words", () => {
      const draft = events.admit({ event: published({ status: "draft" }), rsvps: [], partySize: 1 });
      assert.equal(draft.code, "not_published");
      const cancelled = events.admit({
        event: published({ status: "cancelled", cancellation_reason: "The band pulled out." }),
        rsvps: [], partySize: 1
      });
      assert.equal(cancelled.code, "cancelled");
      assert.match(cancelled.sentence, /The band pulled out/);
    });

    it("says a cancellation has no recorded reason rather than inventing one", () => {
      const cancelled = events.admit({ event: published({ status: "cancelled" }), rsvps: [], partySize: 1 });
      assert.match(cancelled.sentence, /No reason was recorded/);
    });

    it("refuses an unusable party size before it counts anything", () => {
      for (const partySize of ["", "nine", "0", "-1", String(events.PARTY_MAX + 1)]) {
        const decision = events.admit({ event, rsvps: [], partySize });
        assert.equal(decision.outcome, events.ADMISSION.refused, `party size ${partySize} was accepted`);
        assert.equal(decision.code, "party_size_unusable");
      }
    });

    it("refuses a status it does not recognise rather than treating it as open", () => {
      const decision = events.admit({ event: published({ status: "live" }), rsvps: [], partySize: 1 });
      assert.equal(decision.outcome, events.ADMISSION.refused);
      assert.equal(decision.code, "status_unknown");
    });
  });

  describe("three answers to are you coming", () => {
    it("reads an absent answer as not answered, not as no", () => {
      assert.equal(events.attendanceOf({ attending: null }), events.ATTENDANCE.not_answered);
      assert.equal(events.attendanceOf({}), events.ATTENDANCE.not_answered);
      assert.equal(events.attendanceOf({ attending: false }), events.ATTENDANCE.not_going);
      assert.equal(events.attendanceOf({ attending: true }), events.ATTENDANCE.going);
      assert.equal(new Set(Object.values(events.ATTENDANCE)).size, 3);
    });

    it("leaves the answer unanswered when a form does not supply one", () => {
      assert.equal(events.normalizeRsvp({ display_name: "A", email: "a@b.co" }).rsvp.attending, null);
      assert.equal(events.normalizeRsvp({ display_name: "A", email: "a@b.co", attending: "" }).rsvp.attending, null);
      assert.equal(events.normalizeRsvp({ display_name: "A", email: "a@b.co", attending: "maybe" }).rsvp.attending, null);
      assert.equal(events.normalizeRsvp({ display_name: "A", email: "a@b.co", attending: "false" }).rsvp.attending, false);
      assert.equal(events.normalizeRsvp({ display_name: "A", email: "a@b.co", attending: "true" }).rsvp.attending, true);
    });
  });

  describe("what a stranger is allowed to see", () => {
    it("carries no attendee name or email field at all", () => {
      const summary = events.publicSummary({
        event: published({ capacity: 10 }),
        rsvps: [seat("confirmed", 3)]
      });
      // By construction rather than by the template remembering not to print one.
      const keys = Object.keys(summary);
      assert.ok(!keys.some((key) => /name|email|attendee/i.test(key)), `public summary carries ${keys.join(", ")}`);
      assert.match(summary.countSentence, /3 of 10 places taken/);
    });

    it("says it could not count rather than saying nobody is coming", () => {
      const summary = events.publicSummary({ event: published({ capacity: 10 }), rsvps: null });
      assert.equal(summary.ok, false);
      assert.match(summary.countSentence, /does not mean nobody is/);
    });

    it("reports registrations rather than places when no capacity is recorded", () => {
      const summary = events.publicSummary({ event: published({ capacity: null }), venue: {}, rsvps: [seat("confirmed", 1)] });
      assert.match(summary.countSentence, /No capacity is recorded/);
      assert.ok(!/of null/.test(summary.countSentence));
    });

    it("selects no name and no email on the public path", () => {
      // The cheapest way never to leak a field is never to fetch it. Asserted
      // against the source, because a select list is the one place this is decided.
      const source = fs.readFileSync(ROUTES, "utf8");
      const publicRead = source.slice(source.indexOf("async function publicRsvps"), source.indexOf("const rsvpForm"));
      assert.ok(publicRead.includes("select=party_size,state"), "the public RSVP read has changed shape");
      assert.ok(!publicRead.includes("display_name"), "the public RSVP read selects attendee names");
      assert.ok(!publicRead.includes("email"), "the public RSVP read selects email addresses");
    });
  });

  describe("the public page", () => {
    it("renders a published event and offers the form", async () => {
      const { app } = buildApp();
      const response = await request(app).get(`/events/${SLUG}`);
      assert.equal(response.status, 200);
      assert.match(response.text, /Autumn Session/);
      assert.match(response.text, /action="\/events\/autumn-session"/);
    });

    it("answers a cancelled event rather than hiding it", async () => {
      // Somebody holding an RSVP opens the page they were given. A 404 tells them
      // nothing; this is the whole reason cancellation is not a delete.
      const { app } = buildApp({ eventRows: [published({ status: "cancelled", cancellation_reason: "Flooding." })] });
      const response = await request(app).get(`/events/${SLUG}`);
      assert.equal(response.status, 200);
      assert.match(response.text, /Flooding/);
      assert.ok(!response.text.includes('action="/events/autumn-session"'), "it offered to take a name for a cancelled event");
    });

    it("404s an address that matches nothing, and a malformed one", async () => {
      const { app, calls } = buildApp({ eventRows: [] });
      assert.equal((await request(app).get(`/events/${SLUG}`)).status, 404);
      const malformed = await request(app).get("/events/NOT_A_SLUG");
      assert.equal(malformed.status, 404);
      assert.equal(calls.length, 1, "a malformed slug reached the database");
    });

    it("offers no form when it could not read who is coming", async () => {
      const { app } = buildApp({ rsvpsOk: false });
      const response = await request(app).get(`/events/${SLUG}`);
      assert.equal(response.status, 200);
      assert.ok(!response.text.includes('action="/events/autumn-session"'), "it offered a form it would then refuse");
      assert.match(response.text, /does not mean nobody is/);
    });

    it("tells the visitor what happens to what they type", async () => {
      const { app } = buildApp();
      const response = await request(app).get(`/events/${SLUG}`);
      assert.match(response.text, /go to the organiser so they can reach you/i);
      assert.match(response.text, /Nothing is sent to you by us/);
    });

    it("shows no other attendee's name or email", async () => {
      const { app } = buildApp({ rsvps: [{ party_size: 2, state: "confirmed" }] });
      const response = await request(app).get(`/events/${SLUG}`);
      assert.ok(!/@/.test(response.text.replace(/href="[^"]*"/g, "")), "an email address reached the public page");
    });
  });

  describe("the public RSVP", () => {
    const body = { display_name: "Dale", email: "dale@example.com", party_size: "2", attending: "true" };

    it("records a confirmed seat and says how many are left", async () => {
      const { app, calls } = buildApp({ eventRows: [published({ capacity: 10 })] });
      const response = await request(app).post(`/events/${SLUG}`).type("form").send(body);
      assert.equal(response.status, 200);
      const written = writes(calls, "growth_event_rsvps");
      assert.equal(written.length, 1);
      assert.equal(written[0].body.state, "confirmed");
      assert.equal(written[0].body.party_size, 2);
      assert.equal(written[0].body.organization_id, ORG);
      assert.equal(written[0].body.attending, true);
    });

    it("writes waitlisted when the room is full, rather than confirmed", async () => {
      const { app, calls } = buildApp({
        eventRows: [published({ capacity: 2 })],
        rsvps: [{ party_size: 2, state: "confirmed" }]
      });
      const response = await request(app).post(`/events/${SLUG}`).type("form").send(body);
      assert.equal(response.status, 200);
      assert.equal(writes(calls, "growth_event_rsvps")[0].body.state, "waitlisted");
      assert.match(response.text, /waiting list/);
      assert.ok(!/You are confirmed/.test(response.text), "a waitlisted person was told they are confirmed");
    });

    it("writes an unanswered attendance as null, never as false", async () => {
      const { app, calls } = buildApp({ eventRows: [published({ capacity: 10 })] });
      await request(app).post(`/events/${SLUG}`).type("form")
        .send({ display_name: "Dale", email: "dale@example.com" });
      const written = writes(calls, "growth_event_rsvps")[0].body;
      assert.equal(written.attending, null);
      assert.notEqual(written.attending, false);
      assert.equal(written.party_size, 1);
    });

    it("refuses and writes nothing when it could not read the count", async () => {
      const { app, calls } = buildApp({ eventRows: [published({ capacity: 10 })], rsvpsOk: false });
      const response = await request(app).post(`/events/${SLUG}`).type("form").send(body);
      assert.equal(response.status, 503);
      assert.equal(writes(calls, "growth_event_rsvps").length, 0, "it recorded a seat against a count it did not have");
    });

    it("refuses on a cancelled event with 409 and writes nothing", async () => {
      const { app, calls } = buildApp({ eventRows: [published({ status: "cancelled" })] });
      const response = await request(app).post(`/events/${SLUG}`).type("form").send(body);
      assert.equal(response.status, 409);
      assert.equal(writes(calls, "growth_event_rsvps").length, 0);
    });

    it("tells a repeat booking it already has one rather than that it failed", async () => {
      const { app } = buildApp({ eventRows: [published({ capacity: 10 })], writeOk: false, writeStatus: 409 });
      const response = await request(app).post(`/events/${SLUG}`).type("form").send(body);
      assert.equal(response.status, 409);
      assert.match(response.text, /already have a booking/);
    });

    it("refuses a bad email with 400 and writes nothing", async () => {
      const { app, calls } = buildApp({ eventRows: [published({ capacity: 10 })] });
      const response = await request(app).post(`/events/${SLUG}`).type("form")
        .send({ display_name: "Dale", email: "not-an-email" });
      assert.equal(response.status, 400);
      assert.match(response.text, /does not look like an email/);
      assert.equal(writes(calls, "growth_event_rsvps").length, 0);
    });

    it("writes the event's organization, not one from the request", async () => {
      // The public form has no organization and must not be able to name one.
      const { app, calls } = buildApp({ eventRows: [published({ capacity: 10, organization_id: OTHER_ORG })] });
      await request(app).post(`/events/${SLUG}`).type("form").send({ ...body, organization_id: ORG });
      assert.equal(writes(calls, "growth_event_rsvps")[0].body.organization_id, OTHER_ORG);
    });
  });

  describe("the owner's page", () => {
    it("shows the three attendance states as three", async () => {
      const { app } = buildApp({
        rsvps: [
          { id: "r1", event_id: EVENT, display_name: "A", email: "a@x.co", attending: true, party_size: 1, state: "confirmed" },
          { id: "r2", event_id: EVENT, display_name: "B", email: "b@x.co", attending: false, party_size: 1, state: "confirmed" },
          { id: "r3", event_id: EVENT, display_name: "C", email: "c@x.co", attending: null, party_size: 1, state: "confirmed" }
        ]
      });
      const response = await request(app).get(OWNER_PAGE);
      assert.equal(response.status, 200);
      assert.match(response.text, /1 said they are coming, 1 said they are not, and 1 have not answered/);
    });

    it("says no capacity is recorded rather than showing a number", async () => {
      const { app } = buildApp({
        eventRows: [published({ capacity: null })],
        venues: [{ id: VENUE, organization_id: ORG, name: "The Hall", address: "1 Road", capacity: null, time_zone: "UTC" }]
      });
      const response = await request(app).get(OWNER_PAGE);
      assert.match(response.text, /Nobody has recorded how many this holds/);
      assert.match(response.text, /no capacity recorded/);
    });

    it("tells the owner a read failed rather than that they have no events", async () => {
      for (const failure of [{ venuesOk: false }, { eventsOk: false }, { rsvpsOk: false }]) {
        const { app } = buildApp(failure);
        const response = await request(app).get(OWNER_PAGE);
        assert.equal(response.status, 200);
        assert.match(response.text, /could not read part of your events/, `${Object.keys(failure)[0]} rendered as empty`);
        assert.doesNotMatch(response.text, /No events yet/);
      }
    });

    it("scopes every owner read to the organization", async () => {
      const { app, calls } = buildApp();
      await request(app).get(OWNER_PAGE);
      const reads = calls.filter((call) => call.method === "GET");
      assert.ok(reads.length >= 3, `only ${reads.length} reads; this assertion has gone blind`);
      for (const read of reads) assert.ok(read.href.includes(`organization_id=eq.${ORG}`), `unscoped read: ${read.href}`);
    });

    it("refuses everything when the workspace cannot be resolved", async () => {
      for (const broken of [{ organization: null }, { configOk: false }]) {
        const { app, calls } = buildApp(broken);
        const response = await request(app).get(OWNER_PAGE);
        assert.equal(response.status, 503);
        assert.equal(calls.filter((call) => call.method === "GET").length, 0, "it read the database with no workspace");
      }
    });

    it("saves an event as a draft, never as published", async () => {
      // Putting something on a public URL is not a side effect of saving a draft.
      const { app, calls } = buildApp();
      const response = await request(app).post("/api/growth/events").type("form")
        .send({ title: "Winter Session", starts_at: "2026-12-01T19:30", kind: "concert" });
      assert.match(response.headers.location, /done=event/);
      const written = writes(calls, "growth_events")[0].body;
      assert.equal(written.status, "draft");
      assert.equal(written.slug, null);
      assert.equal(written.organization_id, ORG);
    });

    it("keeps an empty capacity box empty rather than writing zero", async () => {
      const { app, calls } = buildApp();
      await request(app).post("/api/growth/venues").type("form").send({ name: "A Room", capacity: "" });
      const written = writes(calls, "growth_venues")[0].body;
      assert.equal(written.capacity, null);
      assert.notEqual(written.capacity, 0);
    });

    it("refuses a venue that is not this organization's", async () => {
      const { app, calls } = buildApp({ venues: [] });
      const response = await request(app).post("/api/growth/events").type("form")
        .send({ title: "X", starts_at: "2026-12-01T19:30", venue_id: VENUE });
      assert.match(response.headers.location, /problem=venue_missing/);
      assert.equal(writes(calls, "growth_events").length, 0);
    });

    it("refuses an event that ends before it starts", async () => {
      const { app, calls } = buildApp();
      const response = await request(app).post("/api/growth/events").type("form")
        .send({ title: "X", starts_at: "2026-12-02T19:30", ends_at: "2026-12-01T19:30" });
      assert.match(response.headers.location, /problem=end_before_start/);
      assert.equal(writes(calls, "growth_events").length, 0);
    });

    it("refuses to publish without an address, and refuses a taken one", async () => {
      const noSlug = buildApp();
      const a = await request(noSlug.app).post("/api/growth/events/publish").type("form").send({ event_id: EVENT });
      assert.match(a.headers.location, /problem=publish_needs_slug/);
      assert.equal(patches(noSlug.calls, "growth_events").length, 0);

      // The slug-uniqueness read returns a different event's id.
      const taken = buildApp({ eventRows: [{ id: "someone-elses" }] });
      const b = await request(taken.app).post("/api/growth/events/publish").type("form").send({ event_id: EVENT, slug: "taken-one" });
      assert.match(b.headers.location, /problem=slug_taken/);
      assert.equal(patches(taken.calls, "growth_events").length, 0);
    });

    it("carries the organization filter on every write it addresses by id", async () => {
      const { app, calls } = buildApp();
      await request(app).post("/api/growth/events/publish").type("form").send({ event_id: EVENT, slug: SLUG });
      await request(app).post("/api/growth/events/cancel").type("form").send({ event_id: EVENT, reason: "Weather." });
      const byId = calls.filter((call) => call.method === "PATCH");
      assert.ok(byId.length >= 2, `only ${byId.length} id-addressed writes; this assertion has gone blind`);
      for (const call of byId) {
        assert.ok(call.href.includes(`organization_id=eq.${ORG}`), `an id alone authorised a write: ${call.href}`);
      }
    });

    it("cancels rather than deleting, and keeps the address", async () => {
      const { app, calls } = buildApp();
      await request(app).post("/api/growth/events/cancel").type("form").send({ event_id: EVENT, reason: "Weather." });
      const patched = patches(calls, "growth_events")[0].body;
      assert.equal(patched.status, "cancelled");
      assert.equal(patched.cancellation_reason, "Weather.");
      assert.ok(!("slug" in patched), "cancelling cleared the address, so the page people were given would 404");
      assert.equal(calls.filter((call) => call.method === "DELETE").length, 0);
    });
  });

  describe("it sends nothing and takes no money", () => {
    const sources = [fs.readFileSync(ROUTES, "utf8"), fs.readFileSync(MODULE, "utf8")];

    it("reads sources worth measuring", () => {
      for (const source of sources) assert.ok(source.length > 3000, "a source file is too short; this check has gone blind");
    });

    // AGENTS.md: "Sounds, voice announcements, haptics, SMS, push, and email
    // alerts must be off or explicitly user-controlled by default." An RSVP is
    // recorded; nobody is messaged. Asserted against the source because the way
    // this breaks is somebody adding a convenience send to the confirmation path.
    it("calls no send path", () => {
      for (const source of sources) {
        for (const forbidden of ["sendEmail", "sendSms", "sendPush", "/api/email", "notification_preferences", "push_subscriptions", "resend", "twilio"]) {
          assert.ok(!source.includes(forbidden), `${forbidden} appears in the events path; an RSVP must not message anybody`);
        }
      }
    });

    it("says so to the visitor rather than leaving it to be assumed", async () => {
      const { app } = buildApp();
      const response = await request(app).post(`/events/${SLUG}`).type("form")
        .send({ display_name: "Dale", email: "dale@example.com" });
      assert.match(response.text, /We do not email you about this/);
    });

    it("touches no money anywhere in the two files", () => {
      for (const source of sources) {
        for (const forbidden of ["price_cents", "amount_cents", "card_number", "payment_intent", "stripe"]) {
          assert.ok(!source.toLowerCase().includes(forbidden), `${forbidden} appears; an RSVP is not a ticket`);
        }
      }
    });
  });

  describe("it is reachable", () => {
    it("is registered in server.js, so its tables are not orphans", () => {
      const server = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
      assert.ok(server.includes("sonara-growth-event-routes.cjs"), "server.js does not require the growth event routes");
      assert.match(server, /registerGrowthEventRoutes\(app,/, "server.js requires the module but never calls it");
    });

    it("refuses to register without every dependency it uses", () => {
      const required = ["layout", "brandCard", "linkAction", "escapeHtml", "requireWorkspaceAccess", "getCustomerPrimaryOrganization", "getSupabaseServerConfig", "supabaseHeaders", "createRateLimiter"];
      for (const missing of required) {
        const deps = Object.fromEntries(required.filter((name) => name !== missing).map((name) => [name, () => {}]));
        assert.throws(() => registerGrowthEventRoutes(express(), deps), new RegExp(missing), `registering without ${missing} did not throw`);
      }
    });

    it("rate-limits the public write", () => {
      const source = fs.readFileSync(ROUTES, "utf8");
      assert.match(source, /createRateLimiter\(\{[\s\S]{0,200}public_event_rsvp/);
      assert.match(source, /app\.post\("\/events\/:slug", rsvpLimiter/);
    });
  });
});
