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
const { REQUIRED, OPTIONAL_CAPABILITY } = require(path.join(root, "lib", "sonara-environment-classification.cjs"));

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

// The variables an owner sets that are not a provider's. They come from the
// same classification the release gate uses, so a variable added there appears
// here without anybody remembering to add it.
//
// Grouped by the account somebody has to open, because that is the unit of
// work: one signup yields several variables, and a list ordered by variable
// name makes one job look like five.
const PLATFORM_ACCOUNTS = Object.freeze([
  {
    name: "Supabase",
    what: "The database, sign-in, and file storage. Nothing works without it.",
    url: "https://supabase.com/dashboard",
    steps: [
      "Create a project. Any region; pick the one nearest your customers.",
      "Open **Project Settings -> API**.",
      "Copy the **Project URL** and the **anon public** key.",
      "Copy the **service_role** key from the same page. It bypasses every row-level security rule, so it is server-side only and never reaches a browser.",
      "Under **Authentication -> Providers**, turn on Email, and turn on **Leaked password protection**."
    ],
    variables: ["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]
  },
  {
    name: "Stripe",
    what: "Taking payments and knowing who is on which plan.",
    url: "https://dashboard.stripe.com/apikeys",
    steps: [
      "Create an account and complete the business details Stripe asks for. Payouts do not start until it is done.",
      "From **Developers -> API keys**, copy the **Secret key**. Use the test key until you have run a real purchase through.",
      "From **Developers -> Webhooks**, add an endpoint at `https://YOUR-DOMAIN/api/stripe/webhook` and copy its **Signing secret**.",
      "Create a product and a recurring price for each plan you sell, and copy each price id into its `STRIPE_PRICE_*` variable.",
      "The webhook secret is what proves a message came from Stripe. Without it, anything that can reach the endpoint can claim somebody paid."
    ],
    variables: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"]
  },
  {
    name: "Resend",
    what: "Sending email: sign-in links, receipts, notifications.",
    url: "https://resend.com/api-keys",
    steps: [
      "Create an account and add the domain you send from.",
      "Add the DNS records Resend gives you and wait for the domain to verify. Sending before it verifies puts your mail in spam folders and is hard to undo.",
      "Create an API key with send permission.",
      "Set the from-address to something at that verified domain."
    ],
    variables: ["RESEND_API_KEY", "RESEND_FROM_EMAIL"]
  },
  {
    name: "Your own domain",
    what: "Where the application lives. Used to build links in email and to sign webhooks against.",
    url: "https://vercel.com/docs/projects/domains",
    steps: [
      "Point your domain at the deployment.",
      "Set the site URL to the full address including `https://`, and no trailing slash."
    ],
    variables: ["NEXT_PUBLIC_SITE_URL"]
  },
  {
    name: "Nothing to buy: the second factor key",
    what: "Seals every TOTP secret, recovery-code pepper and parked sign-in on the system.",
    url: "https://www.rfc-editor.org/rfc/rfc6238",
    steps: [
      "Generate it yourself: `openssl rand -hex 32`.",
      "Set it once and keep it. Changing it makes every enrolled second factor unreadable.",
      "Until it is set, two-factor authentication refuses to switch on and says so. It does not fall back to storing secrets in the clear."
    ],
    variables: ["SONARA_TOTP_KEY"]
  }
]);

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
  // Every variable the release gate calls required must be somewhere an owner
  // can act on. A guide that omits one is a guide that reads as complete and
  // leaves the application unable to serve a customer.
  const covered = new Set(PLATFORM_ACCOUNTS.flatMap((account) => account.variables));
  const uncovered = [...REQUIRED].filter((name) => !covered.has(name)).sort();
  if (uncovered.length) {
    problems.push(
      `these variables are required to serve a paying customer and this guide does not say how to get them: ${uncovered.join(", ")}`
    );
  }
  // And the other direction: an account listing a variable nothing reads is a
  // step somebody follows for no reason.
  const known = new Set([...REQUIRED, ...OPTIONAL_CAPABILITY]);
  const unknown = [...covered].filter((name) => !known.has(name)).sort();
  if (unknown.length) {
    problems.push(`this guide asks for variables the application does not read: ${unknown.join(", ")}`);
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
  // The platform half, first, because none of the providers below matter until
  // the application runs at all.
  lines.push("## Before any of the providers: the accounts the application itself needs");
  lines.push("");
  lines.push(
    `${REQUIRED.size} variables are required to serve a paying customer, and they come from ` +
      `${PLATFORM_ACCOUNTS.filter((account) => account.variables.some((name) => REQUIRED.has(name))).length} accounts. ` +
      "Grouped by the account you open rather than by variable name: one signup yields several variables, and a list " +
      "ordered by name makes one job look like five."
  );
  lines.push("");
  for (const account of PLATFORM_ACCOUNTS) {
    const required = account.variables.filter((name) => REQUIRED.has(name));
    lines.push(`### ${account.name}`);
    lines.push("");
    lines.push(account.what);
    lines.push("");
    lines.push(`**Where:** <${account.url}>`);
    lines.push("");
    lines.push(required.length === account.variables.length
      ? "**Required to serve a paying customer.**"
      : required.length
        ? `**${required.length} of these ${account.variables.length} are required to serve a paying customer.**`
        : "**Optional.** The feature it powers says so on the page when it is missing, rather than failing when somebody uses it.");
    lines.push("");
    account.steps.forEach((step, index) => lines.push(`${index + 1}. ${step}`));
    lines.push("");
    lines.push("| Variable | Required |");
    lines.push("| --- | --- |");
    for (const name of account.variables) {
      lines.push(`| \`${name}\` | ${REQUIRED.has(name) ? "Yes" : "No"} |`);
    }
    lines.push("");
  }

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
