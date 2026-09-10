"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const ROUTE_PATH = path.join(root, "routes", "creator-generation-routes.cjs");
const ROUTE = fs.readFileSync(ROUTE_PATH, "utf8");

const billing = require("../lib/creator-generation-billing.cjs");
const { quote, CAPABILITIES } = require("../lib/sonara-paid-capabilities.cjs");
const { authoriseUsage, drawEntry } = require("../lib/sonara-usage-meter.cjs");

// Wiring the meter into generation was nearly a meter that billed one provider
// out of three.
//
// There are FOUR places this route marks a job completed, not one: ElevenLabs
// twice (a JSON reply and a binary reply), Google Veo once, and
// completeFromProviderPayload once for Suno and the media worker. The first
// version of the billing change wired only the last, so ElevenLabs and Google
// Veo would have produced assets a customer keeps and never been charged for
// them -- and every test would have passed, because the path that was wired
// worked.
//
// That is the recurring defect in its money-losing direction: not a check that
// reports success falsely, but a charge that silently does not happen. So the
// first assertion here is structural and counts the paths, because the next
// provider added to this file will have the same opportunity.
describe("every completed generation is charged", () => {
  it("is reading the real route, not an empty file", () => {
    assert.ok(ROUTE.length > 20000, `the generation route is only ${ROUTE.length} bytes; this check has gone blind`);
    assert.match(ROUTE, /chargeCompletedGeneration/, "the charge helper is missing from the route entirely");
  });

  // The one that catches a new provider.
  it("charges on every path that marks a job completed", () => {
    const completions = ROUTE.match(/status: "completed"/g) || [];
    assert.ok(completions.length >= 4, `expected at least four completion paths, found ${completions.length}`);

    const charges = (ROUTE.match(/await chargeCompletedGeneration\(\{/g) || []).length;
    assert.equal(
      charges,
      completions.length,
      `${completions.length} paths mark a job completed but only ${charges} charge for it. ` +
      "A provider that completes without a charge produces an asset the customer keeps for free, and every existing " +
      "test still passes because the wired paths work. Add the charge beside the completion."
    );
  });

  it("charges after the job is marked complete, so a ledger failure cannot cost the customer their output", () => {
    // Each completion is paired with the charge that follows it.
    //
    // The first version of this compared the FIRST storeOutput against the
    // FIRST charge, and failed — correctly, but for the wrong reason: the
    // ElevenLabs JSON branch completes and charges without storing anything, so
    // it precedes any storeOutput. Comparing firsts was measuring an ordering
    // the code never claimed. Pairing them positionally is the property that
    // actually matters: nothing is charged before the work it is charging for is
    // recorded as done.
    const indicesOf = (needle) => {
      const found = [];
      let at = ROUTE.indexOf(needle);
      while (at !== -1) {
        found.push(at);
        at = ROUTE.indexOf(needle, at + needle.length);
      }
      return found;
    };

    const completions = indicesOf('status: "completed"');
    const charges = indicesOf("await chargeCompletedGeneration({");
    assert.equal(completions.length, charges.length, "every completion should have exactly one charge");
    assert.ok(completions.length >= 4, `expected at least four pairs, found ${completions.length}`);

    for (let index = 0; index < completions.length; index += 1) {
      assert.ok(
        completions[index] < charges[index],
        `completion ${index + 1} is charged before the job is marked complete; taking credit before the work is recorded is the wrong order`
      );
    }
  });

  it("does not charge a failed job", () => {
    // A failure consumed real compute and we absorb it deliberately. This
    // asserts the decision rather than trusting where the call happens to sit.
    const failureHelpers = ROUTE.slice(ROUTE.indexOf("async function failJob("), ROUTE.indexOf("async function failProviderResponse("));
    assert.ok(failureHelpers.length > 50, "could not isolate the failure helpers");
    assert.doesNotMatch(
      failureHelpers,
      /chargeCompletedGeneration/,
      "a failed job must not be charged -- billing somebody for output they never received is the charge that loses them"
    );
  });

  it("keys the charge on the job id, so a repeated poll cannot charge twice", () => {
    assert.match(
      ROUTE,
      /idempotencyKey: `generation:\$\{job\.id\}`/,
      "the charge must be keyed on the job id; a poll, a retry or a duplicated webhook each reach this line"
    );
  });

  it("records whether the usage was measured or estimated", () => {
    assert.match(
      ROUTE,
      /usage_basis: cost\.basis/,
      "the ledger row must record the basis -- '96 GPU seconds' means two different things measured and estimated, " +
      "and revenue cannot be reconciled against cost without knowing which"
    );
  });

  it("gates credit only on jobs that will actually run", () => {
    // review_required, setup_required and manual_required call no provider and
    // burn no compute. Refusing them for credit would charge a customer, in
    // refusals, for work nobody was going to do.
    assert.match(
      ROUTE,
      /if \(initialStatus === "queued"\) \{\s*\n\s*const authorised = await authoriseGenerationCredit/,
      "the credit check must be conditional on the job being queued"
    );
  });

  it("refuses before the job row is written", () => {
    const gate = ROUTE.indexOf("const authorised = await authoriseGenerationCredit");
    const insertJob = ROUTE.indexOf("const created = await insert(config, JOB_TABLE,");
    assert.ok(gate > 0 && insertJob > 0, "one of the two is missing");
    assert.ok(
      gate < insertJob,
      "a job row left in insufficient_credit is a failure the customer cannot clear; refuse before writing it"
    );
  });

  it("tells no credit apart from a failed check, because they need different actions", () => {
    assert.match(
      ROUTE,
      /decision\.code === "insufficient_credit" \? 402 : 503/,
      "402 for no credit and 503 for an unreadable ledger -- a blanket 402 would have somebody buy credit to fix a database blip"
    );
  });

  describe("what a job costs", () => {
    it("prices a video from its requested duration when nothing reports usage", () => {
      const basis = billing.preflight({ capability: "text_to_video", parameters: { duration_seconds: 8 } });
      assert.equal(basis.ok, true);
      assert.equal(basis.capability, "media_generation");
      assert.equal(basis.units, 96, "8 output seconds at 12 GPU seconds each");
      assert.equal(basis.basis, "estimated");
    });

    it("prefers a figure the provider reported over the estimate", () => {
      const cost = billing.gpuSecondsFor({
        capability: "text_to_video",
        parameters: { duration_seconds: 8 },
        payload: { usage: { gpu_seconds: 40 } }
      });
      assert.equal(cost.gpuSeconds, 40, "a measured figure must win over an estimate");
      assert.equal(cost.basis, "metered");
    });

    it("does not read a missing duration as zero output", () => {
      // Number(null) is 0 and finite, and Number("") is 0 too, so a
      // finite-check alone bills nothing for a job with no duration set. The
      // same slip was caught in the usage meter; it must not reappear here.
      for (const duration of [null, undefined, "", 0, -5, "abc"]) {
        const basis = billing.preflight({ capability: "text_to_video", parameters: { duration_seconds: duration } });
        assert.equal(basis.ok, true);
        assert.ok(
          basis.units > 0,
          `a duration of ${JSON.stringify(duration)} billed ${basis.units} units -- it must fall back to the default, not to free`
        );
      }
    });

    it("refuses a capability nobody costed rather than treating it as free", () => {
      const cost = billing.gpuSecondsFor({ capability: "some_new_thing" });
      assert.equal(cost.ok, false);
      assert.equal(cost.code, "capability_not_costed");
    });

    it("costs every capability the form can submit", () => {
      // The gap this closes: adding a capability to the form and not to the
      // estimates would refuse every job on it at runtime with a 500.
      const { FORM_CAPABILITY_ORDER } = require("../routes/creator-generation-routes.cjs");
      assert.ok(Array.isArray(FORM_CAPABILITY_ORDER) && FORM_CAPABILITY_ORDER.length > 0, "no form capabilities found");
      for (const capability of FORM_CAPABILITY_ORDER) {
        const cost = billing.gpuSecondsFor({ capability });
        assert.equal(cost.ok, true, `${capability} is offered on the form and has no cost estimate`);
      }
    });

    it("charges above the cost floor on every capability it bills", () => {
      // The margin the release chain already guards, checked here against the
      // units this module actually produces rather than against one unit.
      for (const capability of Object.keys(billing.CAPABILITY_ESTIMATES)) {
        const cost = billing.gpuSecondsFor({ capability });
        if (!cost.ok || cost.gpuSeconds === 0) continue;
        const priced = quote(billing.BILLED_CAPABILITY, cost.gpuSeconds);
        assert.equal(priced.ok, true, `${capability} could not be priced`);
        assert.ok(
          priced.marginMinor > 0,
          `${capability} bills ${cost.gpuSeconds} ${CAPABILITIES[billing.BILLED_CAPABILITY].unit} at a margin of ${priced.marginMinor}`
        );
      }
    });
  });

  describe("the draw it produces", () => {
    const ledger = (rows) => ({ ok: true, rows });

    it("refuses a job when the balance will not cover the estimate", () => {
      const basis = billing.preflight({ capability: "text_to_video", parameters: { duration_seconds: 8 } });
      const decision = authoriseUsage({ capability: basis.capability, units: basis.units, history: ledger([]) });
      assert.equal(decision.allowed, false);
      assert.equal(decision.code, "insufficient_credit");
    });

    it("draws the metered figure rather than the authorised estimate when they differ", () => {
      const basis = billing.preflight({ capability: "text_to_video", parameters: { duration_seconds: 8 } });
      const authorised = authoriseUsage({
        capability: basis.capability,
        units: basis.units,
        history: ledger([{ entry_kind: "grant", amount_minor: 5000 }]),
        idempotencyKey: "generation:job-1"
      });
      assert.equal(authorised.allowed, true);

      const measured = billing.gpuSecondsFor({
        capability: "text_to_video",
        parameters: { duration_seconds: 8 },
        payload: { usage: { gpu_seconds: 40 } }
      });
      const written = drawEntry({
        capability: basis.capability,
        units: measured.gpuSeconds,
        organizationId: "org-1",
        idempotencyKey: "generation:job-1"
      });

      assert.equal(written.ok, true);
      assert.ok(
        written.row.amount_minor < authorised.drawMinor,
        "a job that used less than estimated must be charged less, or authorising and charging in one step keeps the difference"
      );
    });
  });
});
