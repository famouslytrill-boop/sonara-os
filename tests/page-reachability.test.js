"use strict";

// A page nothing links to is a page nobody finds.
//
// /research-lab/open-source was the opposite bug: two pages linked to a route
// that did not exist, and the link checker caught it. This is the same defect
// from the other side, and no check caught it -- /search was built, registered,
// tested, and reachable only by typing the URL. Every existing check passed,
// because a route that resolves is not the same as a route somebody can get to.
//
// The scope here is deliberately narrow. Not every route needs a link: a
// per-record detail page is reached from its list, an API endpoint is called by
// a form, and a legal alias exists to be linked *from* elsewhere. What this
// checks is the small set of pages that are a destination in their own right --
// somewhere a customer would go on purpose, which means something has to offer
// the way in.

const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../server");

// Destinations. Each is a page a customer would choose to visit, paired with a
// page that must offer the way in.
//
// The "from" page used to be fetched signed-out, and the note here said it had
// to be one that renders for anybody. That stopped being true on 19 August 2026:
// /account had been answering strangers with a page, and once it started
// sending them to sign in like every other customer route, this file could no
// longer see the links on it and reported that five subpages had become
// unreachable. They had not -- the check had simply been reading a page as
// somebody who should never have been shown it.
//
// So every fetch below signs in. A customer is who these links are for, and
// asking as anybody else was measuring a visitor the product does not serve.
const DESTINATIONS = [
  {
    path: "/search",
    from: "/business-builder",
    why: "search is useless if the only way to reach it is typing the URL"
  },
  // Five account subpages were registered, rendered, and linked from nowhere.
  // /account offered only /account/setup, so the pages a customer goes to
  // change their own password or disconnect an integration could be reached
  // only by typing the URL -- the /search defect, five times over.
  //
  // Found by fetching /account and reading the rendered links rather than
  // grepping the source. A source scan reported the four /tutorials pages as
  // unlinked too, and they were not: /tutorials builds those links from a
  // list, so the literal path never appears. Rendered HTML is the only honest
  // answer to "can somebody get here".
  { path: "/account/profile", from: "/account", why: "a customer changing their own details has to be able to find the page" },
  { path: "/account/security", from: "/account", why: "the password and session page is the one people go looking for after a scare" },
  { path: "/account/preferences", from: "/account", why: "notification and contact settings are meaningless if unreachable" },
  { path: "/account/workspaces", from: "/account", why: "which workspaces you belong to is answerable only here" },
  { path: "/account/integrations", from: "/account", why: "disconnecting something has to be as reachable as connecting it" }
];

const { CUSTOMER_SESSION_COOKIE } = require("../lib/sonara-customer-auth.cjs");

const SUPABASE_ENV = Object.freeze({
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.stub-anon-reachability",
  SUPABASE_SERVICE_ROLE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.stub-service-reachability"
});
const ORIGINAL_ENV = Object.fromEntries(Object.keys(SUPABASE_ENV).map((key) => [key, process.env[key]]));
const CUSTOMER = { id: "71717171-7171-4171-8171-717171717171", email: "customer@example.com" };

function signedIn(path) {
  return request(app).get(path).set("Cookie", `${CUSTOMER_SESSION_COOKIE}=stub`);
}

async function linksOn(path) {
  const response = await signedIn(path);
  if (response.status !== 200) return { status: response.status, hrefs: [] };
  const html = String(response.text || "");
  const main = html.match(/<main[\s\S]*?<\/main>/)?.[0] || html;
  return {
    status: response.status,
    hrefs: [...main.matchAll(/href="([^"#?]+)/g)].map((match) => match[1])
  };
}

describe("pages a customer would look for", () => {
  let realFetch;

  before(() => {
    Object.assign(process.env, SUPABASE_ENV);
    realFetch = global.fetch;
    // Signed in, with every other read answering. The session lookup is the
    // only thing this stub has an opinion about.
    global.fetch = async (url) => {
      const target = String(url);
      const body = target.includes("/auth/v1/user") ? CUSTOMER : [];
      return { ok: true, status: 200, headers: { get: () => null }, json: async () => body };
    };
  });

  after(() => {
    global.fetch = realFetch;
    for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("has destinations to check", () => {
    // Without this the loop below passes over an empty list, which is the
    // failure mode half the checks in this repository were written to prevent.
    assert.ok(DESTINATIONS.length > 0, "no destinations declared, so this check proves nothing");
  });

  for (const destination of DESTINATIONS) {
    it(`${destination.path} is linked from ${destination.from}`, async () => {
      const { status, hrefs } = await linksOn(destination.from);
      assert.equal(status, 200, `${destination.from} did not render, so this check could not look`);
      assert.ok(
        hrefs.includes(destination.path),
        `${destination.path} is not linked from ${destination.from} -- ${destination.why}`
      );
    });

    it(`${destination.path} resolves`, async () => {
      // A link is only worth having if it goes somewhere. What counts as
      // "somewhere" here matches tests/no-dead-links.test.js rather than being
      // decided again: a redirect is correct for a signed-in page fetched
      // logged out, and 503 is correct when the page needs Supabase and this
      // environment has none. Only a 404 or a 500 means the link is dead.
      const response = await signedIn(destination.path);
      assert.ok(
        [200, 302, 303, 503].includes(response.status),
        `${destination.path} returned ${response.status}; the link would be dead`
      );
    });
  }
});
