// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";
const TOOLS = Object.freeze([
  { key: "data-formatter", title: "Data formatter", description: "Validate and format your own JSON for a portable record.", fields: [{ name: "text", label: "Your JSON", type: "textarea" }] },
  { key: "text-fingerprint", title: "Text fingerprint", description: "Compute a SHA-256 fingerprint to compare two versions of your text.", fields: [{ name: "text", label: "Your text", type: "textarea" }] },
  { key: "storage-budget", title: "Storage budget", description: "Calculate how much storage your files and backups need.", fields: [{ name: "files", label: "Number of files", type: "number" }, { name: "sizeMiB", label: "Average file size (MiB)", type: "number" }, { name: "copies", label: "Total copies, including backups", type: "number" }] }
]);
module.exports = function registerParentToolRoutes(app, { layout, brandCard, linkAction, escapeHtml }) {
  app.locals.sonaraParentTools = TOOLS.map((tool) => ({ ...tool, path: `/tools/${tool.key}` }));
  app.get("/tools", (_req, res) => res.type("html").send(layout({ title: "SONARA free tools", eyebrow: "SONARA One", heading: "Three tools for your everyday work",
    body: "Open a tool, get the result, and download it. No signup. Processing stays on your device.", surface: "marketing",
    sections: TOOLS.map((tool) => `<section class="card"><h2>${tool.title}</h2><p>${tool.description}</p><a href="/tools/${tool.key}">Open ${tool.title.toLowerCase()}</a></section>`), actions: [linkAction("/free-tools", "All free tools")] })));
  for (const tool of TOOLS) app.get(`/tools/${tool.key}`, (_req, res) => res.type("html").send(layout({
    title: tool.title, eyebrow: "SONARA One · Free", heading: tool.title, body: `${tool.description} Your input is processed locally and is not uploaded or saved.`,
    sections: [brandCard("Your device, your result", "No account or connected provider is needed. Keep a copy by downloading the result."),
      `<section class="card"><form data-parent-tool="${tool.key}">${tool.fields.map((field) => `<label>${escapeHtml(field.label)}${field.type === "textarea" ? `<textarea name="${field.name}" maxlength="100000" rows="8" required></textarea>` : `<input name="${field.name}" type="number" min="0" max="1000000000" step="any" required>`}</label>`).join("")}<button type="submit">Calculate result</button></form><p role="status" data-tool-status></p><pre data-tool-result></pre><a data-tool-download hidden download="${tool.key}.json">Download result</a><noscript>Enable JavaScript to process this input on your device.</noscript></section><script src="/sonara-parent-tools.js" defer></script>`],
    actions: [linkAction("/tools", "SONARA tools"), linkAction("/free-tools", "All free tools")]
  })));
};
