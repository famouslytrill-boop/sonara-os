#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const args = process.argv.slice(2);

if (args[0] === "--check") {
  checkManifest(path.resolve(root, args[1] || "artifacts/release-evidence/manifest.json"));
  process.exit(0);
}

const sourceRoot = path.resolve(root, readArg("--source", "artifacts"));
const outputRoot = path.resolve(root, readArg("--output-dir", "artifacts/release-evidence"));

const checks = [
  check("codeql", "CodeQL SAST", process.env.SONARA_CODEQL_STATUS, []),
  check("build", "Server build", process.env.SONARA_BUILD_STATUS, ["engineering/build.log"]),
  check("lint", "Static lint", process.env.SONARA_LINT_STATUS, ["engineering/lint.log"]),
  check("architecture", "Archify map + architecture delta", process.env.SONARA_ARCHITECTURE_STATUS, [
    "engineering/repository-analysis.json",
    "engineering/archify-validate.json",
    "engineering/architecture-delta.json",
    "engineering/sonara-platform.html",
    "engineering/architecture-delta.html"
  ]),
  check("tenant_adversarial", "Tenant isolation + adversarial application tests", process.env.SONARA_TENANT_STATUS, [
    "security/tenant-adversarial.json"
  ]),
  check("rls", "RLS and tenant query contracts", process.env.SONARA_RLS_STATUS, ["security/rls-contract.log"]),
  check("dependencies", "Dependency vulnerability audit", process.env.SONARA_DEPENDENCY_STATUS, ["security/dependency-audit.json"]),
  check("secrets", "Client secret exposure scan", process.env.SONARA_SECRET_STATUS, ["security/secret-scan.log"])
];

const artifactPaths = [...new Set(checks.flatMap((entry) => entry.artifacts))];
const artifacts = artifactPaths.map((relativePath) => inspect(relativePath));
const missingArtifacts = artifacts.filter((artifact) => !artifact.exists).map((artifact) => artifact.path);
const failedChecks = checks.filter((entry) => entry.status !== "success").map((entry) => entry.id);
const overall = failedChecks.length === 0 && missingArtifacts.length === 0 ? "pass" : "fail";

const manifest = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  repository: process.env.GITHUB_REPOSITORY || "famouslytrill-boop/sonara-os",
  commitSha: process.env.GITHUB_SHA || null,
  ref: process.env.GITHUB_REF || null,
  eventName: process.env.GITHUB_EVENT_NAME || null,
  runId: process.env.GITHUB_RUN_ID || null,
  runAttempt: process.env.GITHUB_RUN_ATTEMPT || null,
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

function readArg(name, fallback) {
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
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
  const absolute = path.join(sourceRoot, relativePath);
  if (!fs.existsSync(absolute)) return { path: relativePath, exists: false };
  const bytes = fs.readFileSync(absolute);
  return {
    path: relativePath,
    exists: true,
    bytes: bytes.length,
    sha256: crypto.createHash("sha256").update(bytes).digest("hex")
  };
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

function checkManifest(manifestPath) {
  if (!fs.existsSync(manifestPath)) throw new Error(`Release evidence manifest does not exist: ${manifestPath}`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (manifest.overall !== "pass") {
    throw new Error(`Release evidence failed. Checks: ${(manifest.failedChecks || []).join(", ") || "none"}; missing: ${(manifest.missingArtifacts || []).join(", ") || "none"}`);
  }
  if (!/^[a-f0-9]{64}$/.test(manifest.evidenceDigest || "")) throw new Error("Release evidence digest is missing or malformed.");
  console.log(JSON.stringify({ ok: true, evidenceDigest: manifest.evidenceDigest }));
}
