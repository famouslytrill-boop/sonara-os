/*
 * SONARA depth — pointer tilt, pointer spotlight, scroll entrance, and hero parallax.
 *
 * The design system has carried a full 3D vocabulary for a while:
 * .sonara-stage, .sonara-depth, .sonara-depth__layer, .sonara-reveal, a motion
 * gate, a work-surface opt-out, and a mobile opt-out. Every piece of it was
 * defined, shipped on every page, and used by nothing -- zero occurrences of
 * any of those class names across server.js, lib/ and routes/. The stylesheet
 * described a 3D interface that no page had ever asked for.
 *
 * This is the moving part of that vocabulary. Everything static is CSS; this
 * file only supplies the three things CSS cannot compute: where the pointer is,
 * whether an element has been scrolled into view, and how far the page has
 * scrolled.
 *
 * Rules it holds to:
 *
 *   - Marketing surfaces only. It looks for .sonara-stage, which
 *     lib/sonara-page-frame.cjs renders only when a page declares itself
 *     marketing. Work screens never match. AGENTS.md asks for operational
 *     screens to stay calm and this is how that is enforced at runtime rather
 *     than by remembering.
 *
 *   - Motion off means off. It reads the same source of truth as the CSS --
 *     data-sonara-motion on <html>, written by sonara-experience-controls.js --
 *     plus prefers-reduced-motion. If either says no, this file attaches
 *     nothing and clears anything it had set.
 *
 *   - Never hide content it might fail to reveal. The entrance styles are gated
 *     behind data-sonara-depth="ready" on <html>, which is set here. If this
 *     script is blocked, errors, or is served stale, nothing is hidden, because
 *     the rule that hides it cannot match.
 *
 *   - Pointer, not touch. Tilt binds only under (hover: hover) and
 *     (pointer: fine), matching the CSS, which drops perspective on small
 *     screens because the effect reads as jitter there.
 *
 * No dependencies, no WebGL, no canvas. Runs under script-src 'self'.
 */
(function () {
  "use strict";

  var root = document.documentElement;
  var MAX_TILT = 6; // degrees; past about 8 the text edges visibly soften
  var HERO_DEPTH = 90; // px of Z travel across one viewport of scroll

  var stages = [];
  var tiltCards = [];
  var heroes = [];
  var pending = [];
  var observer = null;
  var pointerBound = false;
  var scrollBound = false;
  var frame = 0;
  var pointerEvent = null;

  function motionAllowed() {
    if (root.getAttribute("data-sonara-motion") === "off") return false;
    return !(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function finePointer() {
    return Boolean(window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches);
  }

  /* Entrance ------------------------------------------------------------
   * IntersectionObserver rather than a scroll handler: the browser does the
   * intersection maths off the main thread, and an element is unobserved once
   * it has appeared, so a long marketing page settles to zero observers.
   *
   * The observer alone is not enough, and the gap is not theoretical -- it was
   * measured on /start at 390px. An observer only fires when an element's
   * intersection state CHANGES. Scroll smoothly and every card passes through
   * the viewport, so every card fires and appears. Jump straight down the page
   * and a card that was below the viewport is now above it: not intersecting
   * before, not intersecting after, no state change, no callback. It stays at
   * opacity 0 for the rest of the session, occupying its full height as blank
   * space, with nothing to recover it.
   *
   * Jumping is ordinary: the skip link, any #fragment link, find-in-page, the
   * End key, and the browser restoring scroll position on reload or back all
   * do it. Four of six cards on /start stayed invisible that way.
   *
   * So `pending` keeps what has not appeared yet, and sweepPending() reveals
   * anything the viewport has already passed. The observer still handles the
   * normal case, which is what keeps the animation. */
  function reveal(element) {
    element.setAttribute("data-sonara-enter", "in");
    if (observer) observer.unobserve(element);
    var index = pending.indexOf(element);
    if (index !== -1) pending.splice(index, 1);
  }

  // Anything whose top edge is above the viewport has been scrolled into or
  // past, so there is no entrance left to play. Elements still fully below are
  // left to the observer, which is what animates them.
  //
  // The test is `top < 0` rather than `bottom <= 0`, and the difference is a
  // real case rather than caution. A card straddling the top of the viewport --
  // most of it scrolled past, a sliver showing -- satisfies neither the
  // observer's 0.05 threshold nor a wholly-above test, so it sat in the gap
  // between the two and stayed blank. Measured: jumping to the bottom of /start
  // left exactly one card in that state after the wholly-above sweep fixed the
  // other three.
  function sweepPending() {
    for (var index = pending.length - 1; index >= 0; index -= 1) {
      var element = pending[index];
      var box = element.getBoundingClientRect();
      if (box.top < 0) reveal(element);
    }
  }

  function observeEntrances() {
    // setup() re-runs whenever the motion preference changes, so drop the
    // previous observer rather than stacking a second one on the same nodes.
    if (observer) observer.disconnect();
    observer = null;
    pending = [];

    for (var s = 0; s < stages.length; s += 1) {
      var targets = stages[s].querySelectorAll("[data-sonara-enter]");
      for (var t = 0; t < targets.length; t += 1) {
        if (targets[t].getAttribute("data-sonara-enter") === "in") continue;
        pending.push(targets[t]);
      }
    }

    // No IntersectionObserver means no way to animate an entrance, and the CSS
    // is already hiding these. Show them rather than leaving a blank page.
    if (!window.IntersectionObserver) {
      while (pending.length) reveal(pending[pending.length - 1]);
      return;
    }

    observer = new window.IntersectionObserver(
      function (entries) {
        for (var index = 0; index < entries.length; index += 1) {
          var entry = entries[index];
          if (!entry.isIntersecting) continue;
          reveal(entry.target);
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.05 }
    );

    for (var p = 0; p < pending.length; p += 1) observer.observe(pending[p]);
  }

  /* Tilt ----------------------------------------------------------------
   * One delegated pointermove on the document, coalesced into a single rAF.
   * Binding per card would mean one listener per card and one layout read per
   * card per move; this reads each hovered card's box once per frame. */
  function applyTilt() {
    frame = 0;
    var event = pointerEvent;
    if (!event) return;

    var target = event.target && event.target.closest ? event.target.closest(".sonara-depth") : null;

    for (var index = 0; index < tiltCards.length; index += 1) {
      var card = tiltCards[index];
      if (card !== target) clearCard(card);
    }

    if (!target || !target.closest(".sonara-stage")) return;

    var box = target.getBoundingClientRect();
    if (!box.width || !box.height) return;

    // -0.5 .. 0.5 from the card's centre.
    var offsetX = (event.clientX - box.left) / box.width - 0.5;
    var offsetY = (event.clientY - box.top) / box.height - 0.5;

    // Y drives rotateX and X drives rotateY: pushing the pointer down tips the
    // top of the card away, which is the direction that reads as physical.
    target.style.setProperty("--sonara-tilt-x", (-offsetY * MAX_TILT).toFixed(2) + "deg");
    target.style.setProperty("--sonara-tilt-y", (offsetX * MAX_TILT).toFixed(2) + "deg");

    // The same two numbers as a percentage across the card, for the spotlight.
    // Written here rather than in a second handler because the position is
    // already computed and a second listener on pointermove would double the
    // per-frame work for one gradient.
    target.style.setProperty("--sonara-pointer-x", ((offsetX + 0.5) * 100).toFixed(1) + "%");
    target.style.setProperty("--sonara-pointer-y", ((offsetY + 0.5) * 100).toFixed(1) + "%");

    target.setAttribute("data-sonara-tilt", "on");

    if (tiltCards.indexOf(target) === -1) tiltCards.push(target);
  }

  function clearCard(card) {
    card.removeAttribute("data-sonara-tilt");
    card.style.removeProperty("--sonara-tilt-x");
    card.style.removeProperty("--sonara-tilt-y");
    card.style.removeProperty("--sonara-pointer-x");
    card.style.removeProperty("--sonara-pointer-y");
  }

  function onPointerMove(event) {
    pointerEvent = event;
    if (!frame) frame = window.requestAnimationFrame(applyTilt);
  }

  function onPointerLeave() {
    pointerEvent = null;
    while (tiltCards.length) clearCard(tiltCards.pop());
  }

  /* Hero parallax -------------------------------------------------------- */
  function applyHeroDepth() {
    var scrolled = window.pageYOffset || root.scrollTop || 0;
    var viewport = window.innerHeight || 1;
    var ratio = Math.min(1, Math.max(0, scrolled / viewport));
    for (var index = 0; index < heroes.length; index += 1) {
      heroes[index].style.setProperty("--sonara-hero-depth", (ratio * HERO_DEPTH).toFixed(1));
    }
  }

  var heroFrame = 0;
  function onScroll() {
    if (heroFrame) return;
    heroFrame = window.requestAnimationFrame(function () {
      heroFrame = 0;
      applyHeroDepth();
      sweepPending();
    });
  }

  /* Wiring --------------------------------------------------------------- */
  function teardown() {
    root.removeAttribute("data-sonara-depth");
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    // Anything already hidden by the entrance rule has to be released, or
    // switching motion off mid-page would leave the rest of the page blank.
    for (var s = 0; s < stages.length; s += 1) {
      var waiting = stages[s].querySelectorAll("[data-sonara-enter]");
      for (var p = 0; p < waiting.length; p += 1) waiting[p].setAttribute("data-sonara-enter", "in");
    }
    pending = [];
    onPointerLeave();
    for (var h = 0; h < heroes.length; h += 1) heroes[h].style.removeProperty("--sonara-hero-depth");
    if (pointerBound) {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerleave", onPointerLeave);
      pointerBound = false;
    }
    if (scrollBound) {
      window.removeEventListener("scroll", onScroll);
      scrollBound = false;
    }
  }

  function setup() {
    stages = [].slice.call(document.querySelectorAll(".sonara-stage"));
    if (!stages.length) return;

    if (!motionAllowed()) {
      teardown();
      return;
    }

    heroes = [];
    for (var s = 0; s < stages.length; s += 1) {
      var hero = stages[s].querySelector(".sonara-hero-stage");
      if (hero) heroes.push(hero);
    }

    // Only now, once motion is confirmed allowed, does the entrance rule
    // become able to hide anything.
    root.setAttribute("data-sonara-depth", "ready");
    observeEntrances();
    // A reload or a back-navigation can restore scroll position before this
    // runs, putting cards above the viewport that the observer will never
    // report. Sweep once before waiting for a scroll that may never come.
    sweepPending();

    if (finePointer() && !pointerBound) {
      document.addEventListener("pointermove", onPointerMove, { passive: true });
      document.addEventListener("pointerleave", onPointerLeave, { passive: true });
      pointerBound = true;
    }

    // Bound for entrances as well as heroes. Work screens have neither and
    // return early above, so this still costs nothing there -- but a marketing
    // page with no hero scene still needs the sweep, and previously did not get
    // a scroll listener at all.
    if ((heroes.length || pending.length) && !scrollBound) {
      window.addEventListener("scroll", onScroll, { passive: true });
      scrollBound = true;
      applyHeroDepth();
    }
  }

  function start() {
    setup();

    // Restoring from the back/forward cache does not re-run setup, and the page
    // comes back at the scroll position it was left at. Sweep so a card the
    // customer had already scrolled past is not blank on their way back.
    window.addEventListener("pageshow", sweepPending);

    // The preference can change after load, from the experience settings dialog
    // or from the OS. Both re-run the same decision rather than needing a
    // reload, which is what the CSS side already does.
    if (window.matchMedia) {
      var query = window.matchMedia("(prefers-reduced-motion: reduce)");
      var rerun = function () { setup(); };
      if (query.addEventListener) query.addEventListener("change", rerun);
      else if (query.addListener) query.addListener(rerun);
    }

    if (window.MutationObserver) {
      new window.MutationObserver(function () { setup(); }).observe(root, {
        attributes: true,
        attributeFilter: ["data-sonara-motion"]
      });
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
