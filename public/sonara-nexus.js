"use strict";

(() => {
  const root = document.documentElement;
  const storage = {
    get(key, fallback) {
      try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, value); } catch {}
    }
  };

  const settings = {
    theme: storage.get("sonara-theme", "dark"),
    motion: storage.get("sonara-motion", "full"),
    sound: storage.get("sonara-sound", "off"),
    haptics: storage.get("sonara-haptics", "off"),
    language: storage.get("sonara-language", "en")
  };

  const labels = {
    en: {
      platform: "Platform", forge: "SONARA Forge", canvas: "SONARA Canvas", signal: "SONARA Signal",
      tools: "Free tools", pricing: "Pricing", support: "Support", login: "Log in", start: "Start Free",
      search: "Search SONARA", preferences: "Experience settings", close: "Close", theme: "Appearance",
      motion: "Motion", sound: "Interface sound", haptics: "Haptic feedback", language: "Language",
      dark: "Dark", light: "Light", system: "System", full: "Full", reduced: "Reduced", on: "On", off: "Off"
    },
    es: {
      platform: "Plataforma", forge: "SONARA Forge", canvas: "SONARA Canvas", signal: "SONARA Signal",
      tools: "Herramientas gratis", pricing: "Precios", support: "Soporte", login: "Iniciar sesión", start: "Comenzar gratis",
      search: "Buscar en SONARA", preferences: "Ajustes de experiencia", close: "Cerrar", theme: "Apariencia",
      motion: "Movimiento", sound: "Sonido de interfaz", haptics: "Respuesta háptica", language: "Idioma",
      dark: "Oscuro", light: "Claro", system: "Sistema", full: "Completo", reduced: "Reducido", on: "Activado", off: "Desactivado"
    }
  };

  const routes = [
    ["/start", "platform", "◈"], ["/business-builder", "forge", "⚡"], ["/creator-studio", "canvas", "✦"],
    ["/growth-studio", "signal", "⌁"], ["/free-tools", "tools", "⌘"], ["/pricing", "pricing", "$"],
    ["/support", "support", "?"], ["/login", "login", "→"], ["/signup", "start", "+"]
  ];

  function applyPreferences() {
    const resolvedTheme = settings.theme === "system"
      ? (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark")
      : settings.theme;
    root.dataset.theme = resolvedTheme;
    root.dataset.motion = settings.motion;
    root.lang = settings.language;
    translateNavigation();
  }

  function translateNavigation() {
    const copy = labels[settings.language] || labels.en;
    const map = new Map(routes.map(([path, key]) => [path, copy[key]]));
    document.querySelectorAll("header a[href]").forEach((link) => {
      const label = map.get(link.getAttribute("href"));
      if (label) {
        const img = link.querySelector("img");
        if (img) link.replaceChildren(img, document.createTextNode(` ${label}`));
        else link.textContent = label;
      }
    });
  }

  function audioCue(type = "tap") {
    if (settings.sound !== "on") return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = audioCue.ctx ||= new AudioContext();
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(.0001, now);
    gain.gain.exponentialRampToValueAtTime(type === "success" ? .055 : .035, now + .008);
    gain.gain.exponentialRampToValueAtTime(.0001, now + (type === "success" ? .22 : .09));
    gain.connect(ctx.destination);
    const tones = type === "success" ? [440, 660] : [type === "open" ? 330 : 260];
    tones.forEach((frequency, index) => {
      const osc = ctx.createOscillator();
      osc.type = index ? "sine" : "triangle";
      osc.frequency.setValueAtTime(frequency, now + index * .045);
      osc.connect(gain);
      osc.start(now + index * .045);
      osc.stop(now + .24);
    });
  }

  function haptic(pattern = 10) {
    if (settings.haptics === "on" && navigator.vibrate) navigator.vibrate(pattern);
  }

  function icon(name) {
    const icons = {
      command: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 6H7a3 3 0 1 0 3 3V7a3 3 0 1 0-3 3h10a3 3 0 1 0-3-3v10a3 3 0 1 0 3-3H7a3 3 0 1 0 3 3v-2"/></svg>',
      settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21H9.6v-.1A1.7 1.7 0 0 0 8.2 19.3a1.7 1.7 0 0 0-1.87.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 3.8 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H2V9.6h.1A1.7 1.7 0 0 0 3.7 8.2a1.7 1.7 0 0 0-.34-1.87l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 8 3.8a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V2h4v.1A1.7 1.7 0 0 0 14.8 3.7a1.7 1.7 0 0 0 1.87-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.2 8a1.7 1.7 0 0 0 .6 1 1.7 1.7 0 0 0 1.1.4h.1v4h-.1A1.7 1.7 0 0 0 19.4 15Z"/></svg>'
    };
    return icons[name] || "";
  }

  function installBoot() {
    const boot = document.createElement("div");
    boot.className = "sonara-boot";
    boot.innerHTML = '<div class="sonara-boot-core"><img class="sonara-boot-logo" src="/brand/sonara-industries-mark.svg" alt=""><div class="sonara-boot-track"></div><div class="sonara-boot-label">SONARA NEXUS</div></div>';
    document.body.prepend(boot);
    const done = () => requestAnimationFrame(() => boot.classList.add("is-ready"));
    if (document.readyState === "complete") setTimeout(done, 120); else addEventListener("load", () => setTimeout(done, 120), { once: true });
    setTimeout(done, 1400);
  }

  function installTransition() {
    const layer = document.createElement("div");
    layer.className = "sonara-route-transition";
    layer.innerHTML = '<div class="sonara-route-orbit" aria-label="Loading"></div>';
    document.body.append(layer);
    document.addEventListener("click", (event) => {
      const link = event.target.closest("a[href]");
      if (!link || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || link.target === "_blank") return;
      const url = new URL(link.href, location.href);
      if (url.origin !== location.origin || url.pathname === location.pathname && url.hash) return;
      audioCue("open"); haptic(12); layer.classList.add("is-active");
    });
  }

  function installPalette() {
    const palette = document.createElement("div");
    palette.className = "sonara-palette";
    palette.setAttribute("role", "dialog");
    palette.setAttribute("aria-modal", "true");
    palette.innerHTML = '<div class="sonara-dialog"><div class="sonara-dialog-head"><input id="sonara-command-search" autocomplete="off"><button type="button" data-close>×</button></div><div class="sonara-command-list"></div></div>';
    document.body.append(palette);
    const input = palette.querySelector("input");
    const list = palette.querySelector(".sonara-command-list");
    const render = (query = "") => {
      const copy = labels[settings.language] || labels.en;
      const filtered = routes.filter(([, key]) => copy[key].toLowerCase().includes(query.toLowerCase()));
      list.innerHTML = filtered.map(([path, key, glyph]) => `<a href="${path}"><span class="sonara-command-icon">${glyph}</span><strong>${copy[key]}</strong><span class="sonara-command-meta">${path}</span></a>`).join("");
    };
    const open = () => { render(); input.placeholder = (labels[settings.language] || labels.en).search; palette.classList.add("is-open"); setTimeout(() => input.focus(), 30); audioCue("open"); };
    const close = () => palette.classList.remove("is-open");
    input.addEventListener("input", () => render(input.value));
    palette.addEventListener("click", (event) => { if (event.target === palette || event.target.closest("[data-close]")) close(); });
    document.addEventListener("keydown", (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); palette.classList.contains("is-open") ? close() : open(); }
      if (event.key === "Escape") close();
    });
    return open;
  }

  function installPreferences() {
    const panel = document.createElement("div");
    panel.className = "sonara-preferences";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    const copy = labels[settings.language] || labels.en;
    panel.innerHTML = `<div class="sonara-dialog"><div class="sonara-dialog-head"><strong>${copy.preferences}</strong><button type="button" data-close>×</button></div><div class="sonara-settings-body">
      ${settingRow(copy.theme, "theme", [["dark",copy.dark],["light",copy.light],["system",copy.system]])}
      ${settingRow(copy.motion, "motion", [["full",copy.full],["reduced",copy.reduced]])}
      ${settingRow(copy.sound, "sound", [["off",copy.off],["on",copy.on]])}
      ${settingRow(copy.haptics, "haptics", [["off",copy.off],["on",copy.on]])}
      ${settingRow(copy.language, "language", [["en","English"],["es","Español"]])}
    </div></div>`;
    document.body.append(panel);
    panel.querySelectorAll("select[data-setting]").forEach((select) => {
      const key = select.dataset.setting;
      select.value = settings[key];
      select.addEventListener("change", () => {
        settings[key] = select.value; storage.set(`sonara-${key}`, select.value); applyPreferences(); audioCue("success"); haptic([8,25,8]); showToast("Saved");
        if (key === "language") setTimeout(() => location.reload(), 220);
      });
    });
    const open = () => { panel.classList.add("is-open"); audioCue("open"); };
    const close = () => panel.classList.remove("is-open");
    panel.addEventListener("click", (event) => { if (event.target === panel || event.target.closest("[data-close]")) close(); });
    document.addEventListener("keydown", (event) => { if (event.key === "Escape") close(); });
    return open;
  }

  function settingRow(label, key, options) {
    return `<label class="sonara-setting"><span><strong>${label}</strong><small>${key === "sound" || key === "haptics" ? "Optional and off by default" : "Saved on this device"}</small></span><select data-setting="${key}">${options.map(([value,text]) => `<option value="${value}">${text}</option>`).join("")}</select></label>`;
  }

  function showToast(message) {
    let toast = document.querySelector(".sonara-toast");
    if (!toast) { toast = document.createElement("div"); toast.className = "sonara-toast"; document.body.append(toast); }
    toast.textContent = message; toast.classList.add("is-visible"); clearTimeout(showToast.timer); showToast.timer = setTimeout(() => toast.classList.remove("is-visible"), 1300);
  }

  function installDock(openPalette, openPreferences) {
    const dock = document.createElement("div");
    dock.className = "sonara-utility-dock";
    dock.innerHTML = `<button type="button" aria-label="Command palette">${icon("command")}</button><button type="button" aria-label="Experience settings">${icon("settings")}</button>`;
    const [command, prefs] = dock.querySelectorAll("button");
    command.addEventListener("click", () => { haptic(8); openPalette(); });
    prefs.addEventListener("click", () => { haptic(8); openPreferences(); });
    document.body.append(dock);
  }

  function markCurrentRoute() {
    document.querySelectorAll("header a[href]").forEach((link) => {
      const path = new URL(link.href, location.href).pathname;
      const active = path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);
      if (active) link.setAttribute("aria-current", "page"); else link.removeAttribute("aria-current");
    });
  }

  function renameVisibleProducts() {
    const replacements = new Map([["Business Builder","SONARA Forge"],["Creator Studio","SONARA Canvas"],["Growth Studio","SONARA Signal"]]);
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) { return node.parentElement?.closest("script,style") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => replacements.forEach((next, old) => { if (node.nodeValue.includes(old)) node.nodeValue = node.nodeValue.replaceAll(old, next); }));
    replacements.forEach((next, old) => { if (document.title.includes(old)) document.title = document.title.replaceAll(old, next); });
  }

  applyPreferences();
  renameVisibleProducts();
  markCurrentRoute();
  installBoot();
  installTransition();
  const openPalette = installPalette();
  const openPreferences = installPreferences();
  installDock(openPalette, openPreferences);

  document.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button,.action,summary")) { audioCue("tap"); haptic(6); }
  }, { passive: true });
})();
