// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
(function () {
  "use strict";
  const core = typeof module !== "undefined" && module.exports ? module.require("./creator-project-graph-core.js") : globalThis.SonaraCreatorGraph;
  function createDeviceProjectStore({ scope, projectId, indexedDB = globalThis.indexedDB }) {
    if (typeof scope !== "string" || scope.split(":").length !== 2 || !scope.split(":").every((id) => core.UUID.test(id)) || !core.UUID.test(projectId)) throw new TypeError("Open a signed-in project before using device storage.");
    const key = `${scope}:${projectId}`;
    let opening;
    function database() {
      if (!indexedDB) return Promise.reject(new Error("Device storage is unavailable. Download your draft instead."));
      if (!opening) opening = new Promise((resolve, reject) => {
        let blocked = false;
        const request = indexedDB.open("sonara-creator-drafts-v1", 1);
        request.onupgradeneeded = () => request.result.createObjectStore("drafts", { keyPath: "scope" });
        request.onerror = () => reject(new Error("Device storage could not open. Download your draft instead."));
        request.onblocked = () => { blocked = true; reject(new Error("Close other project tabs before opening device storage.")); };
        request.onsuccess = () => { if (blocked) { request.result.close(); return; } request.result.onversionchange = () => request.result.close(); resolve(request.result); };
      }).catch((error) => { opening = null; throw error; });
      return opening;
    }
    async function transaction(mode, action, expectedRevision, snapshot) {
      const db = await database();
      return new Promise((resolve, reject) => {
        let result, failure;
        const tx = db.transaction("drafts", mode);
        tx.oncomplete = () => failure || result === undefined ? reject(failure || new Error("The device operation could not be confirmed.")) : resolve(result);
        tx.onerror = () => { failure ||= new Error("Device storage failed. Your in-memory draft is still available to download."); };
        tx.onabort = () => reject(failure || new Error("Device storage failed. Your in-memory draft is still available to download."));
        const store = tx.objectStore("drafts");
        const request = store.get(key);
        request.onsuccess = () => {
          try {
            const row = request.result;
            if (row && (row.scope !== key || !Number.isSafeInteger(row.deviceRevision) || row.deviceRevision < 1)) throw new Error("The saved draft could not be read. Keep your current draft and download a copy.");
            const saved = row ? { snapshot: core.validateSnapshot(row.snapshot, projectId), deviceRevision: row.deviceRevision } : null;
            if (action === "read") { result = saved; return; }
            const revision = saved?.deviceRevision || 0;
            if (!Number.isSafeInteger(expectedRevision) || expectedRevision !== revision) throw new Error("Another tab changed the device draft. Download your edits before opening the saved copy.");
            if (action === "clear") { store.delete(key); result = null; }
            else {
              if (!Number.isSafeInteger(revision + 1)) throw new Error("This device draft cannot accept another revision.");
              result = { snapshot, deviceRevision: revision + 1 };
              store.put({ scope: key, ...result });
            }
          } catch (error) { failure = error; tx.abort(); }
        };
      });
    }
    return {
      read: () => transaction("readonly", "read"),
      save: (input, expectedRevision) => transaction("readwrite", "save", expectedRevision, core.validateSnapshot(input, projectId)),
      forget: (expectedRevision) => transaction("readwrite", "clear", expectedRevision),
      close: async () => { if (opening) { const db = await opening.catch(() => null); if (db) db.close(); opening = null; } }
    };
  }
  if (typeof module !== "undefined" && module.exports) module.exports = { createDeviceProjectStore };
  else globalThis.SonaraCreatorDeviceStore = { createDeviceProjectStore };
})();
