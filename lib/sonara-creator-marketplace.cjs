// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const { databaseAmount } = require("./sonara-commerce-amounts.cjs");

// Selling a creative work: what has to be true first.
//
// The owner's brief: "Creator studio comes with a Marketplace. Where users can
// sell and monetize the audio and video creations and generations, pictures and
// art." This is the gate in front of that, and it exists because a marketplace is
// the one surface where the cost of getting provenance wrong leaves the building.
//
// ## The rule that organises everything here
//
// **You cannot sell what you are not cleared to publish.** Listing is strictly
// harder than publishing, never easier, and this module composes
// `lib/sonara-creator-approval-graph.cjs`'s `publishReadiness` rather than
// restating its conditions. That is deliberate and it is the whole design: two
// functions each deciding "is this cleared" would agree on the day they were
// written and drift apart on the day somebody adds a blocker to one of them. A
// listing check that had its own copy of "is it approved" would be a second
// opinion, and a second opinion is a way for the first to stop mattering.
//
// So `listingReadiness` starts from `publishReadiness` and adds. Every blocker the
// publish side raises is a blocker here, carried through with its own sentence.
//
// ## What listing adds, and why each one is about money rather than approval
//
// **1. Rights have to be attested, and an unanswered attestation is not a yes.**
// `lib/sonara-generation-provenance.cjs` already makes this argument for
// generation jobs -- "a job that never asked is not a job that was answered". A
// sale is where it bites: publishing something you do not hold the rights to is a
// problem, and *charging* for it is a different and worse one. Three states again,
// and `not_recorded` refuses.
//
// **2. Consent, separately, when a person is in it.** Rights and consent are not
// the same question. You can hold the copyright in a recording of somebody's voice
// and still not have their permission to sell a synthetic version of it. AGENTS.md
// requires provenance, consent and anti-clone safety as three things, and this
// keeps them three.
//
// **3. A price nobody set is not free.** The same defect
// `lib/sonara-merchant-storefront.cjs` was written around: `price_cents` with a
// default of zero makes an unpriced thing and a free thing the same row. A listing
// with no price is refused rather than offered at nothing.
//
// **4. A licence has to be chosen.** What the buyer may do with it is the product.
// Selling a file without saying is selling an argument later.
//
// ## What this module does not do
//
// It takes no payment. That needs the owner's commerce credentials (action 5 in
// `docs/owner/OWNER-STEPS.md`) and nothing here invents one. A listing that is
// ready to sell says so and says the checkout is not connected yet, which is the
// honest state and not a button that pretends.

// DISCLOSURE is imported rather than its values retyped here. The first draft of
// this file compared the disclosure against the string "disclosed", which is not
// one of the three values that module uses -- so a work whose AI disclosure had
// been recorded would have been shown to buyers as not disclosed, silently, with
// nothing failing. A string literal standing in for another module's enum is a
// comparison that is wrong the moment either side is renamed, and nothing says so.
const { publishReadiness, DISCLOSURE } = require("./sonara-creator-approval-graph.cjs");

// Platform access is free; the seller's asking price is a separate amount.
// Checkout and barter availability must not be inferred from this fee policy.
const MARKETPLACE_FEES = Object.freeze({
  subscriptionRequired: false,
  listingFeeCents: 0,
  buyerFeeCents: 0,
  sellerCommissionBasisPoints: 0,
  disclosure: "SONARA marketplace access is free, with no listing fee, buyer fee or seller commission. Item prices, delivery, taxes and any external payment-processing charges are separate.",
  // Two sentences, chosen by whether checkout is configured right now. A page that
  // described Stripe checkout while none was switched on would be promising a
  // purchase nobody can make.
  availability: "Browsing and listing are available. Checkout is not switched on yet, so no purchase can be made today.",
  availabilityWithCheckout: "A buyer pays on Stripe's own checkout, charged directly to the seller's connected Stripe account. The download unlocks only after Stripe confirms the payment, for the buyer's account only."
});

/**
 * What still stands between a seller and a completed sale. Advisory: it renders a
 * page and authorizes nothing -- every money decision re-reads at the moment it is
 * made (lib/sonara-marketplace-orders.cjs purchaseDecision).
 *
 * `checkout` is lib/sonara-connected-checkout.cjs checkoutReadiness. It was a fixed
 * "not built" step until buying existed; it is read from configuration now, and
 * absent configuration is reported as missing rather than as ready.
 */
function purchaseReadiness(payment, checkout) {
  let paymentState = "unavailable";
  let paymentMessage = "We could not verify your payment account. Try again from Payment account.";
  if (payment?.ok === true) {
    paymentState = "ready";
    paymentMessage = payment.payoutsEnabled === true
      ? "Your payment account can accept charges and payouts are enabled."
      : "Your payment account can accept charges, but payouts are not confirmed as enabled. Check Payment account before selling.";
  } else if (payment?.code === "setup_required") {
    paymentState = "setup_required";
    paymentMessage = "Payments need to be enabled by SONARA before this marketplace can take payments.";
  } else if (payment?.code === "not_connected") {
    paymentState = "action_required";
    paymentMessage = "Connect your payment account to receive money from buyers.";
  } else if (payment?.code === "charges_disabled") {
    paymentState = "action_required";
    paymentMessage = "Your payment account cannot accept charges yet. Review its requirements in Payment account.";
  }
  const checkoutReady = checkout?.ok === true;
  return Object.freeze({
    ok: paymentState === "ready" && checkoutReady,
    steps: Object.freeze([
      Object.freeze({ key: "payments", title: "Payment account", state: paymentState, message: paymentMessage }),
      Object.freeze({
        key: "checkout",
        title: "Buyer checkout",
        state: checkoutReady ? "ready" : "setup_required",
        message: checkoutReady
          ? "Buyers pay on Stripe's checkout, charged directly to your connected account. SONARA takes no commission."
          : "Buyer checkout is not switched on for this platform yet, so a buyer cannot pay. Nothing you list is lost; it becomes buyable when it is."
      }),
      Object.freeze({
        key: "delivery",
        title: "Digital delivery",
        state: "per_listing",
        message: "Putting a listing on sale pins a copy of its file to the version, so a buyer always receives what they paid for. The download opens only after Stripe confirms payment, for that buyer only."
      })
    ])
  });
}

// What a buyer is allowed to do. Chosen from a list rather than typed, because a
// free-text licence is a licence nobody can enforce or compare, and because the
// marketplace page has to be able to say what each one means in one sentence.
const LICENCES = Object.freeze([
  Object.freeze({
    key: "personal_use",
    label: "Personal use",
    means: "The buyer may use it for themselves. No resale, no use in something they sell."
  }),
  Object.freeze({
    key: "commercial_single",
    label: "Commercial, one project",
    means: "The buyer may use it in one thing they sell. Another project needs another licence."
  }),
  Object.freeze({
    key: "commercial_unlimited",
    label: "Commercial, unlimited",
    means: "The buyer may use it in anything they sell, for as long as they like. You keep the copyright."
  }),
  Object.freeze({
    key: "exclusive_transfer",
    label: "Exclusive transfer",
    means: "The buyer gets it exclusively and you stop selling it. This one cannot be undone by taking the listing down."
  })
]);

const LICENCE_KEYS = Object.freeze(LICENCES.map((licence) => licence.key));
const LICENCE_BY_KEY = new Map(LICENCES.map((licence) => [licence.key, licence]));

const LISTING_STATES = Object.freeze(["draft", "listed", "withdrawn", "sold_exclusively"]);

// A listing that may be bought from. `draft` is not one: a draft is somebody
// still deciding, and `withdrawn` and `sold_exclusively` are both deliberate ends.
const BUYABLE_STATES = Object.freeze(["listed"]);

const ATTESTED = Object.freeze({
  yes: "yes",
  no: "no",
  not_recorded: "not_recorded"
});

const NOT_LISTABLE = Object.freeze({
  no_version: "no_version",
  not_publishable: "not_publishable",
  rights_not_attested: "rights_not_attested",
  rights_denied: "rights_denied",
  consent_not_recorded: "consent_not_recorded",
  consent_denied: "consent_denied",
  price_not_set: "price_not_set",
  price_unreadable: "price_unreadable",
  licence_not_chosen: "licence_not_chosen",
  licence_unknown: "licence_unknown",
  currency_mismatch: "currency_mismatch"
});

/**
 * Three states out of an attestation field, never two.
 *
 * `null` and `undefined` and a missing key are all "nobody answered". `false` is
 * somebody answering no. `Boolean(value)` collapses the first into the second,
 * which is the defect this returns three values to prevent.
 */
function attestationOf(value) {
  if (value === true || value === "true") return ATTESTED.yes;
  if (value === false || value === "false") return ATTESTED.no;
  return ATTESTED.not_recorded;
}

/**
 * Does this version involve a real person -- a voice, a face, a likeness?
 *
 * Read from the version's provenance object. Absent means nobody recorded it, and
 * this returns `null` for that rather than `false`: "no person is in this" and
 * "nobody said" are different, and only the first makes the consent question moot.
 */
function involvesAPerson(version) {
  const provenance = version && typeof version.provenance === "object" && version.provenance !== null ? version.provenance : {};
  if (!Object.prototype.hasOwnProperty.call(provenance, "involves_person")) return null;
  const value = attestationOf(provenance.involves_person);
  if (value === ATTESTED.yes) return true;
  if (value === ATTESTED.no) return false;
  return null;
}

/** Whole payment minor units, or null outside the stored amount contract. */
function integerCents(value) {
  return databaseAmount(value);
}

/**
 * May this listing be offered for sale?
 *
 * `{ ok, blockers, reason, ... }`. Every blocker carries a sentence a creator can
 * act on, because "not listable" with no reason is a page somebody has to guess
 * at.
 *
 * The publish blockers come first and come through unchanged. A listing is never
 * cleared when the publish side refuses.
 */
function listingReadiness({ listing, version, approvals, storefrontCurrency } = {}) {
  const blockers = [];

  if (!version || !version.id) {
    return frozen({
      ok: false,
      blockers: [{ id: NOT_LISTABLE.no_version, sentence: "This listing does not point at a version of the work, so there is nothing to sell." }],
      publish: null
    });
  }

  // Composed, not restated. Adding a blocker to publishReadiness adds it here.
  const publish = publishReadiness(version, approvals);
  for (const blocker of publish.blockers) {
    blockers.push({
      id: NOT_LISTABLE.not_publishable,
      from: blocker.id,
      sentence: `${blocker.sentence} It cannot be sold while that is true -- selling is never easier than publishing.`
    });
  }

  const rights = attestationOf(listing?.rights_attested);
  if (rights === ATTESTED.not_recorded) {
    blockers.push({
      id: NOT_LISTABLE.rights_not_attested,
      sentence: "Nobody has recorded whether you hold the rights to sell this. That is not the same as saying no, and it has to be answered before a price goes on it."
    });
  } else if (rights === ATTESTED.no) {
    blockers.push({
      id: NOT_LISTABLE.rights_denied,
      sentence: "The rights to sell this are recorded as not held."
    });
  }

  // Consent is only asked when a person is in it -- and "nobody said whether a
  // person is in it" is itself unanswered, so it asks then too.
  const person = involvesAPerson(version);
  if (person !== false) {
    const consent = attestationOf(listing?.consent_attested);
    if (consent === ATTESTED.not_recorded) {
      blockers.push({
        id: NOT_LISTABLE.consent_not_recorded,
        sentence: person === null
          ? "Nobody has recorded whether a real person's voice, face or likeness is in this, so consent cannot be assumed either way. Answer both before selling it."
          : "A real person's voice, face or likeness is in this and their consent to sell it has not been recorded."
      });
    } else if (consent === ATTESTED.no) {
      blockers.push({
        id: NOT_LISTABLE.consent_denied,
        sentence: "Consent to sell this person's voice, face or likeness is recorded as not given."
      });
    }
  }

  const priceCents = integerCents(listing?.price_cents);
  if (priceCents === null) {
    blockers.push({
      id: NOT_LISTABLE.price_unreadable,
      sentence: "We could not read a price for this. It has not been priced at zero -- it has not been read."
    });
  } else if (priceCents === 0) {
    blockers.push({
      id: NOT_LISTABLE.price_not_set,
      sentence: "No price has been set. A price of nothing and no price at all are stored the same way, so this is not offered until you set one."
    });
  }

  const licenceKey = String(listing?.licence || "");
  if (!licenceKey) {
    blockers.push({
      id: NOT_LISTABLE.licence_not_chosen,
      sentence: "Choose what the buyer may do with it. What they are allowed to do is the thing they are paying for."
    });
  } else if (!LICENCE_BY_KEY.has(licenceKey)) {
    blockers.push({
      id: NOT_LISTABLE.licence_unknown,
      sentence: `"${licenceKey}" is not a licence this marketplace offers, so what a buyer would be getting is unclear.`
    });
  }

  // The currency the storefront takes, against the one the listing names. A
  // mismatch is refused rather than converted: a rate nobody chose is a price
  // nobody agreed.
  const listingCurrency = String(listing?.currency || "").toLowerCase();
  const wanted = String(storefrontCurrency || "").toLowerCase();
  if (listingCurrency && wanted && listingCurrency !== wanted) {
    blockers.push({
      id: NOT_LISTABLE.currency_mismatch,
      sentence: `This is priced in ${listingCurrency.toUpperCase()} and the storefront takes ${wanted.toUpperCase()}. Converting it here would invent a rate nobody agreed.`
    });
  }

  return frozen({
    ok: blockers.length === 0,
    blockers,
    publish,
    rights,
    consentNeeded: person !== false,
    involvesAPerson: person,
    priceCents,
    licence: LICENCE_BY_KEY.get(licenceKey) || null
  });
}

/**
 * What a visitor to the public marketplace may see about one listing.
 *
 * Built by naming the fields rather than by removing them, so a column added to
 * the table later is absent here until somebody decides it belongs. The buyer sees
 * the work, the price and the licence; they never see the creator's attestations,
 * which are the creator's record of their own diligence and not a buyer's business.
 */
function publicListing({ listing, readiness } = {}) {
  if (!listing || !readiness?.ok) return null;
  if (!BUYABLE_STATES.includes(String(listing.state || ""))) return null;
  return Object.freeze({
    id: listing.id,
    title: String(listing.title || "Untitled"),
    medium: String(listing.medium || ""),
    priceCents: readiness.priceCents,
    currency: String(listing.currency || "").toLowerCase(),
    licence: readiness.licence ? { key: readiness.licence.key, label: readiness.licence.label, means: readiness.licence.means } : null,
    // The buyer is told when a machine made it. This is the one attestation that
    // is the buyer's business, because it changes what they are buying.
    //
    // Three states, carried through rather than flattened: `true` means it is
    // declared AI, `false` means declared human, and `null` means nobody recorded
    // it. A boolean here would tell a buyer "not AI" about a work where the
    // question was never answered -- and `listingReadiness` only lets that case
    // through when no machine was involved, so the null is narrow and real.
    aiDisclosed: aiDisclosedFrom(readiness.publish),
    madeByMachine: readiness.publish ? readiness.publish.madeByMachine : null
  });
}

/**
 * The row the public catalogue holds for a listing, or null.
 *
 * Only for a cleared listing: there is no partial entry, and `null` is the answer
 * for anything `listingReadiness` refuses. The keys are exactly the columns of
 * public.creator_marketplace_entries, whose migration asserts that column set --
 * so this function and the table cannot disagree about what a buyer sees without
 * one of the two failing.
 *
 * `price_cents` comes from the readiness result rather than the listing row, so it
 * is the integer the gate actually checked and not whatever string the form left.
 */
function marketplaceEntry({ listing, readiness } = {}) {
  if (!listing || !listing.id || !readiness?.ok) return null;
  return Object.freeze({
    listing_id: listing.id,
    title: String(listing.title || "").trim() || "Untitled",
    medium: String(listing.medium || "").trim() || null,
    price_cents: readiness.priceCents,
    currency: String(listing.currency || "").toLowerCase(),
    licence: readiness.licence.key,
    made_by_machine: Boolean(readiness.publish && readiness.publish.madeByMachine),
    ai_disclosed: aiDisclosedFrom(readiness.publish)
  });
}

/**
 * The one sentence the creator's page shows about a listing.
 *
 * Deliberately not "ready" or "not ready": the first blocker's own sentence, so the
 * page says what to do rather than that something is wrong.
 */
function listingSentence(readiness) {
  if (!readiness) return "This listing could not be read.";
  if (readiness.ok) {
    return "Ready to sell. Checkout is not connected yet, so nobody can pay for it -- everything else about it is set.";
  }
  return readiness.blockers.map((blocker) => blocker.sentence).join(" ");
}

/**
 * Whether a buyer is being told a machine made this: true, false, or null.
 *
 * Reads the approval graph's own DISCLOSURE values. Comparing against a literal
 * was the first draft's bug and it was silent in the worst direction -- a declared
 * AI work shown as not declared.
 */
function aiDisclosedFrom(publish) {
  if (!publish) return null;
  if (publish.disclosure === DISCLOSURE.declared_ai) return true;
  if (publish.disclosure === DISCLOSURE.declared_human) return false;
  return null;
}

function frozen(value) {
  return Object.freeze({ ...value, blockers: Object.freeze(value.blockers || []) });
}

module.exports = {
  purchaseReadiness,
  MARKETPLACE_FEES,
  integerCents,
  LICENCES,
  aiDisclosedFrom,
  marketplaceEntry,
  LICENCE_KEYS,
  LISTING_STATES,
  BUYABLE_STATES,
  ATTESTED,
  NOT_LISTABLE,
  attestationOf,
  involvesAPerson,
  listingReadiness,
  publicListing,
  listingSentence
};
