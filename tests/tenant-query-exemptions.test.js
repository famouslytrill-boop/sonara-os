"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");

const repository = path.resolve(__dirname, "..");
const profileFile = "routes/sonara-creator-profile-routes.cjs";
const original = fs.readFileSync(path.join(repository, profileFile), "utf8");

// Run mutations in a disposable runtime-source copy. Never edit the working
// route file, whose contents another test or agent may be using concurrently.
function audit(mutator) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "sonara-query-exemptions-"));
  try {
    for (const name of ["lib", "routes", "api"]) {
      fs.cpSync(path.join(repository, name), path.join(directory, name), { recursive: true });
    }
    fs.copyFileSync(path.join(repository, "server.js"), path.join(directory, "server.js"));
    const changed = mutator(original);
    fs.writeFileSync(path.join(directory, profileFile), changed);
    // Evaluate the real scanner with its three imports supplied explicitly.
    // This keeps the regression independent of subprocess permissions and
    // intercepts exit without terminating the Mocha process.
    const scanner = fs.readFileSync(path.join(repository, "scripts/report-tenant-scoped-queries.mjs"), "utf8")
      .replace(/^import .*;$/gm, "")
      .replace("const require = createRequire(import.meta.url);", "");
    const result = { status: 0, stdout: "", stderr: "" };
    const stopped = {};
    try {
      vm.runInNewContext(scanner, {
        fs, path,
        require: (name) => require(path.resolve(repository, "scripts", name)),
        process: { cwd: () => directory, exit: (status) => { result.status = status; throw stopped; } },
        console: {
          log: (value) => { result.stdout += String(value) + "\n"; },
          error: (value) => { result.stderr += String(value) + "\n"; }
        }
      }, { timeout: 20000, filename: "report-tenant-scoped-queries.mjs" });
    } catch (error) {
      if (error !== stopped) throw error;
    }
    return result;
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

function assertRejected(mutator, expected) {
  const result = audit(mutator);
  assert.ifError(result.error);
  assert.notEqual(result.status, 0, "a broken substitute tenant scope must fail the gate");
  assert.match(result.stdout + result.stderr, expected);
}

describe("tenant query exemptions retain each independent justification", function () {
  this.timeout(30000);

  it("accepts the unchanged runtime population", () => {
    const result = audit((source) => source);
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stdout + result.stderr);
  });

  it("rejects a follower filter removed while the active public lookup survives", () => {
    assertRejected((source) => {
      assert.equal(source.split("&id=in.(").length - 1, 1);
      const changed = source.replace(/&id=in\.\([^\n]*`,/, "`,");
      assert.notEqual(changed, source, "mutation must remove the follower filter");
      assert.ok(!changed.includes("&id=in.("));
      return changed;
    }, /id=in\.\(/);
  });

  it("rejects a removed follower lookup rather than borrowing the public exemption", () => {
    assertRejected((source) => {
      const changed = source.replace(/profiles = await rest\([\s\S]*?\n      \);/, "profiles = { ok: true, rows: [] };");
      assert.notEqual(changed, source, "mutation must remove the follower lookup");
      assert.ok(!changed.includes("&id=in.("));
      return changed;
    }, /no call in this run matched it while carrying id=in\.\(/);
  });

  it("rejects removing active status while the follower exemption survives", () => {
    assertRejected((source) => {
      assert.ok(source.includes("&status=eq.active"));
      return source.replaceAll("&status=eq.active", "");
    }, /no call in this run matched it while carrying status=eq\.active/);
  });
});
