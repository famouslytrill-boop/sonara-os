#!/usr/bin/env node
// A reciprocal licence may not reach this product's runtime by default.
//
// `data/open-source-tools.ts` has carried a required `reciprocalLicense`
// boolean since the register was built, with a careful comment explaining why
// it is a stated field rather than a substring search. **Thirty-one records set
// it, and until now nothing read it except a figure check.**
// `scripts/verify-doc-counts.mjs` asserts that the number printed in the docs
// equals the number in the register. That is a true statement about two numbers
// and says nothing about whether any of those thirty-one may be adopted.
//
// So the register recorded the fact, the documentation quoted the count, and no
// gate connected either to a decision. Every one of the thirty-one is currently
// at `reference_only`, `research_only` or `blocked` -- the rule was being
// followed by hand, which is exactly the state where nobody notices it stopping.
//
// ## What this asserts
//
// A record with `reciprocalLicense: true` must carry an integration status that
// keeps its source out of what customers are served, **or** a written ruling
// here naming the record and the reason.
//
// ## Why a ruling exists at all, rather than a flat ban
//
// Because the flat ban would be overclaiming. Whether a reciprocal licence
// reaches a hosted product depends on how the code is reached: a separate
// process the owner runs, spoken to over a network boundary, is a different
// question from source compiled into this repository, and the answer is
// genuinely contested rather than obvious. `AGENTS.md` and `CLAUDE.md` both
// require that this not happen by assumption, in either direction.
//
// So the default is deny and the exception is written down. That is the same
// shape as `scripts/report-orphan-tables.mjs`, and like that one this list is
// **two-sided**: it fails when an unaccounted record appears, and it fails when
// a ruling here no longer describes anything. A ruling whose reason has expired
// is worse than no ruling, because it is what the next person reads instead of
// checking -- the fifth shape in `.claude/skills/checks-that-cannot-lie`.
//
// ## What this deliberately does not do
//
// It does not read the licence text to decide whether a licence is reciprocal.
// The field is stated for a reason the register spells out: a licence field
// once contained prose naming four reciprocal licences in the course of saying
// the repository was in none of them, and a substring match counted it. This
// check trusts the stated field and checks what was done with it.
//
// It also does not read the rule out of `CLAUDE.md`. That file's statement of
// it was rewritten on 13 September 2026 in commit 86d5a5f -- from naming the
// licences and their network-use trigger to a general instruction to review
// conditions before adopting -- inside a commit about screenshot research. A
// gate that derives its rule from prose is a gate that loosens when the prose
// does, silently, and this repository has fixed that shape several times.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { readOpenSourceTools, registryIntegrity } = require(path.join(root, "lib", "sonara-open-source-registry.cjs"));

// Every integration status, split into the ones that keep a repository's source
// out of what customers are served and the ones that do not.
//
// The two lists are written here and **checked against the type union** below,
// in both directions. That matters more than it looks: a new status added to
// `OpenSourceIntegrationStatus` and not classified here would otherwise fall
// into whichever branch the code happens to take, and for a default-deny gate
// that is the difference between a new status being refused and being waved
// through. Failing until somebody classifies it is the only reading that cannot
// be wrong by accident.
//
// `adapter_built` says an adapter exists in this repository and something calls
// it. `optional_adapter_after_review` says one may be built. Both put the
// question in front of a person, which is the point.
const CONTAINING_STATUSES = Object.freeze(["reference_only", "research_only", "blocked", "needs_license_review", "needs_security_review"]);
const ADOPTION_STATUSES = Object.freeze(["adapter_built", "optional_adapter_after_review"]);

// Rulings, keyed by slug. Empty, and that is the current true state.
//
// An entry means: this repository carries a reciprocal licence, it has an
// adoption status, and somebody wrote down why that is allowed. The reason has
// to name the boundary -- what runs where -- not merely assert that it was
// reviewed.
const RULED = Object.freeze({});

function fail(lines) {
  for (const line of lines) console.error(line);
  process.exit(1);
}

// The union, read out of the register's own type declaration with comments
// stripped first. They were not stripped in the first version of the same read
// in scripts/verify-open-source-registry.mjs, and a semicolon inside a comment
// terminated the non-greedy match, reporting every status but the first two as
// invalid.
const registerSource = fs.readFileSync(path.join(root, "data", "open-source-tools.ts"), "utf8");
const unionBlock = registerSource.replace(/^\s*\/\/.*$/gm, "").match(/export type OpenSourceIntegrationStatus =([\s\S]*?);/);
const DECLARED_STATUSES = unionBlock ? [...unionBlock[1].matchAll(/\|\s*"([a-z_]+)"/g)].map((match) => match[1]) : [];

if (DECLARED_STATUSES.length < 5) {
  fail([
    `ERROR: only ${DECLARED_STATUSES.length} integration statuses read from the type union; this check has gone blind.`,
    "It classifies every declared status into contained or adoption, and it cannot do that over a union it could not parse."
  ]);
}

{
  const classified = new Set([...CONTAINING_STATUSES, ...ADOPTION_STATUSES]);
  const unclassified = DECLARED_STATUSES.filter((status) => !classified.has(status));
  if (unclassified.length) {
    fail([
      `ERROR: integration status(es) ${unclassified.join(", ")} are declared in data/open-source-tools.ts and classified nowhere in this file.`,
      "Add each to CONTAINING_STATUSES or ADOPTION_STATUSES. A default-deny gate that does not know which side a new status falls on is a gate that waves it through."
    ]);
  }
  const invented = [...classified].filter((status) => !DECLARED_STATUSES.includes(status));
  if (invented.length) {
    fail([
      `ERROR: this file classifies ${invented.join(", ")}, which the type union does not declare.`,
      "A status that no record can hold is a rule about nothing, and it reads like a rule about something."
    ]);
  }
}

const integrity = registryIntegrity();
if (!integrity.ok) {
  fail([
    `ERROR: data/open-source-tools.ts opens ${integrity.candidates} records and only ${integrity.parsed} can be read.`,
    "This check cannot rule on records it cannot see, and reporting on the readable ones would be a pass over an unknown remainder."
  ]);
}

const records = readOpenSourceTools();

// Shape one: a check satisfied by measuring nothing. If the parser stops
// matching, or the field stops being read, every assertion below passes over an
// empty set and prints a confident zero.
if (records.length < 100) {
  fail([
    `ERROR: only ${records.length} register records parsed; this check has gone blind.`,
    "It rules on reciprocal-licensed records, and it cannot do that over a register it cannot read."
  ]);
}

const unrecorded = records.filter((record) => record.reciprocalLicense === null);
if (unrecorded.length) {
  fail([
    `ERROR: ${unrecorded.length} register record(s) do not state reciprocalLicense: ${unrecorded.map((r) => r.slug || r.name).join(", ")}.`,
    "The field is required. An absent answer is not `false` -- it is a record this check could not rule on, and treating it as permissive is the one mistake the field exists to stop."
  ]);
}

const reciprocal = records.filter((record) => record.reciprocalLicense === true);

// The same shape again, one level down. A register full of records with the
// flag silently stuck at false would leave this list empty and everything
// below it green.
if (reciprocal.length === 0) {
  fail([
    "ERROR: no register record carries reciprocalLicense: true.",
    "The register has held reciprocal-licensed repositories since it was built, so an empty set means the field or the reader stopped working rather than that the licences changed.",
    "If a reciprocal record has genuinely been the last one removed, lower the floor in this check and say which record it was."
  ]);
}

const errors = [];

for (const record of reciprocal) {
  const slug = record.slug || record.name;
  if (CONTAINING_STATUSES.includes(record.integrationStatus)) continue;

  const ruling = RULED[slug];
  if (!ruling) {
    errors.push(
      `${slug} carries a reciprocal licence (${record.license || "licence not recorded"}) and integrationStatus "${record.integrationStatus}".\n` +
        `    That status puts its source inside what customers are served. Either change the status to one of ${CONTAINING_STATUSES.join(", ")},\n` +
        "    or add a ruling to RULED in this file naming what runs where and why the licence does not reach this product's source."
    );
  }
}

// The other side. A ruling for a record that no longer needs one is a reason
// nobody will recheck, sitting where the next person reads it.
for (const [slug, reason] of Object.entries(RULED)) {
  const record = reciprocal.find((entry) => (entry.slug || entry.name) === slug);
  if (!record) {
    errors.push(`RULED names ${slug}, which is not a reciprocal-licensed record on the register. Remove the ruling rather than leaving a reason that describes nothing.`);
    continue;
  }
  if (CONTAINING_STATUSES.includes(record.integrationStatus)) {
    errors.push(`RULED names ${slug}, whose status is now "${record.integrationStatus}" and needs no ruling. Remove it.`);
  }
  if (!String(reason || "").trim()) {
    errors.push(`RULED names ${slug} with an empty reason, which reads as a decision and is not one.`);
  }
}

if (errors.length) {
  fail(["ERROR: reciprocal-licence containment failed.", ...errors.map((line) => `  - ${line}`)]);
}

const spread = {};
for (const record of reciprocal) spread[record.integrationStatus] = (spread[record.integrationStatus] || 0) + 1;
const printed = Object.entries(spread)
  .sort((a, b) => b[1] - a[1])
  .map(([status, count]) => `${status} ${count}`)
  .join(", ");

console.log(
  `Reciprocal-licence containment verified: ${reciprocal.length} of ${records.length} register records carry a reciprocal licence, ` +
    `each at a status that keeps its source out of what customers are served -- ${printed}. ` +
    `${Object.keys(RULED).length} written ruling(s). ` +
    "This says nothing about whether a licence was read correctly; it says every record that states one has had the adoption question answered."
);
