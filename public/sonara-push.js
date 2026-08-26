// Asking the browser for notification permission, on a real click.
//
// A separate file rather than inline script, because the Content-Security-Policy
// this application serves is `script-src 'self'` with no bundler. That is also
// why the configuration arrives in a JSON script tag rather than as a global:
// a `<script>window.X = ...</script>` would need `'unsafe-inline'`, which is the
// one line that would undo the policy.
//
// ## Why the prompt only ever follows a click
//
// `Notification.requestPermission()` requires a user gesture, and that
// constraint is worth honouring rather than working around. Most browsers
// refuse for ever after a dismissal, so a prompt shown at a bad moment does not
// cost one visit -- it costs the capability permanently, for that person, on
// that device. The page explains first; the button asks second.

(function () {
  "use strict";

  var form = document.getElementById("sonara-push-form");
  var configElement = document.getElementById("sonara-push-config");
  if (!form || !configElement) return;

  var status = form.querySelector("[data-sonara-push-status]");
  var button = form.querySelector("[data-sonara-push-subscribe]");

  function say(message) {
    if (status) status.textContent = message;
  }

  var config;
  try {
    config = JSON.parse(configElement.textContent);
  } catch {
    say("This page could not read its own settings. Reload and try again.");
    return;
  }

  // Feature detection before anything else, and each capability named
  // separately. "Notifications are not supported" is useless to somebody on
  // iOS Safari whose actual problem is that the site is not on their home
  // screen -- a different sentence and a different fix.
  if (!("serviceWorker" in navigator)) {
    say("This browser cannot run the background worker notifications need.");
    if (button) button.disabled = true;
    return;
  }
  if (!("PushManager" in window) || !("Notification" in window)) {
    say("This browser does not support push notifications. On an iPhone or iPad, add this site to your home screen first — notifications only work from there.");
    if (button) button.disabled = true;
    return;
  }
  if (Notification.permission === "denied") {
    // Not recoverable from here, and saying so is kinder than a button that
    // silently does nothing.
    say("Notifications are blocked for this site in your browser settings. Change it there and reload this page.");
    if (button) button.disabled = true;
    return;
  }

  // base64url to the Uint8Array the Push API wants. Padding is restored
  // explicitly: atob tolerates its absence on some browsers and not others, and
  // a key decoded one byte short fails at subscribe time with an opaque error.
  function urlBase64ToUint8Array(value) {
    var padded = value.replace(/-/g, "+").replace(/_/g, "/");
    while (padded.length % 4) padded += "=";
    var raw = window.atob(padded);
    var out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
    return out;
  }

  function chosenTopics() {
    return Array.prototype.slice
      .call(form.querySelectorAll('input[name="topic"]:checked'))
      .map(function (input) { return input.value; });
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (button) button.disabled = true;
    say("Waiting for your browser…");

    // Asked before subscribing, so a refusal costs nothing and says so.
    Notification.requestPermission()
      .then(function (permission) {
        if (permission !== "granted") {
          say("Your browser did not grant permission, so nothing was turned on.");
          if (button) button.disabled = false;
          return null;
        }
        return navigator.serviceWorker.ready;
      })
      .then(function (registration) {
        if (!registration) return null;
        return registration.pushManager.subscribe({
          // Required by every browser: a push that shows nothing is not
          // permitted, which is the rule that stops silent tracking pushes.
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(config.publicKey)
        });
      })
      .then(function (subscription) {
        if (!subscription) return null;
        return fetch(config.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // Same-origin only. The endpoint came from our own page, and
          // credentials are needed for the session cookie.
          credentials: "same-origin",
          body: JSON.stringify({ subscription: subscription.toJSON(), topics: chosenTopics() })
        });
      })
      .then(function (response) {
        if (!response) return null;
        return response.json().catch(function () { return { ok: false, code: "unreadable" }; });
      })
      .then(function (answer) {
        if (!answer) return;
        if (!answer.ok) {
          // The browser now holds a subscription this application did not
          // record. Said plainly, because the recovery is to press the button
          // again rather than to wonder why nothing arrives.
          say("Your browser agreed, but we could not save it. Press the button again.");
          if (button) button.disabled = false;
          return;
        }
        var count = (answer.topics || []).length;
        say(count
          ? "Notifications are on for this browser, for " + count + " kind" + (count === 1 ? "" : "s") + " of update."
          : "Notifications are on, but nothing is ticked — so nothing will be sent. Tick something and press again.");
      })
      .catch(function () {
        say("Something went wrong and notifications were not turned on.");
        if (button) button.disabled = false;
      });
  });
})();
