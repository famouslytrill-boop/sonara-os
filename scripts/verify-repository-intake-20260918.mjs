// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const intakePath = path.join(root, "data", "repository-intake-2026-09-18.json");
const registryPath = path.join(root, "data", "open-source-tools.ts");
const intake = JSON.parse(fs.readFileSync(intakePath, "utf8"));
const registry = fs.readFileSync(registryPath, "utf8");

const problems = [];
const research = Array.isArray(intake.researchOnly) ? intake.researchOnly : [];
const install = Array.isArray(intake.installSet) ? intake.installSet : [];
const all = [...research, ...install];

if (research.length !== 30) problems.push(`researchOnly must contain exactly 30 records; found ${research.length}`);
if (install.length !== 30) problems.push(`installSet must contain exactly 30 records; found ${install.length}`);
if (all.length !== 60) problems.push(`combined intake must contain exactly 60 records; found ${all.length}`);

const duplicateValues = (values) => [...new Set(values.filter((value, index) => values.indexOf(value) !== index))];
const duplicateKeys = duplicateValues(all.map((item) => String(item.key || "").toLowerCase()));
const duplicateRepos = duplicateValues(all.map((item) => String(item.repository || "").toLowerCase()));
if (duplicateKeys.length) problems.push(`duplicate intake keys: ${duplicateKeys.join(", ")}`);
if (duplicateRepos.length) problems.push(`duplicate repository identifiers: ${duplicateRepos.join(", ")}`);

const registryUrls = new Set(
  [...registry.matchAll(/repoUrl:\s*"([^"]+)"/g)]
    .map((match) => match[1].replace(/\/$/, "").toLowerCase())
);
const overlap = all
  .filter((item) => registryUrls.has(String(item.url || "").replace(/\/$/, "").toLowerCase()))
  .map((item) => item.url);
if (overlap.length) problems.push(`intake duplicates existing formal-registry URLs: ${overlap.join(", ")}`);

for (const item of research) {
  if (item.status !== "research_only") problems.push(`${item.key}: research record status must be research_only`);
  if (item.executionEnabled !== false) problems.push(`${item.key}: research record must have executionEnabled=false`);
  if (!item.reasonNotInstalled) problems.push(`${item.key}: research record must state why it is not installed`);
  if (!Array.isArray(item.researchValue) || item.researchValue.length === 0) problems.push(`${item.key}: researchValue must not be empty`);
}

for (const item of install) {
  if (item.status !== "install_target_pinned") problems.push(`${item.key}: install record status must be install_target_pinned`);
  if (item.executionEnabled !== false) problems.push(`${item.key}: install target must remain executionEnabled=false in the registry`);
  if (!/^[0-9a-f]{40}$/.test(String(item.sha || ""))) problems.push(`${item.key}: exact 40-character upstream commit SHA required`);
  if (!item.license || /unverified|unknown|noassertion/i.test(item.license)) problems.push(`${item.key}: install target requires a reviewed licence`);
  if (!item.installClass) problems.push(`${item.key}: installClass is required`);
  if (!item.activationBoundary) problems.push(`${item.key}: activationBoundary is required`);
}

for (const item of all) {
  const url = String(item.url || "");
  if (!/^https:\/\/(github\.com|gitlab\.com)\//i.test(url)) problems.push(`${item.key}: source URL must be GitHub or GitLab HTTPS`);
  if (item.humanReviewRequired !== true) problems.push(`${item.key}: humanReviewRequired must remain true`);
}

if (intake.counts?.researchOnly !== research.length) problems.push("declared researchOnly count disagrees with data");
if (intake.counts?.installSet !== install.length) problems.push("declared installSet count disagrees with data");
if (intake.counts?.total !== all.length) problems.push("declared total count disagrees with data");

if (problems.length) {
  console.error("Repository intake verification failed:");
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}

console.log(`Repository intake verified: ${research.length} research-only + ${install.length} pinned install targets; 0 duplicates with the maintained open-source registry; execution remains disabled by registry authority.`);
