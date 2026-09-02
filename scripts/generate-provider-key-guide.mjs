#!/usr/bin/env node
"use strict";

// The owner's list of accounts to open, derived rather than written.
//
// Two registries describe every external provider this product can reach --
// lib/creator-generation-provider-registry.cjs and
// lib/growth-studio-provider-registry.cjs. Between them they carry the official
// documentation URL, the environment variables each adapter reads, and the
// notes about consent, licensing and cost that apply to it.
//
// That is everything an owner needs in order to go and open the accounts, and
// none of it was in one place. Writing it out by hand would produce a list that
// is correct on the day it is written and wrong the first time a provider is
// added, which is the failure mode this repository keeps finding. So it is
// generated, and --check fails the release chain when the document and the
// registries disagree.
//
// What is deliberately NOT here: prices. A provider's rate card is a figure
// this repository cannot verify, changes without notice, and would be believed
// because it appeared in a generated file. docs/pricing/ carries dated, sourced
// figures; this file carries the URL to go and read the current one.
//
// Nor are there any values. Variable NAMES only. Every one of these is read
// server-side; see AGENTS.md, "Keep service-role secrets server-only."

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = path.join(root, "docs", "owner", "PROVIDER-KEYS.md");

const { CREATOR_GENERATION_PROVIDERS } = require(path.join(root, "lib", "creator-generation-provider-registry.cjs"));
const { GROWTH_STUDIO_PROVIDERS } = require(path.join(root, "lib", "growth-studio-provider-registry.cjs"));

// What each integrationStatus means for somebody deciding whether to open an
// account today. Read out of the registry rather than restated, so a status
// nobody has explained here fails the run instead of rendering as a bare slug.
const STATUS_MEANING = Object.freeze({
  adapter_available: "An adapter is written. Set the variables and it works.",
  connector_required: "The adapter is written, but this provider issues credentials through an app review or partner process, so the account work comes first.",
  worker_candidate: "Runs as a self-hosted worker rather than a vendor account. No key to buy.",
  deployment_candidate: "Self-hosted software you would run yourself. No key to buy.",
  research_only: "Read and understood, not wired in. Nothing to configure.",
  review_required: "Licence or safety review is not finished. Do not configure it yet.",
  isolated_worker_only: "May only run inside an isolated worker. Nothing to configure from here."
});

function providersNeedingCredentials(providers) {
  return providers.filter((provider) => Array.isArray(provider.requiredEnv) && provider.requiredEnv.length > 0);
}

function providersNeedingNothing(providers) {
  return providers.filter((provider) => !(Array.isArray(provider.requiredEnv) && provider.requiredEnv.length > 0));
}

function bullet(text) {
  return `- ${text}`;
}

function renderCredentialed(provider, studio) {
  const lines = [];
  lines.push(`### ${provider.label}`);
  lines.push("");
  lines.push(`${STATUS_MEANING[provider.integrationStatus]}`);
  lines.push("");
  lines.push(`**Where to get it:** <${provider.officialUrl}>`);
  lines.push("");
  lines.push(`**Studio:** ${studio}. **Registry key:** \`${provider.key}\`.`);
  lines.push("");
  lines.push("**Set these, server-side only:**");
  lines.push("");
  lines.push("| Variable | What it is |");
  lines.push("| --- | --- |");
  for (const name of provider.requiredEnv) {
    const role = name === provider.baseUrlEnv
      ? "The API address. Only change it if the provider tells you to."
      : /TOKEN|KEY|SECRET/i.test(name)
        ? "The credential itself. Never in a client bundle, never in a commit."
        : "An account or property identifier the provider gives you.";
    lines.push(`| \`${name}\` | ${role} |`);
  }
  if (provider.enabledEnv) {
    lines.push(`| \`${provider.enabledEnv}\` | Set to \`true\` to switch the adapter on. Absent means off. |`);
  }
  if (provider.baseUrlEnv && !provider.requiredEnv.includes(provider.baseUrlEnv)) {
    lines.push(`| \`${provider.baseUrlEnv}\` | Optional. Defaults to \`${provider.defaultBaseUrl || "the provider's published address"}\`. |`);
  }
  lines.push("");
  if (provider.license) {
    lines.push(`**Licence:** ${provider.license}`);
    lines.push("");
  }
  if (Array.isArray(provider.notes) && provider.notes.length) {
    lines.push("**Before you turn it on:**");
    lines.push("");
    for (const note of provider.notes) lines.push(bullet(note));
    lines.push("");
  }
  return lines.join("\n");
}

function renderNoCredential(providers) {
  const lines = [];
  lines.push("| Provider | Why there is nothing to buy | Reference |");
  lines.push("| --- | --- | --- |");
  for (const provider of providers) {
    lines.push(`| ${provider.label} | ${STATUS_MEANING[provider.integrationStatus]} | <${provider.officialUrl}> |`);
  }
  return lines.join("\n");
}

function build() {
  const creator = CREATOR_GENERATION_PROVIDERS;
  const growth = GROWTH_STUDIO_PROVIDERS;
  const all = [...creator, ...growth];

  // Blindness guards. Every count below is satisfied by an empty registry, and
  // an owner reading "0 accounts to open" would reasonably conclude there was
  // nothing to do.
  const problems = [];
  if (creator.length < 10) problems.push(`the creator registry holds ${creator.length} providers; this generator has gone blind`);
  if (growth.length < 10) problems.push(`the growth registry holds ${growth.length} providers; this generator has gone blind`);
  for (const provider of all) {
    if (!provider.officialUrl) problems.push(`${provider.key} has no officialUrl, so this guide cannot say where to go`);
    if (!STATUS_MEANING[provider.integrationStatus]) {
      problems.push(
        `${provider.key} has integrationStatus "${provider.integrationStatus}", which STATUS_MEANING does not explain. ` +
          "Add the sentence rather than letting the slug render."
      );
    }
  }
  if (problems.length) {
    process.stderr.write(`Provider key guide cannot be generated:\n${problems.map((line) => `  ${line}`).join("\n")}\n`);
    process.exit(1);
  }

  const creatorPaid = providersNeedingCredentials(creator);
  const growthPaid = providersNeedingCredentials(growth);
  const free = providersNeedingNothing(all);

  const lines = [];
  lines.push("# Provider accounts and keys");
  lines.push("");
  lines.push("<!-- Generated by scripts/generate-provider-key-guide.mjs. Do not edit by hand. -->");
  lines.push("");
  lines.push(
    `This is every external provider the application can reach, read out of the two provider registries. ` +
      `Of ${all.length} providers, **${creatorPaid.length + growthPaid.length} need an account and a credential** and ` +
      `**${free.length} need nothing bought** -- they are self-hosted software, model weights, or references that are ` +
      `read rather than called.`
  );
  lines.push("");
  lines.push("## What only you can do");
  lines.push("");
  lines.push(
    "Every credential below is issued to a person who accepts that provider's terms. Nothing in this repository " +
      "can open an account, agree to terms, or pay an invoice on your behalf, so this section is the manual half " +
      "and it stays manual. The work per provider is the same four steps:"
  );
  lines.push("");
  lines.push("1. Open the documentation link and create an account.");
  lines.push("2. Read the current rate card on that page. It is not reproduced here, because a price copied into a file is wrong the moment the provider changes it.");
  lines.push("3. Create the credential in that provider's console.");
  lines.push("4. Set the variables in your hosting environment, server-side. Never in a client bundle, never in a commit.");
  lines.push("");
  lines.push(
    "Then set the provider's `*_ENABLED` variable to `true`. Until you do, the adapter stays off and the product " +
      "says the capability is unavailable rather than failing when somebody uses it."
  );
  lines.push("");
  lines.push("## Creator Studio generation providers");
  lines.push("");
  lines.push(`${creatorPaid.length} of ${creator.length} need a credential.`);
  lines.push("");
  for (const provider of creatorPaid) lines.push(renderCredentialed(provider, "Creator Studio"));
  lines.push("## Growth Studio providers");
  lines.push("");
  lines.push(`${growthPaid.length} of ${growth.length} need a credential.`);
  lines.push("");
  for (const provider of growthPaid) lines.push(renderCredentialed(provider, "Growth Studio"));
  lines.push("## The ones with nothing to buy");
  lines.push("");
  lines.push(
    `${free.length} providers need no vendor account. Most are model families or open-source software: running them ` +
      "costs compute rather than a subscription, and the licence on each is recorded in `data/open-source-tools.ts`. " +
      "A reciprocal licence (AGPL, GPL, OSL) triggers on network use, so check the register before incorporating one " +
      "into this hosted product."
  );
  lines.push("");
  lines.push(renderNoCredential(free));
  lines.push("");
  lines.push("## Where the money questions are answered");
  lines.push("");
  lines.push(
    "- `docs/pricing/` carries dated, sourced competitor and restructure figures. Read those rather than a remembered number.\n" +
      "- `scripts/verify-paid-capability-margins.mjs` holds the floor under each paid capability and fails the release chain " +
      "if a price drops below its cost. That is the check that stops a capability being sold at a loss; it is not a rate card for these providers.\n" +
      "- `data/open-source-tools.ts` records the licence and integration limit for every reviewed repository. A repository " +
      "with no licence declared is all rights reserved."
  );
  lines.push("");
  return `${lines.join("\n")}\n`;
}

const body = build();
const wanted = process.argv.includes("--check");

if (wanted) {
  if (!fs.existsSync(outputPath)) {
    process.stderr.write(`${path.relative(root, outputPath)} does not exist. Run: node scripts/generate-provider-key-guide.mjs\n`);
    process.exit(1);
  }
  const onDisk = fs.readFileSync(outputPath, "utf8");
  if (onDisk !== body) {
    process.stderr.write(
      `${path.relative(root, outputPath)} no longer matches the provider registries.\n` +
        "A provider was added, removed or changed and the guide was not regenerated.\n" +
        "Run: node scripts/generate-provider-key-guide.mjs\n"
    );
    process.exit(1);
  }
  const total = CREATOR_GENERATION_PROVIDERS.length + GROWTH_STUDIO_PROVIDERS.length;
  const credentialed = providersNeedingCredentials([...CREATOR_GENERATION_PROVIDERS, ...GROWTH_STUDIO_PROVIDERS]).length;
  process.stdout.write(
    `Provider key guide verified against the registries: ${total} providers, ${credentialed} needing an account and a credential.\n`
  );
  process.exit(0);
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, body);
process.stdout.write(`Wrote ${path.relative(root, outputPath)}: ${CREATOR_GENERATION_PROVIDERS.length + GROWTH_STUDIO_PROVIDERS.length} providers.\n`);
