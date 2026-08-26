"use strict";

// The support form had three endings and returned `ok: true` from all of them.
// The third read:
//
//   "Setup required: the account database is not configured, so the request
//    used the safe fallback queue. Reference ID: <uuid>."
//
// There is no fallback queue. No table, no file, no in-memory store, nothing
// scheduled. The phrase appeared in five places and described a mechanism that
// was never built.
//
// On that path the insert had failed and the notification email had failed, so
// nothing happened at all — and the customer was shown a reference number, the
// word "queue", and a 200. They would reasonably stop chasing it. A support
// request that silently disappears is worse than a form that refuses to submit,
// because the second one gets retried.
//
// A test asserted the fabrication: "POST /support/request uses the safe fallback
// queue with a reference ID when database is missing". It cleared the Supabase
// environment and checked for `ok: true` and a reference ID, so the guarantee
// had a green tick and no implementation. That is this codebase's stated
// recurring defect in its purest form — a signal reporting success without
// being true — and it had been sitting in the one place a customer goes when
// something has already gone wrong.

const assert = require("node:assert/strict");
const request = require("supertest");
const { supportRequestOutcome } = require("../lib/sonara-support-outcome.cjs");
const app = require("../server");

const REFERENCE = "11111111-1111-4111-8111-111111111111";

const GOOD = {
  name: "Casey Customer",
  email: "casey@example.com",
  subject: "Access question",
  message: "I need help understanding workspace setup.",
  category: "support",
  consent: "yes"
};

describe("a request that went nowhere says so", () => {
  // The two endings where something really happened. Without these, every
  // assertion below would pass against a form that refuses everything, which
  // would be a worse product and an easier test to write.
  it("confirms a stored request", () => {
    const outcome = supportRequestOutcome({ stored: true, emailed: true, referenceId: REFERENCE });
    assert.equal(outcome.ok, true);
    assert.equal(outcome.referenceId, REFERENCE);
    assert.match(outcome.message, /was received/);
  });

  it("still confirms a stored request whose notification email failed", () => {
    // The record is what the customer cares about. The email is our problem, and
    // saying so beats implying their request is at risk.
    const outcome = supportRequestOutcome({ stored: true, emailed: false, referenceId: REFERENCE });
    assert.equal(outcome.ok, true);
    assert.equal(outcome.referenceId, REFERENCE);
    assert.match(outcome.message, /does not affect your request/);
  });

  it("says where an emailed-but-unrecorded request actually is", () => {
    // The reference is real here too, in a different place: it is minted before
    // the insert and written into the email body, so support can find it.
    const outcome = supportRequestOutcome({ stored: false, emailed: true, referenceId: REFERENCE });
    assert.equal(outcome.ok, true);
    assert.equal(outcome.referenceId, REFERENCE);
    assert.match(outcome.message, /reached our support inbox by email/);
    assert.match(outcome.message, /not in your account records/);
  });

  it("refuses to hand out a reference for a request that reached nothing", () => {
    const outcome = supportRequestOutcome({ stored: false, emailed: false, referenceId: REFERENCE });
    assert.equal(outcome.ok, false);
    assert.equal(outcome.status, "not_recorded");
    assert.equal(outcome.referenceId, null, "a reference number was given for a request stored nowhere and sent nowhere");
    assert.doesNotMatch(outcome.message, /queue/i, "the message still describes a queue that does not exist");
    assert.doesNotMatch(outcome.message, /Reference ID/i);
    assert.match(outcome.message, /did not go through/);
  });

  it("never says queue on any path", () => {
    // The word did the damage: it named a mechanism, so the message read as a
    // description of what had happened rather than as reassurance.
    for (const stored of [true, false]) {
      for (const emailed of [true, false]) {
        const outcome = supportRequestOutcome({ stored, emailed, referenceId: REFERENCE });
        assert.doesNotMatch(outcome.message, /queue/i, `stored=${stored} emailed=${emailed} still mentions a queue`);
        assert.ok(outcome.heading, `stored=${stored} emailed=${emailed} has no heading for the page to use`);
      }
    }
  });

  it("answers the real endpoint with 503 rather than 200 when nothing took the request", async () => {
    // Nothing is configured in this suite, so this is the genuine outcome. The
    // status code matters on its own: a caller that reads only the code must not
    // record a vanished request as a filed one.
    const response = await request(app).post("/support/request").set("Accept", "application/json").send(GOOD);
    assert.equal(response.status, 503);
    assert.equal(response.body.ok, false);
    assert.equal(response.body.referenceId, null);
  });

  it("leaves no page describing the queue", async () => {
    const response = await request(app).post("/support/request").set("Accept", "text/html").send(GOOD);
    assert.equal(response.status, 503);
    assert.match(response.text, /did not go through/);
    assert.doesNotMatch(response.text, /fallback queue/i);
  });
});
