"use strict";
(() => {
  const root = document.documentElement;
  let theme = "system";
  try {
    const preferences = JSON.parse(localStorage.getItem("sonara:nexus:preferences:v1") || "{}");
    const legacy = localStorage.getItem("sonara-appearance");
    theme = ["system", "light", "dark"].includes(preferences.theme) ? preferences.theme : (["light", "dark"].includes(legacy) ? legacy : "system");
  } catch {}
  let prefersDark = false;
  try { prefersDark = Boolean(matchMedia?.("(prefers-color-scheme: dark)")?.matches); } catch {}
  root.dataset.sonaraAppearance = theme;
  root.dataset.theme = theme === "system" ? (prefersDark ? "dark" : "light") : theme;
  if (!matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) root.classList.add("nexus-loading");
  setTimeout(() => root.classList.remove("nexus-loading"), 2400);
})();
