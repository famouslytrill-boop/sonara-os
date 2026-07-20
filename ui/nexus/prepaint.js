"use strict";

(() => {
  const browser = globalThis.window || globalThis;
  const root = globalThis.document.documentElement;
  let theme = "system";

  try {
    const preferences = JSON.parse(browser.localStorage.getItem("sonara:nexus:preferences:v1") || "{}");
    const legacy = browser.localStorage.getItem("sonara-appearance");
    theme = ["system", "light", "dark"].includes(preferences.theme)
      ? preferences.theme
      : (["light", "dark"].includes(legacy) ? legacy : "system");
  } catch {}

  let prefersDark = false;
  try {
    prefersDark = Boolean(browser.matchMedia?.("(prefers-color-scheme: dark)")?.matches);
  } catch {}

  root.dataset.sonaraAppearance = theme;
  root.dataset.theme = theme === "system" ? (prefersDark ? "dark" : "light") : theme;
  if (!browser.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) root.classList.add("nexus-loading");
  browser.setTimeout(() => root.classList.remove("nexus-loading"), 2400);
})();
