(function sonaraAuthRecovery() {
  "use strict";

  var form = document.querySelector("[data-sonara-recovery-form]");
  if (!form) return;
  var tokenInput = form.querySelector("[data-sonara-recovery-token]");
  var status = form.querySelector("[data-sonara-recovery-status]");
  var submit = form.querySelector("[data-sonara-recovery-submit]");
  var fragment = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  var accessToken = fragment.get("access_token") || "";
  var recoveryType = fragment.get("type") || "";

  if (accessToken && (!recoveryType || recoveryType === "recovery")) {
    tokenInput.value = accessToken;
    submit.disabled = false;
    status.textContent = "Recovery link verified. Choose a new password.";
    window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
    return;
  }

  status.textContent = "This recovery link is missing or expired. Request a new link.";
})();
