"use strict";

// Every page, rendered with every data read failing.
//
// tests/signed-in-workspace-crawl.test.js crawls with the database answering
// and empty, which is the state a new customer is in. This crawls with the
// database answering nothing at all, which is the state everybody is in for the
// few minutes a year it happens -- and it is the state where a page is most
// likely to tell a customer something false about their own records.
//
// Four were found the first time it ran:
//
//   * all three workspace dashboards said "No activity yet." -- the read
//     outcome was dropped before the card saw it, while countLabel beside it
//     already answered "unavailable", so the two halves of the same card
//     disagreed about what a failure looks like
//   * the billing panel said "No active paid plan found." to a paying customer,
//     which is the one place in the product where being wrong in that direction
//     costs a cancellation
//   * "No areas yet" and "No consent records yet" were card headings printed
//     above bodies explaining the read had failed; a customer skims headings,
//     and a creator reading the second one could reasonably conclude a recorded
//     permission had been lost
//
// The session and the organization still resolve. Only the data fails, because
// a page that cannot identify the customer has a different and already-tested
// answer.

const assert = require("node:assert/strict");
const request = require("supertest");

const SUPABASE_ENV = Object.freeze({
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.stub-anon-key-for-outage",
  SUPABASE_SERVICE_ROLE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.stub-service-role-for-outage",
  ADMIN_EMAILS: "owner-outage@example.com"
});
const original = Object.fromEntries(Object.keys(SUPABASE_ENV).map((key) => [key, process.env[key]]));

const app = require("../server");
const { CUSTOMER_SESSION_COOKIE, ADMIN_SESSION_COOKIE } = require("../lib/sonara-customer-auth.cjs");
const { ROUTE_REGISTRY } = require("../lib/sonara-route-registry.cjs");

const USER = { id: "33333333-3333-4333-8333-333333333333", email: "outage@example.com" };
// The owner's own view of an outage. `ADMIN_EMAILS` is set alongside the
// Supabase stubs below so the admin gate resolves without a role read.
const ADMIN = { id: "55555555-5555-4555-8555-555555555555", email: "owner-outage@example.com" };
const ORGANIZATION_ID = "44444444-4444-4444-8444-444444444444";

const json = (body, status = 200) => ({ ok: status < 400, status, headers: { get: () => null }, json: async () => body });
const unreachable = () => ({ ok: false, status: 500, headers: { get: () => null }, json: async () => ({}) });

function stubFetch(asAdmin = false) {
  return async (url) => {
    const target = String(url);
    if (target.includes("/auth/v1/user")) return json(asAdmin ? ADMIN : USER);
    if (asAdmin && (target.split("/rest/v1/")[1] || "").split("?")[0] === "user_roles") return json([{ role: "owner" }]);
    if (target.includes("/rest/v1/rpc/")) return json({});
    if (!target.includes("/rest/v1/")) return undefined;
    const table = (target.split("/rest/v1/")[1] || "").split("?")[0];
    // Identity resolves; everything about the customer's own records does not.
    if (table === "organization_memberships") return json([{ organization_id: ORGANIZATION_ID, user_id: USER.id, role: "owner", status: "active" }]);
    if (table === "business_memberships") return json([{ id: "m", organization_id: ORGANIZATION_ID, workspace_id: "w", role: "owner", status: "active" }]);
    if (table === "organizations") return json([{ id: ORGANIZATION_ID, name: "Outage Ltd" }]);
    if (table === "billing_entitlements") {
      const asked = decodeURIComponent((target.match(/entitlement_key=in\.\(([^)]*)\)/) || ["", ""])[1]).split(",").filter(Boolean);
      return json(asked[0] ? [{ entitlement_key: asked[0], status: "active" }] : []);
    }
    return unreachable();
  };
}

// A count of zero is an empty-state claim, and the word pattern below cannot
// see one. "Competitors: 0" contains no "no", no "nothing", no "yet" -- so a
// page rendering counts could tell somebody they have none of something while
// every read was failing, and this crawl would pass it.
//
// Found by injecting exactly that: a counting page written during this session
// reported `0` instead of "could not be read" and the whole suite stayed green.
// No page renders a bare "Label: 0" today, so this is an addition with nothing
// to clean up behind it.
//
// Deliberately narrow. It wants a label, a colon and a bare zero -- not "0.00",
// not "10", not a zero inside a date or a price -- because a pattern that fires
// on money would be turned off within a week.
// `0(?![.\d])` was the first version and it matched nothing at all, because
// "Competitors: 0." ends a sentence and the lookahead rejected the full stop as
// though it were a decimal point. It passed, and it was measuring zero pages --
// the exact defect this file exists to catch, in the check itself, caught only
// by injecting the bug and watching it stay green.
//
// The zero must not be followed by a digit, nor by a decimal point *and* a
// digit. A full stop with a space after it is the end of a sentence.
const CLAIMS_ZERO = /\b[A-Za-z][A-Za-z ]{2,30}:\s*0(?!\d)(?!\.\d)/;
const CLAIMS_ZERO_ALL = new RegExp(CLAIMS_ZERO.source, "g");
// A sentence claiming the customer has none of something.
const CLAIMS_EMPTY = /(no |nothing |not added |have not )[^.]{0,60}(yet|here|anybody|any )/i;
const CLAIMS_EMPTY_ALL = new RegExp(CLAIMS_EMPTY.source, "gi");

// Prose that matches the pattern and is not a claim about the customer's
// records. Each says why it is allowed to stay.
const NOT_A_CLAIM_ABOUT_RECORDS = [
  [/no guarantee of revenue/i, "The earnings disclaimer. A statement about what is not promised, not about what is stored."],
  [/nothing here has been changed/i, "The assistant pages, saying they only read and link. A safety statement about the page's own behaviour."],
  [/nothing is sent from here/i, "Campaigns, saying no message leaves without authorization. Same kind of statement."],
  [/nothing is sent to anybody/i, "The consent page, saying suppression is honoured. Same."],
  [/nothing runs on its own/i, "Staff check-ins, saying nothing tracks in the background."],
  [/nothing writes them yet/i, "Food costs, stating honestly that the daily figures are not calculated."],
  [/nothing here reflects your plan/i, "The billing panel's own failure wording, added by this check's first run."],
  [/no reviews are published/i, "Proof and review publishing is owner-gated; a statement of policy."],
  [/nothing here has been sent/i, "Chase drafts, saying a draft is not a message. A statement about what the page does not do."],
  [/nothing here publishes anything on its own/i, "The release calendar, saying it schedules rather than publishes."],
  [/nothing here says your database is empty/i, "The database console's caveat card, which exists to stop an owner concluding exactly the thing this check hunts for. It is the opposite of the claim -- flagged only because the pattern matches the words \"Nothing here\" wherever they appear. Found by the owner pass on its first run, on /admin/database, /admin/database-management and /admin/migrations, all rendering the same card."]
];

function excused(context) {
  return NOT_A_CLAIM_ABOUT_RECORDS.some(([pattern]) => pattern.test(context));
}

describe("no page lies when the database is down", () => {
  let realFetch;
  const findings = [];
  const renderedRoutes = new Set();
  const refusedBy = new Map();
  let rendered = 0;

// A value the page meant to print and could not.
//
// "Reference ID: null." reached a customer-facing page on 17 August, because a
// fix correctly stopped inventing a reference for unsaved work and the template
// printed the null through String() anyway. Nothing objected: the coverage read
// the JSON body, and the page-level assertions checked for the *presence* of the
// string "Reference ID", which "null" satisfies.
//
// These four tokens are what a JavaScript template produces when the value
// behind it is missing. None of them is a word this product's copy would ever
// use, so any appearance in visible page text is a defect rather than a style
// question. Checked over the same stripped text as the claims above, which is
// what a customer actually reads -- attribute values, class names and inline
// data are none of this check's business.
// Two copies, the same way CLAIMS_EMPTY and CLAIMS_EMPTY_ALL are two copies.
// A /g regex carries lastIndex between calls, so the first draft of the
// recognition test below matched its first sentence, resumed from that offset
// for the second, and reported that the pattern had stopped working. The check
// written to prove this check works is the thing that caught it.
const PLACEHOLDER_LEAK = /(?:\[object Object\]|\bundefined\b|\bNaN\b|\bnull\b)/;
const PLACEHOLDER_LEAK_ALL = new RegExp(PLACEHOLDER_LEAK.source, "g");
const leaks = [];

  before(async function crawl() {
    this.timeout(180000);
    Object.assign(process.env, SUPABASE_ENV);
    realFetch = global.fetch;
    global.fetch = stubFetch();

    const routes = ROUTE_REGISTRY
      .filter((entry) => entry.method === "GET" && !entry.route.includes(":"))
      .map((entry) => entry.route);

    // Two passes over the same routes: once as a customer, once as the owner.
    //
    // The customer pass alone silently skipped 49 of 260 routes -- 46 of them
    // redirects to a login this session cannot pass, and almost all of those
    // the admin area. So the file that says "every page, rendered with every
    // data read failing" had never rendered /admin, /admin/database,
    // /admin/users or /admin/system, which are the pages an *owner* opens
    // during an outage. That is where a false "you have no records" does the
    // most damage, because the owner is the person deciding whether anything
    // has actually been lost.
    //
    // `skipped` is kept and asserted rather than dropped on the floor, so the
    // population cannot shrink again without somebody being told.
    for (const [label, cookie, admin] of [["customer", CUSTOMER_SESSION_COOKIE, false], ["owner", ADMIN_SESSION_COOKIE || "sonara_admin_session", true]]) {
      global.fetch = stubFetch(admin);
      await crawlAs(routes, label, cookie);
    }
  });

  // Routes whose successful response is a file rather than a page. Listed by
  // hand and deliberately short: a route added here stops being checked for
  // page markers, so it has to be a genuine download and not a page somebody
  // found inconvenient to fix.
  const FILE_DOWNLOADS = new Set([
    "/business-builder/owner/bookings/calendar",
    "/business-builder/owner/customers/contacts"
  ]);
  const downloadResponses = [];

  async function crawlAs(routes, label, cookieName) {
    for (const route of routes) {
      let response;
      try {
        response = await request(app).get(route).set("Accept", "text/html").set("Cookie", `${cookieName}=stub`).redirects(0);
      } catch (error) {
        findings.push(`${route} threw with the database down as ${label}: ${error.message}`);
        continue;
      }
      // 503 bodies are read as well as 200s.
      //
      // /business-builder/dashboard and /business-builder/control-center answer
      // 503 during an outage and render a real page -- "Business Builder is
      // temporarily unavailable". Skipping every non-200 meant this crawl never
      // inspected the pages *written for* the state it exists to test, which are
      // the pages most likely to make a claim about a customer's records because
      // they are the ones with something to explain.
      //
      // Only 503, and only when a body came back: a 302 has nothing to read, and
      // a 500 is a defect for a different check.
      const readable = response.status === 200
        || (response.status === 503 && /<\/html>|<article|<main/i.test(String(response.text || "")));

      // A route that serves a *file* is not a page and must not be judged as
      // one. /business-builder/owner/bookings/calendar answers a calendar
      // download; rendering an HTML page into a .ics request would be the wrong
      // thing, so it answers 503 with a plain sentence instead.
      //
      // The HTML markers above were always a proxy for "a human can read what
      // came back", chosen because everything crawled until now was a page.
      // Widening that proxy for every route would weaken it, so downloads are
      // taken out of this population and checked separately, and more strictly,
      // in the assertion below -- the count of routes accounted for does not
      // fall, and these gain a check the pages do not have.
      if (!readable && FILE_DOWNLOADS.has(route)) {
        downloadResponses.push({ route, label, status: response.status, body: String(response.text || "") });
        continue;
      }

      if (!readable) {
        // Recorded per route, not per pass. Neither session can reach
        // everything -- the owner cookie is redirected away from /billing and
        // /account/*, the customer cookie away from /admin/* -- so a route only
        // counts as unreachable when *both* passes were refused.
        // An alias counts as covered: /business-builder/tutorial is a 302 to
        // /tutorials/business-builder and /business-builder/pricing a 302 to
        // /pricing, both of which this crawl renders. What is left after those
        // are removed is the real gap.
        const destination = String(response.headers?.location || "").split("#")[0].split("?")[0];
        refusedBy.set(route, { detail: `${route} -> ${label} ${response.status}`, destination });
        continue;
      }
      renderedRoutes.add(route);
      rendered += 1;
      const visible = String(response.text || "")
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ");
      // Excused against the surrounding sentence rather than the matched
      // fragment. CLAIMS_EMPTY matches as few words as it can, so "nothing
      // here reflects your plan" arrives as "nothing here" and no excuse for
      // the longer phrase could ever fire.
      // Every match on the page, not the first. The first version stopped at
      // one, so a page whose opening safety statement is excused could carry a
      // real claim further down and never be looked at -- a check that goes
      // blind exactly where a page has the most to say.
      for (const match of visible.matchAll(CLAIMS_ZERO_ALL)) {
        const phrase = String(match[0]).trim();
        if (excused(phrase)) continue;
        findings.push(`${route} counts "${phrase}" as ${label} while every read is failing`);
      }
      for (const match of visible.matchAll(CLAIMS_EMPTY_ALL)) {
        const context = visible.slice(Math.max(0, match.index - 60), match.index + 140);
        if (!excused(context)) findings.push(`${route} says "${match[0].trim()}" as ${label}, in: ${context.trim().slice(0, 120)}`);
      }

      for (const match of visible.matchAll(PLACEHOLDER_LEAK_ALL)) {
        const context = visible.slice(Math.max(0, match.index - 70), match.index + 70);
        leaks.push(`${route} shows "${match[0]}" in: ${context.trim().slice(0, 130)}`);
      }
    }
  }

  after(() => {
    global.fetch = realFetch;
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("rendered enough pages to be measuring something", () => {
    // Two passes now, so the floor is higher than the 150 the customer pass
    // alone reached.
    assert.ok(rendered >= 400, `only ${rendered} page renders with the database down; the crawl has gone blind`);
  });

  it("makes a file download explain itself during an outage", () => {
    // Not weaker than the page rule -- stricter. A page has to contain HTML
    // markers; these have to answer 503 with a sentence a person can read,
    // carry no JSON blob, and leak no placeholder.
    assert.ok(
      downloadResponses.length > 0,
      "no file-download route was crawled, so this check looked at nothing. If a download moved, point FILE_DOWNLOADS at where it went."
    );

    const wrong = [];
    for (const entry of downloadResponses) {
      if (entry.status !== 503) {
        wrong.push(`${entry.route} answered ${entry.status} with the database down; a download that cannot be built must say so with 503`);
        continue;
      }
      const body = entry.body.trim();
      if (body.length < 20) wrong.push(`${entry.route} answered 503 with nothing a person could read`);
      // A JSON error object is a machine's answer, and this is a link somebody
      // clicked in a browser.
      if (/^[[{]/.test(body)) wrong.push(`${entry.route} answered 503 with JSON rather than a sentence: ${body.slice(0, 60)}`);
      if (/\b(null|undefined|NaN|\[object Object\])\b/.test(body)) wrong.push(`${entry.route} leaked a placeholder into its outage message: ${body.slice(0, 80)}`);
      // It has to say something about what happened, not just fail.
      if (!/could not|not connected|try again|sign in/i.test(body)) {
        wrong.push(`${entry.route} answered 503 without explaining what went wrong: ${body.slice(0, 80)}`);
      }
    }

    assert.deepEqual(wrong, [], wrong.join("\n  "));
  });

  it("accounts for every page it could not render", () => {
    // `rendered >= 400` says how much was looked at. It does not say what was
    // missed, and for most of this file's life the answer was 49 routes that
    // redirected to a login -- the whole admin area among them -- dropped by a
    // bare `continue`. A crawl that cannot say what it skipped is a crawl whose
    // population can shrink quietly.
    //
    // The owner session reaches the admin area, so what is left is genuinely
    // out of reach: sign-in and callback routes, and pages that redirect by
    // design. The cap is what makes this an assertion rather than a log.
    // Follow the whole redirect chain, not one hop.
    //
    // /creator-studio/billing redirects to /billing, which redirects again to
    // /business-builder/billing, which this crawl renders. A single-hop rule
    // called that a gap because it only ever looked at the middle of the chain.
    // `seen` is there because a redirect loop would otherwise hang the check
    // that exists to stop things going unnoticed.
    const landsOnARenderedPage = (start) => {
      const seen = new Set();
      let at = start;
      while (at && !seen.has(at)) {
        if (renderedRoutes.has(at)) return true;
        seen.add(at);
        at = refusedBy.get(at)?.destination;
      }
      return false;
    };

    const unreachable = [...refusedBy.entries()]
      .filter(([route, entry]) => !renderedRoutes.has(route) && !landsOnARenderedPage(entry.destination))
      .map(([, entry]) => entry.detail);

    // Zero, and that is the honest number rather than a tidy one.
    //
    // It was pinned at 13 while the real figure was 6, which is a pin that would
    // not have noticed seven new failures. Examining the six is what closed it:
    // two render an honest outage page under 503 and are now read, three are
    // aliases whose chain ends on a rendered page, and /auth/callback answers
    // "OAuth deferred" to a request carrying no OAuth code, which is correct.
    //
    // Every route is now either rendered or lands on a page that was. If that
    // stops being true, this says so on the first run rather than the fiftieth.
    assert.deepEqual(
      unreachable,
      [],
      `${unreachable.length} routes rendered for neither session and do not redirect to a page that did:\n  ${unreachable.join("\n  ")}`
    );
    // And the map must not be empty, because an empty one would mean the
    // recording stopped rather than that everything rendered.
    assert.ok(refusedBy.size > 0, "no refusal was recorded at all, so the accounting is no longer running");
  });

  it("prints no value it failed to work out", () => {
    assert.deepEqual(
      leaks,
      [],
      "a page showed a JavaScript placeholder where a value should have been; the customer reads that as part of the sentence"
    );
  });

  it("would recognise a placeholder if one appeared", () => {
    // The assertion above passes by finding nothing, which is also what it does
    // when the pattern has stopped matching. This is the difference.
    for (const sentence of ["Reference ID: null.", "Saved undefined records.", "Total: NaN", "Owner: [object Object]"]) {
      assert.match(sentence, PLACEHOLDER_LEAK, `the pattern no longer recognises "${sentence}"`);
    }
    assert.doesNotMatch("Your annulled booking was refunded in full.", PLACEHOLDER_LEAK, "the pattern matches ordinary prose");
  });

  it("tells nobody they have no records when the records could not be read", () => {
    assert.deepEqual(
      findings,
      [],
      `these pages report an empty state while every read is failing:\n  ${findings.join("\n  ")}\n\n` +
        "Carry the read outcome to the card, or add the phrase to NOT_A_CLAIM_ABOUT_RECORDS with the reason it is not about the customer's records."
    );
  });

  it("gives every excused phrase a real reason", () => {
    assert.ok(NOT_A_CLAIM_ABOUT_RECORDS.length >= 5, "the excuse list has been emptied rather than earned");
    for (const [, reason] of NOT_A_CLAIM_ABOUT_RECORDS) {
      assert.ok(String(reason).length >= 40, "an excused phrase needs a stated reason, not a placeholder");
    }
  });

  // The pattern has to match something, or the crawl above proves nothing.
  it("would recognise the claim it is looking for", () => {
    for (const sentence of ["No activity yet.", "You have not added anybody yet.", "Nothing here yet.", "No consent records yet"]) {
      assert.match(sentence, CLAIMS_EMPTY, `the pattern no longer recognises "${sentence}"`);
    }
    // And the numeric form, which the sentence pattern above cannot see.
    // The sentence-ending form is the one the first version missed.
    for (const counted of ["Competitors: 0", "Market signals: 0.", "Customer segments:  0. Competitors: 0."]) {
      assert.match(counted, CLAIMS_ZERO, `the zero pattern no longer recognises "${counted}"`);
    }
    // Things it must not fire on, or it gets switched off rather than fixed.
    for (const fine of ["Total: 0.00", "Balance: 10", "Owed: 0.5", "Due: 2026-08-18", "Rate: 04"]) {
      assert.doesNotMatch(fine, CLAIMS_ZERO, `the zero pattern wrongly flags "${fine}"`);
    }
    assert.ok(excused("No guarantee of revenue"), "the excuse list is not being consulted");
  });
});
