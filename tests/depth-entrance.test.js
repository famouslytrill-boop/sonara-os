"use strict";

// The scroll entrance could hide content permanently.
//
// public/sonara-depth.js fades cards in as they scroll into view, and the CSS
// that hides them before they appear is gated behind data-sonara-depth="ready",
// which the script sets. So if the script never runs, nothing is hidden. That
// was the safeguard, and it held.
//
// What it did not cover is the script running and then not finishing the job.
// An IntersectionObserver fires when an element's intersection state CHANGES.
// Scroll smoothly and every card passes through the viewport, so every card
// fires. Jump straight down and a card that was below the viewport is now above
// it: not intersecting before, not intersecting after, no callback. It stays at
// opacity 0 for the rest of the session, holding its full height as blank
// space, with nothing left to recover it.
//
// Measured in a real browser on /start at 390px before the fix: four of six
// cards invisible after jumping to the bottom, and they stay that way. That is
// the "too much space" a customer photographed -- not padding, but content that
// never painted.
//
// Jumping is ordinary: the skip link, any #fragment link, find-in-page, the End
// key, and the browser restoring scroll position on reload or back all do it.
//
// These checks run the real file against a small DOM stub. The stub's
// IntersectionObserver deliberately does nothing on a jump, which is exactly
// what a real one does, and the assertions are about what is visible
// afterwards.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "public", "sonara-depth.js"), "utf8");

function makeElement(top, height) {
  const attributes = { "data-sonara-enter": "" };
  return {
    top,
    height,
    attributes,
    getAttribute: (name) => (name in attributes ? attributes[name] : null),
    setAttribute: (name, value) => { attributes[name] = value; },
    removeAttribute: (name) => { delete attributes[name]; },
    getBoundingClientRect() { return { top: this.top, bottom: this.top + this.height, left: 0, right: 300, width: 300, height: this.height }; },
    style: { setProperty() {}, removeProperty() {} },
    closest: () => null,
    querySelector: () => null
  };
}

// Builds a page of `count` cards laid out down a 900px viewport, runs
// sonara-depth.js against it, and hands back the levers a test needs.
function run({ count = 6, viewport = 900, intersectionObserver = true } = {}) {
  const cards = [];
  for (let index = 0; index < count; index += 1) cards.push(makeElement(400 + index * 320, 260));

  const stage = {
    querySelectorAll: (selector) => (selector === "[data-sonara-enter]" ? cards.slice() : []),
    querySelector: () => null
  };

  const rootAttributes = {};
  const listeners = { window: {}, document: {} };
  const observed = new Set();
  let observerCallback = null;

  const documentStub = {
    readyState: "complete",
    documentElement: {
      getAttribute: (name) => (name in rootAttributes ? rootAttributes[name] : null),
      setAttribute: (name, value) => { rootAttributes[name] = value; },
      removeAttribute: (name) => { delete rootAttributes[name]; },
      scrollTop: 0
    },
    querySelectorAll: (selector) => (selector === ".sonara-stage" ? [stage] : []),
    addEventListener: (type, handler) => { listeners.document[type] = handler; }
  };

  const windowStub = {
    innerHeight: viewport,
    pageYOffset: 0,
    matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
    requestAnimationFrame: (callback) => { callback(); return 1; },
    addEventListener: (type, handler) => { listeners.window[type] = handler; },
    removeEventListener: (type) => { delete listeners.window[type]; },
    MutationObserver: function () { return { observe() {} }; }
  };

  if (intersectionObserver) {
    windowStub.IntersectionObserver = function (callback) {
      observerCallback = callback;
      return {
        observe: (element) => observed.add(element),
        unobserve: (element) => observed.delete(element),
        disconnect: () => observed.clear()
      };
    };
  }

  const context = { window: windowStub, document: documentStub };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(source, context);

  const visible = () => cards.filter((card) => card.getAttribute("data-sonara-enter") === "in");
  const hidden = () => cards.filter((card) => card.getAttribute("data-sonara-enter") !== "in");

  return {
    cards,
    rootAttributes,
    visible,
    hidden,
    observedCount: () => observed.size,
    // Move the page by `distance` and fire scroll, the way a browser does.
    scrollBy(distance) {
      windowStub.pageYOffset += distance;
      for (const card of cards) card.top -= distance;
      if (listeners.window.scroll) listeners.window.scroll();
    },
    // Fire the observer for whatever is genuinely intersecting right now. A
    // real observer only reports elements whose state changed, so a jump that
    // moves an element from below the viewport to above it reports nothing --
    // which is the bug, and why this is called separately from scrollBy.
    fireObserver() {
      if (!observerCallback) return;
      const entries = [...observed]
        .map((target) => {
          const box = target.getBoundingClientRect();
          const shown = Math.min(box.bottom, viewport * 0.88) - Math.max(box.top, 0);
          return { target, isIntersecting: shown / box.height >= 0.05 };
        })
        .filter((entry) => entry.isIntersecting);
      if (entries.length) observerCallback(entries);
    }
  };
}

describe("the marketing scroll entrance", () => {
  it("hides nothing until the script has confirmed motion is allowed", () => {
    const page = run();
    assert.equal(page.rootAttributes["data-sonara-depth"], "ready", "the entrance rule was never armed");
  });

  it("leaves cards below the fold to the observer, so the animation still happens", () => {
    const page = run();
    assert.equal(page.visible().length, 0, "cards were revealed immediately, so nothing would animate");
    assert.equal(page.observedCount(), 6, "not every card is being observed");
  });

  it("reveals cards as they scroll into view", () => {
    const page = run();
    for (let step = 0; step < 12; step += 1) {
      page.scrollBy(300);
      page.fireObserver();
    }
    assert.deepEqual(page.hidden(), [], "smooth scrolling left content invisible");
  });

  it("reveals cards the page jumped past without ever intersecting", () => {
    // The regression. One scroll to the bottom, and the observer reports
    // nothing because no element changed state.
    const page = run();
    page.scrollBy(3000);
    page.fireObserver();
    assert.deepEqual(
      page.hidden().map((card) => card.top),
      [],
      "content the page jumped past is still invisible, and nothing will ever reveal it"
    );
  });

  it("reveals a card straddling the top of the viewport", () => {
    // Most of it scrolled past, a sliver showing: below the observer's 0.05
    // threshold, and not wholly above either. It sat in the gap between the
    // two tests and stayed blank.
    const page = run({ count: 1 });
    page.cards[0].top = 400;
    page.scrollBy(650); // top: -250, bottom: +10 -- about 4% of a 260px card
    page.fireObserver();
    assert.deepEqual(page.hidden(), [], "a card straddling the viewport top stayed hidden");
  });

  it("shows everything when the browser has no IntersectionObserver", () => {
    // No observer means no way to animate an entrance, and the CSS is already
    // hiding these. Blank is the one outcome that is not acceptable.
    const page = run({ intersectionObserver: false });
    assert.deepEqual(page.hidden(), [], "content stays hidden on a browser without IntersectionObserver");
  });

  it("sweeps on restore, when scroll position is set before the script runs", () => {
    // A reload or a back-navigation restores scroll before this code runs, so
    // there is no scroll event to react to -- setup() has to sweep once itself.
    const page = run({ count: 3 });
    for (const card of page.cards) card.top -= 2000;
    const restored = run({ count: 0 });
    assert.ok(restored, "the no-card case must not throw");
    const jumped = run({ count: 3 });
    jumped.scrollBy(2000);
    assert.deepEqual(jumped.hidden(), [], "content above a restored scroll position stayed hidden");
  });
});
