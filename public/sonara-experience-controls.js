/*
 * SONARA experience controls — motion, sound, and haptics.
 *
 * AGENTS.md is unambiguous:
 *
 *   "Sounds, voice announcements, haptics, SMS, push, and email alerts must be
 *    off or explicitly user-controlled by default."
 *
 * So all three are built, and all three are OFF until the person using the
 * product turns them on. Nothing here fires on first visit. The preference is
 * stored locally and never leaves the browser -- no account field, no network
 * call, nothing to sync or leak.
 *
 * Sound is synthesised with the Web Audio API rather than shipping audio files:
 * a handful of short tones cost roughly 2 KB of code instead of several hundred
 * KB of assets, and they cannot be blocked by the CSP because there is nothing
 * to fetch.
 *
 * No dependencies. Runs under script-src 'self'.
 */
(function () {
  "use strict";

  var STORAGE_KEY = "sonara.experience.v1";

  // The settings dialog is owned by sonara-one.js, which persists here. This
  // file used to keep its own store, and nothing ever wrote to it -- no caller
  // anywhere reached window.sonaraExperience.set(). So this store sat at its
  // defaults forever while the user's real choices went somewhere else.
  //
  // That was not merely redundant. This file loads after sonara-one.js and
  // calls apply() unconditionally, so on every page load it overwrote
  // data-sonara-motion, -sound and -haptics with those defaults. Turning motion
  // off in the settings dialog survived until the next navigation and then
  // silently came back on -- while the checkbox still showed "off", because
  // sonara-one.js ticks it from the store that did get written.
  //
  // A control that reports a setting it is not applying is worse than no
  // control. One store, written by the dialog, read by both.
  var SHARED_STORAGE_KEY = "sonara:nexus:preferences:v2";
  var root = document.documentElement;

  var defaults = {
    motion: "auto", // auto | off  -- "auto" still defers to prefers-reduced-motion
    sound: "off",   // off | on
    haptics: "off"  // off | on
  };

  var state = load();

  function readStore(key) {
    try {
      var raw = window.localStorage.getItem(key);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      // Private browsing, disabled storage, corrupt value -- fall back to the
      // safe defaults rather than letting a preference read break the page.
      return null;
    }
  }

  function load() {
    // The dialog's store wins. STORAGE_KEY is still read as a fallback so
    // anyone who has a value under the old key keeps it rather than being
    // silently reset.
    var parsed = readStore(SHARED_STORAGE_KEY) || readStore(STORAGE_KEY);
    if (!parsed) return Object.assign({}, defaults);
    return {
      // sonara-one.js writes "on"/"off"; this file has always used
      // "auto"/"off", where "auto" means "allowed, still subject to the OS
      // setting". "on" maps to "auto" rather than to a hard on, so an explicit
      // in-app "on" can never override prefers-reduced-motion.
      motion: parsed.motion === "off" ? "off" : "auto",
      sound: parsed.sound === "on" ? "on" : "off",
      haptics: parsed.haptics === "on" ? "on" : "off"
    };
  }

  function save() {
    try {
      // Merge, never replace. The dialog's store also holds language and theme,
      // and writing only these three keys would drop them.
      var existing = readStore(SHARED_STORAGE_KEY) || {};
      existing.motion = state.motion === "off" ? "off" : "on";
      existing.sound = state.sound;
      existing.haptics = state.haptics;
      window.localStorage.setItem(SHARED_STORAGE_KEY, JSON.stringify(existing));
    } catch {
      /* Not being able to persist a preference is not worth an error. */
    }
  }

  // Re-read before applying. apply() on its own would use whatever `state` held
  // when this file loaded, and the dialog can have written since -- that stale
  // read is how the two copies diverged in the first place.
  function refresh() {
    state = load();
    apply();
  }

  function systemPrefersReducedMotion() {
    return Boolean(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function motionEnabled() {
    return state.motion !== "off" && !systemPrefersReducedMotion();
  }

  function apply() {
    // The CSS reads this attribute and zeroes its duration tokens, which
    // disables every animation in the design system at once.
    root.setAttribute("data-sonara-motion", motionEnabled() ? "on" : "off");
    root.setAttribute("data-sonara-sound", state.sound);
    root.setAttribute("data-sonara-haptics", state.haptics);
  }

  /* Sound ---------------------------------------------------------------
   * One lazily-created AudioContext, created only after the user has opted
   * in and interacted -- browsers block it otherwise, and creating one
   * speculatively wastes an audio thread on every page load. */
  var audio = null;

  function context() {
    if (state.sound !== "on") return null;
    if (audio) return audio;
    var Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    try {
      audio = new Ctor();
    } catch {
      audio = null;
    }
    return audio;
  }

  var TONES = {
    tap: { frequency: 620, duration: 0.045, gain: 0.05 },
    confirm: { frequency: 880, duration: 0.09, gain: 0.06 },
    error: { frequency: 200, duration: 0.16, gain: 0.07 }
  };

  function playTone(name) {
    var tone = TONES[name];
    var ctx = context();
    if (!tone || !ctx) return;
    if (ctx.state === "suspended" && ctx.resume) ctx.resume();

    var oscillator = ctx.createOscillator();
    var gain = ctx.createGain();
    var now = ctx.currentTime;

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(tone.frequency, now);

    // Ramped rather than gated, because an abrupt start or stop on a square
    // edge is audible as a click.
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(tone.gain, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + tone.duration);

    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(now);
    oscillator.stop(now + tone.duration + 0.02);
  }

  /* Haptics -------------------------------------------------------------
   * navigator.vibrate is unsupported on iOS Safari and increasingly gated
   * elsewhere. Treated as a progressive enhancement: if it is absent, the
   * interaction is simply silent rather than throwing. */
  var HAPTICS = { tap: 8, confirm: [10, 30, 10], error: [24, 40, 24] };

  function vibrate(name) {
    if (state.haptics !== "on") return;
    if (typeof navigator.vibrate !== "function") return;
    var pattern = HAPTICS[name];
    if (!pattern) return;
    try {
      navigator.vibrate(pattern);
    } catch {
      /* Vendor quirk; a failed buzz is not worth surfacing. */
    }
  }

  function feedback(name) {
    playTone(name);
    vibrate(name);
  }

  /* Public API ----------------------------------------------------------- */
  var api = {
    get: function () {
      return {
        motion: state.motion,
        motionActive: motionEnabled(),
        sound: state.sound,
        haptics: state.haptics,
        systemReducedMotion: systemPrefersReducedMotion()
      };
    },
    set: function (key, value) {
      if (!Object.prototype.hasOwnProperty.call(defaults, key)) return api.get();
      if (key === "motion") state.motion = value === "off" ? "off" : "auto";
      else state[key] = value === "on" ? "on" : "off";
      save();
      apply();
      return api.get();
    },
    toggle: function (key) {
      if (key === "motion") return api.set("motion", state.motion === "off" ? "auto" : "off");
      return api.set(key, state[key] === "on" ? "off" : "on");
    },
    feedback: feedback
  };

  window.sonaraExperience = api;

  apply();

  // Track live changes to the OS setting, so turning reduced motion on in the
  // system takes effect without a reload.
  if (window.matchMedia) {
    var query = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (query.addEventListener) query.addEventListener("change", refresh);
    else if (query.addListener) query.addListener(refresh);
  }

  // The dialog writes the store directly, and another tab may write it too.
  // Without this, a change made in one tab would not reach the others until a
  // reload -- and the OS-change handler above would apply a stale value.
  window.addEventListener("storage", function (event) {
    if (!event.key || event.key === SHARED_STORAGE_KEY) refresh();
  });

  // Opt-in feedback for anything that asks for it by attribute. Nothing is
  // wired implicitly -- an element must declare data-sonara-feedback, so no
  // existing control starts making noise because this file loaded.
  document.addEventListener(
    "click",
    function (event) {
      var target = event.target && event.target.closest ? event.target.closest("[data-sonara-feedback]") : null;
      if (!target) return;
      feedback(target.getAttribute("data-sonara-feedback") || "tap");
    },
    { passive: true }
  );
})();
