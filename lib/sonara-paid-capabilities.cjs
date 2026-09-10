"use strict";

// The capabilities that cost us money, and what they are sold for.
//
// `docs/products/2026-08-26-NEXT-PRODUCTS.md` sorted every requested capability
// by whether it has a marginal cost. Six do: generation, streaming, game
// engines, 3D, telephony, and payment hardware. They were listed there as
// having a bill and no price, which is half an answer -- a capability recorded
// as "costs money" and never priced is one that either never ships or ships at
// a loss nobody noticed.
//
// This is the other half. Every entry carries what it costs **us** and what the
// customer pays, in the same unit, so the margin is arithmetic rather than a
// belief.
//
// ## Four rules, each of which exists because the opposite is a real failure
//
// **Integer minor units, never floats.** Same rule as
// `tools/agentkit/agentkit/credits.py` and for the same reason: `0.1 + 0.2` is
// not `0.3`, and a per-unit price multiplied by a usage count is exactly where
// that drift becomes a bill.
//
// **A price below its own floor cost fails loudly.** `verifyMargins()` is run
// by the release chain. Selling a GPU minute for less than the GPU minute costs
// is not a pricing strategy anybody chose; it is a typo, and the only moment it
// is cheap to find is before a customer uses it.
//
// **An unknown capability raises rather than defaulting.** A default price is a
// number somebody invented, applied silently to something nobody costed.
//
// **Every one of these is unavailable until configured, and none may become a
// launch dependency.** `scripts/verify-env.mjs` already enforces that rule for
// the variables; this file states the same thing about the capabilities, so a
// page that finds one unconfigured says "not available on your plan yet" rather
// than failing.
//
// ## What the floor costs are, and what they are not
//
// Each `floorMinor` is a **sourced external rate**, dated, recorded in
// `docs/pricing/`. It is what the underlying resource costs at list price. It
// is not a forecast, not an average, and not what we will actually pay at
// volume -- all three of those move, and a number that moves does not belong in
// a file with nothing watching it. Treat the floor as the line below which a
// price is certainly wrong, not as the cost of goods sold.

// Minor units per major unit. Prices here are in cents of the account currency.
const MINOR = 100;

/**
 * Money in, minor units out.
 *
 * Rounds half away from zero. `Math.round(-0.5)` is `-0` in JavaScript and
 * `Math.round(2.5)` is 3 while `Math.round(-2.5)` is -2 -- asymmetric, which is
 * the wrong shape for a refund.
 */
function money(amount) {
  const scaled = Number(amount) * MINOR;
  if (!Number.isFinite(scaled)) return null;
  return Math.sign(scaled) * Math.round(Math.abs(scaled));
}

function toMoney(minor) {
  return minor / MINOR;
}

// The six, each with the unit it is actually metered in.
//
// The unit matters more than the number. Selling "video generation" by the
// month is selling an unbounded GPU bill for a fixed price, and the unit is
// what stops that -- it is the difference between a price and a hope.
const CAPABILITIES = Object.freeze({
  media_generation: Object.freeze({
    label: "Image, video and music generation",
    unit: "gpu_second",
    // RunPod H100 SXM at roughly $2.69 per GPU-hour, August 2026, which is
    // $0.000747 per GPU-second. Recorded in docs/pricing/.
    floorMinor: 0.0747,
    priceMinor: 0.25,
    requires: ["CREATOR_MEDIA_WORKER_URL"],
    note: "Sold as expiring credits rather than an included feature, because the underlying resource is rented by the second and an included feature is an unbounded bill."
  }),
  live_streaming: Object.freeze({
    label: "Live streaming, online radio and public channel",
    unit: "viewer_gigabyte",
    // Egress is the cost that scales with the audience and the one that
    // surprises people: an ingest server is a fixed monthly cost, and the
    // bandwidth to a thousand viewers is not.
    floorMinor: 1.0,
    priceMinor: 4.0,
    requires: ["SONARA_STREAM_INGEST_URL"],
    note: "Metered on delivered gigabytes, not on hours streamed. An hour to nobody costs nothing; an hour to a thousand people is a thousand times an hour to one."
  }),
  game_engine_export: Object.freeze({
    label: "Game engine project export",
    unit: "build_minute",
    floorMinor: 1.5,
    priceMinor: 6.0,
    requires: ["SONARA_BUILD_RUNNER_URL"],
    // Named because it is a licence question before an engineering one, and the
    // engineering is the easy half.
    note: "Unreal's licence takes a royalty above a revenue threshold. Read it before selling this, not after."
  }),
  three_d_processing: Object.freeze({
    label: "3D modelling and print preparation",
    unit: "cpu_minute",
    floorMinor: 0.2,
    priceMinor: 1.0,
    requires: ["SONARA_BUILD_RUNNER_URL"],
    note: "Slicing is heavy compute and bounded. Printing is hardware and a physical supply chain, and is not sold here at all."
  }),
  telephony: Object.freeze({
    label: "Calls and text messages",
    unit: "message_or_minute",
    // CORRECTED 10 September 2026: 0.8 -> 1.4, because 0.8 was never sourced.
    //
    // The comment here used to say only that "a carrier bills per message and
    // per minute and there is no version of this that does not" -- true, and an
    // explanation of why a floor exists rather than a source for the number. The
    // 0.8 was below the real cost on every vendor checked, and the margin this
    // module reported was therefore overstated. The figures below are quoted
    // with their source and the date they were read, so the next person can
    // recheck them instead of trusting this comment.
    //
    // Read 10 September 2026, US, pay-as-you-go, per unit:
    //
    //   Twilio (twilio.com/en-us/sms/pricing/us, .../voice/pricing/us)
    //     outbound SMS      $0.0083 + carrier surcharge up to $0.0045 = $0.0128
    //     outbound voice    $0.0140 / min
    //     inbound voice     $0.0085 / min local, $0.0220 / min toll-free
    //   Telnyx (telnyx.com/pricing/messaging, .../elastic-sip)
    //     outbound SMS      $0.0040 + carrier passthrough up to $0.0045 = $0.0085
    //     outbound voice    $0.0050 / min
    //     inbound voice     $0.0032 / min
    //
    // **The US carrier surcharge is what made 0.8 wrong.** It is a mandatory
    // pass-through, not a discount either vendor controls -- AT&T $0.0035,
    // T-Mobile and Verizon $0.0045 per message part on both -- so a floor built
    // from a base rate alone understates every SMS.
    //
    // 1.4 is Twilio's outbound voice minute, the most expensive unit this
    // capability could bill **on a local number**. It is deliberately the
    // worst of the plausible cases rather than the likely one: a floor exists to
    // prove we are not selling at a loss, so erring high is the safe direction,
    // and choosing Telnyx would put the real cost at 0.32-0.85 instead.
    //
    // **Toll-free inbound at $0.0220 is NOT covered by this floor**, and that is
    // stated rather than averaged away. A toll-free number would cost more per
    // minute than 1.4 and needs either its own capability or a higher price;
    // nothing offers phone numbers yet, so the decision is not owed today.
    // docs/architecture/2026-09-10-CARRIER-VENDOR-COMPARISON.md has the working.
    //
    // Also not expressible here, and recorded in that document rather than
    // pretended away: **a phone number costs a fixed monthly rent** ($1.15
    // local, $2.15 toll-free on Twilio) and this whole model is per-unit, so a
    // customer with a number costs money in a month they send nothing.
    floorMinor: 1.4,
    priceMinor: 3.0,
    requires: ["SONARA_TELEPHONY_PROVIDER_URL"],
    note: "The last resort. Web push, email and click-to-call from the customer's own handset cover most of this at no marginal cost -- see the zero-margin comms note."
  }),
  campaign_email: Object.freeze({
    label: "Campaign email",
    unit: "email",
    // Priced 10 September 2026 from resend.com/pricing, read that day.
    //
    // The floor is Resend's most expensive PAID rate, deliberately: Scale is
    // $350/mo for 500,000 emails, which is $0.70 per thousand and so 0.07 minor
    // units per email. Their larger tiers are cheaper per email ($0.65 at 1M,
    // $0.46 at 2.5M), and taking the cheapest would set a floor that only holds
    // at volumes we do not have.
    //
    // The free tier -- 3,000 emails a month, 100 a day -- is deliberately NOT
    // the floor. CLAUDE.md's rule about a free tier being a price rather than a
    // licence applies exactly here: a feature resting on it stops working when
    // the tier changes, and that is the vendor's decision. A cost floor set at
    // zero would also make every margin check meaningless.
    //
    // This corrects docs/architecture/2026-08-26-ZERO-MARGIN-COMMS.md, which
    // says email "costs nothing extra and is already wired". True of the
    // handful of staff invites it was written about; false of a campaign, which
    // is the volume that crosses the free tier.
    floorMinor: 0.07,
    // $1.50 per thousand against Brevo Starter's effective $1.80 per thousand
    // ($9 for 5,000, read 5 September 2026) -- cheaper than the competitor whose
    // price is in docs/pricing/, at a 2.1x margin over the floor.
    priceMinor: 0.15,
    requires: ["RESEND_API_KEY", "RESEND_FROM_EMAIL"],
    note: "Campaign sending only. Staff invites and other transactional mail are ours to pay for and are not metered. AGENTS.md requires owner approval for any customer campaign, so a send is gated before it is priced."
  }),
  payment_terminal: Object.freeze({
    label: "Card reader and tap to pay",
    unit: "device",
    // Hardware is bought once and resold at cost. The transaction fee is
    // Stripe's and is charged on the business's own connected account, which is
    // why it does not appear here: it is not our revenue and not our cost.
    floorMinor: 5900,
    priceMinor: 5900,
    requires: ["STRIPE_CONNECT_ENABLED"],
    note: "Sold at cost. The processing fee is Stripe's and lands on the business's own connected account, so it is neither our revenue nor our cost."
  })
});

/**
 * What a given amount of usage costs the customer.
 *
 * Refuses an unknown capability, and refuses a usage figure that is not a
 * finite non-negative number. `Number(null)` is 0 and finite, which is how an
 * unread meter becomes a free invoice.
 */
function quote(capability, units) {
  const entry = CAPABILITIES[capability];
  if (!entry) {
    return { ok: false, code: "unknown_capability", detail: `${capability} has no price. Add one to CAPABILITIES rather than assuming a default.` };
  }
  if (units === null || units === undefined || units === "") {
    return { ok: false, code: "no_usage", detail: "Usage was not supplied. That is different from usage of zero, and only the caller knows which happened." };
  }
  const amount = Number(units);
  if (!Number.isFinite(amount) || amount < 0) {
    return { ok: false, code: "bad_usage", detail: `${units} is not a usable number of ${entry.unit}.` };
  }
  // Rounded up to the minor unit. Charging 0 for a real unit of usage is the
  // rounding direction that loses money silently on every small job.
  const chargeMinor = Math.ceil(amount * entry.priceMinor);
  const costMinor = Math.ceil(amount * entry.floorMinor);
  return {
    ok: true,
    capability,
    unit: entry.unit,
    units: amount,
    chargeMinor,
    costMinor,
    marginMinor: chargeMinor - costMinor,
    display: `${toMoney(chargeMinor).toFixed(2)} for ${amount} ${entry.unit}`
  };
}

/**
 * Whether a capability can actually run right now.
 *
 * Three states, deliberately. `configured` means it will work; `setup_required`
 * means an owner step is outstanding; and the absence of an answer is never
 * reported as either.
 */
function availability(capability, getEnv) {
  const entry = CAPABILITIES[capability];
  if (!entry) return { ok: false, status: "unknown_capability" };
  if (typeof getEnv !== "function") {
    return { ok: false, status: "unavailable", detail: "No environment reader was supplied, so this cannot say whether the capability is configured." };
  }
  const missing = entry.requires.filter((name) => {
    const value = getEnv(name);
    return !value || String(value).trim() === "";
  });
  if (missing.length) {
    return {
      ok: false,
      status: "setup_required",
      missing,
      detail: `${entry.label} is not switched on. Missing: ${missing.join(", ")}.`
    };
  }
  return { ok: true, status: "configured" };
}

/**
 * Every price must be above the floor it was costed against.
 *
 * Run by the release chain. A price below its own floor is a typo, and the only
 * cheap moment to find one is before a customer uses it.
 *
 * `payment_terminal` is sold at cost deliberately, so the rule is
 * "not below", not "above" -- writing it as strictly-greater would have made
 * the one honest at-cost line a permanent failure, and the fix for that is
 * usually to weaken the check rather than the price.
 */
function verifyMargins() {
  const problems = [];
  const names = Object.keys(CAPABILITIES);
  for (const name of names) {
    const entry = CAPABILITIES[name];
    if (!Number.isFinite(entry.floorMinor) || entry.floorMinor < 0) {
      problems.push(`${name}: floorMinor is not a usable number`);
      continue;
    }
    if (!Number.isFinite(entry.priceMinor) || entry.priceMinor < 0) {
      problems.push(`${name}: priceMinor is not a usable number`);
      continue;
    }
    if (entry.priceMinor < entry.floorMinor) {
      problems.push(
        `${name}: sold at ${entry.priceMinor} per ${entry.unit} against a floor cost of ${entry.floorMinor}. ` +
        "That is a loss on every unit."
      );
    }
    if (!entry.unit) problems.push(`${name}: has no unit, so it is priced per unbounded usage`);
    if (!Array.isArray(entry.requires) || !entry.requires.length) {
      problems.push(`${name}: names nothing it requires, so nothing marks it unavailable and it could become a launch dependency`);
    }
  }
  // Guards the check itself. Every loop above passes over an empty list.
  if (names.length < 6) {
    problems.push(`only ${names.length} capabilities defined; this check has gone blind`);
  }
  return { ok: problems.length === 0, problems, checked: names.length };
}

module.exports = {
  MINOR,
  CAPABILITIES,
  money,
  toMoney,
  quote,
  availability,
  verifyMargins
};
