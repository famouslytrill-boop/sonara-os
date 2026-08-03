"use strict";

// The design system shipped a complete 3D vocabulary that no page used.
//
// .sonara-stage, .sonara-depth, .sonara-depth__layer, .sonara-reveal, a motion
// gate, a work-surface opt-out and a mobile opt-out were all defined in
// public/sonara-design-system.css, linked from every page, and referenced zero
// times across server.js, lib/ and routes/. The stylesheet described a 3D
// interface the server had never rendered, and nothing failed, because nothing
// asked whether the two agreed.
//
// So this asks. It renders real pages and checks three things that can only be
// answered by looking at the output:
//
//   1. Public overview screens actually carry the stage.
//   2. Work screens actually do not -- AGENTS.md asks for operational screens
//      to stay calm, and the expensive mistake here is animating one.
//   3. The safeguards are still wired: motion off, reduced motion, and the
//      entrance gate that must never be able to hide content permanently.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const request = require("supertest");
const app = require("../server");

const root = path.join(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

// Public overview screens. These render without a session.
const MARKETING_ROUTES = [
  "/",
  "/about",
  "/pricing",
  "/security",
  "/contact",
  "/products",
  "/free-tools",
  "/how-it-works",
  "/tutorials",
  "/start",
  "/service-catalog",
  "/business-builder",
  "/creator-studio",
  "/growth-studio"
];

async function getHtml(route) {
  const response = await request(app).get(route).set("accept", "text/html");
  return { status: response.status, html: String(response.text || "") };
}

describe("marketing surfaces render the depth vocabulary", () => {
  it("puts the 3D stage on every public overview screen", async function renderMarketing() {
    this.timeout(60000);
    const missing = [];
    for (const route of MARKETING_ROUTES) {
      const { status, html } = await getHtml(route);
      if (status !== 200) {
        missing.push(`${route}: HTTP ${status}`);
        continue;
      }
      if (!html.includes('data-sonara-surface="marketing"')) missing.push(`${route}: not marked as a marketing surface`);
      if (!/<main[^>]*class="[^"]*sonara-stage/.test(html)) missing.push(`${route}: has no perspective stage`);
      if (!html.includes("/sonara-depth.js")) missing.push(`${route}: does not load the depth script`);
    }
    assert.deepEqual(missing, [], `These public screens are not rendering the 3D vocabulary:\n  ${missing.join("\n  ")}`);
  });

  it("gives those screens something with depth to actually show", async function renderCards() {
    this.timeout(30000);
    const { html } = await getHtml("/");
    assert.match(html, /class="[^"]*sonara-depth/, "the homepage renders no card with depth");
    assert.match(html, /data-sonara-enter/, "the homepage has no scroll-entrance targets");
    assert.match(html, /class="[^"]*sonara-reveal/, "the hero does not reveal");
    // The stage has to be an ancestor of the cards, or the perspective does
    // nothing -- CSS 3D is inherited through the containing block, so a stage
    // rendered as a sibling would look identical in the markup and flat on
    // screen.
    const mainStart = html.indexOf("<main");
    assert.ok(mainStart >= 0);
    assert.ok(html.indexOf('class="card sonara-depth', mainStart) > mainStart || html.indexOf("sonara-depth", mainStart) > mainStart);
  });

  it("leaves work screens calm", async function renderWork() {
    this.timeout(30000);
    // Protected routes redirect when signed out; the redirect target is itself
    // a page, and either way it must not be a marketing surface. Checking the
    // rendered result rather than the route list is the point -- a work screen
    // that starts animating would show up here.
    for (const route of ["/dashboard", "/account", "/login", "/signup", "/readiness", "/legal"]) {
      const { html } = await getHtml(route);
      if (!html.includes("<main")) continue;
      assert.ok(
        !html.includes('data-sonara-surface="marketing"'),
        `${route} is rendering as a marketing surface; work screens stay calm`
      );
      assert.ok(!html.includes("/sonara-depth.js"), `${route} loads the depth script`);
    }
  });

  it("defaults an unmarked page to the calm surface", () => {
    // The default matters more than any single call site: a page added later
    // that forgets to say what it is should come out calm, not animated.
    const frame = read("lib/sonara-page-frame.cjs");
    assert.match(frame, /surface = "work"/, "layout() no longer defaults to the calm surface");
    assert.match(frame, /data-sonara-surface="\$\{isMarketing \? "marketing" : "work"\}"/);
  });
});

describe("the depth safeguards stay wired", () => {
  const styles = read("public/sonara-design-system.css");
  const script = read("public/sonara-depth.js");

  it("cannot hide content it might fail to reveal", () => {
    // Every rule that sets opacity: 0 for the entrance must sit behind the
    // attribute the script sets, so a blocked or stale script leaves the page
    // readable instead of blank.
    const entranceRules = styles
      .split("}")
      .filter((rule) => /\[data-sonara-enter\]/.test(rule) && /opacity:\s*0\b/.test(rule));
    assert.ok(entranceRules.length > 0, "the entrance rule is gone; this check has gone blind");
    for (const rule of entranceRules) {
      assert.match(
        rule,
        /:root\[data-sonara-depth="ready"\]/,
        `An entrance rule hides content without the script gate, so a blocked script would blank the page:\n${rule.trim()}`
      );
    }
    assert.match(script, /root\.setAttribute\("data-sonara-depth", "ready"\)/);
    // And it must only be set after motion is confirmed allowed.
    const setupBlock = script.slice(script.indexOf("function setup()"), script.indexOf("function start()"));
    assert.ok(
      setupBlock.indexOf("motionAllowed()") < setupBlock.indexOf('"data-sonara-depth", "ready"'),
      "the entrance gate opens before motion is checked"
    );
  });

  it("turns everything off for reduced motion and for motion off", () => {
    assert.match(styles, /:root\[data-sonara-motion="off"\][^{]*\[data-sonara-enter\]/);
    assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\[data-sonara-enter\][\s\S]*?opacity: 1 !important/);
    assert.match(script, /data-sonara-motion/);
    assert.match(script, /prefers-reduced-motion: reduce/);
    // Switching motion off mid-visit has to release anything still hidden.
    assert.match(script, /function teardown\(\)/);
    assert.match(script, /attributeFilter: \["data-sonara-motion"\]/);
  });

  it("keeps compositor layers off the screens that do not animate", () => {
    // will-change on every card is a layer per card. The card helpers carry
    // .sonara-depth now, and work screens can render hundreds of them.
    const willChange = styles.split("}").filter((rule) => /will-change:\s*transform/.test(rule));
    assert.ok(willChange.length > 0);
    for (const rule of willChange) {
      assert.match(rule, /\.sonara-stage/, `will-change is not scoped to a stage:\n${rule.trim()}`);
    }
  });

  it("binds pointer tilt only where the stylesheet allows it", () => {
    assert.match(script, /\(hover: hover\) and \(pointer: fine\)/);
    assert.match(styles, /@media \(max-width: 640px\)[\s\S]*?\.sonara-stage \{ perspective: none/);
    assert.match(script, /passive: true/);
    assert.match(script, /requestAnimationFrame/);
  });

  it("ships the script the pages ask for, and caches it", () => {
    assert.ok(fs.existsSync(path.join(root, "public/sonara-depth.js")));
    const worker = read("public/sw.js");
    assert.match(worker, /\/sonara-depth\.js\?v=/, "the depth script is not in the service worker precache");
    assert.match(worker, /\/sonara-design-system\.css\?v=/);
  });
});
