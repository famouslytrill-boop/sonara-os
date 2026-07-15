// SONARA interface engine.
// Progressive enhancement only: if anything here fails or is skipped, the
// server-rendered page stays fully usable. Capability ladder:
//   1. prefers-reduced-motion: reduce  -> static frame, no animation loop
//   2. low-power signals (saveData / low deviceMemory on small screens)
//      -> static frame
//   3. default                          -> Canvas 2D ambient layer
//   4. navigator.gpu present            -> same Canvas 2D visuals at a higher
//      particle tier. WebGPU is a QUALITY HINT only; no adapter is requested
//      and the page never waits on the GPU.
(function sonaraInterfaceEngine() {
  "use strict";

  function safe(run) {
    try {
      run();
    } catch {
      // Never let the ambient layer break the business interface.
      // Failures leave the static server-rendered page untouched.
    }
  }

  function markNavigationState() {
    var path = window.location.pathname.replace(/\/+$/, "") || "/";
    var links = document.querySelectorAll("header nav a, .sonara-quick-bar a");
    for (var index = 0; index < links.length; index += 1) {
      var link = links[index];
      var href = (link.getAttribute("href") || "").replace(/\/+$/, "") || "/";
      if (href === "/" ? path === "/" : path === href || path.indexOf(href + "/") === 0) {
        link.setAttribute("aria-current", "page");
      }
    }
  }

  function prefersReducedMotion() {
    return Boolean(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function isLowPowerContext() {
    var connection = navigator.connection || navigator.webkitConnection || {};
    if (connection.saveData) return true;
    var smallViewport = Math.min(window.innerWidth, window.innerHeight) < 480;
    if (smallViewport && typeof navigator.deviceMemory === "number" && navigator.deviceMemory <= 4) return true;
    return false;
  }

  function qualityTier() {
    // Feature detection per MDN: WebGPU is not Baseline; presence of
    // navigator.gpu only raises the ambient particle budget. Absence (or any
    // failure) keeps the universal Canvas 2D tier.
    try {
      return "gpu" in navigator && navigator.gpu ? 2 : 1;
    } catch {
      return 1;
    }
  }

  function startAmbientLayer() {
    var stage = document.querySelector(".sonara-face-orb");
    if (!stage || stage.querySelector(".sonara-engine-canvas")) return;
    document.documentElement.setAttribute("data-sonara-engine", "static");
    if (prefersReducedMotion() || isLowPowerContext()) return;

    var canvas = document.createElement("canvas");
    canvas.className = "sonara-engine-canvas";
    canvas.setAttribute("aria-hidden", "true");
    var context = canvas.getContext("2d");
    if (!context) return;
    stage.appendChild(canvas);
    document.documentElement.setAttribute("data-sonara-engine", "animated");

    var ratio = Math.min(window.devicePixelRatio || 1, 2);
    var tier = qualityTier();
    var particleCount = tier === 2 ? 42 : 24;
    var particles = [];
    var running = true;
    var frameHandle = 0;

    function resize() {
      var bounds = stage.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(bounds.width * ratio));
      canvas.height = Math.max(1, Math.floor(bounds.height * ratio));
    }

    function resetParticles() {
      particles.length = 0;
      for (var index = 0; index < particleCount; index += 1) {
        particles.push({
          angle: (Math.PI * 2 * index) / particleCount,
          radius: 0.22 + (index % 5) * 0.09,
          speed: 0.0009 + (index % 7) * 0.00035,
          size: 1.1 + (index % 3) * 0.9,
          hue: [46, 190, 322][index % 3]
        });
      }
    }

    function draw(now) {
      if (!running) return;
      var width = canvas.width;
      var height = canvas.height;
      context.clearRect(0, 0, width, height);
      var centerX = width / 2;
      var centerY = height / 2;
      var base = Math.min(width, height);
      for (var index = 0; index < particles.length; index += 1) {
        var particle = particles[index];
        var angle = particle.angle + now * particle.speed;
        var wobble = Math.sin(now * 0.0004 + index) * 0.02;
        var distance = (particle.radius + wobble) * base;
        var x = centerX + Math.cos(angle) * distance;
        var y = centerY + Math.sin(angle) * distance * 0.62;
        context.beginPath();
        context.arc(x, y, particle.size * ratio, 0, Math.PI * 2);
        context.fillStyle = "hsla(" + particle.hue + ", 90%, 70%, 0.55)";
        context.fill();
      }
      frameHandle = window.requestAnimationFrame(draw);
    }

    function pause() {
      running = false;
      if (frameHandle) window.cancelAnimationFrame(frameHandle);
    }

    function resume() {
      if (running) return;
      running = true;
      frameHandle = window.requestAnimationFrame(draw);
    }

    document.addEventListener("visibilitychange", function onVisibility() {
      if (document.hidden) pause();
      else resume();
    });
    window.addEventListener("pagehide", pause);
    window.addEventListener("resize", function onResize() {
      resize();
    });

    resize();
    resetParticles();
    frameHandle = window.requestAnimationFrame(draw);
  }

  safe(markNavigationState);
  safe(startAmbientLayer);
})();
