"use strict";

// The whole of the client script.
//
// A song page that is still being made reloads itself. That is all it does, and
// it is deliberately a reload rather than a fetch-and-patch: every page here is
// rendered on the server, so a reload is guaranteed to agree with what the
// server thinks, where a partial update is a second renderer that can drift.
//
// It does not reload while somebody is typing. The song page carries a rename
// box, and wiping what a person has half-typed to update a status badge would
// be a worse failure than showing a stale badge for a few seconds.

(function () {
  var page = document.querySelector("[data-refresh]");
  if (!page) return;

  var seconds = 5;

  function typing() {
    var active = document.activeElement;
    if (!active) return false;
    var name = active.tagName;
    return name === "INPUT" || name === "TEXTAREA" || active.isContentEditable;
  }

  function tick() {
    if (typing()) {
      // Try again later rather than never: somebody who starts typing and walks
      // away should still see the song arrive.
      window.setTimeout(tick, seconds * 1000);
      return;
    }
    window.location.reload();
  }

  window.setTimeout(tick, seconds * 1000);
})();
