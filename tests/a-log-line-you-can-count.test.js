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

  describe("the checkout path, which is the other place an SLO belongs", () => {
    const { createBilling } = require("../lib/sonara-billing.cjs");

    const PLANS = {
      workspace_monthly: { name: "One workspace", price: "$29/mo", amountCents: 2900, mode: "subscription", env: "STRIPE_PRICE_WORKSPACE_MONTHLY" }
    };

    function billing() {
      return createBilling({
        STRIPE_PLANS: PLANS,
        getEnv: (name) => (name === "STRIPE_SECRET_KEY" ? "sk_live_test" : ""),
        getPublicAppUrl: () => "https://sonaraindustries.com",
        getSafeAbsoluteUrl: (value, fallback) => value || fallback,
        getSupabaseServerConfig: () => ({ ok: false }),
        supabaseHeaders: () => ({}),
        safeCountTable: async () => ({ ok: true, count: 0 }),
        formatMetric: (value) => String(value),
        insertActivityEvent: async () => ({ ok: true })
      });
    }

    const priceResponse = (body, status = 200) =>
      new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

    // The billing module does not take a sink either, so stderr is captured the
    // same way. No prose line is expected on this path, which is itself
    // asserted below.
    async function runCapturing(run) {
      const chunks = [];
      const originalWrite = process.stderr.write;
      const originalFetch = global.fetch;
      process.stderr.write = (chunk) => { chunks.push(String(chunk)); return true; };
      let result;
      try {
        result = await run();
      } finally {
        process.stderr.write = originalWrite;
        global.fetch = originalFetch;
      }
      const events = chunks.join("").split("\n").filter((line) => line.startsWith("{")).map((line) => JSON.parse(line));
      return { result, events };
    }

    it("names the Stripe rejection that used to return a bare ok:false", async () => {
      // The defect: every other refusal in createStripeCheckoutSession was
      // named -- price_mismatch, price_product_archived -- and the one Stripe
      // itself produces was `return { ok: false }` with no code. A customer saw
      // "Checkout could not be started" and the server kept no record of why.
      //
      // 401 is the case docs/owner/STRIPE-RUNTIME-KEY-CUTOVER.md warns about: a
      // restricted verifier passes the price audit and cannot create sessions.
      const { result, events } = await runCapturing(async () => {
        global.fetch = async (url) => {
          if (String(url).includes("/v1/prices/")) return priceResponse({ unit_amount: 2900, currency: "usd", active: true });
          return priceResponse({ error: { message: "no" } }, 401);
        };
        return billing().createStripeCheckoutSession({ get: () => "", body: { workspace: "business_builder" } }, "workspace_monthly", "price_x", "org-7", { id: "user" }, "cus_1");
      });

      assert.equal(result.ok, false);
      assert.equal(result.code, "stripe_session_rejected", "the Stripe rejection is still anonymous");
      assert.equal(result.status, 401, "the status is what tells a credential failure from a bad request");

      const [event] = events.filter((e) => e.event === "checkout.session");
      assert.ok(event, "no checkout.session event was emitted");
      assert.equal(event.outcome, "failed");
      assert.equal(event.reason, "stripe_rejected_credential", "a 401 was not attributed to the credential");
      assert.equal(event.organization, "org-7");
      assert.equal(event.detail.status, 401);
    });

    it("tells a bad request apart from a bad credential", async () => {
      // Same anonymous failure before; different remedy. Collapsing them would
      // send somebody to rotate a key over a malformed parameter.
      const { result, events } = await runCapturing(async () => {
        global.fetch = async (url) => {
          if (String(url).includes("/v1/prices/")) return priceResponse({ unit_amount: 2900, currency: "usd", active: true });
          return priceResponse({ error: { message: "bad param" } }, 400);
        };
        return billing().createStripeCheckoutSession({ get: () => "", body: { workspace: "business_builder" } }, "workspace_monthly", "price_x", "org-7", { id: "user" }, "cus_1");
      });

      assert.equal(result.status, 400);
      const [event] = events.filter((e) => e.event === "checkout.session");
      assert.equal(event.reason, "stripe_rejected_request");
    });

    it("counts a price refusal as refused, not failed", async () => {
      // Refusing to sell at a price the page does not advertise is the guard
      // working. Counting it against an error budget would make the budget
      // measure catalog drift rather than reliability.
      const { result, events } = await runCapturing(async () => {
        global.fetch = async (url) => {
          if (String(url).includes("/v1/prices/")) return priceResponse({ unit_amount: 4999, currency: "usd", active: true });
          throw new Error("a session must not be created when the price is wrong");
        };
        return billing().createStripeCheckoutSession({ get: () => "", body: { workspace: "business_builder" } }, "workspace_monthly", "price_stale", "org-7", { id: "user" }, "cus_1");
      });

      assert.equal(result.code, "price_mismatch");
      const [event] = events.filter((e) => e.event === "checkout.session");
      assert.equal(event.outcome, "refused", "a price refusal was counted as a failure");
      assert.equal(event.reason, "price_mismatch");
      assert.equal(event.detail.charges, 4999);
      assert.equal(event.detail.advertised, 2900);
    });

    it("emits ok for a session that was created", async () => {
      // Or every assertion above is satisfied by a path that never succeeds.
      const { result, events } = await runCapturing(async () => {
        global.fetch = async (url) => {
          if (String(url).includes("/v1/prices/")) return priceResponse({ unit_amount: 2900, currency: "usd", active: true });
          return priceResponse({ url: "https://checkout.stripe.com/c/pay/abc" });
        };
        return billing().createStripeCheckoutSession({ get: () => "", body: { workspace: "business_builder" } }, "workspace_monthly", "price_x", "org-7", { id: "user" }, "cus_1");
      });

      assert.equal(result.ok, true);
      assert.equal(result.url, "https://checkout.stripe.com/c/pay/abc");
      const [event] = events.filter((e) => e.event === "checkout.session");
      assert.equal(event.outcome, "ok");
      assert.equal(event.detail.plan, "workspace_monthly");
    });

    it("refuses a 200 that carries no url rather than returning ok with nothing", async () => {
      const { result, events } = await runCapturing(async () => {
        global.fetch = async (url) => {
          if (String(url).includes("/v1/prices/")) return priceResponse({ unit_amount: 2900, currency: "usd", active: true });
          return priceResponse({ id: "cs_1" });
        };
        return billing().createStripeCheckoutSession({ get: () => "", body: { workspace: "business_builder" } }, "workspace_monthly", "price_x", "org-7", { id: "user" }, "cus_1");
      });

      assert.equal(result.ok, false);
      assert.equal(result.code, "stripe_session_without_url");
      const [event] = events.filter((e) => e.event === "checkout.session");
      assert.equal(event.reason, "stripe_session_without_url");
    });

    it("never puts the Stripe key in a checkout event", async () => {
      // The Authorization header on these calls carries the live key. Nothing
      // this path emits may contain it.
      const { events } = await runCapturing(async () => {
        global.fetch = async (url) => {
          if (String(url).includes("/v1/prices/")) return priceResponse({ unit_amount: 2900, currency: "usd", active: true });
          return priceResponse({ error: { message: "Invalid API Key provided: sk_live_test" } }, 401);
        };
        return billing().createStripeCheckoutSession({ get: () => "", body: { workspace: "business_builder" } }, "workspace_monthly", "price_x", "org-7", { id: "user" }, "cus_1");
      });

      const serialised = JSON.stringify(events);
      assert.ok(!serialised.includes("sk_live_test"), "a checkout event carried the Stripe key");
    });
  });

  describe("the agent runner, which is the one path that executes", () => {
    const { createRunner } = require("../lib/sonara-agent-runner.cjs");
    const fs = require("node:fs");
    const path = require("node:path");

    async function runCapturing(run) {
      const chunks = [];
      const original = process.stderr.write;
      process.stderr.write = (chunk) => { chunks.push(String(chunk)); return true; };
      let result;
      try {
        result = await run();
      } finally {
        process.stderr.write = original;
      }
      const events = chunks.join("").split("\n").filter((line) => line.startsWith("{")).map((line) => JSON.parse(line));
      return { result, events };
    }

    // check_data_quality is on the self-serve list in
    // lib/sonara-agent-authority.cjs; issue_refund requires owner approval.
    // Both are read from that module rather than invented, because a fixture
    // that does not match the authority rule tests nothing.
    it("calls a completed run ok, attributed to the tenant", async () => {
      const runner = createRunner({ handlers: { check_data_quality: async () => ({ ok: true }) } });
      const { result, events } = await runCapturing(() => runner.run({
        action: { action_type: "check_data_quality" },
        organizationId: "org-9"
      }));

      assert.equal(result.status, "completed");
      const [event] = events.filter((e) => e.event === "agent.run");
      assert.ok(event, "a completed agent run emitted no event");
      assert.equal(event.outcome, "ok");
      assert.equal(event.organization, "org-9");
      assert.equal(event.capability, "agent_action");
      assert.equal(event.correlation, "check_data_quality");
      assert.equal(event.detail.status, "completed");
    });

    it("calls a gated refusal refused, not failed", async () => {
      // An owner-approval requirement doing its job is not a reliability
      // failure, and counting it as one would make the error budget measure how
      // often somebody proposes a gated action.
      const runner = createRunner();
      const { result, events } = await runCapturing(() => runner.run({
        action: { action_type: "issue_refund" },
        organizationId: "org-9"
      }));

      assert.equal(result.status, "refused");
      const [event] = events.filter((e) => e.event === "agent.run");
      assert.equal(event.outcome, "refused", "a gated refusal was counted as a failure");
      assert.equal(event.detail.requires_owner_approval, true);
    });

    it("does not call an unimplemented action a failure", async () => {
      // The arguable mapping, asserted so the reasoning is pinned rather than
      // assumed: `unimplemented` is allowed-and-nothing-does-it. Counting it as
      // failed would spend error budget on a known capability gap every time
      // somebody pressed the button, so it is `degraded` with its own reason.
      const runner = createRunner();
      const { result, events } = await runCapturing(() => runner.run({
        action: { action_type: "check_data_quality" },
        organizationId: "org-9"
      }));

      assert.equal(result.status, "unimplemented", "fixture does not reach the unimplemented path");
      const [event] = events.filter((e) => e.event === "agent.run");
      assert.equal(event.outcome, "degraded");
      assert.equal(event.reason, "unimplemented");
      assert.notEqual(event.outcome, "refused", "an allowed-but-unimplemented action was blamed on the gate");
    });

    it("calls a handler that threw failed, without leaking what it threw", async () => {
      const runner = createRunner({
        handlers: {
          check_data_quality: async () => {
            throw new Error("https://project.supabase.co/rest/v1/x?apikey=abcdef123456 refused");
          }
        }
      });
      const { result, events } = await runCapturing(() => runner.run({
        action: { action_type: "check_data_quality" },
        organizationId: "org-9"
      }));

      assert.equal(result.status, "failed");
      const [event] = events.filter((e) => e.event === "agent.run");
      assert.equal(event.outcome, "failed");
      // A handler talks to Supabase and a Supabase error carries the URL it
      // failed on, and that URL carries the key.
      assert.ok(!JSON.stringify(event).includes("apikey=abcdef123456"), "an agent run event carried a credential from a thrown error");
    });

    it("counts a blind autonomy breaker separately from the run it guarded", async () => {
      // A run can complete perfectly while the safety check in front of it
      // could not be evaluated. Three of the four rate limiters in this
      // codebase failed open in silence for months, which is why this module
      // reports a degraded breaker at all -- and now it is countable.
      const runner = createRunner({
        handlers: { check_data_quality: async () => ({ ok: true }) },
        readHistory: async () => ({ ok: false, rows: [], reason: "history table unreadable" }),
        onBreakerDegraded: () => {}
      });
      const { events } = await runCapturing(() => runner.run({
        action: { action_type: "check_data_quality" },
        organizationId: "org-9"
      }));

      const breaker = events.filter((e) => e.event === "agent.autonomy_breaker");
      assert.equal(breaker.length, 1, "a breaker that could not be evaluated emitted no event");
      assert.equal(breaker[0].outcome, "degraded");
      assert.equal(breaker[0].reason, "history_unreadable");
      assert.equal(breaker[0].organization, "org-9");
    });

    it("lets a runner with no tenant say so, rather than defaulting", async () => {
      // The admin drafting runner in routes/sonara-ai-integrations-routes.cjs
      // has no customer organization behind it, so "no tenant" is true there.
      // It has to be DECLARED, because the default is organization scope and a
      // caller that forgets must produce a complaint rather than a plausible
      // process-scoped line.
      const runner = createRunner({ handlers: { draft_content: async () => ({ ok: true }) } });
      const { events } = await runCapturing(() => runner.run({
        action: { action_type: "draft_content" },
        scope: "process"
      }));

      const [event] = events.filter((e) => e.event === "agent.run");
      assert.equal(event.scope, "process");
      assert.equal(event.organization, null);
    });

    it("complains loudly when a caller forgets to attribute a run", async () => {
      // The property that makes the default safe. No organizationId and no
      // declared scope produces a rejected-event line naming the omission, not
      // an agent.run event that looks tenant-less.
      const runner = createRunner({ handlers: { check_data_quality: async () => ({ ok: true }) } });
      const { events } = await runCapturing(() => runner.run({
        action: { action_type: "check_data_quality" }
      }));

      assert.equal(events.filter((e) => e.event === "agent.run").length, 0, "an unattributed run was emitted as if it were fine");
      const [rejected] = events.filter((e) => e.event === "log.event_rejected");
      assert.ok(rejected, "an unattributed run emitted nothing at all, so the omission is invisible");
      assert.equal(rejected.reason, "organization_id_required");
    });

    it("keeps every runner.run call site attributed", () => {
      // Derived rather than listed. The runner defaults to organization scope,
      // so a new call site that passes neither an organizationId nor a scope
      // emits a rejected line instead of a countable one -- which is safe, and
      // still a gap in the series. This fails while that gap is being added
      // rather than after somebody notices the metric is short.
      const roots = ["lib", "routes"];
      const unattributed = [];
      let sites = 0;
      for (const dir of roots) {
        for (const name of fs.readdirSync(path.join(__dirname, "..", dir))) {
          if (!name.endsWith(".cjs")) continue;
          const relative = `${dir}/${name}`;
          const source = fs.readFileSync(path.join(__dirname, "..", relative), "utf8");
          for (const match of source.matchAll(/[A-Za-z]*[Rr]unner\.run\(\{/g)) {
            sites += 1;
            // The call's own text, to its closing `});`.
            //
            // The word boundaries below are escaped deliberately. The first
            // version of this file was written through a Python heredoc where
            // `\b` is a BACKSPACE character, so the pattern became
            // /\x08organizationId/ and matched nothing -- which reported all
            // six call sites as unattributed and looked like a product bug.
            const from = match.index;
            const end = source.indexOf("});", from);
            const call = source.slice(from, end === -1 ? from + 600 : end);
            if (!/\borganizationId\s*:/.test(call) && !/\bscope\s*:/.test(call)) {
              unattributed.push(`${relative}: a runner.run call passes neither organizationId nor scope`);
            }
          }
        }
      }
      assert.ok(sites >= 5, `only ${sites} runner.run call sites found; this check has gone blind`);
      assert.deepEqual(unattributed, [], unattributed.join("\n  "));
    });
  });
});
