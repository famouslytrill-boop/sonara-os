"use strict";

// What this product says about its own legal pages, and why it is a statement
// rather than a task.
//
// /readiness reported `legalPages: review_required`, which rendered as
// "Legal pages: Review required" beside genuinely closable items like
// "Payment connection: Missing". It read as a setup step somebody had not got
// to. It was not one. A qualified legal review is a decision about engaging
// counsel -- a business decision with a cost, made outside this repository --
// and nothing anybody does to this code can close it. docs/SHIP_READINESS.md
// had already reached that conclusion and removed the item from the owner's
// list for exactly this reason; the readiness surface had not caught up.
//
// The position that is true and complete: the pages are published, and every
// one of them says it is not legal advice. That is a disclaimer. It has no
// next step, so it is not reported as though it has one.
//
// What must not happen, stated as plainly as the rule it protects: nothing
// here may claim a review that has not taken place. Dropping "review required"
// and asserting "reviewed" are different acts, and only the first is what this
// is. `legalReviewBoundary: not_attorney_reviewed` stays exactly as it is, and
// tests/server.test.js still refuses any page that claims attorney review.

// The sentence every legal page carries. Exported so the page and the status
// derived from it cannot disagree -- the previous arrangement had the status as
// a literal in one file and the sentence as a literal in another, which is two
// copies of one fact and the shape every drift in this codebase has taken.
const LEGAL_DISCLAIMER =
  "These terms are not legal advice. They remain subject to applicable law and future revision. Questions about them can be sent through the contact route.";

// The two claims the status depends on, checked against the sentence rather
// than assumed from it. If somebody rewrites the disclaimer into something that
// no longer says these, the status stops being published_with_disclaimer.
const DISCLAIMER_MARKERS = Object.freeze(["not legal advice", "subject to applicable law"]);

function carriesDisclaimer(body) {
  const text = String(body || "").toLowerCase();
  return DISCLAIMER_MARKERS.every((marker) => text.includes(marker));
}

// What /readiness reports for `legalPages`, given the pages that exist.
//
// Takes the page list rather than a count and a sentence, because the caller
// having to remember to pass the right sentence is the second copy of a fact
// all over again. Every legal page is rendered by one function with one shared
// body, so the sentence is LEGAL_DISCLAIMER by construction -- and this asserts
// that construction still holds rather than assuming it.
//
// Three answers, and the third is the one worth having. no_legal_pages is not
// the same as a missing disclaimer, and neither is the same as the finished
// state. A check over an empty list returns "every page carries it" -- vacuously
// true, and exactly the failure this codebase keeps finding -- so an empty list
// is its own answer rather than a pass.
function legalPagesStatus(pages) {
  const list = Array.isArray(pages) ? pages : [];
  if (!list.length) return "no_legal_pages";
  return carriesDisclaimer(LEGAL_DISCLAIMER) ? "published_with_disclaimer" : "disclaimer_missing";
}

module.exports = { LEGAL_DISCLAIMER, DISCLAIMER_MARKERS, carriesDisclaimer, legalPagesStatus };
