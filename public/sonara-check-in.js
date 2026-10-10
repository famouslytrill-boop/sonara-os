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

  // Keep ambiguous outcomes with their original id, so retries cannot create
  // another event. Ask for JSON and refuse redirects before sending elsewhere.
  function post(body) {
    return fetch(config.endpoint, {
      method: "POST", redirect: "error",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body)
    }).then(function (response) {
      if (queue) return queue.deliveryResult(response).then(function (decision) {
        return { ok: decision.outcome === "sent" || decision.outcome === "duplicate",
          code: decision.outcome === "auth" ? "authentication_required" : decision.outcome === "wait" ? "unreachable" : decision.outcome,
          retryAt: decision.retryAt || 0 };
      });
      if (!response.ok || response.redirected) return { ok: false };
      return response.json().then(function (answer) { return { ok: Boolean(answer && answer.ok === true) }; }, function () { return { ok: false }; });
    }, function () {
      return { ok: false, code: "unreachable" };
    });
  }

  function renderReview() {
    var panel = form.querySelector("[data-sonara-check-in-review]");
    var list = form.querySelector("[data-sonara-check-in-review-list]");
    var reviewStatus = form.querySelector("[data-sonara-check-in-review-status]");
    if (!queue || !panel || !list) return;
    var result = queue.review({ scope: config });
    list.textContent = "";
    if (!result.entries.length) {
      panel.hidden = true;
      if (reviewStatus) reviewStatus.textContent = "";
      return;
    }
    panel.hidden = false;
    if (reviewStatus) reviewStatus.textContent = "These saved check-ins are not sent automatically. Review each one before removing it from this device.";
    result.entries.forEach(function (entry) {
      var item = document.createElement("li");
      // A shared device may retain someone else's pending check-in. The
      // review is for deciding whether to discard it, never for exposing its
      // original capture timestamp or coordinates to today's signed-in user.
      item.appendChild(document.createTextNode((entry.source === "legacy" ? "Earlier account or browser session" : "Account scope needs review") + " — details hidden for privacy. "));
      var button = document.createElement("button");
      button.type = "button";
      button.className = "action";
      button.textContent = "Discard saved check-in";
      button.dataset.sonaraDiscardEntry = entry.id || "";
      button.dataset.sonaraDiscardSource = entry.source;
      item.appendChild(button);
      list.appendChild(item);
    });
  }

  function sendKept() {
    if (!queue || !queue.pending({ scope: config })) { say("No saved check-ins are waiting on this account."); renderReview(); return; }
    queue.flush({ scope: config }).then(function (result) {
      var delivered = result.sent + result.duplicates;
      if (delivered && !result.waiting) say(delivered === 1 ? "Your check-in from earlier has now been recorded, at the time you made it." : delivered + " check-ins from earlier have now been recorded, at the times you made them.");
      else if (result.waiting) say(result.waiting === 1 ? "One check-in is still waiting on this device to be sent." : result.waiting + " check-ins are still waiting on this device to be sent.");
      if (result.authenticationRequired) say("Your saved check-ins are still on this device. Sign in to the same account and try sending them again.");
      if (result.storageFailed) say("This browser could not update its saved check-ins. They may be sent again; their original references prevent duplicate records.");
      if (result.refused) say("A check-in kept on this device was refused when it was sent, so it was not recorded.");
      if (result.expired) say("A check-in kept on this device was more than a week old and was not sent.");
      renderReview();
    });
  }
  var retryButton = form.querySelector("[data-sonara-check-in-retry]");
  if (retryButton) retryButton.addEventListener("click", sendKept);
  var reviewButton = form.querySelector("[data-sonara-check-in-review-toggle]");
  if (reviewButton) reviewButton.addEventListener("click", renderReview);
  var reviewPanel = form.querySelector("[data-sonara-check-in-review]");
  if (reviewPanel) reviewPanel.addEventListener("click", function (event) {
    var target = event.target;
    if (!target || !target.dataset || !target.dataset.sonaraDiscardEntry) return;
    var discarded = queue.discard(target.dataset.sonaraDiscardEntry, { scope: config, source: target.dataset.sonaraDiscardSource });
    if (discarded.discarded) say("The saved check-in was discarded from this device.");
    else say("That saved check-in could not be discarded. Try again.");
    renderReview();
  });
  window.addEventListener("online", sendKept);
  sendKept();
  renderReview();

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
          capture_user_id: config.userId,
          capture_organization_id: config.organizationId,
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
        if (outcome.answer && (outcome.answer.code === "unreachable" || outcome.answer.code === "authentication_required") && queue && outcome.body.client_event_id) {
          var kept = queue.keep(config.endpoint, outcome.body, { scope: config, retryAt: outcome.answer.retryAt });
          if (kept.kept) {
            say(outcome.answer.code === "authentication_required"
              ? "Your check-in is saved on this device. Sign in to the same account, then send saved check-ins."
              : "Delivery is not confirmed. Your check-in is saved on this device with its original time. Try sending saved check-ins again shortly.");
          } else {
            say(kept.reason === "full" ? "No connection, and this device is already holding as many check-ins as it can. Nothing new was kept." : "No connection, and this browser would not let us keep the check-in. Nothing was recorded.");
          }
          if (button) button.disabled = false;
          return;
        }
        if (!outcome.answer || outcome.answer.ok !== true) {
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
