"use strict";

// Measuring a reply time instead of asking somebody to remember it.
//
// /growth-studio/tools/response-time tells a customer what a slow first reply
// costs them and asks them to type their own average in -- a number nobody has,
// and the one people are most generous to themselves about. service_requests
// carries when a request arrived and service_comments carries the replies, so
// the real figure is a subtraction.
//
// service_comments had no runtime reader at all when this was written. A
// customer could raise a request and nobody could reply to it, and the request
// itself had no page to open.

const assert = require("node:assert/strict");
const science = require("../lib/sonara-service-response.cjs");

const REQUESTS = [
  { id: "a", service_name: "Answered fast", created_at: "2026-08-01T09:00:00Z" },
  { id: "b", service_name: "Answered slowly", created_at: "2026-08-01T10:00:00Z" },
  { id: "c", service_name: "Never answered", created_at: "2026-08-02T10:00:00Z" }
];
const COMMENTS = [
  { service_request_id: "a", created_at: "2026-08-01T09:20:00Z" },
  { service_request_id: "a", created_at: "2026-08-01T11:00:00Z" },
  { service_request_id: "b", created_at: "2026-08-03T10:00:00Z" }
];
const NOW = "2026-08-05T10:00:00Z";

describe("how long a reply actually took", () => {
  it("takes the first reply, not the latest one", () => {
    const result = science.firstReplyTimes(REQUESTS, COMMENTS, { now: NOW });
    assert.equal(result.ok, true);
    // Request "a" has two replies, twenty minutes and two hours after it. The
    // first is what the customer experienced.
    assert.equal(result.fastestMinutes, 20);
  });

  it("does not count an unanswered request as a fast one", () => {
    // The failure this exists to prevent: averaging over only the answered
    // requests is how a business measures itself as excellent while its worst
    // cases sit untouched.
    const result = science.firstReplyTimes(REQUESTS, COMMENTS, { now: NOW });
    assert.equal(result.requests, 3);
    assert.equal(result.answered, 2);
    assert.equal(result.waiting, 1);
    assert.ok(result.longestWaiting, "the unanswered request was not reported at all");
    // Named, not counted. "One is waiting" makes somebody open all of them.
    assert.equal(result.longestWaiting.name, "Never answered");
    assert.ok(result.longestWaiting.waitingMinutes > 0);
  });

  it("leads with the median, because one bad week moves a mean", () => {
    const many = Array.from({ length: 9 }, (_, index) => ({ id: `r${index}`, created_at: "2026-08-01T09:00:00Z" }));
    const quick = many.map((request) => ({ service_request_id: request.id, created_at: "2026-08-01T09:10:00Z" }));
    // One request left for a fortnight, among nine answered in ten minutes.
    many.push({ id: "outlier", created_at: "2026-08-01T09:00:00Z" });
    quick.push({ service_request_id: "outlier", created_at: "2026-08-15T09:00:00Z" });
    const result = science.firstReplyTimes(many, quick, { now: NOW });
    assert.equal(result.medianMinutes, 10, "the median moved, which it should not");
    assert.ok(result.meanMinutes > 1000, "the fixture has no outlier, so this proves nothing");
  });

  it("drops a reply stamped before the request it answers", () => {
    // A clock problem, not a negative wait. Folded into an average it would
    // report an impossibly fast reply.
    const result = science.firstReplyTimes(
      [{ id: "x", created_at: "2026-08-03T10:00:00Z" }, ...REQUESTS],
      [{ service_request_id: "x", created_at: "2026-08-03T09:00:00Z" }, ...COMMENTS],
      { now: NOW }
    );
    assert.equal(result.clockProblems, 1);
    assert.ok(result.fastestMinutes >= 0, "a negative wait reached the figures");
  });

  it("says how many were answered within an hour and within a day", () => {
    const result = science.firstReplyTimes(REQUESTS, COMMENTS, { now: NOW });
    // One of the two answered ones was inside an hour, both inside two days.
    assert.equal(result.withinAnHour, 0.5);
    assert.ok(result.withinADay >= 0 && result.withinADay <= 1);
  });

  it("says a duration the way a person would", () => {
    assert.equal(science.humanDuration(0.5), "under a minute");
    assert.equal(science.humanDuration(1), "1 minute");
    assert.equal(science.humanDuration(45), "45 minutes");
    assert.equal(science.humanDuration(90), "1h 30m");
    assert.equal(science.humanDuration(120), "2 hours");
    assert.equal(science.humanDuration(60 * 24), "1 day");
    assert.equal(science.humanDuration(60 * 30), "1d 6h");
    assert.equal(science.humanDuration(null), null);
  });

  it("says there is nothing to measure rather than reporting zero", () => {
    const result = science.firstReplyTimes([], [], { now: NOW });
    assert.equal(result.ok, false);
    assert.equal(result.code, "nothing_to_measure");
  });

  it("reaches the database and the page", () => {
    // The gap this closed was not arithmetic. service_comments existed with no
    // runtime reader, so the replies had nowhere to be written or read.
    const source = require("node:fs").readFileSync(require.resolve("../routes/sonara-service-lifecycle-routes.cjs"), "utf8");
    assert.match(source, /service_comments/, "nothing reads or writes the reply table");
    assert.match(source, /app\.get\("\/requests\/:requestId"/, "a request still cannot be opened");
    assert.match(source, /app\.post\("\/api\/service-requests\/:requestId\/comments"/, "a reply still cannot be added");
    // Both writes scoped by organization: the service key bypasses row level
    // security, so that filter is the only tenant boundary there is.
    assert.match(source, /service_requests[\s\S]{0,400}organization_id=eq/, "the ownership check does not scope by organization");
  });
});
