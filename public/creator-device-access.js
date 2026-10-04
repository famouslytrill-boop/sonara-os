// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
(function () {
  "use strict";
  window.SonaraDeviceAccess = {
    async verify(keys, userId, signal) {
      if (!userId) throw new Error("Reload this page after signing in.");
      let response, body;
      const controller = new window.AbortController();
      const cancel = () => controller.abort();
      if (signal?.aborted) cancel();
      signal?.addEventListener("abort", cancel, { once: true });
      const timeout = window.setTimeout(cancel, 10000);
      try {
        response = await fetch("/api/account/device-permissions", { credentials: "same-origin", cache: "no-store", headers: { Accept: "application/json" }, signal: controller.signal });
        body = await response.json();
      } catch { throw new Error("Your device permissions could not be checked. Nothing was started."); }
      finally { window.clearTimeout(timeout); signal?.removeEventListener("abort", cancel); }
      if (!response.ok || body?.ok !== true || body.userId !== userId || !Array.isArray(body.permissions)) {
        throw new Error("Your account or device permissions could not be confirmed. Nothing was started.");
      }
      if (!keys.every((key) => body.permissions.some((entry) => entry.key === key && entry.state === "granted" && entry.allowed === true))) {
        throw new Error("Turn on the required access in Device permissions, then try again.");
      }
      return true;
    }
  };
}());
