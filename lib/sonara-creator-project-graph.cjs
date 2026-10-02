// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// The Creator Studio chain, read as a graph: brief -> asset -> version ->
// approval -> may this be published.
//
// ## The three things this module exists to refuse
//
// **1. An approval must belong to one version, not to the asset.**
// Approving "the asset" approves whatever it becomes next, which is the hole an
// approval workflow exists to close. A version 2 approval leaves version 3
// unapproved here, and `publishReadiness` says so by name.
//
// **2. An absent disclosure is not "no".**
// `lib/sonara-generation-provenance.cjs` already makes this argument for
// rights_attested and consent_attested: "a job that never asked is not a job
// that was answered no". The same three states apply to whether something is
// AI-generated -- yes / no / not recorded -- and the third is the honest answer
// far more often than either of the others. A publisher handed `false` when the
// truth is "nobody recorded it" has been told a definite thing about provenance
// on the strength of a question nobody asked.
//
// **3. A version whose provenance says `generated` and whose disclosure is
// absent must not be publishable.**
// This is the one a naive reading loses, and it is the sharpest case in the file.
// The two facts live in different columns -- `source`/`provenance.generated`
// describes how the file was made, `ai_disclosure` records what the customer
// said about it -- and the combination "we know it was generated and nobody
// recorded a disclosure" is exactly when publishing is least safe and most
// likely to look fine. AGENTS.md: "Enforce provenance, consent, and anti-clone
// safety."
//
// ## What it does not do
//
// It writes nothing and publishes nothing. `creator_export_packages` already
// exists and nothing writes it; this module deliberately does not become a
// second home for that. What it provides is the answer an export would need:
// which version, approved by whom, and what its disclosure says.

const VERSION_SOURCES = Object.freeze(["uploaded", "generated", "edited", "imported"]);

// Sources that mean a machine made or altered the file. `edited` is here because
// a human change to a generated file is still generated work, and a two-state
// read of "was this AI" loses exactly that case.
const MACHINE_SOURCES = Object.freeze(["generated", "edited"]);

const APPROVAL_STATES = Object.freeze(["review_requested", "approved", "rejected", "withdrawn"]);
const BRIEF_STATUSES = Object.freeze(["open", "in_progress", "delivered", "closed"]);
const BRIEF_INTENTS = Object.freeze(["original", "adaptation", "commission", "campaign"]);

const DISCLOSURE = Object.freeze({
  declared_ai: "declared_ai",
  declared_human: "declared_human",
  not_recorded: "not_recorded"
});

const TITLE_MAX = 200;
const NOTE_MAX = 2000;

function finiteInteger(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

// The next version number for an asset. An unreadable list is NOT version 1: a
// failed read that produced 1 would overwrite the history it could not see, and
// the unique constraint on (asset_id, version_number) would refuse the insert --
// which is the right outcome, reached by accident. Say it deliberately instead.
function nextVersionNumber(versions) {
  if (!Array.isArray(versions)) {
    return { ok: false, next: null, reason: "The versions of this asset could not be read, so the next number is unknown." };
  }
  let highest = 0;
  for (const version of versions) {
    const number = finiteInteger(version && version.versionNumber);
    if (number === null) {
      return { ok: false, next: null, reason: "One version carries no readable number, so numbering the next one would guess." };
    }
    if (number > highest) highest = number;
  }
  return { ok: true, next: highest + 1, reason: highest ? `The latest version is ${highest}.` : "This is the first version." };
}

// yes / no / not recorded, from the column the customer answers in. `provenance`
// is NOT consulted to fill a missing answer: it says how the file was made, which
// is a different question from what was declared about it, and using one to stand
// in for the other is how a disclosure nobody made starts reading as one that was.
function disclosureOf(version) {
  const declared = version && version.aiDisclosure;
  if (declared === true) return DISCLOSURE.declared_ai;
  if (declared === false) return DISCLOSURE.declared_human;
  return DISCLOSURE.not_recorded;
}

// Whether the row itself says a machine made or altered this version. Read from
// `source` and from the provenance the generation pipeline already writes.
function madeByMachine(version) {
  const source = String((version && version.source) || "").trim().toLowerCase();
  if (MACHINE_SOURCES.includes(source)) return true;
  const provenance = version && typeof version.provenance === "object" && version.provenance ? version.provenance : {};
  return provenance.generated === true;
}

// The decision standing on one version. Rows are ordered by when they were
// decided, falling back to when they were created, and the latest one wins --
// including a `review_requested` that arrives after an approval, which puts the
// version back under review rather than leaving it cleared.
//
// That last clause is the one worth stating, because the comment here said the
// opposite until tests/an-unanswered-disclosure-is-not-a-no.test.js asserted it
// and failed. Somebody asking for another review after an approval is a person
// saying they are no longer sure, and the safe reading of that is "under review",
// not "still cleared to publish". The ordinary flow is unaffected: a review
// request created before the approval that answers it still loses to it, because
// the approval's decided_at is later.
//
// A list this cannot read is reported, never treated as "no approval yet" -- those
// are different, and only one of them is safe to show as "waiting for review".
function approvalStateOf(approvals) {
  if (!Array.isArray(approvals)) {
    return { ok: false, state: null, reason: "The approvals for this version could not be read." };
  }
  const decided = approvals
    .filter((approval) => APPROVAL_STATES.includes(String((approval && approval.state) || "")))
    .slice()
    .sort((left, right) => String(left.decidedAt || left.createdAt || "").localeCompare(String(right.decidedAt || right.createdAt || "")));

  if (!decided.length) return { ok: true, state: "none", reason: "Nobody has been asked to review this version." };
  const latest = decided[decided.length - 1];
  return { ok: true, state: latest.state, reason: `The latest decision on this version is ${latest.state}.`, decidedBy: latest.decidedBy || null };
}

// May this version be exported or published?
//
// Both conditions, and both are refusals rather than warnings. The second is the
// one that matters: a generated version with no recorded disclosure is the case
// where publishing looks fine and is not.
function publishReadiness(version, approvals) {
  const blockers = [];
  const approval = approvalStateOf(approvals);
  const disclosure = disclosureOf(version);
  const machine = madeByMachine(version);

  if (!approval.ok) {
    blockers.push({ id: "approval_unreadable", sentence: "Whether this version was approved could not be read, so it is not cleared to publish." });
  } else if (approval.state !== "approved") {
    blockers.push({
      id: "not_approved",
      sentence: approval.state === "none"
        ? "This version has not been sent for review."
        : `This version is ${approval.state}, not approved.`
    });
  }

  if (machine && disclosure === DISCLOSURE.not_recorded) {
    blockers.push({
      id: "disclosure_not_recorded",
      sentence: "This version was made or altered by a machine and nobody has recorded whether it is disclosed as AI-generated. That has to be answered before it goes out."
    });
  }

  return Object.freeze({
    ok: blockers.length === 0,
    approval: approval.state,
    disclosure,
    madeByMachine: machine,
    blockers: Object.freeze(blockers),
    reason: blockers.length
      ? blockers.map((blocker) => blocker.sentence).join(" ")
      : "Approved, and its disclosure is recorded."
  });
}

// The graph for one brief: its assets, each asset's versions newest first, and the
// readiness of the newest version. `{ ok, rows }` throughout, so a failed read is
// never rendered as an empty brief.
function graphForBrief({ brief, assets, versionsByAsset, approvalsByVersion } = {}) {
  if (!brief || !brief.id) return { ok: false, reason: "No brief was given." };
  if (!Array.isArray(assets)) return { ok: false, reason: "The assets on this brief could not be read." };

  const nodes = assets.map((asset) => {
    const versions = Array.isArray(versionsByAsset?.[asset.id]) ? versionsByAsset[asset.id].slice() : null;
    if (!versions) {
      return { asset, versions: [], latest: null, readiness: null, unreadable: true };
    }
    versions.sort((left, right) => (finiteInteger(right.versionNumber) || 0) - (finiteInteger(left.versionNumber) || 0));
    const latest = versions[0] || null;
    return {
      asset,
      versions,
      latest,
      readiness: latest ? publishReadiness(latest, approvalsByVersion?.[latest.id] || []) : null,
      unreadable: false
    };
  });

  const publishable = nodes.filter((node) => node.readiness && node.readiness.ok).length;
  return Object.freeze({
    ok: true,
    brief,
    nodes: Object.freeze(nodes),
    publishable,
    // Counted separately, because "nothing is ready" and "we could not tell" are
    // different sentences to put in front of a creator.
    unreadable: nodes.filter((node) => node.unreadable).length
  });
}

function problemSentence(code) {
  return Object.freeze({
    title_missing: "A brief needs a title.",
    title_long: `A brief title has to be ${TITLE_MAX} characters or fewer.`,
    intent_unknown: "That is not an intent this understands.",
    status_unknown: "That is not a status this understands.",
    asset_missing: "That asset could not be found in this workspace.",
    version_missing: "That version could not be found in this workspace.",
    source_unknown: "That is not a way a version can have been made.",
    note_long: `A note has to be ${NOTE_MAX} characters or fewer.`,
    nothing_to_decide: "There is nothing waiting for a decision on that version."
  })[code] || null;
}

function normalizeBrief(input = {}) {
  const problems = [];
  const title = String(input.title ?? "").trim();
  if (!title) problems.push("title_missing");
  else if (title.length > TITLE_MAX) problems.push("title_long");

  const intent = String(input.intent ?? "original").trim().toLowerCase() || "original";
  if (!BRIEF_INTENTS.includes(intent)) problems.push("intent_unknown");

  const status = String(input.status ?? "open").trim().toLowerCase() || "open";
  if (!BRIEF_STATUSES.includes(status)) problems.push("status_unknown");

  const summary = String(input.summary ?? "").trim();
  if (summary.length > NOTE_MAX) problems.push("note_long");

  if (problems.length) return { ok: false, problems: Object.freeze(problems) };
  return {
    ok: true,
    brief: Object.freeze({ title, summary: summary || null, intent, status })
  };
}

module.exports = {
  VERSION_SOURCES,
  MACHINE_SOURCES,
  APPROVAL_STATES,
  BRIEF_STATUSES,
  BRIEF_INTENTS,
  DISCLOSURE,
  TITLE_MAX,
  NOTE_MAX,
  nextVersionNumber,
  disclosureOf,
  madeByMachine,
  approvalStateOf,
  publishReadiness,
  graphForBrief,
  normalizeBrief,
  problemSentence
};
