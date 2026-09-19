"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
// The normal repository suite is Mocha. The same dependency-free tests can
// also run in a restricted checkout with node --test.
const { describe, it } = typeof globalThis.describe === "function" ? globalThis : require("node:test");

const root = path.resolve(__dirname, "..");
const script = path.join(root, "scripts/generate-release-evidence.mjs");
const commit = "a".repeat(40);
const paths = [
  "engineering/build.log", "engineering/lint.log",
  "engineering/repository-analysis.json", "engineering/archify-validate.json",
  "engineering/architecture-delta.json", "engineering/sonara-platform.html",
  "engineering/architecture-delta.html", "security/tenant-adversarial.json",
  "security/rls-contract.log", "security/dependency-audit.json", "security/secret-scan.log"
];
const identity = ["--repository", "famouslytrill-boop/sonara-os", "--commit-sha", commit,
  "--ref", "refs/heads/test", "--event-name", "workflow_dispatch", "--run-id", "123", "--run-attempt", "1"];

function run(args) {
  const result = spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: "utf8", timeout: 10000 });
  assert.ifError(result.error);
  assert.equal(result.signal, null, "verifier must exit normally, not hang or crash by signal");
  return result;
}

function withFixture(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sonara-evidence-test-"));
  const source = path.join(dir, "source with spaces");
  const output = path.join(dir, "receipt");
  for (const name of paths) {
    const file = path.join(source, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `fixture only: ${name}\n`);
  }
  const generate = (extra = []) => run(["--source", source, "--output-dir", output, ...identity,
    ...["codeql", "build", "lint", "architecture", "tenant", "rls", "dependency", "secret"]
      .flatMap((name) => [`--${name}-status`, "success"]), ...extra]);
  const manifestPath = path.join(output, "manifest.json");
  try {
    const generated = generate();
    assert.equal(generated.status, 0, generated.stderr);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    assert.equal(manifest.overall, "pass");
    const write = (value = manifest) => fs.writeFileSync(manifestPath, `${JSON.stringify(value)}\n`);
    const verify = (binding = identity) => run(["--check", manifestPath, "--source", source, ...binding]);
    fn({ dir, source, output, manifestPath, manifest, write, verify, generate });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function reject(fixture, pattern = /Release evidence/) {
  const result = fixture.verify();
  assert.notEqual(result.status, 0, "unsafe evidence was accepted");
  assert.match(result.stderr, pattern);
  assert.doesNotMatch(result.stdout, /"ok":true/);
}

function digest(entries) {
  return crypto.createHash("sha256").update(entries.map((item) => `${item.path}:${item.sha256}:${item.bytes}`).sort().join("\n")).digest("hex");
}

describe("release evidence checks real bytes and a complete gate contract", () => {
  it("accepts a generated complete bundle and bound workflow identity", () => withFixture((f) => {
    const result = f.verify();
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).ok, true);
  }));

  const mutations = [
    ["forged pass-only receipt", (m) => { for (const key of Object.keys(m)) delete m[key]; m.overall = "pass"; m.evidenceDigest = "0".repeat(64); }],
    ["unsupported schema", (m) => { m.schemaVersion = 2; }],
    ["missing checks", (m) => { delete m.checks; }],
    ["empty checks", (m) => { m.checks = []; }],
    ["omitted required check", (m) => { m.checks.pop(); }],
    ["duplicate check", (m) => { m.checks[1] = structuredClone(m.checks[0]); }],
    ["unknown check", (m) => { m.checks[0].id = "unchecked"; }],
    ["failed gate hidden by pass summary", (m) => { m.checks[0].status = "failure"; }],
    ["skipped gate hidden by pass summary", (m) => { m.checks[0].status = "skipped"; }],
    ["unknown gate status", (m) => { m.checks[0].status = "unknown"; }],
    ["null gate entry", (m) => { m.checks[0] = null; }],
    ["removed per-gate evidence", (m) => { m.checks[1].artifacts = []; }],
    ["wrong per-gate evidence", (m) => { m.checks[1].artifacts = ["engineering/lint.log"]; }],
    ["duplicate per-gate evidence", (m) => { m.checks[3].artifacts[0] = m.checks[3].artifacts[1]; }],
    ["nonempty failed summary", (m) => { m.failedChecks = ["build"]; }],
    ["missing failed summary", (m) => { delete m.failedChecks; }],
    ["nonempty missing summary", (m) => { m.missingArtifacts = [paths[0]]; }],
    ["missing missing-artifact summary", (m) => { delete m.missingArtifacts; }],
    ["missing artifact records", (m) => { delete m.artifacts; }],
    ["empty artifact records", (m) => { m.artifacts = []; }],
    ["omitted artifact record", (m) => { m.artifacts.pop(); }],
    ["duplicate artifact record", (m) => { m.artifacts[1] = structuredClone(m.artifacts[0]); }],
    ["null artifact record", (m) => { m.artifacts[0] = null; }],
    ["relative path traversal", (m) => { m.artifacts[0].path = "../outside.log"; }],
    ["absolute path", (m) => { m.artifacts[0].path = "/etc/passwd"; }],
    ["false exists claim", (m) => { m.artifacts[0].exists = false; }],
    ["string exists claim", (m) => { m.artifacts[0].exists = "true"; }],
    ["wrong byte count", (m) => { m.artifacts[0].bytes += 1; }],
    ["noninteger byte count", (m) => { m.artifacts[0].bytes = 1.5; }],
    ["zero byte count", (m) => { m.artifacts[0].bytes = 0; }],
    ["malformed file hash", (m) => { m.artifacts[0].sha256 = "invalid"; }],
    ["wrong file hash", (m) => { m.artifacts[0].sha256 = "0".repeat(64); }],
    ["internally consistent but false hashes", (m) => { m.artifacts[0].sha256 = "0".repeat(64); m.evidenceDigest = digest(m.artifacts); }],
    ["malformed aggregate digest", (m) => { m.evidenceDigest = "not-a-digest"; }],
    ["wrong aggregate digest", (m) => { m.evidenceDigest = "0".repeat(64); }],
    ["wrong commit", (m) => { m.commitSha = "b".repeat(40); }],
    ["missing commit", (m) => { delete m.commitSha; }],
    ["abbreviated commit", (m) => { m.commitSha = "abcdef0"; }],
    ["wrong repository", (m) => { m.repository = "someone/else"; }],
    ["wrong workflow run", (m) => { m.runId = "124"; }],
    ["wrong workflow attempt", (m) => { m.runAttempt = "2"; }],
    ["wrong ref", (m) => { m.ref = "refs/heads/untrusted"; }],
    ["wrong event", (m) => { m.eventName = "push"; }],
    ["invalid timestamp", (m) => { m.generatedAt = "not-a-date"; }],
    ["missing run identity", (m) => { m.runId = null; }]
  ];
  for (const [name, mutate] of mutations) {
    it(`rejects ${name}`, () => withFixture((f) => { mutate(f.manifest); f.write(); reject(f); }));
  }

  for (const status of ["failure", "skipped", "unknown", "cancelled", "timed_out"]) {
    it(`rejects a generated ${status} receipt without suppressing its report`, () => withFixture((f) => {
      // Change the existing status argument, rather than relying on duplicate-flag precedence.
      const flags = ["--source", f.source, "--output-dir", f.output, ...identity,
        ...["codeql", "build", "lint", "architecture", "tenant", "rls", "dependency", "secret"]
          .flatMap((name) => [`--${name}-status`, name === "build" ? status : "success"])];
      assert.equal(run(flags).status, 0);
      assert.equal(JSON.parse(fs.readFileSync(f.manifestPath, "utf8")).overall, "fail");
      assert.ok(fs.existsSync(path.join(f.output, "manifest.md")));
      reject(f);
    }));
  }

  it("rejects a file changed after the receipt was generated, even at equal size", () => withFixture((f) => {
    const file = path.join(f.source, paths[0]);
    const bytes = fs.readFileSync(file);
    bytes[0] ^= 1;
    fs.writeFileSync(file, bytes);
    reject(f, /hash|bytes/i);
  }));
  it("rejects a deleted evidence file", () => withFixture((f) => {
    fs.unlinkSync(path.join(f.source, paths[0])); reject(f);
  }));
  it("rejects a directory in place of evidence", () => withFixture((f) => {
    const file = path.join(f.source, paths[0]); fs.unlinkSync(file); fs.mkdirSync(file); reject(f);
  }));
  it("rejects a symlink file even when its bytes match", () => withFixture((f) => {
    const file = path.join(f.source, paths[0]); const outside = path.join(f.dir, "outside.log");
    fs.renameSync(file, outside); fs.symlinkSync(outside, file); reject(f);
  }));
  it("rejects a symlink evidence subdirectory", () => withFixture((f) => {
    const folder = path.join(f.source, "engineering"); const outside = path.join(f.dir, "outside");
    fs.renameSync(folder, outside); fs.symlinkSync(outside, folder, "dir"); reject(f);
  }));
  it("rejects a zero-byte artifact even with recomputed metadata", () => withFixture((f) => {
    fs.writeFileSync(path.join(f.source, paths[0]), "");
    f.manifest.artifacts[0].bytes = 0;
    f.manifest.artifacts[0].sha256 = crypto.createHash("sha256").update("").digest("hex");
    f.manifest.evidenceDigest = digest(f.manifest.artifacts);
    f.write(); reject(f);
  }));
  it("emits a failing report for an empty artifact", () => withFixture((f) => {
    fs.writeFileSync(path.join(f.source, paths[0]), "");
    assert.equal(f.generate().status, 0);
    const manifest = JSON.parse(fs.readFileSync(f.manifestPath, "utf8"));
    assert.equal(manifest.overall, "fail"); assert.ok(manifest.missingArtifacts.includes(paths[0]));
    reject(f);
  }));
  it("accepts reordered checks and artifact entries without weakening exact-set checks", () => withFixture((f) => {
    f.manifest.checks.reverse(); f.manifest.artifacts.reverse(); f.manifest.checks.forEach((c) => c.artifacts.reverse());
    f.write(); assert.equal(f.verify().status, 0);
  }));
  it("rejects malformed JSON", () => withFixture((f) => {
    fs.writeFileSync(f.manifestPath, "{broken"); reject(f, /JSON|SyntaxError/);
  }));
  it("rejects JSON null", () => withFixture((f) => { f.write(null); reject(f); }));
  it("rejects a missing manifest", () => withFixture((f) => { fs.unlinkSync(f.manifestPath); reject(f); }));
});


describe("release evidence CI bindings", () => {
  const workflow = fs.readFileSync(path.join(root, ".github/workflows/engineering-intelligence-security.yml"), "utf8");
  const enforcement = workflow.slice(workflow.indexOf("- name: Enforce release evidence gate"));
  it("runs the integrity tests with the repository's targeted Mocha config", () => {
    assert.ok(workflow.includes("pnpm exec mocha --config .mocharc.targeted.json tests/release-evidence-integrity.test.js"));
  });
  it("binds verification to all six values from the GitHub execution context", () => {
    for (const [flag, variable] of [["repository", "GITHUB_REPOSITORY"], ["commit-sha", "GITHUB_SHA"],
      ["ref", "GITHUB_REF"], ["event-name", "GITHUB_EVENT_NAME"], ["run-id", "GITHUB_RUN_ID"], ["run-attempt", "GITHUB_RUN_ATTEMPT"]]) {
      assert.ok(enforcement.includes(`--${flag} "\${${variable}}"`), `missing independent ${flag} binding`);
    }
    assert.ok(enforcement.includes("--source artifacts"));
  });
  it("retains upload-before-enforcement and fail-closed enforcement", () => {
    assert.ok(workflow.indexOf("- name: Upload release evidence") < workflow.indexOf("- name: Enforce release evidence gate"));
    assert.ok(enforcement.includes("if: always()"));
    assert.ok(!enforcement.includes("continue-on-error: true"));
  });
});
