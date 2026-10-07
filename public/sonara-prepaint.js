// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

(() => {
  const browser = globalThis.window || globalThis;
  const root = globalThis.document.documentElement;

  // Install before the first render. A skipped native document transition
  // rejects ready while normal navigation still completes. Handle only the
  // browser's expected animation cancellations, never unrelated page errors.
  for (const type of ["pageswap", "pagereveal"]) {
    browser.addEventListener?.(type, (event) => {
      event.viewTransition?.ready?.catch((error) => {
        if (["AbortError", "InvalidStateError", "TimeoutError"].includes(error?.name)) return;
        throw error;
      });
    });
  }
  let theme = "system";
  let language = "en-US";

  try {
    // Match the runtime's canonical store and v1 migration precedence before
    // styles load. Corrupt storage falls back to runtime defaults.
    const current = JSON.parse(browser.localStorage.getItem("sonara:nexus:preferences:v2") || "null");
    const preferences = current && typeof current === "object"
      ? current
      : JSON.parse(browser.localStorage.getItem("sonara:nexus:preferences:v1") || "null");
    if (preferences && typeof preferences === "object") {
      theme = ["system", "light", "dark"].includes(preferences.theme) ? preferences.theme : "system";
      const aliases = { en: "en-US", "en-US": "en-US", es: "es", fr: "fr", de: "de", pt: "pt-BR", "pt-BR": "pt-BR" };
      language = Object.prototype.hasOwnProperty.call(aliases, preferences.language) ? aliases[preferences.language] : "en-US";
    } else {
      // Retain the older appearance-only compatibility contract.
      const legacy = browser.localStorage.getItem("sonara-appearance");
      theme = ["light", "dark"].includes(legacy) ? legacy : "system";
    }
  } catch {}
  root.lang = language;

  let prefersDark = false;
  try {
    prefersDark = Boolean(browser.matchMedia?.("(prefers-color-scheme: dark)")?.matches);
  } catch {}

  root.dataset.sonaraAppearance = theme;
  root.dataset.theme = theme === "system" ? (prefersDark ? "dark" : "light") : theme;
  if (!browser.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) root.classList.add("sonara-loading");
  browser.setTimeout(() => root.classList.remove("sonara-loading"), 2400);
})();
