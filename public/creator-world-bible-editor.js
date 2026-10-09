// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
(function () {
  "use strict";
  const form = document.querySelector("[data-world-bible-form]");
  if (!form) return;
  const input = form.querySelector("#world-bible-json");
  const status = form.querySelector("[data-world-bible-status]");
  const submit = form.querySelector('button[type="submit"]');
  const projectId = form.dataset.projectId;
  let revision = Number(form.dataset.revision);
  if (!/^[0-9a-f-]{36}$/.test(projectId) || !Number.isSafeInteger(revision) || revision < 0) return;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    let source;
    try { source = JSON.parse(input.value); }
    catch { status.textContent = "Invalid JSON. Correct the syntax before saving."; return; }
    submit.disabled = true;
    status.textContent = "Saving to this project…";
    try {
      const response = await fetch(`/api/creator-studio/projects/${encodeURIComponent(projectId)}/world`, {
        method: "PUT", credentials: "same-origin",
        headers: { "content-type": "application/json", "x-sonara-intent": "world-bible-save" },
        body: JSON.stringify({ expectedRevision: revision, source })
      });
      const body = await response.json();
      if (!response.ok || !body.ok) {
        status.textContent = body.code === "revision_conflict"
          ? "Conflict: another tab changed this World Bible. Copy your edits, reload, and compare before trying again."
          : (body.message || "The save could not be confirmed. Your text remains in this editor.");
        return;
      }
      revision = body.revision;
      form.dataset.revision = String(revision);
      status.textContent = `Saved revision ${revision}. This did not publish or generate any media.`;
    } catch {
      status.textContent = "Connection failed. Your edits remain here; the save is not confirmed.";
    } finally { submit.disabled = false; }
  });
})();
