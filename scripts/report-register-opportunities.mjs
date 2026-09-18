#!/usr/bin/env node
"use strict";

// 237 reviews, 9 adapters. What is left that we are allowed to build?
//
// `data/open-source-tools.ts` is the most expensive artefact in this
// repository that nothing reads for planning. Every record cost somebody a
// clone, a LICENSE read and a written decision, and the register answers
// "may we use this?" perfectly well -- but nobody has ever asked it the next
// question, which is "what have we learned and not used?"
//
// Measured 18 September 2026:
//
//     integrationStatus            commercialUseStatus
//     ---------------------        --------------------------
//      90  reference_only          120  allowed_after_review
//      50  blocked                  61  blocked_until_review
//      41  research_only            44  needs_review
//      29  optional_adapter…         6  allowed
//      14  needs_license_review      6  blocked (three spellings)
//       9  adapter_built
//       4  needs_security_review
//
// **9 of 237.** The other 228 are research that produced no implementation,
// which is mostly correct -- 50 are blocked outright, 35 carry a critical
// licence risk, 31 are reciprocal and this is a hosted product. The register
// earning its keep looks like refusal far more often than adoption.
//
// The interesting slice is narrow and specific: records already reviewed to
// `optional_adapter_after_review`, on a low licence risk, non-reciprocal, and
// commercially permitted. Those are ideas somebody has already decided SONARA
// *may* build on and has not.
//
// ## This is a report, not a gate
//
// It is deliberately not in `verify:launch` and cannot fail a release. There is
// no correct number of unbuilt opportunities, so a gate over this would either
// never fire or would pressure somebody into adopting a dependency to make a
// check go green -- which is the opposite of what the register is for.
//
// ## What it does not do
//
// It does not recommend installing anything. `.claude/skills/reviewing-an-outside-repository`
// is explicit that "the useful outcome of research is often a SONARA-owned
// implementation of an idea rather than another dependency", and this
// application has one production dependency for reasons the client-secret scan,
// the audit gate and the reciprocal-licence check all depend on. Every row below
// is a **problem somebody solved that we could solve ourselves**, with the
// licence noted so the boundary is visible.

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const REGISTER = "data/open-source-tools.ts";

// Measured 18 September 2026. A floor, because parsing this file by locating a
// literal is exactly the kind of reader that silently returns nothing -- the
// first version of this script found the `[]` inside the type annotation
// `OpenSourceToolRecord[]`, depth-matched an empty array, and printed tidy
// tables of zero without erroring.
const MINIMUM_RECORDS = 150;

function readRegister() {
  const source = fs.readFileSync(path.join(root, REGISTER), "utf8");
  // Anchored past the type annotation on purpose. See MINIMUM_RECORDS.
  const declaration = source.match(/export const openSourceTools\s*:\s*OpenSourceToolRecord\[\]\s*=\s*/);
  if (!declaration) {
    throw new Error(`could not find the openSourceTools declaration in ${REGISTER}`);
  }
  const open = declaration.index + declaration[0].length;
  if (source[open] !== "[") {
    throw new Error(`expected an array literal at offset ${open} of ${REGISTER}, found ${JSON.stringify(source.slice(open, open + 24))}`);
  }
  let depth = 0;
  let end = -1;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "[") depth += 1;
    if (source[i] === "]") {
      depth -= 1;
      if (depth === 0) { end = i + 1; break; }
    }
  }
  if (end < 0) throw new Error(`the openSourceTools array literal in ${REGISTER} is unterminated`);
  const records = new Function(`return ${source.slice(open, end)};`)();
  if (!Array.isArray(records) || records.length < MINIMUM_RECORDS) {
    throw new Error(
      `parsed only ${Array.isArray(records) ? records.length : 0} records from ${REGISTER}, below the ${MINIMUM_RECORDS} `
      + "present on 18 September 2026. Refusing to report on a register this reader has stopped reading."
    );
  }
  return records;
}

function tally(records, key) {
  const counts = new Map();
  for (const record of records) {
    const value = record[key] ?? "(unset)";
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

const records = readRegister();

const built = records.filter((record) => record.integrationStatus === "adapter_built");

// Reviewed as permissible, cheap on licence risk, and not reciprocal -- this is
// a hosted product, which is the case a reciprocal licence is written for.
const permittedUnbuilt = records.filter((record) =>
  record.integrationStatus === "optional_adapter_after_review"
  && record.licenseRisk === "low"
  && record.reciprocalLicense === false
  && (record.commercialUseStatus === "allowed" || record.commercialUseStatus === "allowed_after_review"));

console.log(`Open-source register: ${records.length} records in ${REGISTER}.\n`);

for (const key of ["integrationStatus", "commercialUseStatus", "licenseRisk"]) {
  console.log(`  ${key}`);
  for (const [value, count] of tally(records, key)) {
    console.log(`    ${String(count).padStart(4)}  ${value}`);
  }
  console.log();
}

const reciprocal = records.filter((record) => record.reciprocalLicense === true).length;
console.log(`  ${reciprocal} record(s) carry a reciprocal licence, which triggers on network use and is therefore the case this hosted product is.\n`);

console.log(`Adapters built: ${built.length} of ${records.length}.`);
for (const record of built) {
  console.log(`    ${record.name} -- ${(record.productFit || []).join(", ") || "(no product recorded)"}`);
}

console.log(`\nReviewed as permissible, low licence risk, non-reciprocal, and still unbuilt: ${permittedUnbuilt.length}.`);
console.log("Each is a problem somebody else solved. Building it here means owning an implementation, not taking a dependency.\n");

const byProduct = new Map();
for (const record of permittedUnbuilt) {
  for (const product of (record.productFit || ["(no product recorded)"])) {
    if (!byProduct.has(product)) byProduct.set(product, []);
    byProduct.get(product).push(record);
  }
}

for (const [product, list] of [...byProduct.entries()].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`  ${product} (${list.length})`);
  for (const record of list) {
    const licence = String(record.license || "").split(/[,.]/)[0].slice(0, 26);
    const use = (record.useCase || [])[0] || "";
    console.log(`    ${record.name.slice(0, 30).padEnd(31)} ${licence.padEnd(27)} ${use.slice(0, 64)}`);
  }
  console.log();
}

console.log(
  "This is a report and fails nothing. There is no correct number of unbuilt opportunities, and a gate over one "
  + "would only pressure somebody into adopting a dependency to turn a check green."
);
