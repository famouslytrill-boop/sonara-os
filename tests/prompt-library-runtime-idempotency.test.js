"use strict";

// The Supabase contract verifier must list each migration exactly once.
//
// This test used to prove that by running the code generators twice and
// checking nothing was duplicated -- the generators appended migration paths to
// scripts/verify-supabase-contract.mjs, and a non-idempotent one would add a
// second copy every pass, which the verifier would then check twice while
// looking like it had grown more thorough.
//
// The generators are retired. scripts/verify-supabase-contract.mjs is ordinary
// hand-maintained code now, so the duplicate can only arrive by someone typing
// it. The check is still worth keeping and is now direct: read the file and
// count.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");

function count(source, value) {
  return source.split(value).length - 1;
}

describe("Prompt Library runtime preparation", () => {
  it("names every migration exactly once in the Supabase contract verifier", () => {
    const verifier = fs.readFileSync(path.join(root, "scripts", "verify-supabase-contract.mjs"), "utf8");
    const match = verifier.match(/const contractSql = \[([^\]]+)\]/);
    assert.ok(match, "Supabase verifier contractSql array is missing");

    for (const required of [
      "contractMigrationPath",
      "referenceContractExtensionPath",
      "productLifecycleMigrationPath",
      "marketIntelligenceMigrationPath",
      "promptLibraryMigrationPath",
      "promptLibrarySecurityMigrationPath"
    ]) {
      assert.equal(count(match[1], required), 1, `${required} must appear exactly once in contractSql`);
    }

    assert.match(verifier, /const promptLibrarySql = \[promptLibraryMigrationPath, promptLibrarySecurityMigrationPath\]/);
    assert.match(verifier, /\.replace\(\/\\s\+\/g, " "\)\.trim\(\)/);
  });
});
