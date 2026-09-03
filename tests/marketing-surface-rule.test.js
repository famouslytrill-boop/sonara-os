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
  "/business-builder", "/creator-studio", "/growth-studio", "/help", "/prompt-library",
  // The explainer behind a shared result, and the most literal front door here:
  // whoever lands on it arrived from a link a stranger sent them and has never
  // heard of this company. Orienting them is the page's entire job.
  "/shared"
]);

// Public pages that stay calm, each with the reason. Being public is not the
// test -- being read is. Someone opens a refund policy to check a term and
// someone opens a readiness checklist to see what is not set up yet, and
// neither is improved by parallax.
const CALM = new Map([
  // Not calm because it is a document -- it is a full marketing page. It is on
  // this side because it renders its own <html> outside the SONARA shell, so
  // the stage and the depth script are not its to carry. The rule being checked
  // is "does this page use the SONARA marketing surface", and the honest answer
  // for a second brand's landing page is no.
  ["/leadforge", "a second brand's landing page, rendering its own document outside the SONARA shell"],
  ["/legal", "a reference document somebody reads to check a term"],
  ["/terms", "a reference document somebody reads to check a term"],
  ["/privacy", "a reference document somebody reads to check a term"],
  ["/refund-policy", "a reference document somebody reads to check a term"],
  ["/cookies", "a reference document somebody reads to check a term"],
  ["/acceptable-use", "a reference document somebody reads to check a term"],
  ["/earnings-disclaimer", "a reference document somebody reads to check a term"],
  ["/accessibility", "a page about not making things hard to read"],
  // Joined the public list on 19 August 2026. It had always served a signed-out
  // visitor -- the handler is built for it and says so -- while the registry
  // called it customer-only. Somebody opening a support form is usually already
  // having a bad time; parallax is not what that moment needs.
  ["/support", "a form somebody fills in when something has gone wrong"],
  // Joined the public list on 2 September 2026, having answered 200 to
  // anonymous requests since it was written. The header comment above already
  // decided this case in the abstract -- "someone opens a readiness checklist
  // to see what is not set up yet" -- before there was a route on the list to
  // apply it to.
  ["/readiness", "the status page, read to find out what is not configured yet"],
  ["/business-builder/launch-readiness", "an operational checklist showing what is still setup required"],
  ["/creator-studio/launch-readiness", "an operational checklist showing what is still setup required"],
  ["/growth-studio/launch-readiness", "an operational checklist showing what is still setup required"]
]);

function isPage(route) {
  return !route.endsWith(".xml") && !route.endsWith(".txt");
}

const { CUSTOMER_SESSION_COOKIE } = require("../lib/sonara-customer-auth.cjs");

// Signed in for the work-screen half of this file, signed out for the public
// half. The public pages must look right to somebody who has not signed up --
// that is the whole point of them -- and the work screens can only be looked at
// by somebody who is allowed in.
async function surfaceOf(route, { asCustomer = false } = {}) {
  const pending = request(app).get(route);
  if (asCustomer) pending.set("Cookie", `${CUSTOMER_SESSION_COOKIE}=stub`);
  const response = await pending;
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
  // the side of the rule with the higher cost.
  //
  // It used to fetch these signed out and skip anything that redirected, which
  // meant it was only ever looking at the handful of customer routes that
  // answered a stranger with a page. On 19 August 2026 the last of those --
  // /account, /account/setup and /support -- stopped doing that, and the
  // `rendered > 0` guard at the bottom fired: nothing rendered, so the check
  // was proving nothing. It had been close to proving nothing for a long time.
  //
  // Signed in now, which is who a work screen is for. Admin routes still
  // redirect, and that is fine -- the guard asks that *something* rendered, not
  // that everything did.
  const protectedRoutes = [...CUSTOMER_ROUTES, ...ADMIN_ROUTES].filter((route) => !route.includes(":"));

  let realFetch;
  const CUSTOMER = { id: "81818181-8181-4181-8181-818181818181", email: "worker@example.com" };
  const SUPABASE_ENV = {
    NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.stub-anon-surface",
    SUPABASE_SERVICE_ROLE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.stub-service-surface"
  };
  const originalEnv = Object.fromEntries(Object.keys(SUPABASE_ENV).map((key) => [key, process.env[key]]));

  before(() => {
    Object.assign(process.env, SUPABASE_ENV);
    realFetch = global.fetch;
    global.fetch = async (url) => {
      const target = String(url);
      const body = target.includes("/auth/v1/user") ? CUSTOMER : [];
      return { ok: true, status: 200, headers: { get: () => null }, json: async () => body };
    };
  });

  after(() => {
    global.fetch = realFetch;
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("never renders the stage on a customer or admin route", async () => {
    const offenders = [];
    let rendered = 0;
    for (const route of protectedRoutes) {
      const surface = await surfaceOf(route, { asCustomer: true });
      if (surface.status !== 200) continue;
      rendered += 1;
      if (surface.stage || surface.depthScript) offenders.push(route);
    }
    assert.deepEqual(offenders, [], "these work screens carry marketing depth; AGENTS.md asks for them to stay calm");
    // Guard against the loop passing because everything redirected.
    assert.ok(rendered > 0, "no protected route rendered, so this check proved nothing");
  });
});
