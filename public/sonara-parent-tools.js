// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";
(() => {
  const form = document.querySelector("[data-parent-tool]");
  if (!form) return;
  const status = document.querySelector("[data-tool-status]");
  const output = document.querySelector("[data-tool-result]");
  const download = document.querySelector("[data-tool-download]");
  let url;
  let generation = 0;
  const clear = () => { generation += 1; output.textContent = ""; download.hidden = true; download.removeAttribute("href"); if (url) URL.revokeObjectURL(url); url = null; };
  form.addEventListener("input", () => { clear(); status.textContent = "Input changed. Calculate again for an updated result."; });
  form.addEventListener("submit", async (event) => {
    event.preventDefault(); clear();
    const run = generation;
    try {
      const values = Object.fromEntries(new FormData(form));
      let result;
      if (form.dataset.parentTool === "data-formatter") {
        if (!values.text || values.text.length > 100000) throw new Error("Enter JSON up to 100,000 characters.");
        const parsed = JSON.parse(values.text, (_key, value) => {
          if (typeof value === "number" && (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER)) throw new Error("A number is too large to preserve accurately. Store it as quoted text.");
          return value;
        });
        result = { formatted: JSON.stringify(parsed, null, 2) };
      } else if (form.dataset.parentTool === "text-fingerprint") {
        if (!values.text || values.text.length > 100000) throw new Error("Enter text up to 100,000 characters.");
        if (!window.crypto.subtle) throw new Error("This browser needs a secure connection for text fingerprints.");
        const bytes = new TextEncoder().encode(values.text);
        const digest = await window.crypto.subtle.digest("SHA-256", bytes);
        result = { algorithm: "SHA-256", bytes: bytes.length, sha256: [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("") };
      } else {
        const { files, sizeMiB, copies } = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, Number(value)]));
        if (![files, sizeMiB, copies].every((value) => Number.isFinite(value) && value >= 0 && value <= 1e9) || !Number.isInteger(files) || !Number.isInteger(copies) || copies < 1) throw new Error("Use whole file counts, at least one copy, and nonnegative file sizes.");
        const totalBytes = files * sizeMiB * 1048576 * copies;
        if (!Number.isSafeInteger(Math.ceil(totalBytes))) throw new Error("This estimate is too large to calculate precisely.");
        result = { files, sizeMiB, copies, totalBytes: Math.ceil(totalBytes), totalGiB: totalBytes / 1073741824, estimate: true };
      }
      if (run !== generation) return;
      const json = JSON.stringify(result, null, 2);
      output.textContent = json;
      url = URL.createObjectURL(new Blob([json + "\n"], { type: "application/json" }));
      download.href = url; download.hidden = false; status.textContent = "Result ready. Download it to keep a copy.";
    } catch (error) { if (run === generation) status.textContent = error.message; }
  });
  window.addEventListener("pagehide", clear);
})();
