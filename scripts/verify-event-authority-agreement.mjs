#!/usr/bin/env node
"use strict";

// One decider for "does this need the owner", and a check that keeps it one.
//
// ## The defect this exists because of
//
// `lib/sonara-event-driven-agent-contract.cjs` used to answer that question
// itself, from a frozen list of nine action names:
//
//     function authorityForAction(action) {
//       const normalized = String(action || "").trim().toLowerCase();
//       if (!normalized) return "low_risk";
//       return OWNER_REVIEW_ACTIONS.includes(normalized) ? "owner_review" : "low_risk";
//     }
//
// An allowlist of names that returns `low_risk` for everything else. Meanwhile
// `lib/sonara-agent-authority.cjs` -- the module CLAUDE.md calls "the AGENTS.md
// safety rule as code" -- classifies by pattern and sends anything it does not
// recognise to the owner, because, in its own words, "a classifier that fails
// open fails open exactly when somebody adds a capability, which is the moment
// nobody is reading that file."
//
// Two classifiers, opposite defaults. Measured 18 September 2026, thirteen
// action names that the authority module gates under a NAMED category and the
// event contract called `low_risk`:
//
//   delete_customer_records, purge_audit_log, wipe_bookings, truncate_invoices
//                                                  destructive_data_changes
//   issue_refund_batch, chargeback_reverse          refunds
//   rotate_api_key, grant_role_admin, revoke_role   security_settings
//   change_payout_bank_account                      payout_changes
//   publish_terms_of_service                        legal_or_policy_publishing
//   send_bulk_sms, newsletter_blast                 customer_campaigns
//
// `canDispatch` returns `{ ok: true, reason: "low_risk_authority" }` for a
// `low_risk` event -- no approval required -- so `delete_customer_records` was
// dispatchable unattended. Nothing in production called `canDispatch` yet, which
// is the only reason this was latent rather than live; wiring event consumers is
// the next piece of work and would have made it live.
//
// `authorityForAction` now delegates to the authority module. This check exists
// so it cannot drift back, and so the nine documented names cannot quietly stop
// being gated.
//
// ## A warning worth keeping, because it cost two wrong measurements
//
// `classifyAction` takes a STRING. It normalises with `String()`, so an object
// argument becomes the literal `"[object Object]"`, lands in the `unrecognised`
// category, and returns `requiresOwnerApproval: true`.
//
// That FAILS SAFE, which is exactly what makes it dangerous to a person
// measuring: the first version of this investigation passed
// `{ action_type: name }` and every probe came back `owner_review`, which looked
// like proof of a hole that was not there. The first version of the FIX passed an
// object too, and every action -- including all seven self-serve ones -- came
// back `owner_review`; it looked like a working gate and would have sent every
// draft to the owner. Both were caught by comparing against the seven actions
// that must stay unattended, which is why this check asserts that direction too.

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const contract = require("../lib/sonara-event-driven-agent-contract.cjs");
const authority = require("../lib/sonara-agent-authority.cjs");

const { authorityForAction, OWNER_REVIEW_ACTIONS, createAgentEvent, canDispatch, EVENT_TOPICS } = contract;
const { classifyAction, SENSITIVE_CATEGORIES, SELF_SERVE_ACTIONS } = authority;

// Probe names per sensitive category. Not the category's own regex source --
// generating names from a pattern would test the pattern against itself. These
// are names a capability could plausibly be given, and each is asserted to land
// in the category it is filed under, so a pattern that stops matching is a
// failure rather than a silently weaker probe.
const PROBES = Object.freeze({
  refunds: ["issue_refund_batch", "chargeback_reverse", "reverse_payment"],
  payout_changes: ["change_payout_bank_account", "update_bank_details", "transfer_funds"],
  legal_or_policy_publishing: ["publish_terms_of_service", "publish_privacy_policy", "legal_page_update"],
  customer_campaigns: ["send_bulk_sms", "newsletter_blast", "broadcast_offer"],
  proof_or_review_publishing: ["publish_review", "publish_testimonial", "social_proof_widget"],
  security_settings: ["rotate_api_key", "grant_role_admin", "revoke_role", "change_security_settings"],
  destructive_data_changes: ["delete_customer_records", "purge_audit_log", "wipe_bookings", "truncate_invoices"]
});

// Names nothing should recognise. The default has to be owner review.
const UNRECOGNISED = Object.freeze([
  "an_action_nobody_has_classified",
  "frobnicate_widget",
  "zzz_unknown_capability_2026"
]);

const problems = [];

// --- blindness floors -------------------------------------------------------
//
// Every one of these would otherwise let the check pass by measuring nothing.
if (!Array.isArray(OWNER_REVIEW_ACTIONS) || OWNER_REVIEW_ACTIONS.length < 5) {
  problems.push(
    `OWNER_REVIEW_ACTIONS has ${OWNER_REVIEW_ACTIONS?.length ?? 0} entries; it had 9 on 18 September 2026.\n`
    + "    With an empty list this check would assert nothing about documented consequential actions."
  );
}
if (!Array.isArray(SELF_SERVE_ACTIONS) || SELF_SERVE_ACTIONS.length < 5) {
  problems.push(
    `SELF_SERVE_ACTIONS has ${SELF_SERVE_ACTIONS?.length ?? 0} entries; it had 7 on 18 September 2026.\n`
    + "    Without them the over-gating direction goes unchecked, and over-gating is how a fix for this\n"
    + "    defect sends every draft to the owner while looking like a working gate."
  );
}
if (!Array.isArray(SENSITIVE_CATEGORIES) || SENSITIVE_CATEGORIES.length < 7) {
  problems.push(
    `SENSITIVE_CATEGORIES has ${SENSITIVE_CATEGORIES?.length ?? 0} entries; AGENTS.md names seven.\n`
    + "    A shrunken list means fewer things are gated at all, which is a bigger finding than this check's own."
  );
}

const categoryNames = new Set((SENSITIVE_CATEGORIES || []).map((entry) => entry.category));
const probeCategories = Object.keys(PROBES);

// Every category the authority module declares must have probes here, or this
// check silently stops covering whatever was added.
const uncovered = [...categoryNames].filter((name) => !probeCategories.includes(name));
if (uncovered.length) {
  problems.push(
    `These sensitive categories have no probe in this check:\n      ${uncovered.join(", ")}\n`
    + "    Add at least one plausible action name per category to PROBES. A category with no probe is a\n"
    + "    category this agreement check does not actually verify."
  );
}
const stale = probeCategories.filter((name) => !categoryNames.has(name));
if (stale.length) {
  problems.push(
    `These probe categories no longer exist in the authority module:\n      ${stale.join(", ")}\n`
    + "    Remove or rename them. A probe filed under a category that is gone is not testing what it says."
  );
}

// --- the invariant: the contract must never be laxer than the authority -----
const failOpen = [];
const misfiled = [];
let probeCount = 0;

for (const [category, names] of Object.entries(PROBES)) {
  for (const name of names) {
    probeCount += 1;
    const classification = classifyAction(name);

    // The probe must actually land where it is filed. Otherwise a pattern could
    // stop matching and this check would carry on "passing" on probes that are
    // only gated by the unrecognised default -- true, but not what is claimed.
    if (classification.category !== category) {
      misfiled.push(`${name}: filed under ${category}, classified as ${classification.category}`);
    }
    if (!classification.requiresOwnerApproval) {
      misfiled.push(`${name}: the authority module does not gate it, so it is the wrong probe for ${category}`);
      continue;
    }
    if (authorityForAction(name) !== "owner_review") {
      failOpen.push(`${name} (${classification.category})`);
    }
  }
}

if (misfiled.length) {
  problems.push(
    "These probes do not measure what they claim:\n"
    + misfiled.map((line) => `      ${line}`).join("\n")
    + "\n    Fix the probe or the pattern. A probe gated only by the unrecognised default proves nothing\n"
    + "    about the category it is filed under."
  );
}

if (failOpen.length) {
  problems.push(
    "The event contract calls these low_risk while the authority module gates them:\n"
    + failOpen.map((line) => `      ${line}`).join("\n")
    + "\n\n    canDispatch lets a low_risk event through with no owner approval, so each of these is an\n"
    + "    action an agent could take unattended. AGENTS.md: \"Unknown sensitive actions default to\n"
    + "    owner review.\" authorityForAction must delegate to lib/sonara-agent-authority.cjs rather\n"
    + "    than keep a list of its own."
  );
}

// --- the other direction: the seven unattended actions stay unattended ------
const overGated = (SELF_SERVE_ACTIONS || [])
  .map((entry) => entry.action)
  .filter((name) => authorityForAction(name) !== "low_risk");

if (overGated.length) {
  problems.push(
    "These actions may run unattended, and the event contract now sends them to the owner:\n"
    + overGated.map((name) => `      ${name}`).join("\n")
    + "\n\n    CLAUDE.md: \"Seven named actions may run unattended.\" A fix that gates everything is not a\n"
    + "    fix; it looks like a working gate while making the product ask permission to write a draft.\n"
    + "    The usual cause is passing an object to classifyAction, which stringifies to\n"
    + "    \"[object Object]\" and lands in the unrecognised category."
  );
}

// --- the documented nine must still be gated --------------------------------
const undocumented = (OWNER_REVIEW_ACTIONS || []).filter((name) => !classifyAction(name).requiresOwnerApproval);
if (undocumented.length) {
  problems.push(
    "These are documented as consequential in the event contract and the authority module does not gate them:\n"
    + undocumented.map((name) => `      ${name}`).join("\n")
    + "\n\n    Either the authority module lost a pattern or the list names something that is not real.\n"
    + "    Both matter: this list is what a reader believes about what needs approval."
  );
}

// --- the default, which is the whole argument -------------------------------
const laxDefault = UNRECOGNISED.filter((name) => authorityForAction(name) !== "owner_review");
if (laxDefault.length) {
  problems.push(
    "The event contract does not fail closed on an action it does not recognise:\n"
    + laxDefault.map((name) => `      ${name} -> ${authorityForAction(name)}`).join("\n")
    + "\n\n    This is the defect itself, not a variant of it."
  );
}

// --- and the behaviour, not just the classification -------------------------
//
// The assertions above are about a string. This one runs the real dispatch gate,
// because the classification only matters through canDispatch.
try {
  const event = createAgentEvent({
    organizationId: "org_agreement_probe",
    actorId: "user_agreement_probe",
    producer: "verify-event-authority-agreement",
    topic: EVENT_TOPICS.RESULTS,
    kind: "agent.work.completed",
    action: "delete_customer_records",
    payload: {}
  });
  const decision = canDispatch(event);
  if (event.authority !== "owner_review" || decision.ok !== false) {
    problems.push(
      "A destructive action still dispatches without owner approval:\n"
      + `      authority: ${event.authority}\n`
      + `      canDispatch: ${JSON.stringify(decision)}\n`
      + "    Everything above can be satisfied by a string comparison; this is the behaviour that matters."
    );
  }
} catch (error) {
  problems.push(`Could not build the dispatch probe event: ${error && error.message}`);
}

if (problems.length) {
  console.error(`Event authority agreement failed on ${problems.length} point(s).\n`);
  console.error(problems.map((problem) => `  - ${problem}`).join("\n\n"));
  process.exit(1);
}

console.log(
  `Event authority agreement verified: ${probeCount} probe(s) across ${probeCategories.length} sensitive categories, `
  + `${OWNER_REVIEW_ACTIONS.length} documented consequential action(s), ${SELF_SERVE_ACTIONS.length} unattended action(s), `
  + `and ${UNRECOGNISED.length} unrecognised name(s) -- the event contract is never laxer than lib/sonara-agent-authority.cjs, `
  + "and never stricter about the actions that may run unattended."
);
