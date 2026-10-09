#!/usr/bin/env node
// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Once somebody has subscribed, there is nothing further to ask them for.
//
// The owner's instruction, three times over: "there are no rate limits once
// subscribed... Nothing else to buy nothing else to do. You subscribe, you use
// the service"; "when subscribed to desired workspace, everything in that
// workspace becomes yours to do with and use as you please for that subscription
// length"; and "there are no provider quotes rate limits still stand but
// providing quotes and intake forms are out".
//
// That last clause matters and is easy to lose: an **upstream provider's** limit
// still applies, because it is not ours to waive. What is forbidden is ours --
// a throttle on a subscriber's own work, a quote to request, a form to fill in
// before a feature opens.
//
// ## What this can and cannot check
//
// It checks three properties, and says so rather than implying it has checked the
// promise whole:
//
//   1. Every rate limiter in the runtime is registered below with the reason it
//      exists, and the registration is two-sided -- an unregistered limiter fails,
//      and a registered one that no longer exists fails too, because a reason that
//      describes nothing is what the next person reads instead of checking.
//
//   2. Every limiter that can fire on a signed-in subscriber's own work has a
//      floor under its allowance. This is the one with teeth: 45 writes a minute
//      is a ceiling above honest use, and 5 would be a throttle. Nothing stops
//      somebody editing that number except this.
//
//   3. No customer-facing copy asks for a quote, an intake form, a demo booking
//      or a conversation with sales.
//
// It does not check that a plan's contents match its price, and it does not check
// that no feature inside a workspace charges again -- `verify:lifecycle-evidence`
// and `verify:margins` cover adjacent ground and neither is this. Saying so is
// the point: a check that implied it had verified "nothing else to buy" whole
// would be the defect this repository is about.
//
// It also does not check the **generation allowance** #417 added
// (lib/sonara-generation-allowance.cjs): a sum included each billing period for
// AI generation, which answers 429 once used up. That is a quota rather than a
// rate limit, it exists because each generation costs real money at an upstream
// provider, and its own page says "Provider limits still apply. No extra purchase
// required." -- the owner's stated exception ("provider ... rate limits still
// stand") in the owner's own terms, with nothing offered for sale. Whether an
// included allowance is the right answer is a pricing decision and the owner's.
// What would be this check's business is a page offering to sell more, and the
// copy check below would catch that.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { withoutComments } from "../lib/sonara-comment-stripping.cjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

let failed = false;
function fail(message) {
  failed = true;
  console.error(`Subscription completeness verification failed: ${message}`);
}

// ---------------------------------------------------------------------------
// 1. Why each limiter exists
// ---------------------------------------------------------------------------

// `anonymous_surface`  nobody is signed in, so no subscription is being limited.
// `credential_guard`   it stands in front of a secret and exists to make guessing
//                      expensive. Tight is correct here.
// `abuse_ceiling`      a signed-in subscriber can hit it, so it needs a floor. The
//                      floor is in MINIMUM_SUBSCRIBER_RATE below.
const LIMITERS = Object.freeze({
  "auth.login": "credential_guard",
  "auth.two_factor": "credential_guard",
  "auth.signup": "anonymous_surface",
  "auth.password_reset": "anonymous_surface",
  "auth.password_reset_submit": "credential_guard",
  "auth.invite_accept": "credential_guard",
  "auth.google_start": "anonymous_surface",
  "auth.google_callback": "anonymous_surface",
  "business.management_unlock": "credential_guard",
  "business.procurement_mutation": "abuse_ceiling",
  "business.work_order_mutation": "abuse_ceiling",
  "scroll_site_write": "abuse_ceiling",
  // Added by #417. 120 a minute per subscriber, 7200 an hour -- a ceiling over a
  // runaway client, well clear of anybody pressing a button. Separate from the
  // generation allowance in lib/sonara-generation-allowance.cjs, which is a quota
  // and is described in the header rather than checked here.
  "creator.generation.submit": "abuse_ceiling",
  account_avatar_upload: "abuse_ceiling",
  lead_capture_chat: "anonymous_surface",
  public_booking: "anonymous_surface",
  public_event_rsvp: "anonymous_surface",
  public_store_order: "anonymous_surface",
  public_channel_report: "anonymous_surface",
  // Authenticated block toggles cannot become a throttle on normal subscription
  // activity; the database separately enforces the saved-block safety limit.
  growth_channel_block_toggle: "abuse_ceiling",
  // Stripe's Connect webhook: nobody is signed in, and the signature is what
  // authenticates it.
  stripe_connect_webhook: "anonymous_surface",
  // Resend's delivery receipts for campaign email: nobody is signed in, and the
  // Svix signature is what authenticates it.
  email_receipt_webhook: "anonymous_surface",
  // A signed-in buyer starting a marketplace checkout.
  marketplace_buy: "abuse_ceiling",
  // A storefront buyer has no account: the receipt and its pay button are opened
  // with the receipt token alone.
  public_store_receipt: "anonymous_surface",
  public_store_payment: "anonymous_surface",
  // A business manager recording a payment from Stripe's own record.
  "business.storefront_reconcile": "abuse_ceiling"
});

// Writes per hour, below which a limiter stops being a ceiling over abuse and
// starts being a cap on somebody's day.
//
// 600/hour is ten a minute sustained. The first draft said 300, and the
// falsification found that badly chosen rather than merely low: throttling work
// orders from 45 a minute to 5 lands on exactly 300/hour, so the check passed on
// `<` while the limiter had become a cap somebody meets during an ordinary
// afternoon. A floor a realistic throttle sits exactly on is not a floor.
//
// The real limiters are well clear -- procurement 1800/hour, work orders 2700 --
// and the two that are under it carry their own figure in RATE_EXCEPTIONS, because
// an exception with a number somebody has to look at is harder to erode than a
// floor quietly lowered to fit.
const MINIMUM_SUBSCRIBER_RATE = 600;
const RATE_EXCEPTIONS = Object.freeze({
  scroll_site_write: {
    perHour: 240,
    reason:
      "A scroll site is one document somebody edits, not rows added in bulk: 240 saves an hour is four a minute "
      + "on a page nobody edits that fast. Measured 3 October 2026 against lib/sonara-scroll-site.cjs, where one "
      + "save rewrites the whole document."
  },
  account_avatar_upload: {
    perHour: 20,
    reason:
      "A profile picture. Twenty an hour is past any honest use of one person's own avatar, and each upload is a "
      + "round trip to the file store rather than a row."
  }
});

// ---------------------------------------------------------------------------
// Read the runtime
// ---------------------------------------------------------------------------

const SOURCE_DIRECTORIES = ["lib", "routes"];

function runtimeFiles() {
  const files = [path.join(repoRoot, "server.js")];
  for (const directory of SOURCE_DIRECTORIES) {
    const base = path.join(repoRoot, directory);
    if (!fs.existsSync(base)) continue;
    for (const name of fs.readdirSync(base)) {
      if (!/\.(c?js)$/.test(name)) continue;
      files.push(path.join(base, name));
    }
  }
  return files;
}

const files = runtimeFiles();
if (files.length < 100) {
  fail(`only ${files.length} runtime files were read; this check has gone blind.`);
}

/**
 * Every rate limiter the runtime constructs, with its numbers.
 *
 * One pattern for every call form, because the first version had one pattern per
 * form it knew about and the application grew a form it did not. #417 added
 *
 *     (deps.createRateLimiter || createRateLimiter)({ name: "creator.generation.submit", ... })
 *
 * -- a limiter a paying Creator subscriber can hit -- and this check went on
 * reporting "17 rate limiters, every one accounted for" because
 * `createRateLimiter({` does not match `createRateLimiter)({`. It did not fail on
 * an unregistered limiter. It never saw one. That is shape 2: a scan naming a
 * smaller population than the one it claims, and printing the claim.
 *
 * The pattern: anything ending `RateLimiter`, an optional closing paren (the
 * `(a || b)(` form), the call's open paren, an optional string name (the auth
 * factory's form), then the options object. A definition or a forwarder --
 * `function createRateLimiter({ name, ... })` -- matches too and is skipped below
 * because its `name` is a variable rather than a literal; the forwarder's call
 * sites are where the names are, and they are picked up as calls.
 *
 * PARSER_FIXTURES below hold one of each form, including the one that got through.
 */
const LIMITER_CALL = /[Cc]reate(?:Auth)?RateLimiter\)?\s*\(\s*(?:"([^"]+)"\s*,\s*)?\{([\s\S]{0,700}?)\}\s*\)/g;

function limitersIn(source) {
  const found = [];
  for (const match of source.matchAll(LIMITER_CALL)) {
    const body = match[2];
    const literal = match[1] || (body.match(/name:\s*"([^"]+)"/) || [])[1];
    if (!literal) continue;
    found.push({ name: literal, ...numbersIn(body) });
  }
  return found;
}

function numbersIn(body) {
  const window = body.match(/windowSeconds:\s*(\d+)/);
  const attempts = body.match(/maxAttempts:\s*(\d+)/);
  return {
    windowSeconds: window ? Number(window[1]) : null,
    maxAttempts: attempts ? Number(attempts[1]) : null
  };
}

const seen = new Map();
for (const file of files) {
  const source = withoutComments(fs.readFileSync(file, "utf8"));
  for (const limiter of limitersIn(source)) {
    // The factory in lib/sonara-customer-auth.cjs forwards a name it was given;
    // its own call site is where the name is, and that is picked up from server.js.
    if (limiter.name === "name") continue;
    seen.set(limiter.name, { ...limiter, file: path.relative(repoRoot, file) });
  }
}

// The parser, tested on every call form this repository uses before its count is
// believed. A form it cannot read does not fail as unregistered -- it vanishes --
// so the only way to know the population is whole is to show the parser each
// shape and watch it read the name back.
const PARSER_FIXTURES = Object.freeze([
  { form: "direct", source: 'createRateLimiter({ name: "a.direct", windowSeconds: 60, maxAttempts: 30 })', name: "a.direct" },
  { form: "through deps", source: 'deps.createRateLimiter({ name: "a.deps", windowSeconds: 60, maxAttempts: 30 })', name: "a.deps" },
  // The form that got through. #417's generation limiter is built this way.
  { form: "either-or", source: '(deps.createRateLimiter || createRateLimiter)({\n    name: "a.either", windowSeconds: 60, maxAttempts: 120,\n  })', name: "a.either" },
  { form: "auth factory", source: 'createAuthRateLimiter("a.auth", { windowSeconds: 900, maxAttempts: 10 })', name: "a.auth" }
]);

for (const fixture of PARSER_FIXTURES) {
  const read = limitersIn(fixture.source).map((limiter) => limiter.name);
  if (!read.includes(fixture.name)) {
    fail(
      `the limiter parser no longer reads the ${fixture.form} form: ${JSON.stringify(fixture.source)}. `
      + "A limiter built that way is invisible to this check, so \"every one accounted for\" would be a claim about "
      + "fewer limiters than exist."
    );
  }
}
// And a definition must not be read as a limiter. `name` there is a parameter.
if (limitersIn("function createRateLimiter({ name, windowSeconds, maxAttempts }) {}").length) {
  fail("the limiter parser reads a function definition as a limiter; its names would be variables, not limiters.");
}

// Shape 1, twice over: no limiters found, or far fewer than the application has.
if (seen.size < 10) {
  fail(
    `only ${seen.size} rate limiter(s) found in ${files.length} runtime files; this check has gone blind. `
    + "The application has carried at least fifteen since the storefront landed, so a number this low means the "
    + "parser stopped matching rather than that the limiters went away."
  );
}

// ---------------------------------------------------------------------------
// 2. Every limiter is accounted for, and the account is two-sided
// ---------------------------------------------------------------------------

let subscriberFacing = 0;

for (const [name, limiter] of seen) {
  const reason = LIMITERS[name];
  if (!reason) {
    fail(
      `${limiter.file} creates a rate limiter named ${name} and this check does not know why it exists.\n`
      + "    Register it in LIMITERS in this file as anonymous_surface, credential_guard, or abuse_ceiling.\n"
      + "    An abuse_ceiling is one a signed-in subscriber can hit, and it has to clear the floor below --\n"
      + "    which is the point: the owner's instruction is that a subscription is not rationed."
    );
    continue;
  }
  if (reason !== "abuse_ceiling") continue;

  subscriberFacing += 1;
  if (!limiter.windowSeconds || !limiter.maxAttempts) {
    fail(`${name} is registered as a ceiling on a subscriber's own work and this check could not read its numbers from ${limiter.file}.`);
    continue;
  }
  const perHour = (limiter.maxAttempts / limiter.windowSeconds) * 3600;
  const exception = RATE_EXCEPTIONS[name];
  const floor = exception ? exception.perHour : MINIMUM_SUBSCRIBER_RATE;

  if (exception && perHour > MINIMUM_SUBSCRIBER_RATE) {
    fail(
      `${name} has an exception recorded for being below the ${MINIMUM_SUBSCRIBER_RATE}/hour floor, and it now allows `
      + `${Math.round(perHour)}/hour.\n    Remove the exception from RATE_EXCEPTIONS. A reason that no longer describes `
      + "anything is what the next person reads instead of checking."
    );
    continue;
  }
  if (perHour < floor) {
    fail(
      `${name} allows ${Math.round(perHour)} per hour (${limiter.maxAttempts} per ${limiter.windowSeconds}s) in ${limiter.file}, `
      + `below the ${floor}/hour this check holds it to.\n`
      + "    A signed-in subscriber can hit this one. The owner's instruction is that subscribing is the last thing\n"
      + "    somebody has to do, and a cap they meet during an ordinary day's work is a thing they have to do next.\n"
      + "    Raise it, or record the figure and the reason in RATE_EXCEPTIONS here."
    );
  }
}

// The other direction. A registered name that no longer exists is a reason
// describing nothing.
for (const name of Object.keys(LIMITERS)) {
  if (!seen.has(name)) {
    fail(
      `LIMITERS records why ${name} exists and no runtime file creates it.\n`
      + "    Remove the entry. A stale exemption is read instead of the code."
    );
  }
}
for (const name of Object.keys(RATE_EXCEPTIONS)) {
  if (!seen.has(name)) {
    fail(`RATE_EXCEPTIONS records a figure for ${name} and no runtime file creates it. Remove the entry.`);
  }
}
if (!subscriberFacing) {
  fail(
    "no limiter is registered as an abuse_ceiling, so the floor below was applied to nothing. "
    + "Either every limiter really is anonymous or a credential guard -- in which case say so here -- or a "
    + "category was changed to make this pass."
  );
}

// ---------------------------------------------------------------------------
// 3. Nothing asks for a quote, an intake form, or a word with sales
// ---------------------------------------------------------------------------

// The shapes the owner ruled out. Each is matched against strings rather than
// comments: this file's own prose names all of them, and so does AGENTS.md.
const FORBIDDEN_COPY = Object.freeze([
  { pattern: /\brequest a quote\b/i, what: "a quote to request" },
  { pattern: /\bget a quote\b/i, what: "a quote to request" },
  { pattern: /\brequest pricing\b/i, what: "a price to ask for" },
  { pattern: /\bcontact sales\b/i, what: "a conversation with sales" },
  { pattern: /\btalk to sales\b/i, what: "a conversation with sales" },
  { pattern: /\bbook a demo\b/i, what: "a demo to book" },
  { pattern: /\bschedule a demo\b/i, what: "a demo to book" },
  { pattern: /\bintake form\b/i, what: "an intake form" },
  { pattern: /\brequest access\b/i, what: "access to request" },
  { pattern: /\bjoin the waitlist\b/i, what: "a waitlist" }
]);

// Only what a page says. A comment explaining that quotes are forbidden is not a
// page offering one, and the stripper is lib/sonara-comment-stripping.cjs rather
// than a regex written here -- tests/a-line-comment-cannot-open-a-block-comment.test.js
// refuses a second one by name.
const STRING_LITERALS = /"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g;

function customerFacingStrings(source) {
  const strings = [];
  for (const match of withoutComments(source).matchAll(STRING_LITERALS)) {
    strings.push(match[1] ?? match[2] ?? match[3] ?? "");
  }
  return strings;
}

let stringsExamined = 0;
for (const file of files) {
  // This file names every forbidden phrase in order to look for it.
  if (file.endsWith("verify-subscription-completeness.mjs")) continue;
  const relative = path.relative(repoRoot, file);
  for (const text of customerFacingStrings(fs.readFileSync(file, "utf8"))) {
    stringsExamined += 1;
    for (const forbidden of FORBIDDEN_COPY) {
      if (!forbidden.pattern.test(text)) continue;
      fail(
        `${relative} offers ${forbidden.what}: "${text.trim().slice(0, 120)}"\n`
        + "    The owner's instruction is that somebody subscribes and uses the service. Nothing stands in front of\n"
        + "    a feature but the subscription itself."
      );
    }
  }
}

if (stringsExamined < 5000) {
  fail(`only ${stringsExamined} strings were examined; this check has gone blind.`);
}

// The detector, on input it must catch and input it must not. Zero findings is the
// passing state, so "nothing is there" and "I stopped looking" are the same from
// outside.
const COPY_FIXTURES = Object.freeze([
  { text: "Request a quote for your workspace", shouldMatch: true },
  { text: "Contact sales to unlock this", shouldMatch: true },
  { text: "Fill in the intake form to get started", shouldMatch: true },
  { text: "Request access to this feature", shouldMatch: true },
  // Must not fire. These are the sentences the application actually uses, and a
  // detector that refused them would be a detector somebody switches off.
  { text: "On a paid plan. Compare plans to see what opens this.", shouldMatch: false },
  { text: "Setup needed: connect your payment account before taking money.", shouldMatch: false },
  { text: "This needs your owner's approval before it runs.", shouldMatch: false }
]);

for (const fixture of COPY_FIXTURES) {
  const matched = FORBIDDEN_COPY.some((forbidden) => forbidden.pattern.test(fixture.text));
  if (matched !== fixture.shouldMatch) {
    fail(
      `the copy detector ${fixture.shouldMatch ? "no longer catches" : "now fires on"} ${JSON.stringify(fixture.text)}. `
      + "Until that is fixed, finding no forbidden copy means nothing."
    );
  }
}

if (failed) process.exit(1);

const ceilings = Object.entries(LIMITERS).filter(([, reason]) => reason === "abuse_ceiling").length;
const anonymous = Object.entries(LIMITERS).filter(([, reason]) => reason === "anonymous_surface").length;
const guards = Object.entries(LIMITERS).filter(([, reason]) => reason === "credential_guard").length;
console.log(
  `Subscription completeness verified: ${seen.size} rate limiters, every one accounted for -- ${anonymous} on surfaces `
  + `with nobody signed in, ${guards} standing in front of a secret, ${ceilings} that a subscriber can hit and each above `
  + `its floor (${MINIMUM_SUBSCRIBER_RATE}/hour, with ${Object.keys(RATE_EXCEPTIONS).length} recorded exceptions carrying their own figure). `
  + `0 of ${stringsExamined} customer-facing strings ask for a quote, an intake form, a demo or a word with sales, across `
  + `${files.length} runtime files. The detectors were tested against ${COPY_FIXTURES.length} fixtures including three the `
  + "application really uses and must keep. This checks those three properties and not the whole of \"nothing else to buy\"."
);
