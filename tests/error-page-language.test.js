"use strict";

// The two screens a customer reaches when something has already gone wrong.
//
// Both were written from the software's point of view.
//
//   404:      "Unknown route."
//             "Route unavailable"
//             "The page or action you requested is not registered in SONARA
//              Industries."
//
//   /offline: titled "System response"
//             "The SONARA interface is available again when network access
//              returns."
//
// "Route" is our word for it, not theirs. "Not registered in SONARA Industries"
// reads as though the customer is the thing that is not registered, which on a
// site with accounts is an alarming sentence to land on. And the offline page
// never says the one thing its reader needs to know -- that they are offline --
// while its only link, Home, makes exactly the network request that just
// failed.
//
// The plain-language test did not catch either, because "route", "interface"
// and "system response" are not on its banned list. They are not jargon in the
// way "entitlement" is; they are just written for us rather than for the person
// reading them. So these checks are about what the pages have to accomplish
// rather than about words to avoid.

const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../server");

function visibleText(html) {
  const main = html.slice(html.indexOf("<main"), html.indexOf("</main>"));
  return main
    .replace(/<[^>]+>/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function actionLinks(html) {
  const main = html.slice(html.indexOf("<main"), html.indexOf("</main>"));
  return [...main.matchAll(/class="action" href="([^"]+)"/g)].map((match) => match[1]);
}

describe("the page for an address that does not exist", () => {
  it("is a 404 for a browser", async () => {
    const res = await request(app).get("/definitely-not-a-real-page").set("Accept", "text/html");
    assert.equal(res.status, 404);
  });

  it("does not call it a route", async () => {
    const res = await request(app).get("/definitely-not-a-real-page").set("Accept", "text/html");
    const text = visibleText(res.text);
    assert.doesNotMatch(text, /\broutes?\b/i, `"route" is our word for it, not the customer's: "${text.slice(0, 160)}"`);
  });

  it("does not suggest the customer is the thing that is not registered", async () => {
    // The original sentence was "The page or action you requested is not
    // registered in SONARA Industries." On a site with accounts, a stranger
    // reading that reasonably wonders whether their account is the problem.
    const res = await request(app).get("/definitely-not-a-real-page").set("Accept", "text/html");
    const text = visibleText(res.text);
    assert.doesNotMatch(text, /not registered/i, "the page still says something is not registered");
  });

  it("says the customer's account is fine", async () => {
    const res = await request(app).get("/definitely-not-a-real-page").set("Accept", "text/html");
    assert.match(visibleText(res.text), /nothing is wrong with your account/i);
  });

  it("offers somewhere to go, because a 404 is a navigation problem", async () => {
    // Two links to Home and Help is not navigation. Somebody arrives here from
    // a stale bookmark, a typo, or a link elsewhere, and needs the places they
    // were probably heading.
    const res = await request(app).get("/definitely-not-a-real-page").set("Accept", "text/html");
    const links = actionLinks(res.text);
    assert.ok(links.length >= 4, `only ${links.length} links offered: ${links.join(", ")}`);
    for (const href of ["/", "/help", "/contact"]) {
      assert.ok(links.includes(href), `the 404 page does not link to ${href}`);
    }
  });

  it("still answers a JSON caller with the machine-readable code", async () => {
    // Only the page was rewritten. A client keying off code: "not_found" must
    // not be broken by a copy change.
    const res = await request(app).get("/definitely-not-a-real-page").set("Accept", "application/json");
    assert.equal(res.status, 404);
    assert.equal(res.body.code, "not_found");
    assert.equal(res.body.ok, false);
  });
});

describe("the page shown when the browser is offline", () => {
  it("says the reader is offline, in those words", async () => {
    // The old copy described what would happen when the network returned and
    // never named the current state. Somebody staring at it does not need a
    // description of the future.
    const res = await request(app).get("/offline").set("Accept", "text/html");
    assert.equal(res.status, 200);
    assert.match(visibleText(res.text), /you are offline/i);
  });

  it("is not titled from the software's point of view", async () => {
    const res = await request(app).get("/offline").set("Accept", "text/html");
    const text = visibleText(res.text);
    assert.doesNotMatch(text, /system response/i, "the page is still titled from the system's side");
    assert.doesNotMatch(text, /SONARA interface/i, "the page still talks about the interface rather than the reader");
  });

  it("tells the reader their saved work is safe", async () => {
    // The realistic fear when a page fails mid-session is that something was
    // lost. Records live on the server, not in the tab, so say so.
    assert.match(visibleText((await request(app).get("/offline").set("Accept", "text/html")).text), /still saved|saved work is safe/i);
  });

  it("gives something to do that does not require the network that just failed", async () => {
    const res = await request(app).get("/offline").set("Accept", "text/html");
    const text = visibleText(res.text);
    assert.match(text, /check your wifi|mobile data/i, "there is no first step to try");
    assert.match(text, /already visited/i, "it does not mention that some pages still open offline");
  });

  it("links only to pages the service worker precaches", async () => {
    // Every other link would fetch across the connection that just failed and
    // land the reader back on this page. public/sw.js is the authority on which
    // navigations survive.
    const fs = require("node:fs");
    const path = require("node:path");
    const worker = fs.readFileSync(path.join(__dirname, "..", "public", "sw.js"), "utf8");
    const navigationBlock = worker.slice(
      worker.indexOf("PUBLIC_NAVIGATION_PATHS"),
      worker.indexOf("const PUBLIC_STAGE")
    );
    const cached = new Set([...navigationBlock.matchAll(/"(\/[^"]*)"/g)].map((match) => match[1]));
    assert.ok(cached.size >= 10, `only ${cached.size} cached navigations parsed; this check has gone blind`);

    const res = await request(app).get("/offline").set("Accept", "text/html");
    const offered = actionLinks(res.text);
    assert.ok(offered.length > 0, "the offline page offers nowhere to go");
    const unreachable = offered.filter((href) => !cached.has(href));
    assert.deepEqual(unreachable, [], `the offline page links to pages that are not precached: ${unreachable.join(", ")}`);
  });
});
