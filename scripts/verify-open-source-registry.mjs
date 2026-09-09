#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const registryRequire = createRequire(import.meta.url);
const { BLOCK: REGISTRY_BLOCK, registryIntegrity } = registryRequire("../lib/sonara-open-source-registry.cjs");

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
    // Was a warning, and warnings are what nobody acts on. Nine of these
    // printed on every release for months: records naming a genre rather than
    // an artifact -- "LightRAG-style reference", "Voicebox-style voice
    // synthesis" -- so there was nothing to review and no way to review it.
    // Eight were removed and one turned out to be HKUDS/LightRAG. A register
    // of repositories cannot hold a record that names no repository, so this
    // fails now rather than reminding.
    errors.push(`${source} has no repository behind it: ${rawUrl}. A record that names no artifact cannot be reviewed -- name the repository, or remove the record.`);
    return;
  }

  const owner = segments[0];
  const repository = segments[1]?.replace(/\.git$/i, "");
  // Lower-cased, because GitHub owner and repository names are case-insensitive
  // and this map is what decides whether two records name the same thing.
  // ashishpatel26/500-AI-Agents-Projects and ashishpatel26/500-ai-agents-projects
  // were two entries here and one repository on GitHub.
  const key = (repository ? `${owner}/${repository}` : owner).toLowerCase();
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
// The pattern comes from lib/sonara-open-source-registry.cjs rather than being
// restated here. Two copies of it disagreed about what a record looks like the
// moment one of them learned to read a quoted key.
const toolBlocks = [...toolsSource.matchAll(new RegExp(REGISTRY_BLOCK.source, "g"))].map((match) => match[0]);

// The parser and a dumber count of the same file must agree. A record this
// pattern cannot read is not an error today -- it is simply absent, from the
// count, from the gate and from the page, with nothing saying so. That is how a
// record written with quoted keys sat in the file while every number stayed the
// same.
const integrity = registryIntegrity();
if (!integrity.ok) {
  console.error(
    `ERROR: data/open-source-tools.ts opens ${integrity.candidates} records and only ${integrity.parsed} can be read.\n` +
      `${integrity.candidates - integrity.parsed} record(s) are in the file and invisible to every count built on it.\n` +
      "Check the shape of the entries that were added: the reader wants a `name` field first, quoted or not."
  );
  process.exit(1);
}
if (toolBlocks.length === 0) errors.push("No open-source tool records were parsed from data/open-source-tools.ts.");

// The allowed statuses, read out of the type union in the same file the records
// live in rather than retyped here.
//
// integrationStatus was checked for presence and never for value, so a typo --
// "adaptor_built", "reference-only" -- passed every gate and became a record
// nobody could filter on. TypeScript would object, but a value this file never
// compares against is one that only fails where somebody happens to look.
// Comments are stripped before the union is read. They were not, and the first
// version of this check reported every status but the first two as invalid --
// a semicolon inside the comment explaining the new status terminated the
// non-greedy match. Same class as the policy parser that once read 191 policies
// where there were 497: a regex over source that prose can end early.
const withoutComments = toolsSource.replace(/^\s*\/\/.*$/gm, "");
const statusUnion = withoutComments.match(/export type OpenSourceIntegrationStatus =([\s\S]*?);/);
const ALLOWED_STATUSES = new Set(
  statusUnion ? [...statusUnion[1].matchAll(/\|\s*"([a-z_]+)"/g)].map((match) => match[1]) : []
);
if (ALLOWED_STATUSES.size === 0) {
  errors.push("Could not read OpenSourceIntegrationStatus from data/open-source-tools.ts, so no status could be checked.");
}

// Every status must have a label a reader can be shown.
//
// openSourceToolStatuses ends in `satisfies Record<OpenSourceIntegrationStatus,
// string>`, which looks like the compiler enforcing exactly that. It is not:
// nothing in this repository compiles data/open-source-tools.ts, so the clause
// is decoration. adapter_built was added to the union and taken by six records
// while the map had no row for it, and the only symptom would have been a
// status rendering as undefined wherever the map is read.
const labelBlock = withoutComments.match(/export const openSourceToolStatuses = \{([\s\S]*?)\}\s*satisfies/);
if (!labelBlock) {
  errors.push("Could not read openSourceToolStatuses from data/open-source-tools.ts, so no label could be checked.");
} else {
  const labelled = new Set([...labelBlock[1].matchAll(/^\s*([a-z_]+):/gm)].map((match) => match[1]));
  if (labelled.size === 0) errors.push("openSourceToolStatuses parsed as empty, so this check would pass on anything.");
  for (const status of ALLOWED_STATUSES) {
    if (!labelled.has(status)) errors.push(`Integration status "${status}" has no label in openSourceToolStatuses.`);
  }
  for (const status of labelled) {
    if (!ALLOWED_STATUSES.has(status)) errors.push(`openSourceToolStatuses labels "${status}", which is not an integration status.`);
  }
}

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
  if (record.integrationStatus && ALLOWED_STATUSES.size > 0 && !ALLOWED_STATUSES.has(record.integrationStatus)) {
    errors.push(`${record.name} has integrationStatus "${record.integrationStatus}", which is not one of: ${[...ALLOWED_STATUSES].join(", ")}.`);
  }

  // adapter_built is the one status that claims something about this repository
  // rather than about the upstream project, so it is the one that can be false
  // without anybody noticing. It has to name something that exists.
  //
  // Two shapes of adapter, not one. This matched only `lib/*.cjs` until
  // 7 September 2026, which was right while every adapter here was a runtime
  // module. Then two skill libraries were adapted into `.claude/skills/`, which
  // is an adapter by the same definition -- shipped in this repository, loaded
  // when an agent works here -- and the pattern could not see it. Widened rather
  // than relaxed: a named path of either shape must still exist on disk, which
  // is the guarantee this block is actually for.
  //
  // scripts/verify-adapted-skills.mjs checks the other direction for the skills
  // half: that the skill naming a source names one this register cleared.
  if (record.integrationStatus === "adapter_built") {
    const named = [...block.matchAll(/(lib\/[a-z0-9-]+\.cjs|\.claude\/skills\/[a-z0-9-]+)/g)].map((match) => match[1]);
    if (named.length === 0) {
      errors.push(`${record.name} claims adapter_built without naming the adapter module or skill in its notes.`);
    }
    for (const modulePath of named) {
      const full = path.join(root, modulePath);
      const present = modulePath.startsWith(".claude/skills/")
        ? fs.existsSync(path.join(full, "SKILL.md"))
        : fs.existsSync(full);
      if (!present) {
        errors.push(`${record.name} claims adapter_built and names ${modulePath}, which does not exist.`);
      }
    }
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

// One repository, one verdict.
//
// The register's whole promise is that somebody meeting an outside repository
// can read what was decided about it. Two records for one repository break that
// promise in the worst available way: both are found, they disagree, and which
// one somebody acts on depends on which they happened to scroll to.
//
// Ten repositories were registered twice when this was written on 9 September
// 2026, and four of those pairs carried conflicting verdicts. ripienaar/free-for-dev
// was `blocked` (no licence, all rights reserved) in one record and
// `needs_license_review` with the licence recorded as "Not verified" in the
// other -- the second written before the first settled it, and left standing
// beside it. HKUDS/Vibe-Trading was `blocked` in one and `research_only` in the
// other. Nothing reported any of this: the counts above were computed from a map
// keyed case-sensitively, so ashishpatel26/500-AI-Agents-Projects and
// ashishpatel26/500-ai-agents-projects were two unique targets, and the rest
// simply were not compared.
//
// The fix for a duplicate is to merge, not to delete: the losing record usually
// holds a finding the survivor does not, and deleting it erases work somebody
// did. That is why this names both slugs rather than telling anybody to remove
// one.
const recordsByRepository = new Map();
for (const target of repositoryTargets.values()) {
  const slugs = target.sources
    .filter((source) => source.startsWith("data/open-source-tools.ts:"))
    .map((source) => source.slice("data/open-source-tools.ts:".length));
  if (slugs.length > 1) {
    recordsByRepository.set(`${target.owner}/${target.repository ?? ""}`.replace(/\/$/, ""), slugs);
  }
}
for (const [repository, slugs] of recordsByRepository) {
  errors.push(
    `${repository} has ${slugs.length} records in data/open-source-tools.ts: ${slugs.join(", ")}. ` +
      "A repository with two verdicts has none, because which one is read is an accident of scrolling. " +
      "Merge them into one record -- fold the finding the other holds into its notes rather than deleting it."
  );
}

const registrySource = read("docs/SONARA_EXTERNAL_REPOSITORY_REGISTRY.md");
for (const match of registrySource.matchAll(/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)/g)) {
  addRepositoryTarget(`https://github.com/${match[1]}/${match[2]}`, "docs/SONARA_EXTERNAL_REPOSITORY_REGISTRY.md");
}

// What a run of this check can conclude, and what it cannot.
//
// Three outcomes, not two. `confirmed` means GitHub answered about this target
// and the answer was good. `errors` means GitHub answered and the answer was
// bad -- a 404, a disabled repository, no default branch. `indeterminate` means
// GitHub did not answer: a 5xx, a timeout, a rate limit.
//
// The third one used to be folded into the second, and on 17 August 2026 that
// turned a GitHub gateway outage into thirty-five lines reading
// "ERROR: GitHub returned 504 for rust-lang/rust". Nothing was wrong with the
// register. The natural response to a red external-repository-health run is to
// go and delete entries from it, so a check that cannot tell "this repository
// is gone" from "GitHub is down" is worse than one that does not run: it argues
// for removing records that are fine.
const networkOutcome = { confirmed: 0, indeterminate: [], unattempted: 0 };

// Retried, because a 5xx is usually a moment rather than a state. Three
// attempts and then give up and say so -- retrying until it works is how a
// health check becomes an outage amplifier.
const RETRY_STATUSES = new Set([429, 500, 502, 503, 504]);
const RETRY_DELAYS_MS = [1000, 4000];

function label(target) {
  return `${target.owner}${target.repository ? `/${target.repository}` : ""}`;
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
  let lastFailure = "";
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt - 1]));
    try {
      response = await fetch(endpoint, { headers, signal: globalThis.AbortSignal.timeout(12000) });
    } catch (error) {
      // A transport failure is the same kind of not-an-answer as a 504, and it
      // was the same kind of false error before this: an offline runner used to
      // report every registered repository as broken.
      response = null;
      lastFailure = error.message;
      continue;
    }
    if (!RETRY_STATUSES.has(response.status)) break;
    lastFailure = `GitHub returned ${response.status}`;
    // A rate limit is not going to clear inside a retry window, and burning the
    // remaining attempts against it only deepens the limit.
    if (response.status === 403 || (response.status === 429 && response.headers.get("x-ratelimit-remaining") === "0")) break;
    response = null;
  }

  if (!response) {
    networkOutcome.indeterminate.push(`${label(target)}: ${lastFailure}`);
    return "indeterminate";
  }

  if (response.status === 404 || response.status === 410) {
    errors.push(`Registered GitHub ${target.kind} is unavailable: ${label(target)}`);
    return;
  }
  if ((response.status === 403 || response.status === 429) && response.headers.get("x-ratelimit-remaining") === "0") {
    warnings.push("GitHub API rate limit reached; remaining remote checks are indeterminate.");
    networkOutcome.indeterminate.push(`${label(target)}: rate limited`);
    return "rate_limited";
  }
  if (RETRY_STATUSES.has(response.status)) {
    networkOutcome.indeterminate.push(`${label(target)}: ${lastFailure || `GitHub returned ${response.status}`}`);
    return "indeterminate";
  }
  if (!response.ok) {
    errors.push(`GitHub returned ${response.status} for ${label(target)}.`);
    return;
  }

  const payload = await response.json();
  networkOutcome.confirmed += 1;
  if (target.kind === "repository") {
    if (payload.disabled) errors.push(`Registered repository is disabled: ${payload.full_name}`);
    if (payload.archived) warnings.push(`Registered repository is archived: ${payload.full_name}`);
    if (!payload.default_branch) errors.push(`Registered repository has no default branch: ${payload.full_name}`);
  }
}

if (networkMode) {
  const targets = [...repositoryTargets.values()];
  for (let index = 0; index < targets.length; index += 1) {
    const result = await verifyNetworkTarget(targets[index]);
    if (result === "rate_limited") {
      networkOutcome.unattempted = targets.length - index - 1;
      break;
    }
  }

  // A run that confirmed nothing is not a clean run. Without this the outage
  // above would have gone from thirty-five false errors to a silent pass, which
  // is the same defect wearing the other face: the check would report the
  // register healthy having established nothing about it.
  if (targets.length && !networkOutcome.confirmed) {
    errors.push(
      `Network verification confirmed none of ${targets.length} registered targets, so this run established ` +
      "nothing about whether they exist. Check GitHub availability and the token, then run it again."
    );
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
// What this run established, rather than what the script is capable of.
//
// This line used to read "Open-source and external repository controls
// verified" whether or not --network was passed, and the release chain does not
// pass it -- so the release log ended with the word "verified" while nothing had
// confirmed that any of the registered repositories still exists. The line above
// says "Network verification: disabled"; this one overwrote it, and the summary
// is the line people read.
//
// Unlike the Stripe case, the network half is not unrun: it has its own
// workflow. Naming it is more useful than a bare qualification, because the
// question a reader has at this point is "then who does check".
if (networkMode) {
  // Reports the population it actually reached. The old line claimed "every
  // registered repository still exists" whenever --network was passed, which
  // was already untrue on the rate-limit path -- that breaks out of the loop
  // partway and the summary went on to speak for the targets it never asked
  // about.
  if (networkOutcome.indeterminate.length || networkOutcome.unattempted) {
    for (const entry of networkOutcome.indeterminate) console.warn(`INDETERMINATE: ${entry}`);
    console.log(
      `Open-source and external repository controls verified offline, and ${networkOutcome.confirmed} of ` +
      `${repositoryTargets.size} registered targets confirmed to still exist. GitHub did not answer for ` +
      `${networkOutcome.indeterminate.length}${networkOutcome.unattempted ? `, and ${networkOutcome.unattempted} were not attempted` : ""}, ` +
      "so those are unconfirmed rather than broken -- do not remove them from the register on the strength of this run."
    );
  } else {
    console.log("Open-source and external repository controls verified, including that every registered repository still exists.");
  }
} else {
  console.log(
    "Open-source and external repository controls verified offline: the registry's records, licences and " +
    "declared uses are consistent.\nWhether each registered repository still exists was NOT checked in this " +
    "run -- that is `pnpm run verify:open-source:network`, which .github/workflows/external-repository-health.yml runs."
  );
}
