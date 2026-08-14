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
// The "from" page is fetched signed-out, so it must be one that renders for
// anybody -- which is why the owner pages are not used as sources here even
// though they carry the link too.
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

async function linksOn(path) {
  const response = await request(app).get(path);
  if (response.status !== 200) return { status: response.status, hrefs: [] };
  const html = String(response.text || "");
  const main = html.match(/<main[\s\S]*?<\/main>/)?.[0] || html;
  return {
    status: response.status,
    hrefs: [...main.matchAll(/href="([^"#?]+)/g)].map((match) => match[1])
  };
}

describe("pages a customer would look for", () => {
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
      const response = await request(app).get(destination.path);
      assert.ok(
        [200, 302, 303, 503].includes(response.status),
        `${destination.path} returned ${response.status}; the link would be dead`
      );
    });
  }
});
