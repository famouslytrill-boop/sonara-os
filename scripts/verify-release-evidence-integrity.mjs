#!/usr/bin/env node
// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
//
// This check deliberately follows the existing release evidence generator.
// A 64-character hash STRING is not proof that the bytes still match that hash.
// It verifies the existing eight gate names, required evidence population,
// actual artifact bytes, canonical digest, and the exact CI commit. It does not
// certify a provider, merchant transaction, security posture, or owner approval.

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const EXPECTED = Object.freeze({
  codeql: [],
  build: ["engineering/build.log"],
  lint: ["engineering/lint.log"],
  architecture: [
    "engineering/repository-analysis.json",
    "engineering/archify-validate.json",
    "engineering/architecture-delta.json",
    "engineering/sonara-platform.html",
    "engineering/architecture-delta.html"
  ],
  tenant_adversarial: ["security/tenant-adversarial.json"],
  rls: ["security/rls-contract.log"],
  dependencies: ["security/dependency-audit.json"],
  secrets: ["security/secret-scan.log"]
});
const SHA256 = /^[a-f0-9]{64}$/;
const COMMIT = /^[a-f0-9]{40}$/;

function requireCondition(condition, message) {
  if (!condition) throw new Error("Release evidence integrity failed: " + message);
}

function expectedArtifacts() {
  return Object.values(EXPECTED).flat();
}

function digest(records) {
  const canonical = records
    .map((item) => item.path + ":" + item.sha256 + ":" + item.bytes)
    .sort()
    .join("\n");
  return crypto.createHash("sha256").update(canonical).digest("hex");
}

function safeArtifactPath(base, name) {
  requireCondition(typeof name === "string" && name.length > 0, "an artifact has no path");
  requireCondition(
    !path.isAbsolute(name) && !name.includes("\\") &&
    !name.includes("\0") && !name.includes(":") &&
    name.split("/").every((segment) => segment !== "" && segment !== "." && segment !== ".."),
    "unsafe artifact path: " + name
  );
  const resolved = path.resolve(base, name);
  const relative = path.relative(base, resolved);
  requireCondition(relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative),
    "artifact escaped the evidence root: " + name);
  const realBase = fs.realpathSync(base);
  const realFile = fs.realpathSync(resolved);
  const actualRelative = path.relative(realBase, realFile);
  requireCondition(actualRelative !== "" && !actualRelative.startsWith("..") && !path.isAbsolute(actualRelative),
    "artifact symlink escaped the evidence root: " + name);
  requireCondition(fs.statSync(realFile).isFile(), "artifact is not a file: " + name);
  return realFile;
}

function validate(manifestPath, sourceRoot, expectedCommit) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  requireCondition(manifest.schemaVersion === 1, "unsupported manifest schema version");
  requireCondition(manifest.overall === "pass", "manifest does not report pass");
  requireCondition(COMMIT.test(manifest.commitSha || ""), "manifest lacks a full Git commit SHA");
  if (expectedCommit) {
    requireCondition(COMMIT.test(expectedCommit), "expected CI commit is malformed");
    requireCondition(manifest.commitSha === expectedCommit, "manifest belongs to a different commit");
  }
  requireCondition(Array.isArray(manifest.failedChecks) && manifest.failedChecks.length === 0,
    "manifest lists failed checks");
  requireCondition(Array.isArray(manifest.missingArtifacts) && manifest.missingArtifacts.length === 0,
    "manifest lists missing artifacts");
  requireCondition(Array.isArray(manifest.checks) &&
    manifest.checks.length === Object.keys(EXPECTED).length, "unexpected number of release gates");

  const seenChecks = new Set();
  for (const check of manifest.checks) {
    requireCondition(check && Object.hasOwn(EXPECTED, check.id), "unknown release gate");
    requireCondition(!seenChecks.has(check.id), "duplicate release gate: " + check.id);
    seenChecks.add(check.id);
    requireCondition(check.status === "success", "release gate did not succeed: " + check.id);
    requireCondition(Array.isArray(check.artifacts) &&
      JSON.stringify(check.artifacts) === JSON.stringify(EXPECTED[check.id]),
    "changed evidence requirements for release gate: " + check.id);
  }

  const expected = expectedArtifacts();
  requireCondition(expected.length >= 10, "evidence population is unexpectedly empty");
  requireCondition(Array.isArray(manifest.artifacts) && manifest.artifacts.length === expected.length,
    "unexpected number of evidence artifacts");

  const byPath = new Map();
  for (const artifact of manifest.artifacts) {
    requireCondition(artifact && typeof artifact.path === "string", "malformed artifact");
    requireCondition(!byPath.has(artifact.path), "duplicate artifact: " + artifact.path);
    byPath.set(artifact.path, artifact);
  }

  for (const name of expected) {
    const entry = byPath.get(name);
    requireCondition(entry !== undefined, "required artifact missing from manifest: " + name);
    requireCondition(entry.exists === true, "required artifact is marked missing: " + name);
    requireCondition(Number.isSafeInteger(entry.bytes) && entry.bytes >= 0,
      "invalid byte length for " + name);
    requireCondition(SHA256.test(entry.sha256 || ""), "malformed artifact digest for " + name);
    const filePath = safeArtifactPath(sourceRoot, entry.path);
    const bytes = fs.readFileSync(filePath);
    const actualHash = crypto.createHash("sha256").update(bytes).digest("hex");
    requireCondition(entry.bytes === bytes.length, "artifact byte length changed: " + name);
    requireCondition(entry.sha256 === actualHash, "artifact content changed: " + name);
  }
  requireCondition(SHA256.test(manifest.evidenceDigest || ""), "missing canonical digest");
  requireCondition(digest(manifest.artifacts) === manifest.evidenceDigest,
    "canonical digest no longer matches the artifact manifest");

  return { ok: true, gates: seenChecks.size, artifacts: expected.length,
    commitSha: manifest.commitSha, evidenceDigest: manifest.evidenceDigest };
}

function selfTest() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "sonara-release-integrity-"));
  const source = path.join(temp, "artifacts");
  const manifestPath = path.join(source, "release-evidence", "manifest.json");
  const commit = "a".repeat(40);
  try {
    fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
    const checks = Object.entries(EXPECTED).map(([id, artifacts]) => ({
      id, label: id, status: "success", artifacts
    }));
    const artifacts = expectedArtifacts().map((name) => {
      const file = path.join(source, name);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const bytes = Buffer.from("fixture for " + name);
      fs.writeFileSync(file, bytes);
      return { path: name, exists: true, bytes: bytes.length,
        sha256: crypto.createHash("sha256").update(bytes).digest("hex") };
    });
    const baseline = {
      schemaVersion: 1, overall: "pass", commitSha: commit, checks,
      failedChecks: [], missingArtifacts: [], artifacts, evidenceDigest: digest(artifacts)
    };
    const write = (item) => fs.writeFileSync(manifestPath, JSON.stringify(item));
    write(baseline);
    assert.equal(validate(manifestPath, source, commit).artifacts, expectedArtifacts().length);

    const rejected = (name, item) => {
      write(item);
      assert.throws(() => validate(manifestPath, source, commit),
        /Release evidence integrity failed/, name);
      write(baseline);
    };
    rejected("fabricated canonical digest", { ...baseline, evidenceDigest: "f".repeat(64) });
    rejected("wrong commit", { ...baseline, commitSha: "b".repeat(40) });
    rejected("skipped gate", { ...baseline, checks: checks.map((c) =>
      c.id === "rls" ? { ...c, status: "skipped" } : c) });
    rejected("gate removed", { ...baseline, checks: checks.slice(1) });
    rejected("artifact removed", { ...baseline, artifacts: artifacts.slice(1) });
    rejected("path traversal", { ...baseline, artifacts: artifacts.map((a, i) =>
      i === 0 ? { ...a, path: "../other.log" } : a) });
    const changedFile = path.join(source, artifacts[0].path);
    fs.appendFileSync(changedFile, "\nchanged after manifest creation");
    assert.throws(() => validate(manifestPath, source, commit),
      /artifact (byte length|content) changed/, "changed bytes must be detected");
    fs.writeFileSync(changedFile, "fixture for " + artifacts[0].path);
    write(baseline);
    assert.equal(validate(manifestPath, source, commit).ok, true);
    console.log("Release evidence integrity self-test passed: valid proof and seven tamper/omission cases.");
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

const argv = process.argv.slice(2);
try {
  if (argv[0] === "--self-test") {
    selfTest();
  } else if (argv[0] === "--check") {
    const manifest = path.resolve(argv[1] || "artifacts/release-evidence/manifest.json");
    const sourceArg = argv.indexOf("--source");
    const commitArg = argv.indexOf("--commit");
    const source = path.resolve(sourceArg >= 0 ? argv[sourceArg + 1] : "artifacts");
    const expectedCommit = commitArg >= 0 ? argv[commitArg + 1] : null;
    if (!expectedCommit) throw new Error("An explicit --commit <full_sha> is required when checking release evidence.");
    console.log(JSON.stringify(validate(manifest, source, expectedCommit)));
  } else {
    throw new Error("Use --self-test or --check <manifest> --source <artifacts> [--commit <sha>]");
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
