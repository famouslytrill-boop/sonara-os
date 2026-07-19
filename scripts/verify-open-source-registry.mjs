#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const networkMode = process.argv.includes("--network");
const errors = [];
const warnings = [];
const repositoryTargets = new Map();

function read(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    errors.push(`Missing required file: ${relativePath}`);
    return "";
  }
  return fs.readFileSync(absolutePath, "utf8");
}

function addRepositoryTarget(rawUrl, source, metadata = {}) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    errors.push(`Invalid repository URL in ${source}: ${rawUrl}`);
    return;
  }

  if (url.hostname !== "github.com" && url.hostname !== "www.github.com") return;
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length === 0) {
    warnings.push(`Unresolved generic GitHub placeholder in ${source}: ${rawUrl}`);
    return;
  }

  const owner = segments[0];
  const repository = segments[1]?.replace(/\.git$/i, "");
  const key = repository ? `${owner}/${repository}` : owner;
  const kind = repository ? "repository" : "owner";
  const existing = repositoryTargets.get(`${kind}:${key}`) || { kind, owner, repository, sources: [], metadata: [] };
  existing.sources.push(source);
  existing.metadata.push(metadata);
  repositoryTargets.set(`${kind}:${key}`, existing);
}

function field(block, name) {
  return block.match(new RegExp(`\\b${name}:\\s*"([^"]*)"`))?.[1] ?? "";
}

const packageText = read("package.json");
if (packageText) {
  let packageJson;
  try {
    packageJson = JSON.parse(packageText);
  } catch (error) {
    errors.push(`package.json is not valid JSON: ${error.message}`);
  }

  if (packageJson) {
    const dependencyGroups = ["dependencies", "devDependencies", "optionalDependencies"];
    for (const group of dependencyGroups) {
      for (const [name, version] of Object.entries(packageJson[group] || {})) {
        if (/^(?:git\+|git:|github:|https?:\/\/)/i.test(String(version))) {
          errors.push(`${group}.${name} uses a remote source instead of a registry version: ${version}`);
        }
      }
    }
    if (packageJson.packageManager !== "pnpm@11.1.1") {
      warnings.push(`Expected packageManager pnpm@11.1.1, found ${packageJson.packageManager || "missing"}.`);
    }
  }
}

if (fs.existsSync(path.join(root, ".gitmodules"))) {
  errors.push("External repositories must not be introduced as unmanaged git submodules.");
}

const requirements = read("backend/requirements.txt");
for (const line of requirements.split(/\r?\n/).map((value) => value.trim()).filter(Boolean)) {
  if (line.startsWith("#")) continue;
  if (/^(?:git\+|https?:\/\/)/i.test(line)) {
    errors.push(`backend/requirements.txt contains a remote dependency: ${line}`);
    continue;
  }
  if (!/^[A-Za-z0-9_.-]+(?:\[[A-Za-z0-9_,.-]+\])?==[^\s]+$/.test(line)) {
    errors.push(`Python dependency is not exactly pinned: ${line}`);
  }
}

const toolsSource = read("data/open-source-tools.ts");
const toolBlocks = [...toolsSource.matchAll(/\{\s*\n\s*name:\s*"[^"]+"[\s\S]*?\n\s*\},/g)].map((match) => match[0]);
if (toolBlocks.length === 0) errors.push("No open-source tool records were parsed from data/open-source-tools.ts.");

const seenSlugs = new Set();
for (const block of toolBlocks) {
  const record = {
    name: field(block, "name"),
    slug: field(block, "slug"),
    license: field(block, "license"),
    licenseRisk: field(block, "licenseRisk"),
    commercialUseStatus: field(block, "commercialUseStatus"),
    integrationStatus: field(block, "integrationStatus"),
    officialUrl: field(block, "officialUrl"),
    repoUrl: field(block, "repoUrl"),
    notes: field(block, "notes"),
  };

  for (const required of ["name", "slug", "license", "licenseRisk", "commercialUseStatus", "integrationStatus", "officialUrl", "repoUrl", "notes"]) {
    if (!record[required]) errors.push(`Open-source record ${record.name || "<unknown>"} is missing ${required}.`);
  }
  if (!block.includes("safetyBoundaries:")) errors.push(`Open-source record ${record.name || record.slug} is missing safetyBoundaries.`);
  if (seenSlugs.has(record.slug)) errors.push(`Duplicate open-source slug: ${record.slug}`);
  seenSlugs.add(record.slug);

  const unresolvedLicense = /unknown|must be verified|requires? review/i.test(record.license);
  if (unresolvedLicense && record.commercialUseStatus === "allowed_after_review" && record.integrationStatus !== "reference_only") {
    errors.push(`${record.name} cannot be marked allowed_after_review while its license remains unresolved.`);
  }
  if (record.integrationStatus === "blocked" && !block.includes("blockedUses:")) {
    errors.push(`Blocked record ${record.name} must declare blockedUses.`);
  }

  if (record.repoUrl === "https://example.invalid/blocked") {
    if (record.integrationStatus !== "blocked") errors.push(`${record.name} uses a blocked placeholder without blocked status.`);
  } else {
    addRepositoryTarget(record.repoUrl, `data/open-source-tools.ts:${record.slug}`, record);
  }
}

const registrySource = read("docs/SONARA_EXTERNAL_REPOSITORY_REGISTRY.md");
for (const match of registrySource.matchAll(/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)/g)) {
  addRepositoryTarget(`https://github.com/${match[1]}/${match[2]}`, "docs/SONARA_EXTERNAL_REPOSITORY_REGISTRY.md");
}

async function verifyNetworkTarget(target) {
  const endpoint = target.kind === "repository"
    ? `https://api.github.com/repos/${encodeURIComponent(target.owner)}/${encodeURIComponent(target.repository)}`
    : `https://api.github.com/users/${encodeURIComponent(target.owner)}`;
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "sonara-external-repository-health",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  let response;
  try {
    response = await fetch(endpoint, { headers, signal: globalThis.AbortSignal.timeout(12000) });
  } catch (error) {
    errors.push(`Network check failed for ${target.owner}${target.repository ? `/${target.repository}` : ""}: ${error.message}`);
    return;
  }

  if (response.status === 404 || response.status === 410) {
    errors.push(`Registered GitHub ${target.kind} is unavailable: ${target.owner}${target.repository ? `/${target.repository}` : ""}`);
    return;
  }
  if (response.status === 403 && response.headers.get("x-ratelimit-remaining") === "0") {
    warnings.push("GitHub API rate limit reached; remaining remote checks are indeterminate.");
    return "rate_limited";
  }
  if (!response.ok) {
    errors.push(`GitHub returned ${response.status} for ${target.owner}${target.repository ? `/${target.repository}` : ""}.`);
    return;
  }

  const payload = await response.json();
  if (target.kind === "repository") {
    if (payload.disabled) errors.push(`Registered repository is disabled: ${payload.full_name}`);
    if (payload.archived) warnings.push(`Registered repository is archived: ${payload.full_name}`);
    if (!payload.default_branch) errors.push(`Registered repository has no default branch: ${payload.full_name}`);
  }
}

if (networkMode) {
  for (const target of repositoryTargets.values()) {
    const result = await verifyNetworkTarget(target);
    if (result === "rate_limited") break;
  }
}

console.log(`Open-source registry records: ${toolBlocks.length}`);
console.log(`Unique GitHub targets: ${repositoryTargets.size}`);
console.log(`Network verification: ${networkMode ? "enabled" : "disabled"}`);
for (const warning of warnings) console.warn(`WARNING: ${warning}`);
if (errors.length) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exit(1);
}
console.log("Open-source and external repository controls verified.");
