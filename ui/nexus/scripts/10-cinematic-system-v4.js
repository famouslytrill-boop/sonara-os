"use strict";

(() => {
  const root = document.documentElement;

  function markCurrentNavigation() {
    const current = window.location.pathname.replace(/\/$/, "") || "/";
    document.querySelectorAll(".sonara-desktop-nav a, .sonara-mobile-menu nav a").forEach((link) => {
      const path = new window.URL(link.href, window.location.href).pathname.replace(/\/$/, "") || "/";
      const active = path === "/" ? current === "/" : current === path || current.startsWith(path + "/");
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  }

  function installInputMode() {
    window.addEventListener("keydown", (event) => {
      if (event.key === "Tab" || event.key.startsWith("Arrow")) root.dataset.nexusInput = "keyboard";
    }, { passive: true });
    window.addEventListener("pointerdown", (event) => {
      root.dataset.nexusInput = event.pointerType === "touch" ? "touch" : "pointer";
    }, { passive: true });
  }

  function installMenus() {
    document.querySelectorAll(".sonara-mobile-menu").forEach((menu) => {
      menu.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => menu.removeAttribute("open")));
    });
  }

  function installDialogFocus() {
    document.querySelectorAll("dialog.nexus-dialog").forEach((dialog) => {
      let trigger = null;
      document.querySelectorAll('[aria-controls="' + dialog.id + '"]').forEach((button) => {
        button.addEventListener("click", () => { trigger = button; });
      });
      dialog.addEventListener("close", () => trigger?.focus());
    });
  }

  function initialize() {
    root.dataset.nexusVersion = "cinematic-v4";
    markCurrentNavigation();
    installInputMode();
    installMenus();
    installDialogFocus();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true });
  else initialize();
})();
