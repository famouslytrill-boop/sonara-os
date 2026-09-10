"use strict";

// What a generation job costs, and whether that number was measured.
//
// `lib/sonara-paid-capabilities.cjs` prices media generation per **GPU second**,
// against a dated floor of 0.0747 minor units. `lib/sonara-usage-meter.cjs`
// decides whether there is credit to run it. This is the piece between them:
// how many GPU seconds a job actually used.
//
// ## The honest problem, stated rather than papered over
//
// **No provider here reports usage back.** `routes/creator-generation-routes.cjs`
// sends `duration_seconds` to ElevenLabs and Google Veo, but that is an *input*
// -- how long the output should be -- and nothing in any provider payload says
// how much compute was spent. The Open Media Worker contract in
// `docs/owner/MEDIA-WORKER-INSTALL.md` returns `status`, `output_url` and
// `progress_percent`, and no usage field.
//
// So there are three ways to bill, and only one of them is honest:
//
//   1. Charge zero when usage is unreported. That is giving GPU time away and
//      calling it a feature, and it would make the whole meter decorative.
//   2. Charge a number and present it as metered. That is the defect this
//      codebase is named for -- a figure that reports a measurement it never
//      took.
//   3. Charge a documented estimate, record that it WAS an estimate, and charge
//      the measured figure the moment a provider reports one.
//
// This is the third. Every ledger row carries `metadata.usage_basis`, which is
// `metered` or `estimated`, so revenue can be reconciled against real cost
// rather than against a guess nobody can identify afterwards.
//
// ## The estimates, and where they come from
//
// Each is GPU seconds per second of requested output, and each is a starting
// figure to be replaced by measurement rather than a claim about any specific
// model. They are deliberately conservative -- too low an estimate loses money
// on every job and too high overcharges a customer, and of the two the second
// is the one that loses trust. Where a provider begins reporting usage, that
// figure wins and the estimate is never consulted.
//
// Recorded 10 September 2026. Review when the first worker reports real usage.
const CAPABILITY_ESTIMATES = Object.freeze({
  text_to_video: Object.freeze({ gpuSecondsPerOutputSecond: 12, defaultOutputSeconds: 5 }),
  image_to_video: Object.freeze({ gpuSecondsPerOutputSecond: 12, defaultOutputSeconds: 5 }),
  video_to_video: Object.freeze({ gpuSecondsPerOutputSecond: 14, defaultOutputSeconds: 5 }),
  text_to_music: Object.freeze({ gpuSecondsPerOutputSecond: 2, defaultOutputSeconds: 30 }),
  video_to_music: Object.freeze({ gpuSecondsPerOutputSecond: 2, defaultOutputSeconds: 30 }),
  music_plan: Object.freeze({ gpuSecondsPerOutputSecond: 1, defaultOutputSeconds: 10 }),
  text_to_audio: Object.freeze({ gpuSecondsPerOutputSecond: 1, defaultOutputSeconds: 10 }),
  text_to_speech: Object.freeze({ gpuSecondsPerOutputSecond: 0.4, defaultOutputSeconds: 15 }),
  speech_to_speech: Object.freeze({ gpuSecondsPerOutputSecond: 0.6, defaultOutputSeconds: 15 }),
  reference_analysis: Object.freeze({ gpuSecondsPerOutputSecond: 0, defaultOutputSeconds: 0, flatGpuSeconds: 8 }),

  // The six below were offered on the generation form and had no cost estimate
  // when this module was written, which under `gpuSecondsFor` would refuse every
  // job on them with a 500. A test that walks FORM_CAPABILITY_ORDER caught it;
  // without that test the route would have refused half its own form.
  sound_effects: Object.freeze({ gpuSecondsPerOutputSecond: 1, defaultOutputSeconds: 10 }),
  video_extend: Object.freeze({ gpuSecondsPerOutputSecond: 12, defaultOutputSeconds: 5 }),
  voice_clone: Object.freeze({ gpuSecondsPerOutputSecond: 0, defaultOutputSeconds: 0, flatGpuSeconds: 40 }),
  singing_voice: Object.freeze({ gpuSecondsPerOutputSecond: 1.5, defaultOutputSeconds: 20 }),
  music_voice_profile: Object.freeze({ gpuSecondsPerOutputSecond: 0, defaultOutputSeconds: 0, flatGpuSeconds: 40 }),
  talking_avatar: Object.freeze({ gpuSecondsPerOutputSecond: 15, defaultOutputSeconds: 10 }),
});

// Below this, rounding eats the margin.
//
// The price list works in minor units of a cent. Media generation charges 0.25
// minor units per GPU second against a floor of 0.0747, and `quote()` rounds
// both the charge and the cost UP to a whole minor unit. So at 4 GPU seconds the
// charge is 1 and the cost is also 1 -- a job run at exactly zero margin, which
// the test asserting positive margin on every capability caught.
//
// The arithmetic: 8 GPU seconds charges 2 and costs 1, which is the smallest
// quantity where the two separate. Anything smaller is billed as 8, because
// running a job at no margin is worse than the rounding it came from, and
// billing a fraction of a cent is not a thing.
const MINIMUM_BILLABLE_GPU_SECONDS = 8;

// Everything metered here draws on one priced capability. The unit is the price
// list's, not this file's.
const BILLED_CAPABILITY = "media_generation";

// `Number(null)` is 0 and finite, and `Number("")` is 0 too, so a
// `Number.isFinite` check alone reads a missing duration as zero output and
// bills nothing. That exact slip was in the first draft of
// lib/sonara-usage-meter.cjs and its test caught it; it is not repeated here.
function positiveNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

// Usage a provider actually reported, if any.
//
// The aliases are the shapes a provider plausibly uses, and the list is
// deliberately short: guessing widely risks reading some unrelated number as
// billable usage, which is worse than falling back to a stated estimate.
function meteredGpuSeconds(payload) {
  if (!payload || typeof payload !== "object") return null;
  const candidates = [
    payload.usage?.gpu_seconds,
    payload.usage?.gpuSeconds,
    payload.gpu_seconds,
    payload.compute_seconds,
    payload.usage?.compute_seconds,
  ];
  for (const candidate of candidates) {
    const parsed = positiveNumber(candidate);
    if (parsed !== null) return parsed;
  }
  return null;
}

// How many GPU seconds to charge for this job, and on what basis.
//
// Returns `{ ok, gpuSeconds, basis, detail }`. `basis` is "metered" when a
// provider reported it and "estimated" otherwise, and the caller is expected to
// put that on the ledger row: a charge whose basis is not recorded cannot be
// reconciled later, and "we billed 60 GPU seconds" means two different things
// depending on which it was.
function gpuSecondsFor({ capability, parameters = null, payload = null } = {}) {
  const estimate = CAPABILITY_ESTIMATES[capability];
  if (!estimate) {
    // Refused rather than defaulted. A capability nobody has costed is not a
    // free one, and inventing a rate here would be a price with no floor behind
    // it -- lib/sonara-paid-capabilities.cjs makes the same refusal.
    return {
      ok: false,
      code: "capability_not_costed",
      detail: `${capability} has no cost estimate, so what it consumes is unknown rather than nothing. Add one to CAPABILITY_ESTIMATES.`,
    };
  }

  const measured = meteredGpuSeconds(payload);
  if (measured !== null) {
    return {
      ok: true,
      gpuSeconds: Math.max(measured, MINIMUM_BILLABLE_GPU_SECONDS),
      basis: "metered",
      detail: measured < MINIMUM_BILLABLE_GPU_SECONDS
        ? `The provider reported ${measured} GPU seconds, billed at the ${MINIMUM_BILLABLE_GPU_SECONDS}-second minimum.`
        : "The provider reported the compute it used."
    };
  }

  if (estimate.flatGpuSeconds) {
    return {
      ok: true,
      gpuSeconds: Math.max(estimate.flatGpuSeconds, MINIMUM_BILLABLE_GPU_SECONDS),
      basis: "estimated",
      detail: `${capability} is charged a flat ${estimate.flatGpuSeconds} GPU seconds; no provider reported usage.`,
    };
  }

  const requested = positiveNumber(parameters?.duration_seconds) ?? estimate.defaultOutputSeconds;
  const gpuSeconds = Math.max(requested * estimate.gpuSecondsPerOutputSecond, MINIMUM_BILLABLE_GPU_SECONDS);

  return {
    ok: true,
    gpuSeconds,
    basis: "estimated",
    detail:
      `No provider reported usage, so this is ${requested} requested output seconds at ` +
      `${estimate.gpuSecondsPerOutputSecond} GPU seconds each.`,
  };
}

// What to check before starting work.
//
// The pre-flight cannot know the real usage, so it authorises the estimate. Two
// consequences, both deliberate:
//
//   * A customer with no credit is refused before any provider is called, which
//     is the point -- the alternative is discovering it after the GPU bill.
//   * A job that ends up metered LOWER than the estimate is charged the lower
//     figure, because the draw happens at completion with what was really used.
//     Authorising and charging in one step would keep the difference.
function preflight({ capability, parameters = null } = {}) {
  const cost = gpuSecondsFor({ capability, parameters, payload: null });
  if (!cost.ok) return cost;
  return { ok: true, capability: BILLED_CAPABILITY, units: cost.gpuSeconds, basis: cost.basis, detail: cost.detail };
}

module.exports = {
  BILLED_CAPABILITY,
  MINIMUM_BILLABLE_GPU_SECONDS,
  CAPABILITY_ESTIMATES,
  positiveNumber,
  meteredGpuSeconds,
  gpuSecondsFor,
  preflight,
};
