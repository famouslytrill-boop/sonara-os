#!/usr/bin/env node

// The handoff prompt, generated rather than written.
//
// docs/CODEX_MASTER_PROMPT.md was the previous attempt. It opened with "SONARA
// is an AI-powered creator business operating system" and listed Prompt Vault,
// Artist OS, Content Studio, Visual Builder and Local Business Kits as the
// active tools. None of those are the product. AGENTS.md names SONARA
// Industries, the SONARA One platform, and Business Builder, Creator Studio and
// Growth Studio -- and it also says retired public names must not appear in
// active docs, which that file was full of.
//
// It rotted for the ordinary reason: somebody wrote it once, the product moved,
// and nothing ever compared the two. A handoff prompt is exactly the document
// where that is most expensive, because its whole job is to be the first thing
// somebody reads.
//
// So this one is assembled from the repository every time. The product
// architecture comes out of AGENTS.md. The counts come from the code they
// describe. The only hand-written part is the sprint log, which is history and
// cannot be derived. Run with --check in the release chain; it fails if the
// committed file has drifted from what the repository now says.

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = path.join(root, "docs", "HANDOFF_PROMPT.md");
const SPRINT_LOG = path.join(root, "docs", "SPRINT_LOG.md");
const checkOnly = process.argv.includes("--check");

function read(relative) {
  const target = path.join(root, relative);
  return fs.existsSync(target) ? fs.readFileSync(target, "utf8") : "";
}

const problems = [];

// --- Facts, each read from the thing it describes ------------------------

const agentsRules = read("AGENTS.md");
if (!agentsRules) problems.push("AGENTS.md is missing; the product architecture below would be invented");

// The safety rules are quoted rather than paraphrased. A paraphrase of "do not
// automate refunds without owner approval" is how the rule loses its edge.
const safetyRules = (agentsRules.match(/## Safety\n([\s\S]*?)\n## /) || [])[1] || "";
if (!safetyRules.trim()) problems.push("AGENTS.md has no readable Safety section");

const buildRules = (agentsRules.match(/## Build And CI Guardrails\n([\s\S]*?)$/) || [])[1] || "";
if (!buildRules.trim()) problems.push("AGENTS.md has no readable Build And CI Guardrails section");

const { readOpenSourceTools } = require(path.join(root, "lib", "sonara-open-source-registry.cjs"));
const registerRecords = readOpenSourceTools();

const routeRegistry = require(path.join(root, "lib", "sonara-route-registry.cjs"));
const contract = require(path.join(root, "lib", "sonara-database-contract.cjs"));
const authority = require(path.join(root, "lib", "sonara-agent-authority.cjs"));

const migrationCount = fs.existsSync(path.join(root, "supabase", "migrations"))
  ? fs.readdirSync(path.join(root, "supabase", "migrations")).filter((name) => name.endsWith(".sql")).length
  : 0;

// How many test files mocha actually runs.
//
// This counted `tests/*.test.js` at the top level and called the result "test
// files run under mocha". Mocha's own spec is `tests/**/*.js` and
// `tests/**/*.mjs` -- recursive, and not limited to the `.test.js` suffix -- so
// the sentence named one population and the number measured another. It read
// 257 while mocha ran 261, and nothing objected because the two were never
// compared.
//
// So the globs are read from `.mocharc.json` rather than restated here. The
// day somebody adds a pattern, this follows; the day somebody removes the
// config, this fails loudly instead of quietly counting nothing.
function mochaSpecGlobs() {
  const raw = read(".mocharc.json");
  if (!raw) throw new Error(".mocharc.json is missing, so the number of test files mocha runs cannot be derived.");
  const spec = JSON.parse(raw).spec;
  const globs = Array.isArray(spec) ? spec : spec ? [spec] : [];
  if (!globs.length) throw new Error(".mocharc.json declares no spec, so the number of test files mocha runs cannot be derived.");
  return globs;
}

// A mocha glob as a regular expression. Only the two forms this repository
// uses are supported -- `**` for any depth and `*` within one segment -- and
// anything else throws rather than being silently mismatched.
function globToRegExp(glob) {
  if (/[?[\]{}!]/.test(glob)) throw new Error(`the spec glob ${glob} uses syntax this counter does not implement`);
  const pattern = glob
    .split("/")
    .map((segment) => {
      if (segment === "**") return "(?:.+/)?";
      return `${segment.replace(/[.+^$()|\\]/g, "\\$&").replace(/\*/g, "[^/]*")}/`;
    })
    .join("")
    .replace(/\/$/, "");
  return new RegExp(`^${pattern}$`);
}

function countMochaFiles() {
  const patterns = mochaSpecGlobs().map(globToRegExp);
  const found = new Set();
  const walk = (directory) => {
    for (const entry of fs.readdirSync(path.join(root, directory), { withFileTypes: true })) {
      const relative = `${directory}/${entry.name}`;
      if (entry.isDirectory()) walk(relative);
      else if (patterns.some((pattern) => pattern.test(relative))) found.add(relative);
    }
  };
  if (fs.existsSync(path.join(root, "tests"))) walk("tests");
  // A count of zero means the globs stopped matching, not that the suite is
  // empty. Reporting it would put a confident 0 into a document people read to
  // decide whether this is shippable.
  if (!found.size) throw new Error("no files matched the mocha spec; the counter has gone blind.");
  return found.size;
}

const testCount = countMochaFiles();

const serverLines = read("server.js").split("\n").length;

const packageJson = JSON.parse(read("package.json") || "{}");
const verifyChain = String(packageJson.scripts?.["verify:launch"] || "");
if (!verifyChain) problems.push("package.json has no verify:launch script; the checks listed below would be fiction");

// The sprint log is the one part that cannot be derived. Missing is fine on a
// first run; empty and pretending to be full is not.
const sprintLog = read("docs/SPRINT_LOG.md").trim();

// --- Assembly ------------------------------------------------------------

const productArchitecture = (agentsRules.match(/## Product Architecture\n([\s\S]*?)\n## /) || [])[1] || "";
const positioning = (agentsRules.match(/## Public Product Positioning\n([\s\S]*?)\n## /) || [])[1] || "";

const lines = [];
lines.push("# SONARA Handoff Prompt");
lines.push("");
lines.push("Paste this whole file as the first message to ChatGPT, Codex, or any other assistant picking up work on this repository.");
lines.push("");
lines.push("Generated by `scripts/generate-handoff-prompt.mjs` from the repository itself. Do not edit by hand -- the release runs it with `--check`. The one file to edit is `docs/SPRINT_LOG.md`, which is history and cannot be derived.");
lines.push("");

lines.push("## What you are working on");
lines.push("");
lines.push(productArchitecture.trim());
lines.push("");
lines.push(positioning.trim());
lines.push("");

lines.push("## How this codebase is built");
lines.push("");
lines.push("- One Express 4 CommonJS server (`server.js`, currently " + serverLines + " lines) served on Vercel through `api/index.js`.");
lines.push("- **No bundler and no build step.** Pages are HTML strings built on the server. There is no React, no JSX, no TypeScript compilation in the runtime path.");
lines.push("- Content-Security-Policy is `script-src 'self'`. Nothing loads from a CDN. Every asset is served from this origin.");
lines.push("- Supabase over PostgREST for data. " + migrationCount + " migrations, " + contract.DATABASE_TABLES.length + " canonical tables. Every tenant-scoped table is filtered by `organization_id`; the service-role key never reaches a browser.");
lines.push("- " + routeRegistry.PUBLIC_ROUTES.length + " public routes, " + routeRegistry.CUSTOMER_ROUTES.length + " customer routes, " + routeRegistry.ADMIN_ROUTES.length + " admin routes.");
lines.push("- " + testCount + " test files run under mocha. `pnpm test` is the whole suite and takes about ten seconds.");
lines.push("");
lines.push("Because there is no build step, a change to a `.cjs` file under `lib/` or `routes/` is live as soon as it is saved. There is no compile error to catch a typo -- `pnpm run typecheck` parses every runtime file, and that is the substitute.");
lines.push("");

lines.push("## Rules that are not negotiable");
lines.push("");
lines.push("Quoted from `AGENTS.md`, which is the source. Do not paraphrase these back to the user as though they were suggestions.");
lines.push("");
lines.push("### Safety");
lines.push(safetyRules.trim());
lines.push("");
lines.push("### Build and CI");
lines.push(buildRules.trim());
lines.push("");

lines.push("## The agent approval rule");
lines.push("");
lines.push("`lib/sonara-agent-authority.cjs` implements the safety rule above as code. " + authority.SENSITIVE_CATEGORY_NAMES.length + " categories require owner approval:");
lines.push("");
for (const entry of authority.SENSITIVE_CATEGORIES) {
  lines.push(`- **${entry.category.replace(/_/g, " ")}** -- ${entry.reason}`);
}
lines.push("");
lines.push(authority.SELF_SERVE_ACTIONS.length + " actions may run unattended: " + authority.SELF_SERVE_ACTIONS.map((entry) => "`" + entry.action + "`").join(", ") + ".");
lines.push("");
lines.push("Anything not on either list goes to the owner. The default is deny, deliberately -- a classifier that fails open fails open exactly when somebody adds a capability, which is the moment nobody is reading that file.");
lines.push("");

lines.push("## Using other people's code");
lines.push("");
lines.push(registerRecords.length + " external repositories have been reviewed and recorded in `data/open-source-tools.ts`. `docs/github-radar/GITHUB_RADAR_PRODUCT_INTEGRATION_MAP.md` says which product each one is for.");
lines.push("");
lines.push("Before adapting anything from a repository, check its record. The statuses mean what they say:");
lines.push("");
lines.push("- `optional_adapter_after_review` -- code may be adapted into SONARA's own implementation.");
lines.push("- `reference_only` / `research_only` -- read the patterns, take no code.");
lines.push("- `blocked` / `needs_license_review` -- neither, and the record says why.");
lines.push("");
lines.push("Two things that come up repeatedly and are worth stating plainly. A repository with **no licence declared is all rights reserved** -- the absence of a licence is not permission, and nobody on this project can grant what its author has not. And a **reciprocal licence (AGPL, GPL, OSL) triggers on network use**, so incorporating one into this hosted product obliges releasing this product's source under the same terms. Both are recorded per repository rather than left to be rediscovered.");
lines.push("");

lines.push("## Before you push");
lines.push("");
lines.push("Run `pnpm run verify:launch`. It chains:");
lines.push("");
for (const step of verifyChain.split("&&").map((part) => part.trim()).filter(Boolean)) {
  lines.push("- `" + step + "`");
}
lines.push("");
lines.push("`pnpm` only. Never `npm`, never `npm audit fix`, never a `package-lock.json`.");
lines.push("");

lines.push("## How to work here");
lines.push("");
lines.push("The recurring failure in this codebase is not broken code. It is **a signal that reports success without being true** -- a test that passes against a stub while the real path is broken, a gate asserting a guarantee that stopped holding, a check satisfied by an empty list. Several have been found and fixed; assume more exist.");
lines.push("");
lines.push("Practically, that means: when you add a check, verify it fails on bad input before trusting it green. When a list-based check could pass by being empty, assert the list is non-empty too. When you write a reason into a comment, make sure it is a reason you verified rather than one you reasoned to.");
lines.push("");

lines.push("## Sprint log");
lines.push("");
if (sprintLog) {
  lines.push(sprintLog);
} else {
  lines.push("_`docs/SPRINT_LOG.md` is empty. Add the most recent sprint there._");
}
lines.push("");

const generated = lines.join("\n");

if (problems.length) {
  for (const problem of problems) console.error(`ERROR: ${problem}`);
  process.exit(1);
}

if (checkOnly) {
  const existing = fs.existsSync(OUTPUT) ? fs.readFileSync(OUTPUT, "utf8") : "";
  if (existing !== generated) {
    console.error(`ERROR: ${path.relative(root, OUTPUT)} is out of date. Run: node scripts/generate-handoff-prompt.mjs`);
    process.exit(1);
  }
  console.log(`Handoff prompt verified against the repository: ${registerRecords.length} reviewed repositories, ${contract.DATABASE_TABLES.length} tables, ${testCount} test files.`);
} else {
  fs.writeFileSync(OUTPUT, generated);
  if (!fs.existsSync(SPRINT_LOG)) problems.push("docs/SPRINT_LOG.md does not exist yet");
  console.log(`Wrote ${path.relative(root, OUTPUT)}.`);
}
