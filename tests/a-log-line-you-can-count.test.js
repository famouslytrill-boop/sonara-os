"use strict";

// Item 1 of docs/PRODUCTION_RELIABILITY_AND_OBSERVABILITY_PLAN.md, and the
// reason it is first in that plan rather than last.
//
// An SLO is a rate over outcomes and an error budget is arithmetic over it.
// Neither can be built on lines like
//
//   [campaign-dispatch] batch_fell_back: campaign 33.. batch of 40 did not ...
//
// which is true, useful to somebody reading one incident, and impossible to
// count. These assertions are about the properties that make a line countable,
// and every one of them is a way the count could be wrong while looking right.

const assert = require("node:assert/strict");
const {
  OUTCOMES,
  SCOPES,
  buildEvent,
  emitEvent
} = require("../lib/sonara-structured-log.cjs");
const { dispatchCampaign } = require("../lib/growth-studio-dispatch.cjs");
const { authoriseCampaign } = require("../lib/growth-studio-sender.cjs");

const ORG = "11111111-1111-4111-8111-111111111111";
const CAMPAIGN = "33333333-3333-4333-8333-333333333333";

function capture() {
  const lines = [];
  return { lines, write: (line) => lines.push(line), events: () => lines.map((line) => JSON.parse(line)) };
}

describe("a log line you can count", () => {
  describe("the shape that makes it countable", () => {
    it("has a closed set of outcomes, so a rate over them means something", () => {
      // Free text is the defect: "failed", "failure", "error" and "Failed." are
      // four values naming one thing, and a failure rate computed over them is
      // wrong in a way nobody can see from the number.
      assert.deepEqual([...OUTCOMES], ["ok", "partial", "refused", "degraded", "failed"]);
      assert.deepEqual([...SCOPES], ["organization", "process"]);

      const rejected = buildEvent({ event: "x", scope: "process", outcome: "Failed." });
      assert.equal(rejected.ok, false);
      assert.equal(rejected.code, "outcome_not_recognised");
      assert.equal(rejected.record, null, "a rejected event must not produce a record to count");
    });

    it("keeps partial as its own outcome rather than rounding it", () => {
      // A campaign where 459 of 460 landed is neither a success nor a failure.
      // Counting it as either makes the resulting rate describe nothing.
      assert.ok(OUTCOMES.includes("partial"));
      assert.ok(OUTCOMES.includes("degraded"));
      const built = buildEvent({ event: "x", scope: "process", outcome: "partial" });
      assert.equal(built.ok, true);
      assert.equal(built.record.outcome, "partial");
    });

    it("refuses an event with no scope, because a forgotten tenant is not an absent one", () => {
      // The whole reason scope exists. Without it the field would be
      // `organization: null` for a process-level event AND for a call that
      // simply forgot the tenant -- shape 4: absent and deliberately-none are
      // different facts with the same shape.
      const missing = buildEvent({ event: "x", outcome: "ok" });
      assert.equal(missing.ok, false);
      assert.equal(missing.code, "scope_required");
      assert.match(missing.detail, /forgotten tenant look like an absent one/);
    });

    it("refuses an organization-scoped event with no organization", () => {
      const built = buildEvent({ event: "x", scope: "organization", outcome: "ok" });
      assert.equal(built.ok, false);
      assert.equal(built.code, "organization_id_required");
    });

    it("lets a process-scoped event say so explicitly", () => {
      const built = buildEvent({ event: "boot.ready", scope: "process", outcome: "ok" });
      assert.equal(built.ok, true);
      assert.equal(built.record.organization, null);
      assert.equal(built.record.scope, "process");
    });

    it("always writes every field, so a consumer never guesses at a missing key", () => {
      // An absent key and a null value read differently to anything parsing
      // this, and only one of them is a fact. Every field is present.
      const built = buildEvent({ event: "x", scope: "process", outcome: "ok" });
      assert.deepEqual(
        Object.keys(built.record).sort(),
        ["capability", "correlation", "detail", "event", "organization", "outcome", "reason", "scope", "ts"]
      );
    });

    it("does not invent a correlation id it does not have", () => {
      // A correlation id this module made up would correlate nothing, which is
      // worse than none: it looks like a thread and joins unrelated lines.
      const built = buildEvent({ event: "x", scope: "process", outcome: "ok" });
      assert.equal(built.record.correlation, null);
    });

    it("emits exactly one line per event", () => {
      const sink = capture();
      emitEvent({ event: "x", scope: "process", outcome: "ok" }, { write: sink.write });
      assert.equal(sink.lines.length, 1);
      assert.doesNotMatch(sink.lines[0], /\n/, "a log line with a newline in it is two lines to whatever reads it");
    });
  });

  describe("it cannot take down what it was describing", () => {
    it("reports its own refusal instead of throwing", () => {
      // A logger that throws takes down the operation it was logging, which is
      // a worse outcome than a missing line -- but it must not be silent
      // either, or a malformed call disappears.
      const sink = capture();
      const result = emitEvent({ event: "x", scope: "process", outcome: "nonsense" }, { write: sink.write });
      assert.equal(result.ok, false);
      const [event] = sink.events();
      assert.equal(event.event, "log.event_rejected");
      assert.equal(event.reason, "outcome_not_recognised");
      assert.equal(event.outcome, "failed");
    });

    it("does not echo the rejected input, which has not been scrubbed yet", () => {
      // The rejected call is exactly the one whose values have not been through
      // the field-wise scrub, so echoing it back is how a bad call becomes the
      // leak. Only the event NAME travels.
      const sink = capture();
      emitEvent(
        { event: "probe", scope: "process", outcome: "nope", detail: { key: "sk_live_51ABCdefGHIjklMNOpqr" } },
        { write: sink.write }
      );
      assert.ok(!sink.lines[0].includes("sk_live_51ABCdefGHIjklMNOpqr"), "a rejected event echoed a credential");
      assert.equal(sink.events()[0].detail.attempted_event, "probe");
    });

    it("survives a circular detail object", () => {
      const circular = { name: "loop" };
      circular.self = circular;
      const sink = capture();
      assert.doesNotThrow(() =>
        emitEvent({ event: "x", scope: "process", outcome: "ok", detail: circular }, { write: sink.write })
      );
      assert.equal(sink.lines.length, 1);
      assert.doesNotThrow(() => JSON.parse(sink.lines[0]), "the line stopped being JSON");
    });

    it("survives a sink that throws", () => {
      // Whatever the sink is later -- a collector, a table -- it can fail, and
      // it must not take the request with it.
      assert.doesNotThrow(() =>
        emitEvent({ event: "x", scope: "process", outcome: "ok" }, { write: () => { throw new Error("sink down"); } })
      );
    });

    it("keeps a number a number, so it can be summed", () => {
      // Stringifying values would make every count a string and defeat the
      // aggregation this exists for.
      const sink = capture();
      emitEvent(
        { event: "x", scope: "process", outcome: "ok", detail: { accepted: 459, charged: true, missing: null } },
        { write: sink.write }
      );
      const [event] = sink.events();
      assert.equal(event.detail.accepted, 459);
      assert.equal(event.detail.charged, true);
      assert.equal(event.detail.missing, null);
    });
  });

  describe("the campaign dispatcher, which is the first real caller", () => {
    const ENV = {
      RESEND_API_KEY: "re_test",
      RESEND_FROM_EMAIL: "hello@example.com",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key-for-signing"
    };

    const SEND = {
      subject: "A subject",
      body: "A body long enough to be real.",
      organizationId: ORG,
      campaignId: CAMPAIGN,
      origin: "https://app.example.com",
      getEnv: (name) => ENV[name],
      getReadiness: () => ({ services: { emailDelivery: "enabled" } })
    };

    // Driven through authoriseCampaign rather than a hand-built decision. A
    // fixture that does not match the product tests nothing -- `history` is
    // required or authoriseCampaign refuses with balance_unreadable and the
    // dispatcher returns before any of this runs.
    let nextLead = 1;
    function authorised(count) {
      return authoriseCampaign({
        approval: { status: "approved", approved_by: "owner-1" },
        history: { ok: true, rows: [{ entry_kind: "grant", amount_minor: 100000000 }] },
        recipients: Array.from({ length: count }, (_, index) => ({
          id: `44444444-4444-4444-8444-${String(nextLead++).padStart(12, "0")}`,
          email: `p${index}@example.com`,
          consent: { channel: "email", consent_status: "granted" }
        }))
      });
    }

    const jsonOk = (body, status = 200) =>
      new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

    // The emitter writes to stderr by default and the dispatcher does not take
    // a sink, so stderr is captured for the duration. Restored in a finally, so
    // a failing assertion does not silence the rest of the suite.
    //
    // Both kinds of line land here, and the first version of this helper parsed
    // all of them -- which failed on `[campaign-dispatch] ...`, the PROSE line
    // from defaultReport. That is the two sinks coexisting exactly as intended,
    // so the helper partitions them instead of assuming one. `prose` is
    // returned rather than discarded: a change that quietly replaced the human
    // line with the structured one would otherwise pass unnoticed.
    async function runCapturingEvents(run) {
      const chunks = [];
      const original = process.stderr.write;
      process.stderr.write = (chunk) => { chunks.push(String(chunk)); return true; };
      let result;
      try {
        result = await run();
      } finally {
        process.stderr.write = original;
      }
      const lines = chunks.join("").split("\n").filter(Boolean);
      const events = [];
      const prose = [];
      for (const line of lines) {
        if (line.startsWith("{")) events.push(JSON.parse(line));
        else prose.push(line);
      }
      return { result, events, prose };
    }

    it("emits one countable event per dispatch, scoped to the tenant", async () => {
      const decision = authorised(2);
      assert.equal(decision.allowed, true, "fixture does not authorise; nothing below would run");

      const { result, events } = await runCapturingEvents(() => dispatchCampaign({
        ...SEND,
        decision,
        appendLedger: async () => ({ ok: true, code: "recorded" }),
        fetchImpl: async () => jsonOk({ data: [{ id: "msg-a" }, { id: "msg-b" }] }),
        recordSends: async (rows) => ({ ok: true, code: "recorded", written: rows.length })
      }));

      assert.equal(result.sent, 2);
      const terminal = events.filter((event) => event.event === "campaign.dispatch");
      assert.equal(terminal.length, 1, "a dispatch must produce exactly one terminal event, or the series has gaps or duplicates");
      assert.equal(terminal[0].outcome, "ok");
      assert.equal(terminal[0].scope, "organization");
      assert.equal(terminal[0].organization, ORG, "the event is not attributable to a tenant, so no per-tenant rate can be computed");
      assert.equal(terminal[0].capability, "campaign_email");
      assert.equal(terminal[0].correlation, CAMPAIGN);
      assert.equal(terminal[0].detail.accepted, 2);
      assert.equal(terminal[0].detail.charged, true);
      assert.equal(terminal[0].detail.recorded, true);
    });

    it("calls a send that reached some of the list partial, not ok and not failed", async () => {
      const decision = authorised(2);
      let call = 0;
      const { result, events } = await runCapturingEvents(() => dispatchCampaign({
        ...SEND,
        decision,
        appendLedger: async () => ({ ok: true, code: "recorded" }),
        // The batch response carries one id, not two, so the dispatcher falls
        // back to individual sends; the second is refused.
        fetchImpl: async () => {
          call += 1;
          if (call === 1) return jsonOk({ data: [{ id: "msg-a" }] });
          if (call === 2) return jsonOk({ id: "msg-a" });
          return jsonOk({ message: "bad address" }, 422);
        },
        recordSends: async (rows) => ({ ok: true, code: "recorded", written: rows.length })
      }));

      assert.equal(result.sent, 1, "fixture did not produce a partial send; the assertion below would prove nothing");
      const terminal = events.filter((event) => event.event === "campaign.dispatch");
      assert.equal(terminal.length, 1);
      assert.equal(terminal[0].outcome, "partial");
    });

    it("calls a gate refusal refused, so it does not spend error budget", async () => {
      // A campaign stopped because email is unconfigured is this code working.
      // Counting it as a failure would make the budget measure configuration
      // rather than reliability.
      const decision = authorised(1);
      const { result, events } = await runCapturingEvents(() => dispatchCampaign({
        ...SEND,
        decision,
        getReadiness: () => ({ services: { emailDelivery: "setup_required" } })
      }));

      assert.equal(result.code, "email_not_configured");
      const terminal = events.filter((event) => event.event === "campaign.dispatch");
      assert.equal(terminal.length, 1);
      assert.equal(terminal[0].outcome, "refused", "a gate refusal was counted as a failure");
      assert.equal(terminal[0].reason, "email_not_configured");
      assert.equal(terminal[0].organization, ORG);
    });

    it("emits a degraded event when the send went out but the record did not", async () => {
      // The case worth alerting on later: the emails are in inboxes and the
      // record of who was reached is not written, so the remainder cannot be
      // computed.
      const decision = authorised(2);
      const { events, prose } = await runCapturingEvents(() => dispatchCampaign({
        ...SEND,
        decision,
        appendLedger: async () => ({ ok: true, code: "recorded" }),
        fetchImpl: async () => jsonOk({ data: [{ id: "msg-a" }, { id: "msg-b" }] }),
        recordSends: async () => ({ ok: false, code: "send_record_write_failed" })
      }));

      const degraded = events.filter((event) => event.event === "campaign.dispatch.degraded");
      assert.ok(degraded.length >= 1, "a failed send-record write produced no degraded event");
      assert.ok(
        degraded.every((event) => event.outcome === "degraded" && event.organization === ORG),
        "a degradation was emitted without the tenant or with the wrong outcome"
      );
      assert.ok(
        degraded.some((event) => /send_record/.test(String(event.reason))),
        `no degraded event named the send-record failure; reasons were ${degraded.map((e) => e.reason).join(", ")}`
      );

      // And the terminal event still says the send itself succeeded, because it
      // did. Collapsing the two would lose which half went wrong.
      const terminal = events.filter((event) => event.event === "campaign.dispatch");
      assert.equal(terminal.length, 1);
      assert.equal(terminal[0].outcome, "ok");
      assert.equal(terminal[0].detail.recorded, false);

      // The human line is still there alongside it. Structured logging that
      // replaced the readable line would make one incident harder to read in
      // exchange for making a hundred countable.
      assert.ok(
        prose.some((line) => line.includes("[campaign-dispatch]")),
        "the prose report disappeared when the structured line arrived"
      );
    });

    it("still calls the injected reporter, so nothing that read prose lost it", async () => {
      // The structured line is additional. A caller or test that reads the
      // prose report must see exactly what it saw before.
      const decision = authorised(2);
      const reported = [];
      await runCapturingEvents(() => dispatchCampaign({
        ...SEND,
        decision,
        report: (payload) => reported.push(payload),
        appendLedger: async () => ({ ok: true, code: "recorded" }),
        fetchImpl: async () => jsonOk({ data: [{ id: "msg-a" }, { id: "msg-b" }] }),
        recordSends: async () => ({ ok: false, code: "send_record_write_failed" })
      }));

      assert.ok(reported.length >= 1, "the injected prose reporter stopped being called");
      assert.ok(reported.every((entry) => typeof entry.code === "string"), "the prose reporter's payload shape changed");
    });
  });
});
