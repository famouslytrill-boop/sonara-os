// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
// Recording a check-in, on a real click, at the precision the person picked.
//
// A separate file rather than inline script for the same reason as
// public/sonara-push.js: the Content-Security-Policy is `script-src 'self'`
// with no bundler, so an inline `<script>` would need 'unsafe-inline' -- the one
// line that would undo the policy. Configuration arrives in a JSON script tag.
//
// ## Nothing here runs without a submit
//
// `getCurrentPosition` is called inside the submit handler and nowhere else,
// and `watchPosition` is not called at all. That is not a style preference: the
// difference between "a check-in" and "tracking" is entirely whether a position
// is taken when somebody asks for it or continuously while they are not
// looking, and only one of those is what AGENTS.md permits.
//
// ## The rounding happens here, before anything is sent
//
// public/sonara-location-precision.js is loaded first and does the reducing.
// Rounding on the server would describe the storage rather than the disclosure:
// by then the precise coordinate has already left the phone. So "roughly where
// I am" means the exact figure never leaves the device, and the server applies
// the same function afterwards only so a payload cannot claim a coarseness it
// did not apply.

(function () {
  "use strict";

  var form = document.getElementById("sonara-check-in-form");
  var configElement = document.getElementById("sonara-check-in-config");
  if (!form || !configElement) return;

  var precision = window.SonaraLocationPrecision;
  var status = form.querySelector("[data-sonara-check-in-status]");
  var button = form.querySelector("[data-sonara-check-in-submit]");

  function say(message) {
    if (status) status.textContent = message;
  }

  if (!precision) {
    say("This page could not load the part that protects your position, so nothing will be sent.");
    if (button) button.disabled = true;
    return;
  }

  var config;
  try {
    config = JSON.parse(configElement.textContent);
  } catch {
    say("This page could not read its own settings. Reload and try again.");
    if (button) button.disabled = true;
    return;
  }

  function chosenMode() {
    var picked = form.querySelector('input[name="privacy_mode"]:checked');
    return picked ? picked.value : precision.DEFAULT_MODE;
  }

  // The reading, or null. Never rejects: a refusal and a timeout are ordinary
  // answers here, not errors, and the difference between them is what the
  // person is told next.
  function readPosition() {
    return new Promise(function (resolve) {
      if (!navigator.geolocation) return resolve({ ok: false, reason: "unsupported" });
      navigator.geolocation.getCurrentPosition(
        function (position) {
          resolve({
            ok: true,
            reading: {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracyMeters: position.coords.accuracy
            }
          });
        },
        function (error) {
          resolve({ ok: false, reason: error && error.code === 1 ? "denied" : "unavailable" });
        },
        // High accuracy is NOT requested. The finest reading a device can give
        // costs battery and takes longer, and every mode but one rounds it away
        // immediately. `precise` accepts a normal fix; a check-in is a place,
        // not a navigation fix.
        { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
      );
    });
  }

  // public/sonara-offline-queue.js, when it loaded. Without it a check-in
  // with no signal is lost, as it always was, and the page says so.
  var queue = window.SonaraOfflineQueue || null;

  // No answer at all -- no signal, a timeout -- or the server failing comes
  // back as `unreachable`, which is the case worth keeping and retrying. A 4xx
  // is the server refusing this check-in, and sending it again would not help.
  function post(body) {
    return fetch(config.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body)
    }).then(function (response) {
      if (response.status >= 500) return { ok: false, code: "unreachable" };
      return response.json().catch(function () { return { ok: false, code: "unreadable" }; });
    }, function () {
      return { ok: false, code: "unreachable" };
    });
  }

  function sendKept() {
    if (!queue || !queue.pending()) return;
    queue.flush().then(function (result) {
      var delivered = result.sent + result.duplicates;
      if (delivered && !result.waiting) say(delivered === 1 ? "Your check-in from earlier has now been recorded, at the time you made it." : delivered + " check-ins from earlier have now been recorded, at the times you made them.");
      else if (result.waiting) say(result.waiting === 1 ? "One check-in is still waiting on this device to be sent." : result.waiting + " check-ins are still waiting on this device to be sent.");
      if (result.refused) say("A check-in kept on this device was refused when it was sent, so it was not recorded.");
      if (result.expired) say("A check-in kept on this device was more than a week old and was not sent.");
    });
  }
  window.addEventListener("online", sendKept);
  sendKept();

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (button) button.disabled = true;

    var mode = chosenMode();
    var wantsPosition = precision.modeFor(mode).value !== "manual";

    say(wantsPosition ? "Asking your device where you are…" : "Recording your check-in…");

    var located = wantsPosition ? readPosition() : Promise.resolve({ ok: false, reason: "not_wanted" });

    located
      .then(function (result) {
        if (wantsPosition && !result.ok) {
          // Each refusal gets its own sentence and its own recovery. "Could not
          // get your location" covers three different situations and helps with
          // none of them.
          if (result.reason === "denied") {
            say("Your browser did not share your position, so nothing was recorded. You can check in without one by choosing the last option.");
          } else if (result.reason === "unsupported") {
            say("This browser cannot report a position. You can still check in by choosing the last option.");
          } else {
            say("Your device could not work out where it is just now. Try again in a moment, or check in without a position.");
          }
          if (button) button.disabled = false;
          return null;
        }

        // Reduced here, on the device. What goes on the wire is already
        // whatever coarseness was chosen.
        var reduced = precision.reduce(result.ok ? result.reading : null, mode);
        var raw = {
          event_type: "check_in",
          // Sent because /staff/location lists check-ins by employee_id. Without
          // it the row is written, the request succeeds, and the person is told
          // to reload a page their check-in will never appear on -- a success
          // message about something that did not happen from where they stand.
          // The value came from the server on this page; it is not a claim the
          // browser gets to make freely, and the endpoint refuses one that is
          // not the caller's own.
          employee_id: config.employeeId || null,
          privacy_mode: reduced.mode,
          latitude: reduced.latitude,
          longitude: reduced.longitude,
          accuracy_meters: reduced.accuracyMeters
        };
        // Named and timed now, when the button was pressed, so a send that
        // only succeeds later records the time it happened and is recorded
        // once however many attempts it takes.
        var body = queue ? queue.prepare(raw) || raw : raw;
        return post(body).then(function (answer) {
          return { answer: answer, reduced: reduced, body: body };
        });
      })
      .then(function (outcome) {
        if (!outcome) return;
        if (outcome.answer && outcome.answer.code === "unreachable" && queue && outcome.body.client_event_id) {
          var kept = queue.keep(config.endpoint, outcome.body);
          if (kept.kept) {
            say("No connection. Your check-in is saved on this device and will be sent when you are back online, recorded at the time you pressed the button.");
          } else {
            say(kept.reason === "full" ? "No connection, and this device is already holding as many check-ins as it can. Nothing new was kept." : "No connection, and this browser would not let us keep the check-in. Nothing was recorded.");
          }
          if (button) button.disabled = false;
          return;
        }
        if (!outcome.answer || outcome.answer.ok === false) {
          say("Your check-in was not saved. Press the button again.");
          if (button) button.disabled = false;
          return;
        }
        say(
          outcome.reduced.mode === "manual"
            ? "Checked in. No position was sent."
            : "Checked in, " + precision.modeFor(outcome.reduced.mode).label.toLowerCase() + ". Reload to see it below."
        );
      })
      .catch(function () {
        say("Something went wrong and nothing was recorded.");
        if (button) button.disabled = false;
      });
  });
})();
