// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// What act does a reciprocal licence trigger on, and when should we refuse to
// say?
//
// This lives in `lib/` rather than inside the report because two places state
// the answer and they disagreed. `scripts/report-register-opportunities.mjs`
// classified the register into network / distribution / unknown, and
// `scripts/generate-handoff-prompt.mjs` wrote "Twenty of the thirty-one
// reciprocal records are the first kind" as a literal -- in the very commit
// that fixed the report, while the report said eighteen. Codex found it on
// PR #299. A number typed into the document that teaches other assistants
// about licences, in the change whose subject was licence misclassification.
//
// So the classification has one implementation and the handoff derives its
// sentence from it.
//
// ## Why three buckets
//
// AGPL, SSPL and OSL reach *providing the software over a network*, which is
// what a hosted product does. GPL and LGPL trigger on distribution; MPL is
// per-file. And some records carry a licence that belongs to neither set --
// Directus's `MSCL-1.0-GPL (Monospace Sustainable Core License 1.0)`, whose own
// register note says "It is a licence written this year whose abbreviation
// carries GPL, and it is not OSI open source. Nothing should be built on it
// from a summary." Putting that under a definitive heading because a pattern
// missed is building on a summary, so it goes to `unknown`, which is a
// statement that somebody has to read the record.
//
// None of this is legal advice and none of it replaces the record's own
// `notes`, which say what was opened and when. It is a count.

const NETWORK_FAMILIES = new Set(["AGPL-1.0", "AGPL-3.0", "AGPL", "SSPL-1.0", "SSPL", "OSL-3.0", "OSL"]);

const DISTRIBUTION_FAMILIES = new Set([
  "GPL-2.0", "GPL-3.0", "GPL-3.0-or-later", "GPL-2.0-or-later", "GPL",
  "LGPL-2.1", "LGPL-3.0", "LGPL",
  "MPL-2.0", "MPL", "EPL-2.0", "EPL", "MS-RL"
]);

// The identifier is what sits before the prose. Split on a comma, a semicolon,
// an opening bracket, or a full stop FOLLOWED BY WHITESPACE -- never on a bare
// period, because `GPL-3.0` and `MSCL-1.0-GPL` contain their own.
//
// Splitting on every period is what the first version did, and it printed
// `GPL-3.0` as `GPL-3`, `LGPL-3.0` as `LGPL-3` and `MSCL-1.0-GPL` as `MSCL-1`.
// An operator reading the report could not tell which licence or which version
// a row meant, in the one report whose subject is exactly that.
function licenceIdentifier(record) {
  const raw = String((record && record.license) || "").trim();
  const prose = raw.split(/[,;(]|\.\s/)[0] || "";
  return prose.trim().replace(/\.+$/, "");
}

function licenceTrigger(record) {
  const identifier = licenceIdentifier(record);
  if (NETWORK_FAMILIES.has(identifier)) return "network";
  if (DISTRIBUTION_FAMILIES.has(identifier)) return "distribution";
  return "unknown";
}

// The whole summary in one shape, so a caller cannot take the total from here
// and a bucket count from somewhere else.
function summariseReciprocal(records) {
  const reciprocal = (records || []).filter((record) => record && record.reciprocalLicense === true);
  const buckets = { network: [], distribution: [], unknown: [] };
  for (const record of reciprocal) buckets[licenceTrigger(record)].push(record);
  return {
    total: reciprocal.length,
    network: buckets.network,
    distribution: buckets.distribution,
    unknown: buckets.unknown
  };
}

module.exports = {
  licenceIdentifier,
  licenceTrigger,
  summariseReciprocal,
  NETWORK_FAMILIES,
  DISTRIBUTION_FAMILIES
};
