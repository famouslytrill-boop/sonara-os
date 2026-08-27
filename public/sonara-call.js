// One end of a browser-to-browser call.
//
// The same file runs on both ends and the difference is one word of
// configuration: the business end creates the call and makes the offer, the
// customer end joins the call it was linked to and answers. Everything after
// that is symmetric, which is why it is one file rather than two that have to
// be kept in step.
//
// A separate file rather than inline script, because the Content-Security-Policy
// is `script-src 'self'` with no bundler, and configuration arrives in a JSON
// script tag for the same reason.
//
// ## What actually crosses this application
//
// An offer, an answer, and a list of network candidates -- a few kilobytes,
// once, at the start. **The audio never comes here.** Once the two ends
// connect they are sending to each other directly, and this application could
// be switched off without the call dropping. That is the whole reason a call
// costs nothing however long it lasts.
//
// ## Why polling, and why it stops
//
// There is no WebSocket to signal over: this runs against a serverless
// function. So each side writes rows and reads the other side's back, every
// second and a half, and **stops the moment the connection is established**.
// A poll that carried on would be a cost per minute on a call that has none.
//
// ## The microphone is asked for on a click and never before
//
// `getUserMedia` triggers the browser's own permission prompt, and a prompt at
// a bad moment does not cost one call -- a dismissal is remembered, and on most
// browsers it is remembered for ever. So the page explains, the button asks,
// and a refusal is reported as a refusal rather than as a failed call.

(function () {
  "use strict";

  var configElement = document.getElementById("sonara-call-config");
  if (!configElement) return;

  var statusElement = document.querySelector("[data-sonara-call-status]");
  var startButton = document.querySelector("[data-sonara-call-start]");
  var hangupButton = document.querySelector("[data-sonara-call-hangup]");
  var audioElement = document.querySelector("[data-sonara-call-audio]");

  function say(message) {
    if (statusElement) statusElement.textContent = message;
  }

  var config;
  try {
    config = JSON.parse(configElement.textContent);
  } catch {
    say("This page could not read its own settings. Reload and try again.");
    if (startButton) startButton.disabled = true;
    return;
  }

  // Named separately rather than one "not supported" sentence. A person on an
  // insecure origin and a person on a browser without WebRTC have different
  // problems and different fixes.
  if (typeof window.RTCPeerConnection !== "function") {
    say("This browser cannot make calls of this kind.");
    if (startButton) startButton.disabled = true;
    return;
  }
  if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== "function") {
    say("This browser will not give a page access to a microphone. On http:// that is expected — this needs https.");
    if (startButton) startButton.disabled = true;
    return;
  }

  var POLL_MS = 1500;

  var peer = null;
  var localStream = null;
  var callId = config.callId || null;
  var token = config.token || null;
  var iceServers = config.iceServers || [];
  var cursor = null;
  var pollTimer = null;
  var finished = false;
  // Candidates that arrived before the remote description was set. Applying one
  // early throws, and a dropped candidate is a call that connects on some
  // networks and not others -- the worst kind of intermittent.
  var pendingCandidates = [];

  function api(path, body) {
    return fetch(path, {
      method: body ? "POST" : "GET",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      credentials: "same-origin",
      body: body ? JSON.stringify(body) : undefined
    }).then(function (response) {
      return response.json().catch(function () { return { ok: false, code: "unreadable" }; });
    });
  }

  function withToken(body) {
    var payload = body || {};
    if (token) payload.token = token;
    return payload;
  }

  function stopPolling() {
    if (pollTimer) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
  }

  function finish(message, reason) {
    if (finished) return;
    finished = true;
    stopPolling();
    say(message);
    if (hangupButton) hangupButton.disabled = true;
    if (startButton) startButton.disabled = true;
    if (localStream) localStream.getTracks().forEach(function (track) { track.stop(); });
    if (peer) {
      try { peer.close(); } catch { /* already closed */ }
    }
    if (callId && reason) {
      // Best effort and deliberately unguarded: the call is over on this side
      // whatever the server says, and reporting a failure to record that would
      // tell the person something went wrong when the only thing that went
      // wrong is a row.
      api("/api/calls/" + encodeURIComponent(callId) + "/status", withToken({ status: "ended", reason: reason }));
    }
  }

  function attachRemote(event) {
    if (audioElement && event.streams && event.streams[0]) audioElement.srcObject = event.streams[0];
  }

  function newPeer() {
    var connection = new RTCPeerConnection({ iceServers: iceServers });

    connection.onicecandidate = function (event) {
      if (!event.candidate || !callId) return;
      // Sent as they are found rather than waiting for gathering to finish.
      // Waiting adds seconds of silence to the start of every call.
      api("/api/calls/" + encodeURIComponent(callId) + "/signals", withToken({
        kind: "candidate",
        payload: event.candidate.toJSON ? event.candidate.toJSON() : event.candidate
      }));
    };

    connection.ontrack = attachRemote;

    connection.onconnectionstatechange = function () {
      if (connection.connectionState === "connected") {
        say("Connected. The audio is going directly between the two devices.");
        // Nothing more is needed from the server, so the polling stops here.
        stopPolling();
        if (callId) api("/api/calls/" + encodeURIComponent(callId) + "/status", withToken({ status: "connected" }));
      } else if (connection.connectionState === "failed") {
        finish(
          config.relay
            ? "The call could not connect. Both sides may be on networks that block it."
            : "The call could not connect. This happens on about one network in six, and this deployment has no relay configured for those.",
          "connection_failed"
        );
      } else if (connection.connectionState === "disconnected" || connection.connectionState === "closed") {
        finish("The call ended.", "disconnected");
      }
    };

    return connection;
  }

  function microphone() {
    // Audio only. Video is a different feature with a different bandwidth
    // story, and asking for a camera nobody wanted is how a permission prompt
    // gets refused.
    return navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  }

  function addLocal(stream) {
    localStream = stream;
    stream.getTracks().forEach(function (track) { peer.addTrack(track, stream); });
  }

  function applyCandidate(candidate) {
    if (!peer.remoteDescription) {
      pendingCandidates.push(candidate);
      return;
    }
    peer.addIceCandidate(candidate).catch(function () {
      // A candidate the browser will not accept is normal -- they arrive from
      // networks that are already unreachable. It is not the call failing.
    });
  }

  function drainCandidates() {
    var waiting = pendingCandidates;
    pendingCandidates = [];
    waiting.forEach(applyCandidate);
  }

  function handle(signal) {
    if (signal.kind === "offer") {
      return peer.setRemoteDescription(signal.payload)
        .then(drainCandidates)
        .then(function () { return microphone(); })
        .then(function (stream) {
          addLocal(stream);
          return peer.createAnswer();
        })
        .then(function (answer) {
          return peer.setLocalDescription(answer).then(function () { return answer; });
        })
        .then(function (answer) {
          say("Answering…");
          return api("/api/calls/" + encodeURIComponent(callId) + "/signals", withToken({ kind: "answer", payload: { type: answer.type, sdp: answer.sdp } }));
        })
        .catch(function (error) {
          finish(
            error && error.name === "NotAllowedError"
              ? "Your browser did not give permission for the microphone, so the call was not answered."
              : "The call could not be answered.",
            "answer_failed"
          );
        });
    }

    if (signal.kind === "answer") {
      return peer.setRemoteDescription(signal.payload).then(drainCandidates).catch(function () {
        finish("The other side answered with something this browser could not use.", "bad_answer");
      });
    }

    if (signal.kind === "candidate") {
      applyCandidate(signal.payload);
      return Promise.resolve();
    }

    if (signal.kind === "bye") {
      finish("The other side hung up.", null);
      return Promise.resolve();
    }

    return Promise.resolve();
  }

  function poll() {
    if (finished || !callId) return;
    var url = "/api/calls/" + encodeURIComponent(callId) + "/signals";
    var parameters = [];
    if (cursor) parameters.push("after=" + encodeURIComponent(cursor));
    if (token) parameters.push("token=" + encodeURIComponent(token));
    if (parameters.length) url += "?" + parameters.join("&");

    api(url)
      .then(function (answer) {
        if (finished) return null;
        if (!answer || answer.ok === false) {
          // A failed poll is not a failed call. Said as what it is, and the
          // polling carries on -- one unreachable request in the middle of a
          // connecting call is ordinary.
          say("Still connecting. One check did not get through.");
          return null;
        }
        cursor = answer.cursor || cursor;
        return (answer.signals || []).reduce(function (chain, signal) {
          return chain.then(function () { return handle(signal); });
        }, Promise.resolve());
      })
      .catch(function () { /* the timer below tries again */ })
      .then(function () {
        if (!finished) pollTimer = setTimeout(poll, POLL_MS);
      });
  }

  function startAsBusiness() {
    say("Placing the call…");
    return api(config.createEndpoint, { customer_id: config.customerId })
      .then(function (answer) {
        if (!answer || answer.ok === false) {
          throw new Error(answer && answer.detail ? answer.detail : "The call could not be placed.");
        }
        callId = answer.callId;
        iceServers = answer.iceServers || [];
        peer = newPeer();

        // Shown before the microphone is asked for, so the link exists whether
        // or not permission is granted -- a call somebody can still send after
        // fumbling the prompt.
        var link = window.location.origin + answer.joinUrl;
        say("Send this link to them, then keep this page open: " + link);

        return microphone();
      })
      .then(function (stream) {
        addLocal(stream);
        return peer.createOffer();
      })
      .then(function (offer) {
        return peer.setLocalDescription(offer).then(function () { return offer; });
      })
      .then(function (offer) {
        return api("/api/calls/" + encodeURIComponent(callId) + "/signals", withToken({
          kind: "offer",
          payload: { type: offer.type, sdp: offer.sdp }
        }));
      })
      .then(function () {
        poll();
      });
  }

  function startAsCustomer() {
    say("Joining…");
    peer = newPeer();
    // The customer waits: the business end has already made the offer, or is
    // about to. Asking for the microphone now rather than on the offer would
    // put the prompt in front of somebody before there is anything to hear.
    poll();
    return Promise.resolve();
  }

  if (startButton) {
    startButton.addEventListener("click", function () {
      startButton.disabled = true;
      if (hangupButton) hangupButton.disabled = false;
      var started = config.role === "business" ? startAsBusiness() : startAsCustomer();
      started.catch(function (error) {
        finish(
          error && error.name === "NotAllowedError"
            ? "Your browser did not give permission for the microphone, so no call was placed."
            : (error && error.message) || "The call could not be started.",
          "start_failed"
        );
      });
    });
  }

  if (hangupButton) {
    hangupButton.addEventListener("click", function () {
      if (callId) {
        api("/api/calls/" + encodeURIComponent(callId) + "/signals", withToken({ kind: "bye", payload: { reason: "hangup" } }));
      }
      finish("You hung up.", "hangup");
    });
  }

  // A closed tab is a hung-up call. Without this the other side sits listening
  // to nothing until the connection times out, and the row says 'ringing' for
  // ever.
  window.addEventListener("pagehide", function () {
    if (!finished && callId) {
      api("/api/calls/" + encodeURIComponent(callId) + "/signals", withToken({ kind: "bye", payload: { reason: "left" } }));
    }
  });
})();
