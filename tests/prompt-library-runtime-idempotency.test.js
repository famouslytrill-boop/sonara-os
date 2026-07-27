"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.join(__dirname, "..");

function count(source, value) {
  return source.split(value).length - 1;
}

describe("Prompt Library runtime preparation", () => {
  it("preserves extended Supabase verifier paths across repeated runtime passes", function() {
    this.timeout(15000);

    for (let pass = 0; pass < 2; pass += 1) {
      execFileSync(process.execPath, ["scripts/prepare-prompt-library-runtime.cjs"], {
        cwd: root,
        stdio: "pipe"
      });
    }

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
  });
});
