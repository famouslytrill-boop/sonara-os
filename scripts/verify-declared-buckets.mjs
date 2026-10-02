#!/usr/bin/env node
// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Every storage bucket this application declares must have something that writes
// to it, or a recorded reason why not.
//
// ## The case this was written for
//
// `lib/sonara-ecosystem-manifest.cjs` has declared an `avatars` bucket since the
// manifest existed. `scripts/verify-production-schema.mjs` asserts that bucket is
// present in the live project, and it passed, every release, truthfully.
//
// Nothing in `lib/` or `routes/` ever wrote to it. The bucket existed; profile
// pictures did not. `/account/profile` was a read-only page with no form.
//
// That is this repository's recurring defect in its most convincing form: the
// gate was not broken and its statement was not false. "The avatars bucket
// exists" was true. It simply was not evidence for the thing a reader would take
// it as evidence for, and there was no check for the other half.
//
// So this is the other half. A bucket is declared because a feature needs it; a
// declared bucket nobody writes to is either a feature that was never finished or
// a line in a manifest that should go.
//
// ## Why a writer and not a reader
//
// A bucket with a reader and no writer serves empty results forever. A bucket
// with a writer and no reader stores things nobody looks at, which costs money
// and is visible in a bill. The first failure is silent and the second is not, so
// this looks for the writer.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

let failed = false;
function fail(message) {
  failed = true;
  console.error(`Declared bucket verification failed: ${message}`);
}

const manifestPath = path.join(repoRoot, "lib", "sonara-ecosystem-manifest.cjs");
const manifestSource = fs.readFileSync(manifestPath, "utf8");

// Read the declared list out of the manifest rather than importing it, so a
// manifest that stops exporting the field fails here instead of yielding an
// empty list that this would report as "all accounted for".
const declaredMatch = manifestSource.match(/storageBuckets:\s*\[([^\]]*)\]/);
if (!declaredMatch) {
  fail("lib/sonara-ecosystem-manifest.cjs no longer declares storageBuckets, so there is nothing to check and this check cannot see it.");
  process.exit(1);
}
const declared = [...declaredMatch[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);

// Shape 1. A manifest edited down to an empty array would otherwise pass.
if (declared.length < 5) {
  fail(`only ${declared.length} bucket(s) declared; this check has gone blind. The manifest has carried seven since it was written.`);
}

// Buckets with no writer, each with a reason that was checked rather than
// reasoned to, and each read back against the tree below. A reason that has
// stopped being true is worse than no entry, because it is what the next person
// reads instead of checking -- so an entry naming a bucket that now HAS a writer
// fails here too.
//
// The first draft of this list was three guesses: it said music-stems and
// release-packages and exports were written by edge workers. One of those was
// flatly wrong -- routes/creator-generation-routes.cjs writes music-stems from
// this process -- and the detector was too narrow to notice, which is how a wrong
// reason gets to sit in a passing check. Every line below names the file or the
// absent column that was opened to confirm it.
const NO_WRITER_YET = Object.freeze({
  "business-assets":
    "Nothing in the schema can record a file here. public.business_assets (migration 010) has no storage_path, "
    + "object_path or bucket_id column, checked 3 October 2026, and no other table points into this bucket. "
    + "20260716130000_launch_storage_buckets.sql provisions it ahead of a feature that does not exist.",
  "support-attachments":
    "There is no attachment table. No create table in supabase/migrations/ matches attachment or ticket, "
    + "checked 3 October 2026 -- support messages are rows and nothing accepts a file alongside one.",
  "release-packages":
    "public.creator_release_packages is a plan, not an archive: package_name, release_type, tracklist, "
    + "visual_direction, marketing_angles, checklist, status, and no storage_path, object_path or bucket_id column "
    + "(migration 020, checked 3 October 2026). There is nowhere to record an archive even if one were built.",
  exports:
    "Every export here is built per request and streamed rather than stored. Each sets Content-Disposition and "
    + "sends the bytes in the response: routes/sonara-last9-routes.cjs (accounting exports, invoices, contact "
    + "cards), routes/sonara-shared-result-routes.cjs (invoice PDFs), routes/sonara-creator-project-routes.cjs "
    + "(project JSON/VTT/CSV). Checked 3 October 2026. A streamed export has nothing to put in a bucket."
});

const SOURCE_DIRECTORIES = ["lib", "routes", "scripts"];

function runtimeFiles() {
  const files = [path.join(repoRoot, "server.js")];
  for (const directory of SOURCE_DIRECTORIES) {
    const base = path.join(repoRoot, directory);
    if (!fs.existsSync(base)) continue;
    for (const name of fs.readdirSync(base)) {
      if (!/\.(c?js|mjs)$/.test(name)) continue;
      // The manifest declares the buckets and this script names them to check
      // them; neither is a writer.
      if (name === "sonara-ecosystem-manifest.cjs" || name === "verify-declared-buckets.mjs") continue;
      files.push(path.join(base, name));
    }
  }
  return files;
}

const files = runtimeFiles();
if (files.length < 100) {
  fail(`only ${files.length} source files were read; this check has gone blind.`);
}

/**
 * The files that pass this bucket name to the storage module.
 *
 * Not "the files that mention the name" -- `verify-production-schema.mjs` lists
 * every bucket and writes to none of them, so a mention alone would have reported
 * the avatars bucket as written the whole time nothing uploaded a picture.
 *
 * Two upload shapes count, because this repository has both and the first draft
 * of this check knew only one. `lib/sonara-file-storage.cjs` is the shared way;
 * `routes/creator-generation-routes.cjs` POSTs to `/storage/v1/object/` itself and
 * picks its bucket with a ternary, so a check looking only for `bucket:` or a
 * plain assignment called it unwritten and let a wrong exemption past.
 */
// A bucket counts as written only when its name actually reaches an upload call.
//
// The first version asked two separate questions -- does this file name the
// bucket, and does this file upload anything -- and answered yes to both for a
// file that named the bucket in an unused constant. Deleting the `{ bucket: ... }`
// option from the avatar upload, which is precisely the bug this whole check
// exists to catch, left it green: the name was still in the file and `storage.put`
// was still called, just no longer with each other.
//
// So the name has to be traced to the call. Two shapes, because this repository
// has both:
//
//   bucket: "avatars"                    or  bucket: AVATARS   (identifier)
//   `${url}/storage/v1/object/${bucket}` where bucket came from the literal
//
// `identifiersFor` is what makes the second work: the creator generation route
// picks its bucket with a ternary, so the literal and the interpolation are on
// different lines and only the variable connects them.
function quote(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Variables in this file that hold this bucket's name.
 *
 * Any declaration or assignment whose right-hand side contains the quoted
 * literal, which covers `= "avatars"` and `= x ? "music-stems" : "creator-assets"`
 * alike. Deliberately shallow: it does not follow a name through a function
 * parameter or an object field, so a bucket passed down two levels reads as
 * unwritten and has to be recorded rather than inferred. Under-reporting here
 * fails the build; over-reporting hides a dead bucket.
 */
function identifiersFor(source, bucket) {
  const names = new Set();
  const pattern = new RegExp(`(?:const|let|var)?\\s*([A-Za-z_$][\\w$]*)\\s*=\\s*([^;\\n]*["'\`]${quote(bucket)}["'\`][^;\\n]*)`, "g");
  for (const match of source.matchAll(pattern)) names.add(match[1]);
  return [...names];
}

/** Does this file hand this bucket to an upload? */
function writesTo(source, bucket) {
  const literal = `["'\`]${quote(bucket)}["'\`]`;
  const tokens = [literal, ...identifiersFor(source, bucket).map((name) => quote(name))];
  for (const token of tokens) {
    // The shared storage module's option.
    if (new RegExp(`bucket:\\s*${token}`).test(source)) return true;
    // A direct REST upload, where the name is interpolated into the object path.
    if (new RegExp(`storage\\/v1\\/object\\/(?:sign\\/)?\\$\\{\\s*${token}\\s*\\}`).test(source)) return true;
    if (new RegExp(`storage\\/v1\\/object\\/(?:sign\\/)?${token}`).test(source)) return true;
  }
  return false;
}

function writersOf(bucket) {
  const found = [];
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    if (!source.includes(bucket)) continue;
    if (!writesTo(source, bucket)) continue;
    found.push(path.relative(repoRoot, file));
  }
  return found;
}

const unwritten = [];
let writtenCount = 0;

for (const bucket of declared) {
  const writers = writersOf(bucket);
  const recorded = NO_WRITER_YET[bucket];

  if (writers.length && recorded) {
    fail(
      `${bucket} is recorded as having no writer, and ${writers.join(", ")} writes to it.\n`
      + `    The reason reads "${recorded}"\n`
      + "    Remove the entry from NO_WRITER_YET. A reason that has stopped being true is what the next person reads instead of checking."
    );
    continue;
  }
  if (writers.length) {
    writtenCount += 1;
    continue;
  }
  if (recorded) continue;
  unwritten.push(bucket);
}

if (unwritten.length) {
  fail(
    `${unwritten.join(", ")} declared in lib/sonara-ecosystem-manifest.cjs with nothing writing to ${unwritten.length === 1 ? "it" : "them"}.\n`
    + "    A bucket that exists and has no writer is not a feature. scripts/verify-production-schema.mjs will still\n"
    + "    report it present, which is true and is not evidence that anything uses it -- that pairing is what hid the\n"
    + "    avatars bucket for months while /account/profile had no form on it.\n"
    + "    Either write to it, or record a checked reason in NO_WRITER_YET in this file, or take it out of the manifest."
  );
}

// The detector, tested on input it must reject. Zero unwritten buckets is the
// passing state, so "I found nothing" and "I can no longer see" look identical
// from the outside -- which is the defect this whole file is about.
const FIXTURES = Object.freeze([
  { source: 'const B = "avatars";\nawait storage.put(config, {}, { bucket: B });', bucket: "avatars", shouldMatch: true },
  { source: 'await storage.put(config, {}, { bucket: "avatars" });', bucket: "avatars", shouldMatch: true },
  // The shape the first detector missed, and the reason a wrong exemption sat in
  // a passing check: a ternary choosing the bucket, uploaded by direct REST.
  {
    source: 'const bucket = x ? "music-stems" : "creator-assets";\nawait fetch(`${u}/storage/v1/object/${bucket}/${p}`, { method: "POST" });',
    bucket: "music-stems",
    shouldMatch: true
  },
  // The break that got past the first detector: the name is in the file, the file
  // uploads, and the two are no longer connected. This is the avatars bug exactly.
  {
    source: 'const AVATAR_BUCKET = "avatars";\nawait storage.put(config, { userId }, {});',
    bucket: "avatars",
    shouldMatch: false
  },
  // The shape that made this bug invisible: a file that names every bucket in a
  // list and writes to none of them.
  { source: 'const buckets = ["avatars", "exports"];\nfor (const b of buckets) await check(b);', bucket: "avatars", shouldMatch: false },
  { source: '// the avatars bucket is declared in the manifest', bucket: "avatars", shouldMatch: false }
]);

// The same two functions the scan uses, so the self-test cannot pass while the
// scan reads something different.
function detectsWriter(source, bucket) {
  return writesTo(source, bucket);
}

for (const fixture of FIXTURES) {
  if (detectsWriter(fixture.source, fixture.bucket) !== fixture.shouldMatch) {
    fail(
      `the writer detector ${fixture.shouldMatch ? "no longer finds" : "now fires on"} ${JSON.stringify(fixture.source)}. `
      + "Until that is fixed, finding every bucket accounted for means nothing."
    );
  }
}

if (failed) process.exit(1);

console.log(
  `Declared buckets verified: ${declared.length} declared, ${writtenCount} written from this repository, `
  + `${Object.keys(NO_WRITER_YET).length} with no writer and a checked reason recorded, 0 declared and unaccounted for. `
  + `Read from ${files.length} source files. The detector was tested against ${FIXTURES.length} fixtures, including a file that `
  + "lists every bucket and writes to none -- the shape that hid the avatars bucket while nothing uploaded a picture."
);
