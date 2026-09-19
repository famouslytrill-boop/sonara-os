#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const args = process.argv.slice(2);

const sourceRoot = path.resolve(root, readArg("--source", "artifacts"));
const outputRoot = path.resolve(root, readArg("--output-dir", "artifacts/release-evidence"));

const checks = [
  check("codeql", "CodeQL SAST", readArg("--codeql-status"), []),
  check("build", "Server build", readArg("--build-status"), ["engineering/build.log"]),
  check("lint", "Static lint", readArg("--lint-status"), ["engineering/lint.log"]),
  check("architecture", "Archify map + architecture delta", readArg("--architecture-status"), [
    "engineering/repository-analysis.json",
    "engineering/archify-validate.json",
    "engineering/architecture-delta.json",
    "engineering/sonara-platform.html",
    "engineering/architecture-delta.html"
  ]),
  check("tenant_adversarial", "Tenant isolation + adversarial application tests", readArg("--tenant-status"), [
    "security/tenant-adversarial.json"
  ]),
  check("rls", "RLS contract + tenant query verification", readArg("--rls-status"), ["security/rls-contract.log"]),
  check("dependencies", "Dependency vulnerability audit", readArg("--dependency-status"), ["security/dependency-audit.json"]),
  check("secrets", "Client secret exposure scan", readArg("--secret-status"), ["security/secret-scan.log"])
];

const artifactPaths = [...new Set(checks.flatMap((entry) => entry.artifacts))];

// Initialize the same required gate/artifact contract in both modes. The
// receipt is data to verify, never the authority on which gates are required.
if (args[0] === "--check") {
  const manifestArg = args[1] && !args[1].startsWith("--") ? args[1] : "artifacts/release-evidence/manifest.json";
  checkManifest(path.resolve(root, manifestArg));
  process.exit(0);
}

const artifacts = artifactPaths.map((relativePath) => inspect(relativePath));
const missingArtifacts = artifacts.filter((artifact) => !artifact.exists).map((artifact) => artifact.path);
const failedChecks = checks.filter((entry) => entry.status !== "success").map((entry) => entry.id);
const overall = failedChecks.length === 0 && missingArtifacts.length === 0 ? "pass" : "fail";

const manifest = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  repository: readArg("--repository", "famouslytrill-boop/sonara-os"),
  commitSha: readArg("--commit-sha"),
  ref: readArg("--ref"),
  eventName: readArg("--event-name"),
  runId: readArg("--run-id"),
  runAttempt: readArg("--run-attempt"),
  overall,
  checks,
  failedChecks,
  missingArtifacts,
  artifacts,
  evidenceDigest: digestArtifacts(artifacts.filter((artifact) => artifact.exists))
};

fs.mkdirSync(outputRoot, { recursive: true });
const jsonPath = path.join(outputRoot, "manifest.json");
const markdownPath = path.join(outputRoot, "manifest.md");
fs.writeFileSync(jsonPath, `${JSON.stringify(manifest, null, 2)}\n`);
fs.writeFileSync(markdownPath, renderMarkdown(manifest));
console.log(JSON.stringify({ ok: overall === "pass", overall, manifest: path.relative(root, jsonPath), evidenceDigest: manifest.evidenceDigest }));

function readArg(name, fallback = null) {
  const prefix = name + "=";
  const inline = args.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

function check(id, label, status, artifacts) {
  return {
    id,
    label,
    status: normalizeStatus(status),
    artifacts
  };
}

function normalizeStatus(value) {
  const candidate = String(value || "unknown").trim().toLowerCase();
  if (["success", "passed", "pass", "ok"].includes(candidate)) return "success";
  if (["failure", "failed", "fail", "cancelled", "timed_out", "action_required", "skipped"].includes(candidate)) return candidate;
  return "unknown";
}

function inspect(relativePath) {
  // Only the authored artifactPaths list reaches here, never a manifest path.
  // Reject links (including linked parent directories), special files and
  // empty output. A symlink to the right bytes is still not bundled evidence.
  let fd;
  try {
    if (!fs.lstatSync(sourceRoot).isDirectory()) throw new Error("source is not a directory");
    let absolute = sourceRoot;
    for (const part of relativePath.split("/")) {
      absolute = path.join(absolute, part);
      if (fs.lstatSync(absolute).isSymbolicLink()) throw new Error("symbolic link is not evidence");
    }
    fd = fs.openSync(absolute, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
    if (!fs.fstatSync(fd).isFile()) throw new Error("artifact is not a regular file");
    const bytes = fs.readFileSync(fd);
    if (bytes.length === 0) throw new Error("artifact is empty");
    return {
      path: relativePath,
      exists: true,
      bytes: bytes.length,
      sha256: crypto.createHash("sha256").update(bytes).digest("hex")
    };
  } catch (error) {
    // Generation still writes a failing receipt for upload/diagnostics.
    return { path: relativePath, exists: false, reason: error.code || error.message };
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

function digestArtifacts(existingArtifacts) {
  const canonical = existingArtifacts
    .map((artifact) => `${artifact.path}:${artifact.sha256}:${artifact.bytes}`)
    .sort()
    .join("\n");
  return crypto.createHash("sha256").update(canonical).digest("hex");
}

function renderMarkdown(manifest) {
  const rows = manifest.checks
    .map((entry) => `| ${entry.label} | ${entry.status} | ${entry.artifacts.length ? entry.artifacts.join("<br>") : "GitHub Code Scanning"} |`)
    .join("\n");
  const missing = manifest.missingArtifacts.length ? manifest.missingArtifacts.map((item) => `- ${item}`).join("\n") : "- None";
  const failed = manifest.failedChecks.length ? manifest.failedChecks.map((item) => `- ${item}`).join("\n") : "- None";
  return `# SONARA Release Evidence\n\n` +
    `- **Result:** ${manifest.overall.toUpperCase()}\n` +
    `- **Commit:** ${manifest.commitSha || "unknown"}\n` +
    `- **Workflow run:** ${manifest.runId || "local"}\n` +
    `- **Evidence digest:** \`${manifest.evidenceDigest}\`\n\n` +
    `## Checks\n\n| Gate | Status | Evidence |\n| --- | --- | --- |\n${rows}\n\n` +
    `## Failed checks\n\n${failed}\n\n` +
    `## Missing evidence\n\n${missing}\n`;
}

function requireEvidence(condition, message) {
  if (!condition) throw new Error(`Release evidence ${message}`);
}

function exactSet(actual, expected, label) {
  requireEvidence(Array.isArray(actual), `${label} must be an array.`);
  requireEvidence(actual.length === expected.length && new Set(actual).size === expected.length &&
    actual.every((value) => expected.includes(value)), `${label} must contain exactly the required entries, without duplicates.`);
}

function checkManifest(manifestPath) {
  requireEvidence(fs.existsSync(manifestPath), `manifest does not exist: ${manifestPath}`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  requireEvidence(manifest !== null && typeof manifest === "object" && !Array.isArray(manifest), "manifest must be an object.");
  requireEvidence(manifest.schemaVersion === 1, "schemaVersion must be 1.");
  requireEvidence(manifest.overall === "pass", "failed: the receipt does not report pass.");
  requireEvidence(typeof manifest.commitSha === "string" && /^[a-f0-9]{40}$/.test(manifest.commitSha), "commitSha must be a full commit SHA.");
  requireEvidence(typeof manifest.generatedAt === "string" && Number.isFinite(Date.parse(manifest.generatedAt)) &&
    new Date(manifest.generatedAt).toISOString() === manifest.generatedAt, "generatedAt must be an ISO timestamp.");
  for (const field of ["runId", "runAttempt"]) {
    requireEvidence(typeof manifest[field] === "string" && /^[1-9][0-9]*$/.test(manifest[field]), `${field} must identify a workflow execution.`);
  }
  for (const field of ["ref", "eventName"]) {
    requireEvidence(typeof manifest[field] === "string" && manifest[field].trim().length > 0, `${field} is required.`);
  }

  // CI supplies these expectations from GitHub's execution context, not from
  // the receipt being checked. Local callers may supply the same bindings.
  // Hash integrity is NOT a signature or proof of a trustworthy producer.
  const expectedIdentity = {
    repository: readArg("--repository", "famouslytrill-boop/sonara-os"),
    commitSha: readArg("--commit-sha"),
    ref: readArg("--ref"),
    eventName: readArg("--event-name"),
    runId: readArg("--run-id"),
    runAttempt: readArg("--run-attempt")
  };
  for (const [field, expected] of Object.entries(expectedIdentity)) {
    if (expected !== null) requireEvidence(manifest[field] === expected, `${field} does not match the expected execution.`);
  }

  requireEvidence(Array.isArray(manifest.checks), "checks must be an array.");
  exactSet(manifest.checks.map((entry) => entry?.id), checks.map((entry) => entry.id), "checks");
  for (const required of checks) {
    const recorded = manifest.checks.find((entry) => entry.id === required.id);
    requireEvidence(recorded.status === "success", `gate ${required.id} did not succeed.`);
    exactSet(recorded.artifacts, required.artifacts, `artifacts for ${required.id}`);
  }
  exactSet(manifest.failedChecks, [], "failedChecks");
  exactSet(manifest.missingArtifacts, [], "missingArtifacts");

  requireEvidence(Array.isArray(manifest.artifacts), "artifacts must be an array.");
  // Validate the full allowlist before any artifact file is opened. Absolute
  // paths, traversal paths, missing records and duplicate records all fail.
  exactSet(manifest.artifacts.map((entry) => entry?.path), artifactPaths, "artifacts");
  const actualArtifacts = artifactPaths.map((relativePath) => {
    const recorded = manifest.artifacts.find((entry) => entry.path === relativePath);
    requireEvidence(recorded.exists === true, `artifact ${relativePath} was not recorded as present.`);
    requireEvidence(Number.isSafeInteger(recorded.bytes) && recorded.bytes > 0, `artifact ${relativePath} has an invalid byte count.`);
    requireEvidence(typeof recorded.sha256 === "string" && /^[a-f0-9]{64}$/.test(recorded.sha256), `artifact ${relativePath} has a malformed hash.`);
    const actual = inspect(relativePath);
    requireEvidence(actual.exists, `artifact ${relativePath} is unavailable: ${actual.reason}.`);
    requireEvidence(actual.bytes === recorded.bytes && actual.sha256 === recorded.sha256, `artifact ${relativePath} bytes/hash do not match the receipt.`);
    return actual;
  });
  requireEvidence(typeof manifest.evidenceDigest === "string" && /^[a-f0-9]{64}$/.test(manifest.evidenceDigest), "digest is missing or malformed.");
  const actualDigest = digestArtifacts(actualArtifacts);
  requireEvidence(actualDigest === manifest.evidenceDigest, "digest does not match the verified files.");
  console.log(JSON.stringify({ ok: true, evidenceDigest: actualDigest }));
}
