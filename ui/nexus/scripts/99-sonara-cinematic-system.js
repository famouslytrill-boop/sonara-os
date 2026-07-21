"use strict";

(() => {
  const root = document.documentElement;
  const preferenceKey = "sonara:nexus:preferences:v3";
  const legacyKeys = ["sonara:nexus:preferences:v2", "sonara:nexus:preferences:v1"];
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
  const defaults = Object.freeze({
    language: "en",
    theme: "system",
    motion: reducedMotion ? "off" : "on",
    sound: "off",
    haptics: "off"
  });

  const dictionaries = {
    en: {
      platform: "Nexus", businessBuilder: "Business Builder", creatorStudio: "Creator Studio", growthStudio: "Growth Studio",
      tools: "Free tools", pricing: "Pricing", support: "Support", login: "Log in", start: "Create account",
      dashboard: "Dashboard", settings: "Settings", admin: "Administration", logout: "Log out", menu: "Menu",
      command: "Command", experience: "Experience", heroEyebrow: "Connected operating infrastructure",
      heroHeading: "Build, create, and grow—without losing control.",
      heroBody: "Business Builder, Creator Studio, and Growth Studio share one secure operating layer for independent founders, creators, operators, and small teams.",
      productsKicker: "Three connected companies", productsHeading: "One system. Three focused ways to move.",
      productsBody: "Each company keeps its own workflows and records while identity, access, billing, support, and delivery remain connected through SONARA Nexus.",
      flowKicker: "Designed for real operations", flowHeading: "Move from intention to evidence-backed action.",
      ctaKicker: "Start with useful work", ctaHeading: "Begin free. Add depth when the work demands it.",
      searchPlaceholder: "Search companies, pages, and actions", settingsTitle: "Experience settings", language: "Language",
      languageHelp: "Updates the core interface language.", appearance: "Appearance", appearanceHelp: "Follow your device or choose light or dark.",
      motion: "Motion", sound: "Sound feedback", haptics: "Tactile feedback"
    },
    es: {
      platform: "Nexus", businessBuilder: "Business Builder", creatorStudio: "Creator Studio", growthStudio: "Growth Studio",
      tools: "Herramientas gratis", pricing: "Precios", support: "Soporte", login: "Iniciar sesión", start: "Crear cuenta",
      dashboard: "Panel", settings: "Ajustes", admin: "Administración", logout: "Cerrar sesión", menu: "Menú",
      command: "Comandos", experience: "Experiencia", heroEyebrow: "Infraestructura operativa conectada",
      heroHeading: "Construye, crea y crece sin perder el control.",
      heroBody: "Business Builder, Creator Studio y Growth Studio comparten una capa operativa segura para fundadores, creadores, operadores y equipos pequeños.",
      productsKicker: "Tres empresas conectadas", productsHeading: "Un sistema. Tres formas enfocadas de avanzar.",
      productsBody: "Cada empresa conserva sus flujos y registros mientras identidad, acceso, facturación, soporte y entrega permanecen conectados.",
      flowKicker: "Diseñado para operaciones reales", flowHeading: "Pasa de la intención a una acción respaldada por evidencia.",
      ctaKicker: "Empieza con trabajo útil", ctaHeading: "Comienza gratis. Añade profundidad cuando el trabajo lo exija.",
      searchPlaceholder: "Buscar empresas, páginas y acciones", settingsTitle: "Ajustes de experiencia", language: "Idioma",
      languageHelp: "Actualiza el idioma principal de la interfaz.", appearance: "Apariencia", appearanceHelp: "Sigue tu dispositivo o elige claro u oscuro.",
      motion: "Movimiento", sound: "Sonido", haptics: "Respuesta táctil"
    },
    fr: {
      platform: "Nexus", businessBuilder: "Business Builder", creatorStudio: "Creator Studio", growthStudio: "Growth Studio",
      tools: "Outils gratuits", pricing: "Tarifs", support: "Assistance", login: "Connexion", start: "Créer un compte",
      dashboard: "Tableau de bord", settings: "Réglages", admin: "Administration", logout: "Déconnexion", menu: "Menu",
      command: "Commande", experience: "Expérience", heroEyebrow: "Infrastructure opérationnelle connectée",
      heroHeading: "Construisez, créez et développez sans perdre le contrôle.",
      heroBody: "Business Builder, Creator Studio et Growth Studio partagent une couche opérationnelle sécurisée pour les fondateurs, créateurs, opérateurs et petites équipes.",
      productsKicker: "Trois entreprises connectées", productsHeading: "Un système. Trois façons ciblées d’avancer.",
      productsBody: "Chaque entreprise conserve ses flux et ses données tandis que l’identité, l’accès, la facturation, l’assistance et la livraison restent connectés.",
      flowKicker: "Conçu pour les opérations réelles", flowHeading: "Passez de l’intention à l’action fondée sur des preuves.",
      ctaKicker: "Commencez par un travail utile", ctaHeading: "Commencez gratuitement. Ajoutez de la profondeur au bon moment.",
      searchPlaceholder: "Rechercher des entreprises, pages et actions", settingsTitle: "Réglages de l’expérience", language: "Langue",
      languageHelp: "Met à jour la langue principale de l’interface.", appearance: "Apparence", appearanceHelp: "Suivez l’appareil ou choisissez clair ou sombre.",
      motion: "Animation", sound: "Retour sonore", haptics: "Retour tactile"
    },
    de: {
      platform: "Nexus", businessBuilder: "Business Builder", creatorStudio: "Creator Studio", growthStudio: "Growth Studio",
      tools: "Kostenlose Tools", pricing: "Preise", support: "Support", login: "Anmelden", start: "Konto erstellen",
      dashboard: "Übersicht", settings: "Einstellungen", admin: "Administration", logout: "Abmelden", menu: "Menü",
      command: "Befehl", experience: "Erlebnis", heroEyebrow: "Vernetzte Betriebsinfrastruktur",
      heroHeading: "Bauen, gestalten und wachsen—ohne die Kontrolle zu verlieren.",
      heroBody: "Business Builder, Creator Studio und Growth Studio teilen eine sichere Betriebsebene für Gründer, Kreative, Betreiber und kleine Teams.",
      productsKicker: "Drei verbundene Unternehmen", productsHeading: "Ein System. Drei fokussierte Wege nach vorn.",
      productsBody: "Jedes Unternehmen behält seine Abläufe und Daten, während Identität, Zugriff, Abrechnung, Support und Lieferung verbunden bleiben.",
      flowKicker: "Für echte Abläufe entwickelt", flowHeading: "Von der Absicht zur nachweisbaren Handlung.",
      ctaKicker: "Mit sinnvoller Arbeit beginnen", ctaHeading: "Kostenlos starten. Tiefe hinzufügen, wenn sie gebraucht wird.",
      searchPlaceholder: "Unternehmen, Seiten und Aktionen durchsuchen", settingsTitle: "Erlebniseinstellungen", language: "Sprache",
      languageHelp: "Aktualisiert die zentrale Oberflächensprache.", appearance: "Darstellung", appearanceHelp: "Gerät verwenden oder Hell/Dunkel wählen.",
      motion: "Bewegung", sound: "Klangfeedback", haptics: "Haptisches Feedback"
    },
    pt: {
      platform: "Nexus", businessBuilder: "Business Builder", creatorStudio: "Creator Studio", growthStudio: "Growth Studio",
      tools: "Ferramentas grátis", pricing: "Preços", support: "Suporte", login: "Entrar", start: "Criar conta",
      dashboard: "Painel", settings: "Configurações", admin: "Administração", logout: "Sair", menu: "Menu",
      command: "Comando", experience: "Experiência", heroEyebrow: "Infraestrutura operacional conectada",
      heroHeading: "Construa, crie e cresça sem perder o controle.",
      heroBody: "Business Builder, Creator Studio e Growth Studio compartilham uma camada operacional segura para fundadores, criadores, operadores e pequenas equipes.",
      productsKicker: "Três empresas conectadas", productsHeading: "Um sistema. Três maneiras focadas de avançar.",
      productsBody: "Cada empresa mantém seus fluxos e registros enquanto identidade, acesso, cobrança, suporte e entrega permanecem conectados.",
      flowKicker: "Criado para operações reais", flowHeading: "Passe da intenção para uma ação baseada em evidências.",
      ctaKicker: "Comece com trabalho útil", ctaHeading: "Comece grátis. Adicione profundidade quando o trabalho exigir.",
      searchPlaceholder: "Pesquisar empresas, páginas e ações", settingsTitle: "Configurações de experiência", language: "Idioma",
      languageHelp: "Atualiza o idioma principal da interface.", appearance: "Aparência", appearanceHelp: "Siga o dispositivo ou escolha claro ou escuro.",
      motion: "Movimento", sound: "Som", haptics: "Resposta tátil"
    }
  };

  function readPreferences() {
    const keys = [preferenceKey, ...legacyKeys];
    for (const key of keys) {
      try {
        const value = JSON.parse(window.localStorage.getItem(key) || "null");
        if (value && typeof value === "object") {
          return {
            ...defaults,
            ...value,
            sound: value.sound === "on" ? "on" : "off",
            haptics: value.haptics === "on" ? "on" : "off"
          };
        }
      } catch {}
    }
    return { ...defaults };
  }

  let preferences = readPreferences();
  let audioContext;
  let lastFocusedElement;

  function resolveTheme(value) {
    if (value === "light" || value === "dark") return value;
    return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
  }

  function dictionary() {
    return dictionaries[preferences.language] || dictionaries.en;
  }

  function translate() {
    const active = dictionary();
    root.lang = preferences.language;
    document.querySelectorAll("[data-i18n]").forEach((element) => {
      const value = active[element.dataset.i18n];
      if (!value) return;
      if (element.tagName === "INPUT" && element.type === "search") element.placeholder = value;
      else element.textContent = value;
    });
  }

  function applyPreferences() {
    root.dataset.theme = resolveTheme(preferences.theme);
    root.dataset.nexusMotion = preferences.motion;
    root.dataset.nexusSound = preferences.sound;
    root.dataset.nexusHaptics = preferences.haptics;
    translate();
    document.querySelectorAll("[data-nexus-preference]").forEach((element) => {
      const name = element.dataset.nexusPreference;
      if (element.type === "checkbox") element.checked = preferences[name] === "on";
      else element.value = preferences[name];
    });
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) themeMeta.setAttribute("content", root.dataset.theme === "dark" ? "#080b12" : "#f7f8fb");
  }

  function savePreferences() {
    try { window.localStorage.setItem(preferenceKey, JSON.stringify(preferences)); } catch {}
  }

  function installHeroScene() {
    if (!document.body.classList.contains("sonara-home-v3")) return;
    const hero = document.querySelector(".hero");
    if (!hero || hero.querySelector(".nexus-hero-scene")) return;
    hero.insertAdjacentHTML("beforeend", `
      <div class="nexus-hero-scene" aria-hidden="true">
        <div class="nexus-prism-gate" data-nexus-depth>
          <span class="nexus-prism-bezel"></span>
          <span class="nexus-prism-field"><span class="nexus-prism-grid"></span></span>
          <span class="nexus-prism-rail nexus-prism-rail--forge"></span>
          <span class="nexus-prism-rail nexus-prism-rail--canvas"></span>
          <span class="nexus-prism-rail nexus-prism-rail--signal"></span>
          <img class="nexus-prism-mark" src="/brand/sonara-industries-mark.svg" alt="">
          <span class="nexus-prism-label nexus-prism-label--forge">FORGE · OPERATE</span>
          <span class="nexus-prism-label nexus-prism-label--canvas">CANVAS · CREATE</span>
          <span class="nexus-prism-label nexus-prism-label--signal">SIGNAL · GROW</span>
          <span class="nexus-prism-caption">One identity · three focused companies</span>
        </div>
      </div>`);
  }

  function installActiveNavigation() {
    const currentPath = window.location.pathname.replace(/\/$/, "") || "/";
    document.querySelectorAll('a[href^="/"]').forEach((link) => {
      const target = new window.URL(link.href, window.location.href).pathname.replace(/\/$/, "") || "/";
      const isCurrent = target === "/" ? currentPath === "/" : currentPath === target || currentPath.startsWith(`${target}/`);
      if (isCurrent) link.setAttribute("aria-current", "page");
    });
  }

  function installRevealMotion() {
    const items = document.querySelectorAll("main>section:not(.hero),.nexus-section,.nexus-cta,.card,.nexus-product");
    items.forEach((item) => { item.dataset.nexusReveal = ""; });
    if (reducedMotion || preferences.motion === "off" || !window.IntersectionObserver) {
      items.forEach((item) => item.classList.add("is-visible"));
      return;
    }
    const observer = new window.IntersectionObserver((entries) => entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    }), { threshold: 0.08 });
    items.forEach((item) => observer.observe(item));
  }

  function installDepth() {
    const target = document.querySelector("[data-nexus-depth]");
    if (!target || reducedMotion || preferences.motion === "off" || window.innerWidth < 920) return;
    window.addEventListener("pointermove", (event) => {
      const x = (event.clientX / window.innerWidth - 0.5) * 4;
      const y = (event.clientY / window.innerHeight - 0.5) * -3.5;
      target.style.transform = `rotateX(${y}deg) rotateY(${x}deg)`;
    }, { passive: true });
    window.addEventListener("pointerleave", () => { target.style.transform = "rotateX(0deg) rotateY(0deg)"; });
  }

  function playTone(kind = "tap") {
    if (preferences.sound !== "on") return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    audioContext ||= new AudioContextClass();
    const now = audioContext.currentTime;
    const gain = audioContext.createGain();
    const oscillator = audioContext.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.value = kind === "open" ? 330 : kind === "complete" ? 495 : 405;
    gain.gain.setValueAtTime(0.018, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.11);
  }

  function installTactileFeedback() {
    window.addEventListener("pointerdown", (event) => {
      const control = event.target.closest?.("a,button,summary,input[type='submit']");
      if (!control) return;
      control.classList.add("nexus-press");
      playTone(control.hasAttribute("data-nexus-command") ? "open" : "tap");
    });
    window.addEventListener("pointerup", (event) => {
      document.querySelectorAll(".nexus-press").forEach((element) => element.classList.remove("nexus-press"));
      if (preferences.haptics !== "on" || !window.navigator.vibrate) return;
      if (event.target.closest?.("a,button,summary,input[type='submit']")) window.navigator.vibrate(6);
    });
    window.addEventListener("pointercancel", () => {
      document.querySelectorAll(".nexus-press").forEach((element) => element.classList.remove("nexus-press"));
    });
  }

  function commandLinks() {
    const links = [...document.querySelectorAll(".sonara-desktop-nav a,.nexus-account-panel a")];
    const unique = new Map();
    links.forEach((link) => {
      const href = link.getAttribute("href");
      if (href && !unique.has(href)) unique.set(href, link.textContent.trim());
    });
    return [...unique.entries()];
  }

  function installDialogs() {
    const commandDialog = document.querySelector("#nexus-command-dialog");
    const settingsDialog = document.querySelector("#nexus-settings-dialog");
    const commandList = commandDialog?.querySelector(".nexus-command-list");
    const commandInput = commandDialog?.querySelector("input");

    if (commandList) {
      commandList.innerHTML = commandLinks().map(([href, label]) => `<li><a href="${href}" data-label="${label.toLowerCase()}"><span>${label}</span><small>↵</small></a></li>`).join("");
    }

    const openDialog = (dialog) => {
      if (!dialog?.showModal) return;
      lastFocusedElement = document.activeElement;
      dialog.showModal();
      window.setTimeout(() => {
        if (dialog === commandDialog) commandInput?.focus();
        else dialog.querySelector("select,input,button")?.focus();
      }, 20);
      playTone("open");
    };

    const closeDialog = (dialog) => {
      if (!dialog?.open) return;
      dialog.close();
      lastFocusedElement?.focus?.();
    };

    document.querySelectorAll("[data-nexus-command]").forEach((button) => { button.onclick = () => openDialog(commandDialog); });
    document.querySelectorAll("[data-nexus-settings]").forEach((button) => { button.onclick = () => openDialog(settingsDialog); });
    document.querySelectorAll("[data-dialog-close]").forEach((button) => { button.onclick = () => closeDialog(button.closest("dialog")); });

    [commandDialog, settingsDialog].forEach((dialog) => dialog?.addEventListener("click", (event) => {
      if (event.target === dialog) closeDialog(dialog);
    }));

    commandInput?.addEventListener("input", () => {
      const query = commandInput.value.trim().toLowerCase();
      commandList?.querySelectorAll("li").forEach((item) => {
        item.hidden = Boolean(query) && !item.textContent.toLowerCase().includes(query);
      });
    });

    window.addEventListener("keydown", (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openDialog(commandDialog);
      }
      if (event.key === "Escape") {
        document.querySelectorAll(".sonara-mobile-menu[open],.nexus-account-menu[open]").forEach((details) => { details.open = false; });
      }
    });
  }

  function installSettings() {
    document.querySelectorAll("[data-nexus-preference]").forEach((element) => element.addEventListener("change", () => {
      const name = element.dataset.nexusPreference;
      preferences[name] = element.type === "checkbox" ? (element.checked ? "on" : "off") : element.value;
      savePreferences();
      applyPreferences();
      const live = document.querySelector("#nexus-live");
      if (live) live.textContent = "Experience preference updated.";
    }));
  }

  function installMenus() {
    document.querySelectorAll(".sonara-mobile-menu a").forEach((link) => link.addEventListener("click", () => {
      const menu = link.closest("details");
      if (menu) menu.open = false;
    }));
    document.addEventListener("click", (event) => {
      document.querySelectorAll(".nexus-account-menu[open]").forEach((menu) => {
        if (!menu.contains(event.target)) menu.open = false;
      });
    });
  }

  function installRouteProgress() {
    const progress = document.querySelector(".nexus-route-progress");
    document.addEventListener("click", (event) => {
      const link = event.target.closest?.("a[href]");
      if (!link || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const url = new window.URL(link.href, window.location.href);
      if (url.origin !== window.location.origin || url.hash || link.target === "_blank") return;
      progress?.classList.remove("is-complete");
      progress?.classList.add("is-active");
      root.classList.add("nexus-leaving");
    });
    window.addEventListener("pageshow", () => {
      progress?.classList.remove("is-active");
      progress?.classList.add("is-complete");
      root.classList.remove("nexus-leaving");
      window.setTimeout(() => progress?.classList.remove("is-complete"), 180);
    });
  }

  function finishLoader() {
    const loader = document.querySelector("#nexus-loader");
    if (!loader) return;
    loader.classList.add("is-ready");
    window.setTimeout(() => { loader.hidden = true; }, reducedMotion ? 0 : 220);
  }

  function installSystemThemeListener() {
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    media?.addEventListener?.("change", () => {
      if (preferences.theme === "system") applyPreferences();
    });
  }

  function init() {
    applyPreferences();
    installHeroScene();
    installActiveNavigation();
    installRevealMotion();
    installDepth();
    installDialogs();
    installSettings();
    installMenus();
    installTactileFeedback();
    installRouteProgress();
    installSystemThemeListener();
    root.classList.add("nexus-ready");
    root.classList.remove("nexus-loading");
    finishLoader();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
