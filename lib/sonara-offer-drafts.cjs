"use strict";

const { fieldLabel } = require("./sonara-plain-language.cjs");

// An offer draft, and the one thing "required" did not mean.
//
// Both offer forms -- /business-builder/offers/free and
// /creator-studio/offers/free -- ask for deliverables and mark the field
// required. requireFields tested that the submitted string was not blank:
//
//     fields.filter((field) => !String(body[field] || "").trim())
//
// and the builders then split that string on commas and dropped the empty
// pieces. So ", , ," passed the required check and produced `deliverables: []`.
// A draft was saved, the page said the offer was recorded, and the offer listed
// nothing at all -- a required field satisfied by measuring nothing, which is
// the shape this repository keeps finding.
//
// splitList is the reason the two disagree, so the emptiness check lives beside
// it rather than in the caller. A field declared as a list is required to yield
// at least one item, not merely to arrive non-blank.

function splitList(value) {
  return String(value === undefined || value === null ? "" : value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

// Which declared list fields came in carrying separators and nothing else.
// Returns [] when every one of them has something in it, so the caller can
// treat it exactly like requireFields' missing list.
function listFieldsWithNothingIn(body, fields) {
  const source = body && typeof body === "object" ? body : {};
  return (Array.isArray(fields) ? fields : []).filter((field) => splitList(source[field]).length === 0);
}

// The sentence a customer reads. Named per field, because "invalid input" tells
// somebody who typed "a, b" and somebody who typed ", ," the same thing.
//
// Through fieldLabel, so the prose says "Deliverables" rather than the raw key.
// sendValidationFailure carries a comment about exactly this: customers were
// once shown "Please complete: productKey, serviceName." The JSON body still
// carries the raw names, which is what a client keys off.
function emptyListMessage(fields) {
  const labels = (Array.isArray(fields) ? fields : []).map(fieldLabel).filter(Boolean);
  if (!labels.length) return "";
  const label = labels.length === 1 ? labels[0] : `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
  return `Separate each item with a comma. ${label} came through with separators and nothing between them, so the offer would list nothing.`;
}

function buildBusinessOffer(input) {
  const source = input && typeof input === "object" ? input : {};
  return {
    headline: `${source.serviceType} for ${source.audience}`,
    pricePosition: String(source.priceIdea),
    deliverables: splitList(source.deliverables),
    proofPoints: splitList(source.proofPoints || ""),
    buyerNextAction: "Submit an intake request and schedule owner review.",
    caution: "Validate scope, refund terms, and payment readiness before selling."
  };
}

function buildCreatorOffer(input) {
  const source = input && typeof input === "object" ? input : {};
  return {
    offerType: String(source.offerType),
    audience: String(source.audience),
    deliverables: splitList(source.deliverables),
    pricePosition: String(source.priceIdea),
    rightsReminder: "Confirm ownership, license terms, and platform rules before monetization.",
    buyerNextAction: "Review catalog details and support requirements."
  };
}

// The list fields each form declares required, so a check has one place to read
// them from rather than restating the two handlers.
const OFFER_LIST_FIELDS = Object.freeze({
  business_builder: Object.freeze(["deliverables"]),
  creator_studio: Object.freeze(["deliverables"])
});

module.exports = {
  splitList,
  listFieldsWithNothingIn,
  emptyListMessage,
  buildBusinessOffer,
  buildCreatorOffer,
  OFFER_LIST_FIELDS
};
