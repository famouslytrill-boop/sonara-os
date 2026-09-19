#!/usr/bin/env node
// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Is the email provider configured for the variables this application actually
// reads?
//
// ## What was wrong with the previous version
//
// It could not fail. Its only `process.exit(1)` was guarded by
// `formsEnabled && strict`, and `formsEnabled` was computed from
//
//     ["app/contact/page.tsx", "app/support/page.tsx",
//      "app/help/page.tsx", "app/feedback/page.tsx"].some(existsSync)
//
// Next.js App Router paths. There is no `app/` directory in this repository and
// there never has been -- the runtime is Express with `routes/*.cjs`. So
// `formsEnabled` was permanently false, the branch was unreachable, and the
// script printed `[MISSING]` for every unset variable and then exited 0 saying
// "Email env check completed." That is shape 1 in
// .claude/skills/checks-that-cannot-lie: a check that reports success because
// its population is empty.
//
// ## And the list it checked was wrong too
//
// It required nine hardcoded variables: RESEND_API_KEY, RESEND_FROM_EMAIL,
// CONTACT_EMAIL, SUPPORT_EMAIL, HELP_EMAIL, BILLING_EMAIL, SECURITY_EMAIL,
// PRIVACY_EMAIL and LEGAL_EMAIL. Measured on 18 September 2026 across `lib/`,
// `routes/`, `api/` and `server.js`, seven of the nine were read by nothing,
// and the two address variables the runtime does use are named
// `SUPPORT_TO_EMAIL` and `CONTACT_TO_EMAIL` -- so five of the nine names did
// not exist anywhere and two were misspellings of ones that did. A check
// demanding values the code never looks at trains an operator to set variables
// that do nothing, and then its pass means nothing either.
//
// ## Where the list comes from now
//
// `lib/sonara-infrastructure-manifest.cjs` already declares what the Resend
// service requires, and `envReadiness` there, `/api/readiness` and the founder
// control plane all read that declaration. So this check reads it too rather
// than carrying a second list, because a second list is the one that drifts. A
// nested array in `envGroups` means "any one of these", which is how
// `SUPPORT_TO_EMAIL or CONTACT_TO_EMAIL` is expressed.
//
// If the manifest ever declares no requirements for the service, this exits 1
// rather than reporting every environment ready.
//
// This does not send anything. `pnpm run test:email` is the delivery test, and
// it only reaches a provider with an explicit `--send`.

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const root = process.cwd();
const require = createRequire(import.meta.url);

// The authoritative declaration, and the reason this file does not carry a list
// of its own: `lib/sonara-infrastructure-manifest.cjs` already declares what
// the Resend service requires, the readiness endpoints already read it, and a
// second list here would be the one that goes stale. A nested array in
// `envGroups` means "any one of these".
const { INFRASTRUCTURE_SERVICES } = require(path.join(root, "lib", "sonara-infrastructure-manifest.cjs"));

const SERVICE_KEY = "resend";

const service = INFRASTRUCTURE_SERVICES.find((entry) => entry.key === SERVICE_KEY);

if (!service) {
  console.error(`Email env check failed: no "${SERVICE_KEY}" service is declared in lib/sonara-infrastructure-manifest.cjs.`);
  console.error("Either the email provider was replaced -- in which case point this check at the new one --");
  console.error("or the manifest changed shape. It will not fall back to a list of its own and report success.");
  process.exit(1);
}

const groups = (service.envGroups || []).map((group) => (Array.isArray(group) ? group : [group])).filter((group) => group.length);

function parseEnvFile(file) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) return {};
  const out = {};
  for (const raw of fs.readFileSync(full, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const at = line.indexOf("=");
    if (at === -1) continue;
    out[line.slice(0, at).trim()] = line.slice(at + 1).trim().replace(/^['"]|['"]$/g, "").trim();
  }
  return out;
}

const env = { ...parseEnvFile(".env"), ...parseEnvFile(".env.local"), ...process.env };

// The rules the APPLICATION applies, not a looser restatement of them.
//
// The first version of this function accepted any non-empty value except four
// exact sentinel words, which meant `RESEND_API_KEY=replace-me` and
// `RESEND_FROM_EMAIL=fake` both made this check exit 0 and report email ready
// while `lib/sonara-readiness.cjs` treated delivery as unconfigured -- so the
// command advertised as the way to verify email said yes to environments the
// product says no to. Codex found it on PR #299, and my own falsification of
// the permissive direction had used `RESEND_API_KEY=x`, a one-character key
// this now correctly rejects.
//
// `isConfiguredSecret` and `isConfiguredEmail` come from
// lib/sonara-env-value-checks.cjs, which is where `server.js` gets them and
// where it passes them to `createReadiness`. One implementation, so this cannot
// drift away from what the running application decides.
const {
  isConfiguredSecret,
  isConfiguredEmail,
  MINIMUM_SECRET_LENGTH
} = require(path.join(root, "lib", "sonara-env-value-checks.cjs"));

// Which rule applies follows the readiness module: a *_EMAIL value must be a
// real address, and anything else is a secret held to the minimum length and
// the placeholder test.
function configured(name) {
  const value = env[name];
  if (typeof value !== "string" || !value.trim()) return false;
  return /EMAIL$/.test(name) ? isConfiguredEmail(value) : isConfiguredSecret(value);
}

const strict =
  process.argv.includes("--strict")
  || process.env.SONARA_STRICT_EMAIL_ENV === "true"
  || process.env.VERCEL_ENV === "production";

if (!groups.length) {
  console.error(`Email env check failed: the "${SERVICE_KEY}" service declares no required environment variables.`);
  console.error("A check over an empty requirement list reports every environment ready. It refuses to do that --");
  console.error("shape 1 in .claude/skills/checks-that-cannot-lie, and exactly how the previous version of this");
  console.error("script passed on every run for a month.");
  process.exit(1);
}

console.log(`Email environment readiness for ${service.label} (${service.launchStatus}), ${groups.length} requirement(s) declared in lib/sonara-infrastructure-manifest.cjs.`);
console.log(`- strict mode: ${strict ? "yes -- an unsatisfied requirement fails this check" : "no -- reporting only"}`);

const missing = [];
for (const group of groups) {
  const label = group.join(" or ");
  // Never the value, only whether there is one.
  if (group.some((name) => configured(name))) {
    console.log(`[OK]      ${label}`);
  } else {
    console.log(`[MISSING] ${label}`);
    missing.push(label);
  }
}

if (missing.length) {
  console.log("");
  console.log(`Not configured here: ${missing.join("; ")}.`);
  console.log("Set these in Vercel and mark RESEND_API_KEY sensitive. No secret values were printed.");
  console.log("A value counts as set on the application's own terms: an address must parse as one, and a secret");
  console.log(`must be at least ${MINIMUM_SECRET_LENGTH} characters and not a placeholder -- "replace-me" and "fake" are not configured.`);
  if (strict) {
    console.error(`\nEmail env check failed in strict mode: ${missing.length} of ${groups.length} requirement(s) unsatisfied.`);
    process.exit(1);
  }
  console.log("Not strict, so this is a report. Run with --strict, or in production, to make it a gate.");
  process.exit(0);
}

console.log(`\nEmail env verified: all ${groups.length} requirement(s) ${service.label} declares are configured.`);
