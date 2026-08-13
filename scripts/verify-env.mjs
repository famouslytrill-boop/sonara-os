import fs from "node:fs";
import path from "node:path";

// Every environment variable this application reads must have a decision
// attached to it.
//
// This was a hand-typed list of "required" names checked for presence in
// .env.example. Seven of its twelve were read by nothing — STRIPE_PRICE_STARTER
// and friends, whose real names all end _MONTHLY. It failed on every run, it was
// not in the release chain, and anybody who did run it would have chased eight
// variables that do not exist. A check nobody runs is not a check, and a stale
// one is worse than none: it teaches people the output is noise.
//
// So the list is derived from the source instead, and each name has to be
// classified below. Adding an env var without classifying it fails, which is
// the point — the classification is where somebody decides whether a paying
// customer can be served without it.

const root = process.cwd();
const SOURCE_DIRS = ["lib", "routes", "api", "scripts"];
const SOURCE_FILES = ["server.js"];
// .ts as well as .js: lib/env.ts and lib/env/server.ts declare names as string
// literals rather than reading process.env, and several variables are named
// only there. A scan that missed them reported STRIPE_WEBHOOK_SECRET as unused.
const SOURCE_EXTENSIONS = /\.(c?js|mjs|ts)$/;

// Cannot serve a paying customer without these.
const REQUIRED = new Set([
  "SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET",
  "RESEND_API_KEY", "RESEND_FROM_EMAIL",
  "NEXT_PUBLIC_SITE_URL"
]);

// Set by the platform. Nobody types these, and documenting them as settings
// would invite somebody to set them wrongly.
const PLATFORM_PROVIDED = new Set([
  "NODE_ENV", "PORT", "VERCEL", "VERCEL_ENV", "VERCEL_GIT_COMMIT_REF", "VERCEL_GIT_COMMIT_SHA"
]);

// A feature is unavailable without these and every path falls back to a stated
// setup-required. None may become a launch dependency.
const OPTIONAL_CAPABILITY = new Set([
  "ADMIN_EMAIL", "ADMIN_EMAILS", "SONARA_ADMIN_EMAILS", "FOUNDER_EMAILS",
  "APP_URL", "BASE_URL", "NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_API_URL", "PUBLIC_SITE_URL",
  "NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET", "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "STRIPE_SUCCESS_URL", "STRIPE_CANCEL_URL",
  "SONARA_CRON_SECRET", "SONARA_AI_PROVIDER", "SONARA_EMBEDDING_PROVIDER", "SONARA_VECTOR_MEMORY_PROVIDER",
  "CREATOR_MEDIA_WORKER_URL", "CREATOR_MEDIA_WORKER_TOKEN",
  "OPENAI_API_KEY", "GEMINI_API_KEY", "ELEVENLABS_API_KEY",
  "SUNO_API_KEY", "SUNO_API_BASE_URL", "SUNO_GENERATE_PATH", "SUNO_STATUS_PATH_TEMPLATE",
  "GA4_PROPERTY_ID", "GA4_ACCESS_TOKEN", "POSTHOG_PROJECT_API_KEY",
  "HUBSPOT_ACCESS_TOKEN", "KLAVIYO_PRIVATE_API_KEY",
  "GITHUB_TOKEN", "SUPABASE_ACCESS_TOKEN", "SUPABASE_PROJECT_ID",
  "REQUEST_TIMEOUT_MS", "WAIT_FOR_DEPLOYMENT_SECONDS", "EXPECTED_COMMIT_SHA",
  "SONARA_EXPECTED_SUPABASE_PROJECT_NAME", "SONARA_STRICT_EMAIL_ENV", "SONARA_VERIFY_USER_JWT",

  // The plan price ids, and the older names each still falls back to.
  //
  // Optional individually and by the letter of this set's rule: a missing price
  // makes that one plan report setup_required, which is a stated fallback and
  // not a crash. lib/sonara-readiness.cjs:301 resolves each primary name and
  // then its aliases, so every name below is genuinely read.
  //
  // Worth being plain about what that means together, though: it is possible to
  // set all ten required variables and still sell nothing, because "required
  // for paid usage" covers the machinery of charging and not the existence of
  // anything to charge for. Which price ids belong here is recorded in
  // docs/owner/OWNER-STEPS.md, verified against the live account.
  "STRIPE_PRICE_STARTER_MONTHLY", "STRIPE_PRICE_CORE_MONTHLY", "STRIPE_PRICE_PRO_MONTHLY",
  // The breadth plans. No price object exists for these yet, which is why they
  // are here rather than in the required list: the plan renders "Checkout is
  // not configured for this plan yet" until the owner creates one, and that is
  // the correct state rather than a fault.
  "STRIPE_PRICE_WORKSPACE_MONTHLY", "STRIPE_PRICE_ALL_THREE_MONTHLY", "STRIPE_PRICE_TEAM_MONTHLY",
  // The shared secret a scheduler presents to /api/agents/schedule/tick.
  // Optional: without it the endpoint answers 503 and no schedule runs, which
  // is a product with no scheduled work rather than a broken one. A customer
  // can be served without it.
  "SONARA_SCHEDULE_TICK_SECRET",
  "STRIPE_PRICE_ID_BUSINESS_BUILDER_MONTHLY", "STRIPE_PRICE_BUSINESS_BUILDER_STARTER_MONTHLY",
  "STRIPE_PRICE_ID_CREATOR_STUDIO_MONTHLY", "STRIPE_PRICE_BUSINESS_BUILDER_CORE_MONTHLY",
  "STRIPE_PRICE_CREATOR_STUDIO_CORE_MONTHLY", "STRIPE_PRICE_GROWTH_STUDIO_CORE_MONTHLY",
  "STRIPE_PRICE_ID_GROWTH_STUDIO_MONTHLY", "STRIPE_PRICE_BUSINESS_BUILDER_PRO_MONTHLY",
  "STRIPE_PRICE_CREATOR_STUDIO_PRO_MONTHLY", "STRIPE_PRICE_GROWTH_STUDIO_PRO_MONTHLY"
]);

// Turns a warning into a gate. Not required to run; required to know the deploy
// is telling the truth. docs/owner/OWNER-STEPS.md item 2.
const RATCHET = new Set(["SONARA_REQUIRE_LEAKED_PASSWORD_PROTECTION"]);

// Must never be true in production. The code enforces it as well as the
// classification — routes/sonara-last9-routes.cjs checks NODE_ENV and VERCEL_ENV
// so the variable alone cannot open it.
const DEVELOPMENT_ONLY = new Set(["SONARA_ALLOW_MANUAL_ORG_ID"]);

function walk(directory) {
  const found = [];
  if (!fs.existsSync(directory)) return found;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...walk(full));
    else if (SOURCE_EXTENSIONS.test(entry.name)) found.push(full);
  }
  return found;
}

// Only names this file already classifies are matched as string literals, so an
// unrelated constant cannot be mistaken for an environment variable.
const candidateNames = new Set([...REQUIRED, ...PLATFORM_PROVIDED, ...OPTIONAL_CAPABILITY, ...RATCHET, ...DEVELOPMENT_ONLY]);

// This file is excluded from its own scan.
//
// It lives under scripts/, and the string-literal pass matches any classified
// name it finds -- so every name in the lists above counted as "used" purely by
// being listed, and the stale-name check could never fire. That is the exact
// check that would have caught STRIPE_PRICE_STARTER, quietly answering its own
// question. Verified by renaming an entry and watching the stale error appear.
const SELF = path.join(root, "scripts", "verify-env.mjs");

const files = [...SOURCE_FILES.map((name) => path.join(root, name)), ...SOURCE_DIRS.flatMap((dir) => walk(path.join(root, dir)))]
  .filter((file) => path.resolve(file) !== SELF);
const used = new Set();
for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  for (const match of source.matchAll(/process\.env\.([A-Z][A-Z0-9_]{2,})/g)) used.add(match[1]);
  for (const match of source.matchAll(/process\.env\["([A-Z][A-Z0-9_]{2,})"\]/g)) used.add(match[1]);
  // Names that appear only as string literals -- readiness rows, the
  // infrastructure manifest, the env declarations in lib/env*.ts. A variable
  // this application knows about by name is one it uses, whether or not it
  // reaches it through process.env directly.
  for (const match of source.matchAll(/["'`]([A-Z][A-Z0-9_]{4,})["'`]/g)) {
    if (/^(GET|POST|PATCH|PUT|DELETE|HEAD|OPTIONS|TRUE|FALSE|NULL|HTML|JSON|UTF|SHA|HMAC|AES)/.test(match[1])) continue;
    if (candidateNames.has(match[1])) used.add(match[1]);
  }

  // The pass above cannot report anything.
  //
  // It only records a literal that is *already classified*, so a name this file
  // has never heard of is skipped rather than flagged -- which makes "every
  // variable the code reads is classified" true by construction. The filter is
  // there for a real reason (any shouty string literal would otherwise look
  // like a variable), but it turned the check into one that could only ever
  // confirm what it already believed.
  //
  // Thirteen names sat in that gap, and they were not incidental: the plan
  // table in server.js declares its price variables as `env:` and
  // `envAliases:` values, lib/sonara-readiness.cjs reads them at line 301, and
  // not one was classified. **The three that gate every paid plan were invisible
  // to the environment check while it reported success.**
  //
  // A key literally named `env` is not ambiguous, so this pass needs no
  // allow-list and is free to report a name nobody has classified yet.
  for (const match of source.matchAll(/\benv:\s*["'`]([A-Z][A-Z0-9_]{2,})["'`]/g)) used.add(match[1]);
  for (const match of source.matchAll(/\benvAliases:\s*\[([^\]]*)\]/g)) {
    for (const alias of match[1].matchAll(/["'`]([A-Z][A-Z0-9_]{2,})["'`]/g)) used.add(alias[1]);
  }
}

const errors = [];

if (used.size < 30) errors.push(`only ${used.size} environment variables found in source; the scan is not working`);

const classified = new Set([...REQUIRED, ...PLATFORM_PROVIDED, ...OPTIONAL_CAPABILITY, ...RATCHET, ...DEVELOPMENT_ONLY]);
for (const name of [...used].sort()) {
  if (!classified.has(name)) {
    errors.push(`${name} is read by the code and classified nowhere in scripts/verify-env.mjs. Decide whether a paying customer can be served without it.`);
  }
}

// The other direction. A name classified here and read nowhere is the stale
// entry this rewrite exists to prevent.
for (const name of [...classified].sort()) {
  if (!used.has(name)) {
    errors.push(`${name} is classified in scripts/verify-env.mjs and read by no source file. Remove it, or it becomes the next STRIPE_PRICE_STARTER.`);
  }
}

// Everything a person has to set must appear in .env.example, so there is one
// place to read rather than a grep.
const examplePath = path.join(root, ".env.example");
const example = fs.existsSync(examplePath) ? fs.readFileSync(examplePath, "utf8") : "";
if (!example) errors.push(".env.example is missing, so there is nowhere to read what has to be set.");

for (const name of [...REQUIRED, ...RATCHET].sort()) {
  if (!example.includes(`${name}=`)) errors.push(`${name} must be set for paid usage and is not in .env.example.`);
}

for (const error of errors) console.error(`ERROR: ${error}`);
if (errors.length) {
  console.error(`\nEnvironment verification failed with ${errors.length} problem(s).`);
  process.exit(1);
}

console.log(
  `Environment verified: ${used.size} variables read by the code, all classified — ` +
  `${REQUIRED.size} required for paid usage, ${RATCHET.size} ratchet, ${DEVELOPMENT_ONLY.size} development-only, ` +
  `${OPTIONAL_CAPABILITY.size} optional, ${PLATFORM_PROVIDED.size} platform-provided.`
);
