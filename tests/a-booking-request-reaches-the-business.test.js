"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const notice = require("../lib/sonara-booking-notice.cjs");

const ORG = "11111111-1111-4111-8111-111111111111";

function recorder(answer = { ok: true, considered: 2, sent: 2, removed: 0, failures: [] }) {
  const sent = [];
  return { sent, notify: async (_deps, message) => { sent.push(message); return answer; } };
}

const DEPS = { supabaseUrl: "https://example.supabase.co", serviceRoleHeaders: () => ({}), getEnv: () => "" };

describe("a booking request reaches the business", () => {
  const booking = {
    organizationId: ORG,
    bookingId: "22222222-2222-4222-8222-222222222222",
    customerName: "Dana Okoro",
    serviceName: "Gutter clean",
    startsAt: "2026-09-04T09:30:00Z"
  };

  it("sends booking_made with the service and the time", async () => {
    const push = recorder();
    const result = await notice.announceBooking(DEPS, booking, { notify: push.notify });
    assert.equal(result.notified, true, result.reason);
    assert.equal(push.sent[0].topic, "booking_made");
    assert.equal(push.sent[0].organizationId, ORG);
    assert.match(push.sent[0].payload.body, /Dana Okoro/);
    assert.match(push.sent[0].payload.body, /Gutter clean/);
    assert.match(push.sent[0].payload.body, /2026-09-04 09:30 UTC/);
  });

  // A push payload is decrypted by the browser and rendered by the operating
  // system: notification history, lock screen, whatever the OS syncs. Contact
  // details belong behind the session, one tap away.
  it("puts no contact details on a lock screen", () => {
    const payload = notice.bookingPayload({
      ...booking,
      customerEmail: "dana@example.com",
      customerPhone: "+15551234567"
    });
    const rendered = JSON.stringify(payload);
    assert.doesNotMatch(rendered, /dana@example\.com/);
    assert.doesNotMatch(rendered, /15551234567/);
    assert.doesNotMatch(rendered, /@/, "no address of any kind belongs in a push payload");
  });

  it("says the request is not an appointment yet", () => {
    // The public page tells the customer the same thing. A business told
    // "New booking" and a customer told "not confirmed" is two products.
    assert.match(notice.bookingPayload(booking).body, /[Nn]ot confirmed/);
  });

  it("tags each booking separately, so two in a minute stay two", () => {
    const one = notice.bookingPayload({ ...booking, bookingId: "a" });
    const two = notice.bookingPayload({ ...booking, bookingId: "b" });
    assert.notEqual(one.tag, two.tag);
  });

  // "starting Invalid Date" is worse than saying nothing; the row is one tap
  // away either way.
  it("omits a time it cannot read rather than printing a broken one", () => {
    assert.equal(notice.when("not a date"), null);
    assert.equal(notice.when(null), null);
    const body = notice.bookingPayload({ ...booking, startsAt: "not a date" }).body;
    assert.doesNotMatch(body, /Invalid|NaN/);
    assert.match(body, /Dana Okoro/, "the rest of the notification still has to be useful");
  });

  it("still names the service when the customer gave no name", () => {
    assert.match(notice.bookingPayload({ ...booking, customerName: "  " }).body, /Somebody asked for Gutter clean/);
  });

  it("bounds the body, because the sender does not choose the lock screen", () => {
    const long = notice.bookingPayload({ ...booking, customerName: "x".repeat(500), serviceName: "y".repeat(500) });
    assert.ok(long.body.length <= 240);
  });

  it("refuses without an organization rather than sending to nobody", async () => {
    const push = recorder();
    const result = await notice.announceBooking(DEPS, { ...booking, organizationId: null }, { notify: push.notify });
    assert.equal(result.reason, "no_organization");
    assert.equal(push.sent.length, 0);
  });

  it("reports a failed send rather than claiming it went", async () => {
    const push = recorder({ ok: false, code: "setup_required" });
    const result = await notice.announceBooking(DEPS, booking, { notify: push.notify });
    assert.equal(result.notified, false);
    assert.equal(result.reason, "setup_required");
  });

  // The caller is a route serving somebody who is not our customer. An
  // exception here would turn a saved booking into an error page for a person
  // who did nothing wrong.
  it("does not throw when the sender does", async () => {
    const result = await notice.announceBooking(DEPS, booking, {
      notify: async () => { throw new Error("push exploded"); }
    });
    assert.equal(result.ok, false);
    assert.equal(result.reason, "send_failed");
  });

  describe("the public booking route", () => {
    const source = fs.readFileSync(require.resolve("../routes/sonara-public-booking-routes.cjs"), "utf8");
    const code = source.replace(/\/\*[\s\S]*?\*\/|(^|[^:])\/\/[^\n]*/g, (match, before) => (before === undefined ? " " : `${before} `));

    it("announces the booking it just saved", () => {
      assert.match(code, /await announceBooking\(/);
    });

    // Un-awaited, the fetch never leaves: this runs as a serverless function.
    it("awaits it rather than firing and forgetting", () => {
      const call = code.indexOf("announceBooking(");
      assert.ok(call > -1);
      assert.match(code.slice(Math.max(0, call - 12), call + 16), /await announceBooking\(/);
    });

    it("only announces after the row is written", () => {
      const write = code.indexOf(`rest/v1/${"$"}{BOOKINGS_TABLE}`);
      const refusal = code.indexOf("problem=not_saved");
      const announce = code.indexOf("announceBooking(");
      assert.ok(write > -1 && refusal > -1 && announce > refusal, "a booking that failed to save must not be announced");
    });

    it("asks the database for the row back, so the notification can be tagged", () => {
      assert.match(code, /Prefer: "return=representation"/);
    });
  });
});
