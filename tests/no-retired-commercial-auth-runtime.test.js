"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const RUNTIME_PATHS = [
  "server.js",
  "lib",
  "routes"
];

const archive = fs.readFileSync(path.join(ROOT, "docs", "archive", "legacy-names.md"), "utf8");
const retiredBlock = /<!-- BEGIN RETIRED_RUNTIME_IDENTIFIERS -->\s*```text\s*([\s\S]*?)```\s*<!-- END RETIRED_RUNTIME_IDENTIFIERS -->/.exec(archive);
assert.ok(retiredBlock, "legacy archive is missing the retired runtime identifier ledger");
const RETIRED = retiredBlock[1].split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
assert.ok(RETIRED.length >= 15, `only ${RETIRED.length} retired identifiers are archived; runtime scan has gone blind`);


function runtimeFiles(entry) {
  const absolute = path.join(ROOT, entry);
  const stat = fs.statSync(absolute);
  if (stat.isFile()) return [absolute];
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((item) => {
    const relative = path.join(entry, item.name);
    if (item.isDirectory()) return runtimeFiles(relative);
    return /\.(?:c?js|mjs)$/.test(item.name) ? [path.join(ROOT, relative)] : [];
  });
}

describe("retired commercial and Google compatibility is absent from runtime", () => {
  const files = RUNTIME_PATHS.flatMap(runtimeFiles);
  assert.ok(files.length > 40, `only ${files.length} runtime files found; legacy scan has gone blind`);

  for (const retired of RETIRED) {
    it(`does not recognize retired identifier ${retired}`, () => {
      const hits = files
        .filter((file) => fs.readFileSync(file, "utf8").includes(retired))
        .map((file) => path.relative(ROOT, file));
      assert.deepEqual(hits, [], `${retired} is still recognized by executable runtime: ${hits.join(", ")}`);
    });
  }

  it("has no deferred Google OAuth runtime state", () => {
    const offenders = files.filter((file) => {
      const source = fs.readFileSync(file, "utf8");
      return /google(?:OAuth|SignIn)[\s\S]{0,80}deferred|Google OAuth is deferred|OAuth deferred/i.test(source);
    }).map((file) => path.relative(ROOT, file));
    assert.deepEqual(offenders, [], `Google OAuth is still deferred in runtime: ${offenders.join(", ")}`);
  });
});
