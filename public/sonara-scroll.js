/* The runtime a published scroll site loads.
 *
 * It does three things and refuses to be needed for any of them:
 *
 *   - scrubs a frame sequence against scroll position
 *   - drives the progress bar where CSS cannot
 *   - wires the soundtrack button
 *
 * Everything else is CSS. A page with this file blocked still reads top to
 * bottom with every word visible, because `sonara-scroll-render.cjs` writes
 * each section in its finished state and layers the animation on top. This
 * script is the enhancement to the enhancement.
 *
 * A separate file rather than inline, because the Content-Security-Policy on
 * this application is `script-src 'self'` and there is no bundler here. The
 * exported ZIP writes its own copy of this same file beside its index.html.
 */
(function () {
  "use strict";

  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- the progress bar ------------------------------------------------ */

  /* CSS does this on its own via animation-timeline: scroll(), in the ~84% of
   * browsers that support it. This covers the rest, and steps aside where the
   * CSS is already running so the two never fight over the same transform. */
  function startProgress() {
    var bar = document.querySelector(".progress");
    if (!bar) return;
    if (window.CSS && CSS.supports && CSS.supports("animation-timeline", "view()")) return;
    if (reduced) { bar.style.transform = "scaleX(1)"; return; }

    var ticking = false;
    function paint() {
      var height = document.documentElement.scrollHeight - window.innerHeight;
      var through = height > 0 ? window.scrollY / height : 0;
      bar.style.transform = "scaleX(" + Math.min(1, Math.max(0, through)) + ")";
      ticking = false;
    }
    window.addEventListener("scroll", function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(paint);
    }, { passive: true });
    paint();
  }

  /* ---- the frame sequence ---------------------------------------------- */

  function padded(index, width) {
    var text = String(index);
    while (text.length < width) text = "0" + text;
    return text;
  }

  function startFrames() {
    var track = document.querySelector("[data-frames]");
    if (!track) return;

    var count = parseInt(track.getAttribute("data-frames"), 10);
    var pattern = track.getAttribute("data-pattern") || "";
    var canvas = track.querySelector("canvas");
    if (!canvas || !count || count < 2 || pattern.indexOf("%d") === -1) return;

    var context = canvas.getContext("2d");
    if (!context) return;

    var images = new Array(count + 1);
    var drawn = -1;

    function urlFor(index) {
      return pattern.replace("%d", padded(index, 4));
    }

    function draw(index) {
      var image = images[index];
      /* Only paint a frame that has actually decoded. Drawing an image that has
       * not loaded clears the canvas to transparent, which reads on screen as
       * the footage flickering to black -- worse than holding the last good
       * frame for another moment. */
      if (!image || !image.complete || !image.naturalWidth) return;
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      drawn = index;
    }

    function load(index, onReady) {
      if (index < 1 || index > count) return;
      if (images[index]) { if (onReady) onReady(); return; }
      var image = new Image();
      image.decoding = "async";
      image.src = urlFor(index);
      images[index] = image;
      if (onReady) image.addEventListener("load", onReady, { once: true });
    }

    /* The first frame immediately, so the canvas is never an empty box while
     * the rest arrive. */
    load(1, function () { draw(1); });

    var ticking = false;
    function paint() {
      var box = track.getBoundingClientRect();
      var scrollable = box.height - window.innerHeight;
      var through = scrollable > 0 ? (-box.top) / scrollable : 0;
      through = Math.min(1, Math.max(0, through));

      var index = Math.min(count, Math.max(1, Math.round(through * (count - 1)) + 1));
      if (index !== drawn) {
        load(index, function () { draw(index); });
        draw(index);
        /* One frame ahead in whichever direction the reader is going, so a
         * steady scroll is not waiting on the network at every step. */
        load(index + (index >= drawn ? 1 : -1));
      }
      ticking = false;
    }

    window.addEventListener("scroll", function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(paint);
    }, { passive: true });
    window.addEventListener("resize", paint, { passive: true });
    paint();
  }

  /* ---- the soundtrack --------------------------------------------------- */

  function startAudio() {
    var button = document.querySelector("[data-audio]");
    var element = document.querySelector("[data-audio-source]");
    if (!button || !element) return;

    /* The button is written hidden and revealed here. Without JavaScript it
     * would be a control that does nothing, and a dead button is worse than no
     * button. */
    button.hidden = false;

    var label = button.textContent;
    button.addEventListener("click", function () {
      if (element.paused) {
        var started = element.play();
        /* A browser may refuse to play, and the promise rejects rather than
         * throwing. Swallowing it silently leaves a button that says "Pause"
         * over silence. */
        if (started && started.catch) {
          started.catch(function () {
            button.textContent = "Your browser would not play this";
            button.disabled = true;
          });
        }
        button.textContent = "Pause";
      } else {
        element.pause();
        button.textContent = label;
      }
    });

    element.addEventListener("ended", function () { button.textContent = label; });
  }

  function start() {
    startProgress();
    startFrames();
    startAudio();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
