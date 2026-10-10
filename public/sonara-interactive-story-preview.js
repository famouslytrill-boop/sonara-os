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
  const saveButton = form.querySelector("[data-story-save]");
  const loadButton = form.querySelector("[data-story-load]");
  let storyRevision = 0;
  let storedWorldChanged = false;
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
  const base = "/api/creator-studio/projects/" + encodeURIComponent(id)
    + "/world-bible/interactive";
  if (loadButton && saveButton) {
    loadButton.addEventListener("click", async function () {
      if (!window.confirm("Loading the saved draft will replace the text in this editor. Copy any unsaved changes before continuing. Load now?")) return;
      loadButton.disabled = true;
      status.textContent = "Reading your private saved revision…";
      try {
        const response = await fetch(base + "/draft", {
          credentials: "same-origin", headers: { "accept": "application/json" }
        });
        const result = await response.json();
        if (!response.ok || !result.ok) {
          status.textContent = "Could not load: " + (result.code || "request_failed");
          return;
        }
        if (!result.storyDraft) {
          storyRevision = 0;
          storedWorldChanged = false;
          status.textContent = "No saved draft exists. This editor still contains its initial template.";
          return;
        }
        story.value = JSON.stringify(result.storyDraft.draft, null, 2);
        storyRevision = result.storyDraft.revision;
        storedWorldChanged = !!result.storyDraft.worldChanged;
        output.textContent = "";
        status.textContent = storedWorldChanged
          ? "Recovered revision " + storyRevision + " from an older World Bible. Copy your work and reconcile the changed characters/scenes before a new save."
          : "Loaded private revision " + storyRevision + ". Edits remain unsaved until you select Save.";
      } catch {
        status.textContent = "Could not load saved story. Your existing text is preserved.";
      } finally { loadButton.disabled = false; }
    });
    saveButton.addEventListener("click", async function () {
      if (storedWorldChanged) {
        status.textContent = "This saved story references an older World Bible. Copy the draft and reconcile changed scenes or characters before saving; automatic rebasing is not supported.";
        return;
      }
      let draft;
      try { draft = JSON.parse(story.value); }
      catch { status.textContent = "Fix invalid JSON before saving."; return; }
      if (!window.confirm("Save a new private story revision? This does not publish, render or compile media.")) return;
      saveButton.disabled = true;
      status.textContent = "Saving your private story revision…";
      try {
        const response = await fetch(base + "/draft", {
          method: "POST", credentials: "same-origin",
          headers: { "content-type": "application/json", "x-sonara-intent": "story-save" },
          body: JSON.stringify({ expectedRevision: storyRevision,
            expectedWorldRevision: revision, story: draft })
        });
        const result = await response.json();
        if (!response.ok || !result.ok) {
          status.textContent = response.status === 409
            ? "Revision conflict or World Bible changed. Copy your text before loading the newest version. No overwrite was confirmed."
            : "Save refused: " + (result.code || "request_failed");
          return;
        }
        storyRevision = result.storyDraft.revision;
        status.textContent = "Saved private story revision " + storyRevision +
          ". No media rendered or published.";
      } catch {
        status.textContent = "Connection interrupted. Save not confirmed; copy your draft before leaving.";
      } finally { saveButton.disabled = false; }
    });
  }

})();
