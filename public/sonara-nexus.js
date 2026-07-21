"use strict";

(() => {
  const root = document.documentElement;
  const preferenceKey = "sonara:nexus:preferences:v2";
  const legacyPreferenceKey = "sonara:nexus:preferences:v1";
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
  const defaults = {
    language: "en",
    theme: "system",
    motion: reducedMotion ? "off" : "on",
    sound: "off",
    haptics: "off"
  };

  const dictionaries = {
    en: {
      platform: "Nexus", products: "Companies", businessBuilder: "Business Builder", creatorStudio: "Creator Studio", growthStudio: "Growth Studio",
      tools: "Free tools", pricing: "Pricing", support: "Support", login: "Log in", start: "Create account", dashboard: "Dashboard", settings: "Settings", admin: "Administration", logout: "Log out",
      menu: "Menu", command: "Command", experience: "Experience", heroEyebrow: "Connected operating infrastructure",
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
      platform: "Nexus", products: "Empresas", businessBuilder: "Business Builder", creatorStudio: "Creator Studio", growthStudio: "Growth Studio",
      tools: "Herramientas gratis", pricing: "Precios", support: "Soporte", login: "Iniciar sesión", start: "Crear cuenta", dashboard: "Panel", settings: "Ajustes", admin: "Administración", logout: "Cerrar sesión",
      menu: "Menú", command: "Comandos", experience: "Experiencia", heroEyebrow: "Infraestructura operativa conectada",
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
      platform: "Nexus", products: "Entreprises", businessBuilder: "Business Builder", creatorStudio: "Creator Studio", growthStudio: "Growth Studio",
      tools: "Outils gratuits", pricing: "Tarifs", support: "Assistance", login: "Connexion", start: "Créer un compte", dashboard: "Tableau de bord", settings: "Réglages", admin: "Administration", logout: "Déconnexion",
      menu: "Menu", command: "Commande", experience: "Expérience", heroEyebrow: "Infrastructure opérationnelle connectée",
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
      platform: "Nexus", products: "Unternehmen", businessBuilder: "Business Builder", creatorStudio: "Creator Studio", growthStudio: "Growth Studio",
      tools: "Kostenlose Tools", pricing: "Preise", support: "Support", login: "Anmelden", start: "Konto erstellen", dashboard: "Übersicht", settings: "Einstellungen", admin: "Administration", logout: "Abmelden",
      menu: "Menü", command: "Befehl", experience: "Erlebnis", heroEyebrow: "Vernetzte Betriebsinfrastruktur",
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
      platform: "Nexus", products: "Empresas", businessBuilder: "Business Builder", creatorStudio: "Creator Studio", growthStudio: "Growth Studio",
      tools: "Ferramentas grátis", pricing: "Preços", support: "Suporte", login: "Entrar", start: "Criar conta", dashboard: "Painel", settings: "Configurações", admin: "Administração", logout: "Sair",
      menu: "Menu", command: "Comando", experience: "Experiência", heroEyebrow: "Infraestrutura operacional conectada",
      heroHeading: "Construa, crie e cresça sem perder o controle.",
      heroBody: "Business Builder, Creator Studio e Growth Studio compartilham uma camada operacional segura para fundadores, criadores, operadores e pequenas equipes.",
      productsKicker: "Três empresas conectadas", productsHeading: "Um sistema. Três maneiras focadas de avançar.",
      productsBody: "Cada empresa mantém seus próprios fluxos e registros enquanto identidade, acesso, cobrança, suporte e entrega permanecem conectados.",
      flowKicker: "Criado para operações reais", flowHeading: "Passe da intenção para uma ação baseada em evidências.",
      ctaKicker: "Comece com trabalho útil", ctaHeading: "Comece grátis. Adicione profundidade quando o trabalho exigir.",
      searchPlaceholder: "Pesquisar empresas, páginas e ações", settingsTitle: "Configurações de experiência", language: "Idioma",
      languageHelp: "Atualiza o idioma principal da interface.", appearance: "Aparência", appearanceHelp: "Siga o dispositivo ou escolha claro ou escuro.",
      motion: "Movimento", sound: "Som", haptics: "Resposta tátil"
    }
  };

  function readPreferences() {
    try {
      const current = JSON.parse(window.localStorage.getItem(preferenceKey) || "null");
      if (current && typeof current === "object") return { ...defaults, ...current };
      const legacy = JSON.parse(window.localStorage.getItem(legacyPreferenceKey) || "null");
      if (legacy && typeof legacy === "object") return { ...defaults, ...legacy, haptics: legacy.haptics === "on" ? "on" : "off" };
    } catch {}
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
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.setAttribute("content", root.dataset.theme === "dark" ? "#080b12" : "#f7f9fc");
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
        <div class="nexus-prism-stage" data-nexus-depth>
          <span class="nexus-grid-plane"></span>
          <span class="nexus-ribbon nexus-ribbon--forge"></span>
          <span class="nexus-ribbon nexus-ribbon--canvas"></span>
          <span class="nexus-ribbon nexus-ribbon--signal"></span>
          <span class="nexus-core"></span>
          <span class="nexus-label nexus-label--forge">FORGE · OPERATE</span>
          <span class="nexus-label nexus-label--canvas">CANVAS · CREATE</span>
          <span class="nexus-label nexus-label--signal">SIGNAL · GROW</span>
        </div>
      </div>`);
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
      const x = (event.clientX / window.innerWidth - 0.5) * 7;
      const y = (event.clientY / window.innerHeight - 0.5) * -6;
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
    oscillator.frequency.value = kind === "open" ? 342 : kind === "complete" ? 494 : 410;
    gain.gain.setValueAtTime(0.025, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.12);
  }

  function pulse(pattern = 6) {
    if (preferences.haptics !== "on" || reducedMotion || !window.navigator.vibrate) return;
    window.navigator.vibrate(pattern);
  }

  function installTactileFeedback() {
    window.addEventListener("pointerdown", (event) => {
      const control = event.target.closest?.("a,button,summary,input[type='submit']");
      if (!control || control.hasAttribute("disabled")) return;
      control.classList.add("nexus-press");
      pulse(control.hasAttribute("data-nexus-command") ? 8 : 5);
      playTone(control.hasAttribute("data-nexus-command") ? "open" : "tap");
    });
    for (const type of ["pointerup", "pointercancel", "blur"]) {
      window.addEventListener(type, () => document.querySelectorAll(".nexus-press").forEach((element) => element.classList.remove("nexus-press")));
    }
  }

  function closeDialog(dialog) {
    if (!dialog?.open) return;
    dialog.close();
    if (lastFocusedElement?.focus) lastFocusedElement.focus();
  }

  function installDialogs() {
    const commandDialog = document.querySelector("#nexus-command-dialog");
    const settingsDialog = document.querySelector("#nexus-settings-dialog");
    const commandList = commandDialog?.querySelector(".nexus-command-list");
    const commandInput = commandDialog?.querySelector("input");
    const links = [...document.querySelectorAll(".sonara-desktop-nav a, .sonara-mobile-menu nav a")]
      .filter((link, index, array) => array.findIndex((item) => item.getAttribute("href") === link.getAttribute("href")) === index);

    if (commandList) {
      commandList.innerHTML = links.map((link) => `<li><a href="${link.getAttribute("href")}"><span>${link.textContent.trim()}</span><small>↵</small></a></li>`).join("");
    }

    const open = (dialog) => {
      if (!dialog?.showModal) return;
      lastFocusedElement = document.activeElement;
      dialog.showModal();
      playTone("open");
      pulse(8);
      window.setTimeout(() => {
        if (dialog === commandDialog) commandInput?.focus();
        else dialog.querySelector("select,input,button")?.focus();
      }, 25);
    };

    document.querySelectorAll("[data-nexus-command]").forEach((button) => { button.onclick = () => open(commandDialog); });
    document.querySelectorAll("[data-nexus-settings]").forEach((button) => { button.onclick = () => open(settingsDialog); });
    document.querySelectorAll("[data-dialog-close]").forEach((button) => { button.onclick = () => closeDialog(button.closest("dialog")); });

    for (const dialog of [commandDialog, settingsDialog]) {
      dialog?.addEventListener("click", (event) => {
        if (event.target === dialog) closeDialog(dialog);
      });
    }

    commandInput?.addEventListener("input", () => {
      const query = commandInput.value.toLowerCase().trim();
      commandList?.querySelectorAll("li").forEach((item) => { item.hidden = !item.textContent.toLowerCase().includes(query); });
    });

    window.addEventListener("keydown", (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        open(commandDialog);
      }
      if (event.key === "Escape") {
        closeDialog(commandDialog);
        closeDialog(settingsDialog);
      }
    });
  }

  function installSettings() {
    document.querySelectorAll("[data-nexus-preference]").forEach((element) => element.addEventListener("change", () => {
      const name = element.dataset.nexusPreference;
      preferences[name] = element.type === "checkbox" ? (element.checked ? "on" : "off") : element.value;
      savePreferences();
      applyPreferences();
      playTone("complete");
      pulse(7);
    }));
  }

  function installPasswordVisibility() {
    document.querySelectorAll("[data-toggle-password]").forEach((button) => {
      const input = document.getElementById(button.dataset.togglePassword || "");
      if (!input || input.tagName !== "INPUT") {
        button.disabled = true;
        return;
      }

      button.addEventListener("click", () => {
        const show = input.type === "password";
        input.type = show ? "text" : "password";
        button.textContent = show ? "Hide password" : "Show password";
        button.setAttribute("aria-pressed", show ? "true" : "false");
        button.setAttribute("aria-label", show ? "Hide password" : "Show password");
      });
    });
  }

  function installRouteProgress() {
    const progress = document.querySelector(".nexus-route-progress");
    document.addEventListener("click", (event) => {
      const link = event.target.closest?.("a[href]");
      if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target === "_blank") return;
      const url = new window.URL(link.href, window.location.href);
      if (url.origin !== window.location.origin || url.hash || link.hasAttribute("download")) return;
      progress?.classList.add("is-active");
      root.classList.add("nexus-leaving");
    });
    window.addEventListener("pageshow", () => {
      progress?.classList.remove("is-active");
      root.classList.remove("nexus-leaving");
    });
  }

  function installCurrentNavigation() {
    const current = window.location.pathname.replace(/\/$/, "") || "/";
    document.querySelectorAll('a[href^="/"]').forEach((link) => {
      const path = new window.URL(link.href, window.location.href).pathname.replace(/\/$/, "") || "/";
      if (path === current) link.setAttribute("aria-current", "page");
    });
  }

  function closeMenusAfterNavigation() {
    document.addEventListener("click", (event) => {
      const link = event.target.closest?.("details a");
      if (!link) return;
      link.closest("details")?.removeAttribute("open");
    });
  }

  function initialize() {
    applyPreferences();
    installHeroScene();
    installRevealMotion();
    installDepth();
    installDialogs();
    installSettings();
    installPasswordVisibility();
    installTactileFeedback();
    installRouteProgress();
    installCurrentNavigation();
    closeMenusAfterNavigation();
    root.classList.add("nexus-ready");
    root.classList.remove("nexus-loading");
    const loader = document.querySelector("#nexus-loader");
    if (loader) {
      loader.classList.add("is-ready");
      window.setTimeout(() => { loader.hidden = true; }, reducedMotion ? 0 : 230);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true });
  else initialize();
})();
