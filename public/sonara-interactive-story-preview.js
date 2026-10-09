// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
(function () {
  "use strict";
  const form = document.querySelector("[data-sonara-interactive-preview]");
  if (!form) return;
  const submit = form.querySelector('[type="submit"]');
  const status = form.querySelector("[data-preview-status]");
  const output = form.querySelector("[data-preview-output]");
  const story = form.querySelector('textarea[name="story"]');
  const decisions = form.querySelector('input[name="decisions"]');
  const id = form.dataset.projectId;
  const revision = Number(form.dataset.worldRevision);
  if (!/^[0-9a-f-]{36}$/.test(id) || !Number.isSafeInteger(revision) || revision < 1) return;
  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    let parsed;
    try { parsed = JSON.parse(story.value); }
    catch { status.textContent = "Invalid story JSON. Correct your syntax before previewing."; return; }
    const selected = decisions.value.trim() ? decisions.value.split(",").map((s) => s.trim()) : [];
    if (selected.length > 32 || selected.some((s) => !/^[a-z][a-z0-9-]{0,39}$/.test(s))) {
      status.textContent = "Use up to 32 comma-separated choice IDs, with lowercase letters, numbers or hyphens.";
      return;
    }
    submit.disabled = true;
    output.textContent = "";
    status.textContent = "Validating your authored choices…";
    try {
      const response = await fetch("/api/creator-studio/projects/" + encodeURIComponent(id)
        + "/world-bible/interactive/preview", {
        method: "POST", credentials: "same-origin",
        headers: { "content-type": "application/json", "x-sonara-intent": "interactive-preview" },
        body: JSON.stringify({ expectedWorldRevision: revision, story: parsed, decisions: selected })
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        status.textContent = result.code === "world_bible_revision_conflict"
          ? "This World Bible changed in another tab. Copy your story draft and reload to reconcile."
          : "Preview refused: " + (result.code || "request_failed");
        if (result.detail) output.textContent = String(result.detail);
        return;
      }
      status.textContent = "Preview ready. Nothing was saved, rendered, compiled or published.";
      output.textContent = JSON.stringify({
        sourceSaved: result.sourceSaved, storyFingerprint: result.storyFingerprint,
        stats: result.stats, warnings: result.warnings, preview: result.preview
      }, null, 2);
    } catch {
      status.textContent = "Connection error. Copy your unsaved draft before leaving; no preview is confirmed.";
    } finally { submit.disabled = false; }
  });
})();
