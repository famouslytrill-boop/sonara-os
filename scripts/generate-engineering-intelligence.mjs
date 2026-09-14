#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const output = resolveOutput(process.argv.slice(2));

const EVIDENCE = [
  {
    id: "runtime",
    label: "Express/Vercel runtime",
    paths: ["server.js", "vercel.json", "routes"],
    claim: "Public and private HTTP surfaces are served by the Node/Express runtime deployed through Vercel."
  },
  {
    id: "tenant_isolation",
    label: "Tenant isolation",
    paths: [
      "lib/sonara-tenant-scoped-tables.cjs",
      "tests/cross-tenant-isolation.test.js",
      "supabase/migrations/20260603090000_production_auth_workspace_rls.sql"
    ],
    claim: "Tenant scoping is enforced in application queries and reinforced by database RLS policy."
  },
  {
    id: "agent_authority",
    label: "Agent authority",
    paths: ["lib/sonara-agent-authority.cjs", "lib/sonara-agent-runner.cjs", "docs/agents/AGENT_ARCHITECTURE.md"],
    claim: "Agent actions pass through explicit authority and approval policy before consequential execution."
  },
  {
    id: "payments",
    label: "Payment boundary",
    paths: ["lib/sonara-stripe-plans.cjs", "scripts/verify-stripe-env.mjs"],
    claim: "Stripe plan and credential readiness are governed server-side and verified before release."
  },
  {
    id: "security",
    label: "Security gate",
    paths: [
      "docs/security/LAUNCH_SECURITY_GATE.md",
      "docs/security/SECURITY_CENTER.md",
      "scripts/client-secret-scan.cjs"
    ],
    claim: "Release security includes secret scanning, tenant/RLS controls, provider checks, and evidence gates."
  },
  {
    id: "release",
    label: "Release orchestration",
    paths: [
      ".github/workflows/controlled-production-deploy.yml",
      ".github/workflows/sonara-validation.yml",
      ".github/workflows/dependency-scan.yml"
    ],
    claim: "GitHub Actions is the governed validation and deployment orchestration layer."
  },
  {
    id: "architecture",
    label: "Architecture contract",
    paths: [
      "architecture/sonara-platform.architecture.json",
      "docs/architecture/SONARA-ENGINEERING-SECURITY-AGENT-ARCHITECTURE.md"
    ],
    claim: "The current architecture is represented as an authored, reviewable contract and an Archify-compatible system map."
  }
];

const trackedFiles = gitLines(["ls-files"]);
const changedFiles = resolveChangedFiles();
const evidence = EVIDENCE.map((entry) => ({
  ...entry,
  files: entry.paths.map((relativePath) => inspectPath(relativePath)),
  ready: entry.paths.every((relativePath) => fs.existsSync(path.join(root, relativePath)))
}));

const missingEvidence = evidence.flatMap((entry) => entry.files.filter((file) => !file.exists).map((file) => `${entry.id}:${file.path}`));
if (missingEvidence.length) {
  throw new Error(`Engineering intelligence evidence is incomplete: ${missingEvidence.join(", ")}`);
}

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  repository: {
    name: process.env.GITHUB_REPOSITORY || "famouslytrill-boop/sonara-os",
    commitSha: process.env.GITHUB_SHA || gitOne(["rev-parse", "HEAD"]),
    branch: process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || gitOne(["rev-parse", "--abbrev-ref", "HEAD"]),
    baseBranch: process.env.GITHUB_BASE_REF || null,
    trackedFileCount: trackedFiles.length,
    changedFileCount: changedFiles.length,
    changedFiles
  },
  inventory: summarizeInventory(trackedFiles),
  architecture: {
    map: "architecture/sonara-platform.architecture.json",
    evidenceReady: evidence.every((entry) => entry.ready),
    evidence
  },
  boundaries: {
    tenantIsolationTest: "tests/cross-tenant-isolation.test.js",
    rlsGuide: "docs/security/RLS_POLICY_GUIDE.md",
    agentAuthority: "lib/sonara-agent-authority.cjs",
    launchSecurityGate: "docs/security/LAUNCH_SECURITY_GATE.md"
  }
};

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ ok: true, output: path.relative(root, output), trackedFiles: trackedFiles.length, changedFiles: changedFiles.length }));

function resolveOutput(args) {
  const inline = args.find((arg) => arg.startsWith("--output="));
  const index = args.indexOf("--output");
  const value = inline?.slice("--output=".length) || (index >= 0 ? args[index + 1] : "artifacts/engineering/repository-analysis.json");
  return path.resolve(root, value);
}

function gitOne(args) {
  try {
    return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

function gitLines(args) {
  const value = gitOne(args);
  return value ? value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean) : [];
}

function resolveChangedFiles() {
  const base = String(process.env.GITHUB_BASE_REF || "").trim();
  if (base) {
    const mergeBase = gitOne(["merge-base", `origin/${base}`, "HEAD"]);
    if (mergeBase) return gitLines(["diff", "--name-only", `${mergeBase}...HEAD"]);
  }
  const parent = gitOne(["rev-parse", "HEAD^"]);
  return parent ? gitLines(["diff", "--name-only", `${parent}...HEAD`]) : [];
}

function inspectPath(relativePath) {
  const absolute = path.join(root, relativePath);
  if (!fs.existsSync(absolute)) return { path: relativePath, exists: false, kind: "missing" };
  const stat = fs.statSync(absolute);
  if (stat.isDirectory()) {
    const files = walk(absolute).map((file) => path.relative(root, file).replaceAll("\\", "/"));
    return { path: relativePath, exists: true, kind: "directory", fileCount: files.length };
  }
  const bytes = fs.readFileSync(absolute);
  return {
    path: relativePath,
    exists: true,
    kind: "file",
    bytes: bytes.length,
    sha256: crypto.createHash("sha256").update(bytes).digest("hex")
  };
}

function walk(directory) {
  const output = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...walk(full));
    else output.push(full);
  }
  return output;
}

function summarizeInventory(files) {
  const byArea = {};
  const byExtension = {};
  for (const file of files) {
    const area = file.includes("/") ? file.split("/")[0] : "root";
    byArea[area] = (byArea[area] || 0) + 1;
    const extension = path.extname(file) || "[none]";
    byExtension[extension] = (byExtension[extension] || 0) + 1;
  }
  return {
    byArea: sortObject(byArea),
    byExtension: sortObject(byExtension),
    criticalAreas: {
      routes: files.filter((file) => file.startsWith("routes/")).length,
      libraries: files.filter((file) => file.startsWith("lib/")).length,
      tests: files.filter((file) => file.startsWith("tests/") && file.endsWith(".test.js")).length,
      migrations: files.filter((file) => file.startsWith("supabase/migrations/") && file.endsWith(".sql")).length,
      workflows: files.filter((file) => file.startsWith(".github/workflows/") && /\.ya?ml$/.test(file)).length
    }
  };
}

function sortObject(value) {
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));
}
