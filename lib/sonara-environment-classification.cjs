"use strict";

// How every environment variable this application reads is classified.
//
// Lifted out of scripts/verify-env.mjs on 2 September 2026 so the release gate
// and docs/owner/PROVIDER-KEYS.md read one list rather than two. The generator
// needed to know which variables an owner must set, and copying the sets into
// it would have created exactly the drift this repository has already paid for
// three times -- most recently in the register parser, where three copies of one
// regex disagreed the moment one learned to read a quoted key.
//
// The comments are the originals. They are the reasoning, not decoration, and
// they belong with the sets rather than with the script that used to hold them.

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
//
// The first six are the runtime's -- Node's and Vercel's -- and reach a serving
// process. GITHUB_STEP_SUMMARY is the odd one and is here rather than under
// OPTIONAL_CAPABILITY for the reason this list gives: GitHub Actions sets it,
// nobody types it, and it never reaches a customer at all.
// scripts/report-production-schema-gaps.mjs appends its findings to that file
// when it is present so the report lands on the run summary as well as in the
// log; with no such file the report still prints in full. There is no capability
// to switch off, so classifying it as one would overstate what it does.
const PLATFORM_PROVIDED = new Set([
  "NODE_ENV", "PORT", "VERCEL", "VERCEL_ENV", "VERCEL_GIT_COMMIT_REF", "VERCEL_GIT_COMMIT_SHA",
  "GITHUB_STEP_SUMMARY"
]);

// A feature is unavailable without these and every path falls back to a stated
// setup-required. None may become a launch dependency.
//
// Six names left this list on 19 August 2026, when the Next.js application under
// app/ was deleted. They were read by nothing that runs -- lib/env/server.ts,
// lib/auth/workspace.ts, lib/sonara/ai/providerConfig.ts and
// lib/sonara/memory/vectorProvider.ts named them, and none of those files was
// ever deployed. This check reported them as classified-and-unread the moment
// the dead tree went, which is the half of it that exists for exactly this.
//
// SONARA_ADMIN_EMAILS was the one that mattered: five documents told the owner
// to set it for admin access and nothing on the running server has ever read
// it. FOUNDER_EMAILS, ADMIN_EMAILS and ADMIN_EMAIL are the live ones.
//
// NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY left with the nine orphaned validator
// scripts deleted in the same commit. Checkout here is server-side: server.js
// creates the Stripe session and redirects, so no publishable key ever reaches
// a browser. docs/SONARA_DEPLOYMENT_TRUTH.md lists it as needed "when
// browser-side Stripe.js is introduced", which is the honest place for it --
// a classification here would mean this check vouches for a variable nothing
// reads.
const OPTIONAL_CAPABILITY = new Set([
  "ADMIN_EMAIL", "ADMIN_EMAILS", "FOUNDER_EMAILS",
  "APP_URL", "BASE_URL", "NEXT_PUBLIC_APP_URL", "PUBLIC_SITE_URL",
  "STRIPE_SUCCESS_URL", "STRIPE_CANCEL_URL",
  "SONARA_CRON_SECRET",
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
  // Connected payments, so a business can be paid by its own customers.
  //
  // Optional, and it must stay optional: Stripe Connect has to be enabled on
  // the platform account before any of those calls succeed, and that is a
  // dashboard step nothing here can perform or verify. Without it every
  // connected-payment path answers setup_required with the step named, which is
  // a product that cannot yet collect on behalf of a business rather than a
  // broken one. A customer can be served without it -- they raise invoices and
  // are paid the way they already are.
  //
  // Deliberately a flag rather than a secret. The credential is the existing
  // STRIPE_SECRET_KEY; this only says whether the platform side is ready, and a
  // flag is the one thing an owner can set truthfully from what they can see in
  // their own dashboard.
  "STRIPE_CONNECT_ENABLED",
  // Web push. Optional, and it must stay optional for two separate reasons.
  //
  // The ordinary one: a customer with no push configured gets email and the
  // pages they already use, which is the product working rather than a product
  // broken. `pushReadiness()` reports setup_required naming the missing keys.
  //
  // The one that is a rule rather than a preference: AGENTS.md says *"Sounds,
  // voice announcements, haptics, SMS, push, and email alerts must be off or
  // explicitly user-controlled by default."* Push being free does not make it
  // default-on, and a required classification here would be this check
  // vouching for the opposite.
  //
  // VAPID_PRIVATE_KEY is a signing key and belongs nowhere near a browser. It
  // is read only by lib/sonara-web-push.cjs, which runs server-side.
  // VAPID_PUBLIC_KEY does reach the browser -- a subscription cannot be created
  // without it -- and that is correct: it is the public half.
  // Browser-to-browser calling. Optional, and for a reason worth writing down
  // rather than the usual one.
  //
  // The tempting alternative is a hardcoded public STUN address, which would
  // make calling work everywhere on day one with no configuration. CLAUDE.md
  // rules it out: *"A hosted service with a free tier is a price, not a
  // licence, and a shipped feature resting on one stops working when the tier
  // changes -- which is the vendor's decision, not this project's."*
  //
  // With none of these set, `callReadiness` reports setup_required and names
  // the variable, and the call page says so instead of offering a button that
  // cannot work. Calls between two devices on the same network still connect,
  // because host candidates need no server at all.
  //
  // SONARA_TURN_SECRET is a secret in the AGENTS.md sense and must stay
  // server-only: it signs the ephemeral TURN credentials handed to browsers.
  // The credentials themselves reach a browser and are meant to -- they expire
  // within the hour. The secret that mints them does not expire at all.
  "SONARA_STUN_URLS", "SONARA_TURN_URL", "SONARA_TURN_SECRET",
  "VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT",
  "STRIPE_PRICE_ID_BUSINESS_BUILDER_MONTHLY", "STRIPE_PRICE_BUSINESS_BUILDER_STARTER_MONTHLY",
  "STRIPE_PRICE_ID_CREATOR_STUDIO_MONTHLY", "STRIPE_PRICE_BUSINESS_BUILDER_CORE_MONTHLY",
  "STRIPE_PRICE_CREATOR_STUDIO_CORE_MONTHLY", "STRIPE_PRICE_GROWTH_STUDIO_CORE_MONTHLY",
  "STRIPE_PRICE_ID_GROWTH_STUDIO_MONTHLY", "STRIPE_PRICE_BUSINESS_BUILDER_PRO_MONTHLY",
  "STRIPE_PRICE_CREATOR_STUDIO_PRO_MONTHLY", "STRIPE_PRICE_GROWTH_STUDIO_PRO_MONTHLY",
  // Both were read by the application and classified nowhere, and both were
  // invisible here until the constant-resolving pass below existed: the name is
  // bound to a constant and the read is by identifier.
  //
  // SONARA_TOTP_KEY seals every TOTP secret, recovery-code pepper and parked
  // session on the system. Optional rather than required because
  // lib/sonara-secret-box.cjs refuses to switch the second factor on without it
  // and says so on the page -- it does not fall back to storing secrets in the
  // clear -- so a customer without it has no second factor rather than a broken
  // one. Set it once: changing it makes every enrolled factor unreadable.
  //
  // SONARA_UPLOAD_BUCKET names the bucket customer files go to, and
  // lib/sonara-file-storage.cjs falls back to DEFAULT_BUCKET without it.
  "SONARA_TOTP_KEY", "SONARA_UPLOAD_BUCKET"
]);

// Turn a warning into a gate. Not required to run; required to know a check is
// telling the truth. Two now, with different scopes.
//
// SONARA_REQUIRE_LEAKED_PASSWORD_PROTECTION is about production --
// docs/owner/OWNER-STEPS.md item 2.
//
// SONARA_MIGRATION_REPLAY_REQUIRED is about CI, and never reaches a customer.
// scripts/verify-migration-replay.mjs is the only check here that executes the
// migrations rather than reading them, and it cannot run without PostgreSQL. A
// contributor without one should get a loud notice rather than a blocked
// commit; CI must get a failure, or the skip path becomes the only path that
// ever runs and the check stops being one. .github/workflows/sonara-industries-ci.yml
// sets it, and tests/migrations-are-replayed-not-just-read.test.js asserts CI
// still does.
const RATCHET = new Set(["SONARA_REQUIRE_LEAKED_PASSWORD_PROTECTION", "SONARA_MIGRATION_REPLAY_REQUIRED"]);

// Must never be true in production. The code enforces it as well as the
// classification — routes/sonara-last9-routes.cjs checks NODE_ENV and VERCEL_ENV
// so the variable alone cannot open it.
const DEVELOPMENT_ONLY = new Set(["SONARA_ALLOW_MANUAL_ORG_ID"]);

module.exports = { REQUIRED, PLATFORM_PROVIDED, OPTIONAL_CAPABILITY, RATCHET, DEVELOPMENT_ONLY };
