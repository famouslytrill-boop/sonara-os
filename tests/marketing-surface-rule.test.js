"use strict";

// Which pages are cinematic, and which stay still.
//
// AGENTS.md gives two instructions that pull against each other if you only
// read one of them: public overview screens should feel polished, dark-first
// and marketable, and work screens should be calm, clear and operational. The
// line between them is the surface a page declares -- `marketing` renders
// <main class="sonara-ds sonara-stage"> and loads sonara-depth.js; `work` gets
// neither, and the stylesheet strips depth inside [data-sonara-surface="work"]
// on top of that.
//
// The default is `work`, so forgetting leaves a page calm. That is the right
// default and it has a cost: a public page nobody remembered to mark shows a
// prospective customer the plain operational frame. Eighteen of thirty-one
// public routes were cinematic when this was written and thirteen were not,
// and not one of the thirteen was a decision anybody had recorded.
//
// So this file records the decision, both ways. It is not asserting that the
// current output is whatever it currently is -- it names each public route and
// says which side of the line it is on and why.

const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../server");
const { PUBLIC_ROUTES, CUSTOMER_ROUTES, ADMIN_ROUTES } = require("../lib/sonara-route-registry.cjs");

// Public pages that exist to attract and orient someone who has not signed up.
const CINEMATIC = new Set([
  "/", "/about", "/start", "/products", "/service-catalog", "/free-tools", "/pricing",
  "/how-it-works", "/tutorials", "/tutorials/getting-started", "/tutorials/business-builder",
  "/tutorials/creator-studio", "/tutorials/growth-studio", "/contact", "/security",
  "/business-builder", "/creator-studio", "/growth-studio", "/help", "/prompt-library"
]);

// Public pages that stay calm, each with the reason. Being public is not the
// test -- being read is. Someone opens a refund policy to check a term and
// someone opens a readiness checklist to see what is not set up yet, and
// neither is improved by parallax.
const CALM = new Map([
  ["/legal", "a reference document somebody reads to check a term"],
  ["/terms", "a reference document somebody reads to check a term"],
  ["/privacy", "a reference document somebody reads to check a term"],
  ["/refund-policy", "a reference document somebody reads to check a term"],
  ["/cookies", "a reference document somebody reads to check a term"],
  ["/acceptable-use", "a reference document somebody reads to check a term"],
  ["/earnings-disclaimer", "a reference document somebody reads to check a term"],
  ["/accessibility", "a page about not making things hard to read"],
  ["/business-builder/launch-readiness", "an operational checklist showing what is still setup required"],
  ["/creator-studio/launch-readiness", "an operational checklist showing what is still setup required"],
  ["/growth-studio/launch-readiness", "an operational checklist showing what is still setup required"]
]);

function isPage(route) {
  return !route.endsWith(".xml") && !route.endsWith(".txt");
}

async function surfaceOf(route) {
  const response = await request(app).get(route);
  const html = String(response.text || "");
  return {
    status: response.status,
    stage: /<main[^>]*class="[^"]*sonara-stage/.test(html),
    declared: /data-sonara-surface="marketing"/.test(html),
    depthScript: html.includes("/sonara-depth.js")
  };
}

describe("which pages are cinematic", () => {
  it("accounts for every public route", () => {
    // The two lists above have to cover PUBLIC_ROUTES exactly. Without this, a
    // route added later is silently outside the rule -- which is the exact way
    // thirteen pages ended up undecided in the first place.
    const pages = PUBLIC_ROUTES.filter(isPage);
    const undecided = pages.filter((route) => !CINEMATIC.has(route) && !CALM.has(route));
    assert.deepEqual(undecided, [], "these public routes are on neither list; decide whether each is a front door or a document");

    const stale = [...CINEMATIC, ...CALM.keys()].filter((route) => !pages.includes(route));
    assert.deepEqual(stale, [], "these routes are listed here but are no longer public");
  });

  for (const route of [...CINEMATIC].sort()) {
    it(`${route} is cinematic`, async () => {
      const surface = await surfaceOf(route);
      assert.equal(surface.status, 200, `${route} did not render`);
      assert.ok(surface.stage, `${route} is a public front door and should render the stage`);
      assert.ok(surface.declared, `${route} should declare data-sonara-surface="marketing"`);
      assert.ok(surface.depthScript, `${route} should load the depth script`);
    });
  }

  for (const [route, reason] of [...CALM].sort()) {
    it(`${route} stays calm: ${reason}`, async () => {
      const surface = await surfaceOf(route);
      assert.equal(surface.status, 200, `${route} did not render`);
      assert.equal(surface.stage, false, `${route} is ${reason}, so it should not carry the stage`);
      assert.equal(surface.depthScript, false, `${route} should not load the depth script`);
    });
  }
});

describe("work screens stay calm", () => {
  // The expensive mistake is animating an operational screen, so this checks
  // the side of the rule with the higher cost. Signed out, these redirect --
  // a 303 is the expected answer and proves nothing about the surface, so only
  // routes that actually render are asserted on.
  const protectedRoutes = [...CUSTOMER_ROUTES, ...ADMIN_ROUTES].filter((route) => !route.includes(":"));

  it("never renders the stage on a customer or admin route", async () => {
    const offenders = [];
    let rendered = 0;
    for (const route of protectedRoutes) {
      const surface = await surfaceOf(route);
      if (surface.status !== 200) continue;
      rendered += 1;
      if (surface.stage || surface.depthScript) offenders.push(route);
    }
    assert.deepEqual(offenders, [], "these work screens carry marketing depth; AGENTS.md asks for them to stay calm");
    // Guard against the loop passing because everything redirected.
    assert.ok(rendered > 0, "no protected route rendered, so this check proved nothing");
  });
});
