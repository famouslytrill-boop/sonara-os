"use strict";

// Whether replacing the authentication provider is still a week of work.
//
// docs/architecture/DATABASES-AND-AUTHENTICATION.md says the coupling to
// Supabase Auth is four HTTP endpoints in a small number of files, and that the
// database coupling is an order of magnitude larger. That is the finding the
// whole document turns on, and a document is where a measurement goes to rot: it
// was true on 19 August 2026 and nothing stops the fifth endpoint appearing in
// the twelfth file next week, with the document still saying four and two.
//
// So the property is asserted here instead. Not as an equality -- a check that
// fails on every legitimate change gets its number bumped without being read,
// which is a check nobody is running. As a ceiling, which only fails when the
// claim stops being true.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const SEARCHED = ["lib", "routes", "api"];

function sourceFiles() {
  const found = [];
  const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === "archive") continue;
        walk(full);
      } else if (/\.(cjs|js)$/.test(entry.name)) {
        found.push(full);
      }
    }
  };
  for (const directory of SEARCHED) walk(path.join(ROOT, directory));
  found.push(path.join(ROOT, "server.js"));
  return found;
}

// A path named inside a comment is a path discussed, not a path called. Same
// reasoning as scripts/report-orphan-tables.mjs.
function withoutComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

// Measured 19 August 2026: 2 files, 4 endpoints. The ceilings leave room for a
// change that is genuinely needed and fail on a drift nobody decided to make.
const MAX_FILES_TOUCHING_AUTH = 4;
const KNOWN_AUTH_ENDPOINTS = ["user", "token", "signup", "recover"];
const MAX_AUTH_ENDPOINTS = 6;

describe("the authentication surface stays small enough to replace", () => {
  const files = sourceFiles().map((file) => ({ file: path.relative(ROOT, file), source: withoutComments(fs.readFileSync(file, "utf8")) }));

  it("has files to look at, so nothing below passes over an empty list", () => {
    assert.ok(files.length > 100, `only ${files.length} source files were found; this check has gone blind`);
    assert.ok(
      files.some((entry) => entry.file === "server.js"),
      "server.js was not searched, and it is the largest file that could hold a call"
    );
  });

  it("keeps the calls to the identity provider in a handful of files", () => {
    const touching = files.filter((entry) => entry.source.includes("auth/v1/")).map((entry) => entry.file);
    assert.ok(touching.length > 0, "nothing calls the identity provider at all, so this check is measuring nothing");
    assert.ok(
      touching.length <= MAX_FILES_TOUCHING_AUTH,
      `${touching.length} files now call the identity provider directly:\n  ${touching.join("\n  ")}\n`
        + "docs/architecture/DATABASES-AND-AUTHENTICATION.md prices replacing it on the basis that this is a small number. "
        + "Either put the call behind lib/sonara-customer-auth.cjs, or raise this ceiling and update that document's table in the same change."
    );
  });

  it("uses only the endpoints the migration note was priced against", () => {
    const used = new Set();
    for (const entry of files) {
      for (const match of entry.source.matchAll(/auth\/v1\/([a-z_]+)/g)) used.add(match[1]);
    }
    assert.ok(used.size > 0, "no endpoint was found, so the set below is empty and proves nothing");
    const unexpected = [...used].filter((endpoint) => !KNOWN_AUTH_ENDPOINTS.includes(endpoint));
    assert.deepEqual(
      unexpected,
      [],
      `these identity endpoints are called and are not in the migration note: ${unexpected.join(", ")}. `
        + "Add them to KNOWN_AUTH_ENDPOINTS here and to the table in docs/architecture/DATABASES-AND-AUTHENTICATION.md, "
        + "so the cost of moving provider is still an honest figure."
    );
    assert.ok(used.size <= MAX_AUTH_ENDPOINTS, `${used.size} identity endpoints are in use`);
  });

  it("still depends on PostgREST rather than on anything Supabase-specific", () => {
    // The other half of the finding, and the more valuable half: the exit from
    // Supabase is "run PostgREST against some other Postgres", which only holds
    // while the reads are plain PostgREST requests. A Supabase-only path would
    // close that exit quietly.
    const dataFiles = files.filter((entry) => entry.source.includes("rest/v1/"));
    assert.ok(dataFiles.length > 10, `only ${dataFiles.length} files read through PostgREST; this check has gone blind`);
    assert.ok(
      dataFiles.length > MAX_FILES_TOUCHING_AUTH,
      "the data surface is no longer larger than the auth surface, which is the asymmetry the migration note is built on"
    );
  });

  it("keeps the one production dependency the migration note assumes", () => {
    // Better Auth and every other TypeScript identity library is ruled out in
    // that document on the grounds that this repository has no build step. If
    // that stops being true the recommendation changes, and this is what says so.
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
    assert.deepEqual(
      Object.keys(manifest.dependencies || {}),
      ["express"],
      "a second production dependency appeared; the migration note rules out library-based auth on the basis that there is one"
    );
  });
});
