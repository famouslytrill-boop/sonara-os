// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
(function () {
  "use strict";
  const root = document.querySelector("[data-project-draft]");
  if (!root) return;
  const core = globalThis.SonaraCreatorGraph;
  const status = root.querySelector("[data-draft-status]");
  const entries = root.querySelector("[data-draft-entries]");
  const download = root.querySelector("[data-draft-download]");
  let snapshot, store, deviceRevision = 0, change = 0, busy = false, url;
  try {
    snapshot = core.validateSnapshot(JSON.parse(root.dataset.snapshot), root.dataset.projectId);
    store = globalThis.SonaraCreatorDeviceStore.createDeviceProjectStore({ scope: root.dataset.deviceScope, projectId: snapshot.projectId });
  } catch (error) { status.textContent = error.message; root.querySelectorAll("button,input,textarea").forEach((el) => { el.disabled = true; }); return; }
  const say = (message) => { status.textContent = message; };
  function renewDownload() {
    if (url) URL.revokeObjectURL(url);
    url = URL.createObjectURL(new Blob([JSON.stringify(snapshot, null, 2) + "\n"], { type: "application/json" }));
    download.href = url; download.download = `project-${snapshot.projectId}-draft.json`; download.hidden = false;
  }
  function field(form, name, label, value, type = "number") {
    const wrapper = document.createElement("label"); wrapper.textContent = label;
    const input = document.createElement(type === "textarea" ? "textarea" : "input");
    input.name = name; input.value = value;
    if (type === "textarea") input.maxLength = 2000;
    else { input.type = type; input.min = name === "endMs" || name === "outMs" || name === "durationMs" ? "1" : "0"; input.max = "86400000"; input.step = "1"; }
    input.required = true; wrapper.append(input); form.append(wrapper);
  }
  function button(form, name, label) {
    const el = document.createElement("button"); el.type = "submit"; el.textContent = label; el.name = "draftAction"; el.value = name; el.formNoValidate = name === "remove"; form.append(el);
  }
  function render() {
    root.querySelector("[data-draft-revision]").textContent = `Draft based on workspace revision ${snapshot.revision}. ${snapshot.graph.nodes.length} entries.`;
    entries.replaceChildren();
    for (const node of snapshot.graph.nodes) {
      const form = document.createElement("form"); form.dataset.draftNode = node.id; form.dataset.draftKind = node.kind;
      const heading = document.createElement("h3"); heading.textContent = node.kind === "source" ? `Source · ${node.assetId}` : node.kind === "caption" ? "Draft caption" : "Draft clip"; form.append(heading);
      if (node.kind === "source") field(form, "durationMs", "Source duration (ms)", node.durationMs);
      else {
        field(form, "startMs", "Timeline start (ms)", node.startMs);
        if (node.kind === "caption") { field(form, "endMs", "Caption end (ms)", node.endMs); field(form, "text", "Draft caption text", node.text, "textarea"); }
        else {
          field(form, "inMs", "Source in (ms)", node.inMs); field(form, "outMs", "Source out (ms)", node.outMs);
          const wrapper = document.createElement("label"); wrapper.textContent = "Clip sound";
          const select = document.createElement("select"); select.name = "muted";
          for (const [value, label] of [["false", "Sound on"], ["true", "Muted"]]) { const option = document.createElement("option"); option.value = value; option.textContent = label; select.append(option); }
          select.value = String(node.muted); wrapper.append(select); form.append(wrapper);
        }
      }
      button(form, "update", "Apply to local draft"); button(form, "remove", "Remove from local draft"); entries.append(form);
    }
    renewDownload();
  }
  function edit(command) {
    snapshot = { ...snapshot, graph: core.applyCommand(snapshot.graph, command, globalThis.crypto.randomUUID()) };
    change++; render(); say("Local draft updated. Save on this device or download it; the workspace has not changed.");
  }
  entries.addEventListener("submit", (event) => {
    event.preventDefault(); const form = event.target;
    try {
      const command = Object.fromEntries(new FormData(form));
      edit({ ...command, nodeId: form.dataset.draftNode, action: event.submitter?.value === "remove" ? "remove" : `update_${form.dataset.draftKind}` });
    } catch (error) { say(error.message); }
  });
  root.querySelector("[data-draft-caption]").addEventListener("submit", (event) => {
    event.preventDefault();
    try { edit({ ...Object.fromEntries(new FormData(event.target)), action: "add_caption" }); event.target.reset(); }
    catch (error) { say(error.message); }
  });
  const importFile = root.querySelector("[data-draft-import]");
  importFile.addEventListener("change", async () => {
    const file = importFile.files[0], before = change;
    if (!file) return;
    try {
      if (file.size > core.MAX_SNAPSHOT_BYTES) throw new Error("Choose a project JSON up to 2 MB.");
      const imported = core.validateSnapshot(JSON.parse(await file.text()), snapshot.projectId);
      if (before !== change) throw new Error("Your draft changed while the file opened. Choose the file again.");
      snapshot = imported; change++; render(); say("JSON opened as a local draft. No upload or workspace change occurred.");
    } catch (error) { say(error.message); }
    importFile.value = "";
  });
  root.addEventListener("click", async (event) => {
    const action = event.target.closest("button[data-draft-action]")?.dataset.draftAction;
    if (!action || busy) return;
    busy = true;
    const controls = root.querySelectorAll("button[data-draft-action]"); controls.forEach((control) => { control.disabled = true; });
    say(action === "sync" ? "Saving to the workspace…" : "Opening device storage…");
    const before = change;
    const submitted = core.validateSnapshot(snapshot, snapshot.projectId);
    try {
      if (action === "save") {
        const saved = await store.save(submitted, deviceRevision); deviceRevision = saved.deviceRevision;
        say(before === change ? "Draft saved on this device. The workspace has not changed." : "The earlier draft was saved. Save again to keep your latest edits.");
      } else if (action === "open") {
        const saved = await store.read();
        if (!saved) throw new Error("No draft is saved for this account, workspace and project.");
        if (before !== change) throw new Error("Your draft changed while storage opened. Try again.");
        snapshot = saved.snapshot; deviceRevision = saved.deviceRevision; change++; render(); say("Device draft opened. Its original workspace revision is preserved.");
      } else if (action === "forget") {
        await store.forget(deviceRevision); deviceRevision = 0; say("Saved copy forgotten for this project. Your open draft is still available to download.");
      } else if (action === "sync") {
        const response = await fetch(`/api/creator-studio/projects/${snapshot.projectId}/commands`, {
          method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ action: "restore_snapshot", revision: submitted.revision, deviceScope: root.dataset.deviceScope, snapshot: submitted })
        });
        const result = await response.json().catch(() => null);
        if (!response.ok || !result?.ok) throw new Error(`${result?.message || "The workspace save could not be confirmed."} Your local draft is kept.`);
        const confirmed = core.validateSnapshot({ ...result.project, version: 1, projectId: result.project.id }, submitted.projectId);
        if (confirmed.revision !== submitted.revision + 1 || JSON.stringify(confirmed.graph) !== JSON.stringify(submitted.graph)) throw new Error("The returned workspace revision did not match your save. Your local draft is kept; reload before trying again.");
        if (before !== change) { say("The earlier draft reached the workspace. Later edits remain local; download them before reloading."); return; }
        snapshot = confirmed; change++; render();
        // Never silently write/erase persistent drafts. The explicit device-save
        // control keeps storage opt-in and prevents deleting a newer tab's work.
        say("Draft saved to the workspace. Save on this device to update its saved copy; reload to refresh the workspace editor and audio renderer.");
      }
    } catch (error) { say(error.message || "The operation could not finish. Your local draft is kept."); }
    finally { busy = false; controls.forEach((control) => { control.disabled = false; }); }
  });
  window.addEventListener("pagehide", () => { if (url) URL.revokeObjectURL(url); void store.close(); });
  window.addEventListener("offline", () => say("Disconnected. Local editing, device saves and draft downloads still work in this open page."));
  window.addEventListener("online", () => say("Connection available. Save to the workspace when you are ready; nothing syncs automatically."));
  render();
})();
