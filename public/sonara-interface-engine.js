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
// Also provides: aria-current navigation state, a keyboard command palette
// (Ctrl+K), and safe optional haptics with a device-local disable setting.
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

  // ---------------------------------------------------------------------
  // Navigation state
  // ---------------------------------------------------------------------

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

  // ---------------------------------------------------------------------
  // Appearance and quality: system theme by default, device-local choice.
  // Reduced motion always takes precedence over a visual quality selection.
  // ---------------------------------------------------------------------

  var APPEARANCE_KEY = "sonara-appearance";
  var QUALITY_KEY = "sonara-quality";

  function storedChoice(key, allowed, fallback) {
    try {
      var value = window.localStorage.getItem(key);
      return allowed.indexOf(value) !== -1 ? value : fallback;
    } catch {
      return fallback;
    }
  }

  function appearanceChoice() {
    return storedChoice(APPEARANCE_KEY, ["system", "light", "dark"], "system");
  }

  function resolvedAppearance(choice) {
    if (choice === "light" || choice === "dark") return choice;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function applyAppearance(choice) {
    var resolved = resolvedAppearance(choice);
    document.documentElement.setAttribute("data-sonara-appearance", choice);
    document.documentElement.setAttribute("data-theme", resolved);
    var themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.setAttribute("content", resolved === "light" ? "#FAF8F4" : "#0C1122");
  }

  function bindAppearance() {
    var choice = appearanceChoice();
    applyAppearance(choice);
    var selects = document.querySelectorAll("[data-sonara-appearance-select]");
    for (var index = 0; index < selects.length; index += 1) {
      selects[index].value = choice;
      selects[index].addEventListener("change", function onAppearance(event) {
        var next = event.currentTarget.value;
        try {
          window.localStorage.setItem(APPEARANCE_KEY, next);
        } catch {
          // The selected appearance still applies for this page.
        }
        applyAppearance(next);
      });
    }
    if (window.matchMedia) {
      var colorScheme = window.matchMedia("(prefers-color-scheme: dark)");
      var onSystemAppearance = function onSystemAppearance() {
        if (appearanceChoice() === "system") applyAppearance("system");
      };
      if (colorScheme.addEventListener) colorScheme.addEventListener("change", onSystemAppearance);
    }
  }

  function qualityChoice() {
    return storedChoice(QUALITY_KEY, ["auto", "full", "reduced", "off"], "auto");
  }

  function bindQuality() {
    var choice = qualityChoice();
    document.documentElement.setAttribute("data-sonara-quality", choice);
    var selects = document.querySelectorAll("[data-sonara-quality-select]");
    for (var index = 0; index < selects.length; index += 1) {
      selects[index].value = choice;
      selects[index].addEventListener("change", function onQuality(event) {
        try {
          window.localStorage.setItem(QUALITY_KEY, event.currentTarget.value);
        } catch {
          // Storage can be unavailable in restricted browser modes.
        }
        window.location.reload();
      });
    }
  }

  // ---------------------------------------------------------------------
  // Haptics: optional, brief, meaningful actions only. Device-local setting.
  // ---------------------------------------------------------------------

  var HAPTICS_KEY = "sonara-haptics";

  function hapticsEnabled() {
    try {
      if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
      return window.localStorage.getItem(HAPTICS_KEY) === "on";
    } catch {
      return false;
    }
  }

  function vibrate(pattern) {
    try {
      if (!hapticsEnabled()) return;
      if (typeof navigator.vibrate === "function") navigator.vibrate(pattern);
    } catch {
      // Vibration is never required.
    }
  }

  function bindHaptics() {
    document.addEventListener("click", function onActionClick(event) {
      var target = event.target && event.target.closest
        ? event.target.closest('button[type="submit"], [data-haptic]')
        : null;
      if (target) vibrate(10);
    });

    var toggles = document.querySelectorAll("[data-sonara-haptics-toggle]");
    for (var index = 0; index < toggles.length; index += 1) {
      var toggle = toggles[index];
      syncHapticsToggle(toggle);
      toggle.addEventListener("click", function onToggle(event) {
        var button = event.currentTarget;
        try {
          var next = hapticsEnabled() ? "off" : "on";
          window.localStorage.setItem(HAPTICS_KEY, next);
        } catch {
          // Storage unavailable: leave default behavior.
        }
        syncHapticsToggle(button);
        vibrate(8);
      });
    }
  }

  function syncHapticsToggle(button) {
    var enabled = hapticsEnabled();
    button.setAttribute("aria-pressed", String(enabled));
    button.textContent = enabled ? "Haptics: On" : "Haptics: Off";
  }

  // ---------------------------------------------------------------------
  // Command palette (Ctrl+K / button). Static destination list; navigation
  // only — no data access, no network calls.
  // ---------------------------------------------------------------------

  var DESTINATIONS = [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Start guide", href: "/start" },
    { label: "Service catalog", href: "/service-catalog" },
    { label: "Service requests", href: "/requests" },
    { label: "Deliverables", href: "/deliverables" },
    { label: "Billing", href: "/billing" },
    { label: "Support", href: "/support" },
    { label: "Account", href: "/account" },
    { label: "Account setup", href: "/account/setup" },
    { label: "Account preferences", href: "/account/preferences" },
    { label: "Notifications", href: "/notifications" },
    { label: "Products", href: "/products" },
    { label: "Free tools", href: "/free-tools" },
    { label: "Tutorials", href: "/tutorials" },
    { label: "Pricing", href: "/pricing" },
    { label: "Contact", href: "/contact" },
    { label: "Platform readiness", href: "/readiness" },
    { label: "Legal center", href: "/legal" },
    { label: "Business Builder", href: "/business-builder" },
    { label: "Business Builder dashboard", href: "/business-builder/dashboard" },
    { label: "Business Builder tools", href: "/business-builder/tools" },
    { label: "Creator Studio", href: "/creator-studio" },
    { label: "Creator Studio dashboard", href: "/creator-studio/dashboard" },
    { label: "Creator Studio tools", href: "/creator-studio/tools" },
    { label: "Growth Studio", href: "/growth-studio" },
    { label: "Growth Studio dashboard", href: "/growth-studio/dashboard" },
    { label: "Growth Studio tools", href: "/growth-studio/tools" },
    { label: "Admin console", href: "/admin" },
    { label: "Login", href: "/login" },
    { label: "Create account", href: "/signup" }
  ];

  var palette = null;
  var paletteInput = null;
  var paletteList = null;
  var paletteOpen = false;
  var lastFocused = null;

  function buildPalette() {
    palette = document.createElement("div");
    palette.className = "sonara-command-palette";
    palette.setAttribute("role", "dialog");
    palette.setAttribute("aria-modal", "true");
    palette.setAttribute("aria-label", "Go to page");
    palette.hidden = true;

    var panel = document.createElement("div");
    panel.className = "sonara-command-panel";
    paletteInput = document.createElement("input");
    paletteInput.type = "search";
    paletteInput.placeholder = "Type a destination...";
    paletteInput.setAttribute("aria-label", "Search destinations");
    paletteList = document.createElement("ul");
    paletteList.setAttribute("role", "listbox");
    panel.appendChild(paletteInput);
    panel.appendChild(paletteList);
    palette.appendChild(panel);
    document.body.appendChild(palette);

    paletteInput.addEventListener("input", function onFilter() {
      renderPaletteItems(paletteInput.value);
    });
    paletteInput.addEventListener("keydown", function onKey(event) {
      if (event.key === "Enter") {
        var first = paletteList.querySelector("a");
        if (first) first.click();
      }
    });
    palette.addEventListener("click", function onBackdrop(event) {
      if (event.target === palette) closePalette();
    });
    document.addEventListener("keydown", function onEscape(event) {
      if (paletteOpen && event.key === "Escape") closePalette();
    });
  }

  function renderPaletteItems(query) {
    var needle = String(query || "").trim().toLowerCase();
    var matches = DESTINATIONS.filter(function match(destination) {
      return !needle || destination.label.toLowerCase().indexOf(needle) !== -1 || destination.href.indexOf(needle) !== -1;
    }).slice(0, 9);
    paletteList.textContent = "";
    for (var index = 0; index < matches.length; index += 1) {
      var item = document.createElement("li");
      var link = document.createElement("a");
      link.href = matches[index].href;
      link.textContent = matches[index].label;
      item.appendChild(link);
      paletteList.appendChild(item);
    }
    if (!matches.length) {
      var empty = document.createElement("li");
      empty.className = "sonara-command-empty";
      empty.textContent = "No matching destination.";
      paletteList.appendChild(empty);
    }
  }

  function openPalette() {
    if (!palette) buildPalette();
    lastFocused = document.activeElement;
    palette.hidden = false;
    paletteOpen = true;
    paletteInput.value = "";
    renderPaletteItems("");
    paletteInput.focus();
  }

  function closePalette() {
    if (!palette) return;
    palette.hidden = true;
    paletteOpen = false;
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  function bindPalette() {
    document.addEventListener("keydown", function onShortcut(event) {
      if ((event.ctrlKey || event.metaKey) && String(event.key).toLowerCase() === "k") {
        event.preventDefault();
        if (paletteOpen) closePalette();
        else openPalette();
      }
    });
    var buttons = document.querySelectorAll("[data-sonara-command]");
    for (var index = 0; index < buttons.length; index += 1) {
      buttons[index].addEventListener("click", function onOpen() {
        openPalette();
      });
    }
  }

  // ---------------------------------------------------------------------
  // Ambient canvas layer
  // ---------------------------------------------------------------------

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
    var quality = qualityChoice();
    if (prefersReducedMotion() || quality === "off" || quality === "reduced") return;
    if (quality === "auto" && isLowPowerContext()) return;

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

  safe(bindAppearance);
  safe(bindQuality);
  safe(markNavigationState);
  safe(bindHaptics);
  safe(bindPalette);
  safe(startAmbientLayer);
})();
