"use strict";

(() => {
  const root = document.documentElement;
  const preferenceKey = "sonara:nexus:preferences:v2";

  function readPreferences() {
    try {
      const stored = JSON.parse(window.localStorage.getItem(preferenceKey) || "{}");
      return stored && typeof stored === "object" ? stored : {};
    } catch {
      return {};
    }
  }

  function writePreferences(preferences) {
    try { window.localStorage.setItem(preferenceKey, JSON.stringify(preferences)); } catch {}
  }

  function applyBrightness(value) {
    const brightness = Math.min(112, Math.max(92, Number(value) || 104));
    root?.style?.setProperty?.("--sonara-brightness", String(brightness / 100));
    document.querySelectorAll?.("[data-sonara-preference='brightness']")?.forEach?.((input) => { input.value = String(brightness); });
    document.querySelectorAll?.("[data-sonara-brightness-output]")?.forEach?.((output) => { output.textContent = `${brightness}%`; });
    return brightness;
  }

  function installBrightness() {
    const preferences = readPreferences();
    preferences.brightness = String(applyBrightness(preferences.brightness));
    writePreferences(preferences);
    document.querySelectorAll?.("[data-sonara-preference='brightness']")?.forEach?.((input) => {
      input.addEventListener?.("input", () => {
        const current = readPreferences();
        current.brightness = String(applyBrightness(input.value));
        writePreferences(current);
      });
    });
  }

  function installPasswordRecovery() {
    const tokenInput = document.querySelector?.("[data-sonara-recovery-token]");
    if (!tokenInput) return;
    const status = document.querySelector?.("[data-sonara-recovery-status]");
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const token = hash.get("access_token") || "";
    const type = hash.get("type") || "";
    if (token && (!type || type === "recovery")) {
      tokenInput.value = token;
      if (status) status.textContent = "Recovery link verified. Choose your new password.";
      window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);
      return;
    }
    if (status) status.textContent = "Open this page from the latest recovery email. Recovery links expire for your protection.";
  }

  function closeWorkspaceMenu() {
    document.addEventListener?.("click", (event) => {
      const menu = document.querySelector?.(".sonara-workspace-menu[open]");
      if (!menu || menu.contains(event.target)) return;
      menu.removeAttribute("open");
    });
  }

  function initializeCustomerReadyExperience() {
    installBrightness();
    installPasswordRecovery();
    closeWorkspaceMenu();
  }

  if (document.readyState === "loading") window.addEventListener?.("load", initializeCustomerReadyExperience, { once: true });
  else initializeCustomerReadyExperience();
})();
