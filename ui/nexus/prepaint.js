"use strict";

(() => {
  const browser = globalThis.window || globalThis;
  const documentRoot = globalThis.document?.documentElement;
  if (!documentRoot) return;

  let theme = "system";
  for (const key of ["sonara:nexus:preferences:v3", "sonara:nexus:preferences:v2", "sonara:nexus:preferences:v1"]) {
    try {
      const preferences = JSON.parse(browser.localStorage?.getItem(key) || "null");
      if (preferences && ["system", "light", "dark"].includes(preferences.theme)) {
        theme = preferences.theme;
        break;
      }
    } catch {}
  }

  if (theme === "system") {
    try {
      const legacy = browser.localStorage?.getItem("sonara-appearance");
      if (["light", "dark"].includes(legacy)) theme = legacy;
    } catch {}
  }

  let prefersDark = false;
  try { prefersDark = Boolean(browser.matchMedia?.("(prefers-color-scheme: dark)")?.matches); } catch {}

  documentRoot.dataset.sonaraAppearance = theme;
  documentRoot.dataset.theme = theme === "system" ? (prefersDark ? "dark" : "light") : theme;

  const reducedMotion = Boolean(browser.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
  if (!reducedMotion) documentRoot.classList.add("nexus-loading");
  browser.setTimeout?.(() => documentRoot.classList.remove("nexus-loading"), reducedMotion ? 0 : 1200);
})();
