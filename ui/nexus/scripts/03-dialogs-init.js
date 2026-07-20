      index
    }));

    if (commandList) {
      commandList.innerHTML = commandItems.map((item) => `<li><a href="${escapeMarkup(item.href)}" data-command-label="${escapeMarkup(item.label.toLowerCase())}"><span>${escapeMarkup(item.label)}</span><small>↵</small></a></li>`).join("");
    }

    document.querySelectorAll("[data-nexus-command]").forEach((button) => button.addEventListener("click", () => {
      openDialog(commandDialog);
      setTimeout(() => commandInput?.focus(), 40);
    }));
    document.querySelectorAll("[data-nexus-settings]").forEach((button) => button.addEventListener("click", () => openDialog(settingsDialog)));
    document.querySelectorAll("[data-dialog-close]").forEach((button) => button.addEventListener("click", () => closeDialog(button.closest("dialog"))));
    document.querySelectorAll("dialog").forEach((dialog) => {
      dialog.addEventListener("close", () => document.body.classList.remove("nexus-no-scroll"));
      dialog.addEventListener("click", (event) => {
        if (event.target === dialog) closeDialog(dialog);
      });
    });

    commandInput?.addEventListener("input", () => {
      const query = commandInput.value.trim().toLowerCase();
      commandList?.querySelectorAll("a").forEach((link) => {
        const match = !query || link.dataset.commandLabel?.includes(query);
        link.closest("li").hidden = !match;
      });
    });

    document.addEventListener("keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openDialog(commandDialog);
        setTimeout(() => commandInput?.focus(), 40);
      }
      if (event.key === "Escape") document.querySelectorAll("dialog[open]").forEach(closeDialog);
    });
  }

  function syncSettingsControls() {
    const controls = document.querySelectorAll("[data-nexus-preference]");
    controls.forEach((control) => {
      const key = control.dataset.nexusPreference;
      if (!key) return;
      if (control instanceof HTMLInputElement && control.type === "checkbox") control.checked = preferences[key] === "on";
      else control.value = preferences[key];
    });
  }

  function prepareSettings() {
    document.querySelectorAll("[data-nexus-preference]").forEach((control) => {
      control.addEventListener("change", () => {
        const key = control.dataset.nexusPreference;
        if (!key) return;
        preferences[key] = control instanceof HTMLInputElement && control.type === "checkbox" ? (control.checked ? "on" : "off") : control.value;
        savePreferences();
        applyPreferences();
        announce(`${key} updated`);
      });
    });
    window.matchMedia?.("(prefers-color-scheme: dark)")?.addEventListener?.("change", () => {
      if (preferences.theme === "system") applyPreferences();
    });
  }

  function announce(message) {
    const region = document.querySelector("#nexus-live");
    if (!region) return;
    region.textContent = "";
    requestAnimationFrame(() => { region.textContent = message; });
  }

  function escapeMarkup(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
  }

  function finishLoading() {
    const loader = document.querySelector("#nexus-loader");
    requestAnimationFrame(() => requestAnimationFrame(() => {
      root.classList.add("nexus-ready");
      loader?.setAttribute("aria-hidden", "true");
      setTimeout(() => { if (loader) loader.hidden = true; }, reducedMotion ? 0 : 320);
    }));
  }

  function initialize() {
    root.classList.add("nexus-js");
    applyPreferences();
    replaceLegacyVisibleNames();
    buildHeroVisual();
    prepareNavigation();
    prepareRevealMotion();
    prepareParallax();
    prepareRouteTransitions();
    prepareDialogs();
    prepareSettings();
    prepareTactileFeedback();
    finishLoading();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true });
  else initialize();
})();
