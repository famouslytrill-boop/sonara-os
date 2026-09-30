// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// The files the deployed runtime can reach, with one definition.
//
// Three release gates built this list themselves with a flat `readdirSync` over
// `lib/` and `routes/`, so none of them could see `lib/catalog/` -- four product
// catalogue modules one directory down. Each then printed its own total as though
// it were the runtime: `verify:request-tenant-ids` said 304 files,
// `verify:filter-encoding` said 303, and `verify:tenant-queries` and
// `typecheck`, which do walk recursively, said 307. Three numbers for one
// population, all phrased as fact.
//
// It is not hypothetical and it is not new. The comment in
// scripts/verify-customer-ready-production-experience.mjs records this as "the
// fourth time a check scoped to server.js went partially blind because code moved
// one directory over", and that gate walks recursively for exactly that reason.
//
// Proven before this module existed: a file placed in `lib/catalog/` reading
// `req.body.organizationId` -- an unregistered request-supplied tenant id, which
// is the one thing verify:request-tenant-ids exists to catch -- left that gate
// exiting 0 with byte-identical output. It did not see the file.
//
// So the walk lives here, once. A gate that asks this module for its population
// cannot quietly stop covering a directory somebody adds, and two gates that ask
// for the same population cannot disagree about what it is.
//
// ## Why this takes options rather than returning one list
//
// The three callers genuinely differ, and flattening that would be its own lie.
// verify:request-tenant-ids reads `api/` because a request handler could live
// there; verify:filter-encoding does not, because `api/index.js` is a five-line
// re-export of server.js with no query in it; verify:supabase-contract reads only
// `.cjs` because that is what the runtime modules are. What must not differ is
// whether a subdirectory is seen.

const fs = require("node:fs");
const path = require("node:path");

// Measured 30 September 2026 by calling this module: the recursive walk over lib,
// routes and api plus server.js finds 309 files; over lib and routes with .cjs and
// .js, 308; over routes and lib with .cjs alone, 307. Each count includes this
// file, which lives in lib/ -- the flat walks these replace reported 304, 303 and
// a .cjs-only total, and the difference is lib/catalog/ plus this module.
//
// The floor sits below all three and far above zero, so a broken walk cannot pass
// by measuring nothing -- shape 1 in .claude/skills/checks-that-cannot-lie.
const MINIMUM_RUNTIME_FILES = 250;

const DEFAULT_EXTENSIONS = [".cjs", ".mjs", ".js"];

function walk(absolute, root, extensions, found) {
  let entries;
  try {
    entries = fs.readdirSync(absolute, { withFileTypes: true });
  } catch {
    // A directory that is not there is not an error here: a caller may name one
    // that only exists in some checkouts. An absent directory contributing
    // nothing is caught by the floor rather than by throwing.
    return found;
  }
  for (const entry of entries) {
    const full = path.join(absolute, entry.name);
    if (entry.isDirectory()) {
      walk(full, root, extensions, found);
      continue;
    }
    if (!extensions.some((extension) => entry.name.endsWith(extension))) continue;
    found.push(path.relative(root, full));
  }
  return found;
}

// Repository-relative paths, sorted, so two callers with the same options get the
// same list in the same order and a diff of their output is meaningful.
function runtimeSourceFiles({ root, directories, extensions = DEFAULT_EXTENSIONS, files = ["server.js"] } = {}) {
  if (!root) throw new TypeError("runtimeSourceFiles requires root");
  if (!Array.isArray(directories) || directories.length === 0) {
    throw new TypeError("runtimeSourceFiles requires at least one directory; an empty population is what this module exists to prevent");
  }
  const found = [];
  for (const name of files) {
    if (fs.existsSync(path.join(root, name))) found.push(name);
  }
  for (const directory of directories) {
    walk(path.join(root, directory), root, extensions, found);
  }
  return found.sort();
}

// The sentence a caller prints when the walk has gone blind, or null when it has
// not. Returned rather than thrown so each gate keeps its own exit path.
function blindnessReason(found, minimum = MINIMUM_RUNTIME_FILES) {
  if (found.length >= minimum) return null;
  return `only ${found.length} runtime files found, against a floor of ${minimum}. `
    + "This check has gone blind -- the walk is broken or a directory moved -- and a clean result here would mean nothing.";
}

module.exports = { runtimeSourceFiles, blindnessReason, MINIMUM_RUNTIME_FILES, DEFAULT_EXTENSIONS };
