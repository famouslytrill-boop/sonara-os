"use strict";

(() => {
  const root = document.documentElement;
  const preferenceKey = "sonara:nexus:preferences:v1";
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
  const defaults = {
    language: "en",
    theme: "system",
    motion: reducedMotion ? "off" : "on",
    sound: "off",
    haptics: "on"
  };

  const dictionaries = {
    en: {
      platform: "Platform", businessBuilder: "Business Builder", creatorStudio: "Creator Studio", growthStudio: "Growth Studio",
      tools: "Free tools", pricing: "Pricing", support: "Support", login: "Log in", start: "Start Free",
      menu: "Menu", command: "Command", experience: "Experience", heroEyebrow: "Launch operating system",
      heroHeading: "Make work move.", heroBody: "Business Builder, Creator Studio, and Growth Studio connect through one fast operating layer for founders, creators, and small teams.",
      primaryAction: "Enter SONARA Nexus", secondaryAction: "Explore free tools", tertiaryAction: "See plans",
      productsKicker: "Three connected companies", productsHeading: "One operating layer. Three focused workspaces.",
      productsBody: "Business Builder, Creator Studio, and Growth Studio keep their own tools and records while identity, billing, support, and delivery stay connected through SONARA Nexus.",
      flowKicker: "Designed for momentum", flowHeading: "From intent to outcome without losing context.",
      ctaKicker: "Start with the next useful action", ctaHeading: "Build something real before adding complexity.",
      searchPlaceholder: "Search pages and actions", settingsTitle: "Experience settings", language: "Language",
      languageHelp: "Updates the interface and core product language.", appearance: "Appearance",
      appearanceHelp: "Follow your device or choose light or dark.", motion: "Motion", sound: "Sound feedback", haptics: "Tactile feedback"
    },
    es: {
      platform: "Plataforma", businessBuilder: "Business Builder", creatorStudio: "Creator Studio", growthStudio: "Growth Studio",
      tools: "Herramientas gratis", pricing: "Precios", support: "Soporte", login: "Iniciar sesión", start: "Comenzar gratis",
      menu: "Menú", command: "Comandos", experience: "Experiencia", heroEyebrow: "Sistema operativo de lanzamiento",
      heroHeading: "Haz que el trabajo avance.", heroBody: "Business Builder, Creator Studio y Growth Studio se conectan mediante una capa operativa rápida.",
      primaryAction: "Entrar a SONARA Nexus", secondaryAction: "Explorar herramientas gratis", tertiaryAction: "Ver planes",
      productsKicker: "Tres empresas conectadas", productsHeading: "Una capa operativa. Tres espacios enfocados.",
      productsBody: "Cada empresa conserva sus herramientas y registros mientras identidad, facturación, soporte y entrega permanecen conectados.",
      flowKicker: "Diseñado para el impulso", flowHeading: "De la intención al resultado sin perder el contexto.",
      ctaKicker: "Empieza con la siguiente acción útil", ctaHeading: "Construye algo real antes de añadir complejidad.",
      searchPlaceholder: "Buscar páginas y acciones", settingsTitle: "Ajustes de experiencia", language: "Idioma",
      languageHelp: "Actualiza la interfaz y el lenguaje principal del producto.", appearance: "Apariencia",
      appearanceHelp: "Sigue tu dispositivo o elige claro u oscuro.", motion: "Movimiento", sound: "Sonido", haptics: "Respuesta táctil"
    },
    fr: {
      platform: "Plateforme", businessBuilder: "Business Builder", creatorStudio: "Creator Studio", growthStudio: "Growth Studio",
      tools: "Outils gratuits", pricing: "Tarifs", support: "Assistance", login: "Connexion", start: "Commencer gratuitement",
      menu: "Menu", command: "Commande", experience: "Expérience", heroEyebrow: "Système d’exploitation de lancement",
      heroHeading: "Faites avancer le travail.", heroBody: "Business Builder, Creator Studio et Growth Studio se connectent dans une couche opérationnelle rapide.",
      primaryAction: "Entrer dans SONARA Nexus", secondaryAction: "Explorer les outils", tertiaryAction: "Voir les offres",
      productsKicker: "Trois entreprises connectées", productsHeading: "Une couche opérationnelle. Trois espaces spécialisés.",
      productsBody: "Chaque entreprise conserve ses outils et ses données tandis que l’identité, la facturation, l’assistance et la livraison restent connectées.",
      flowKicker: "Conçu pour l’élan", flowHeading: "De l’intention au résultat sans perdre le contexte.",
      ctaKicker: "Commencez par l’action utile", ctaHeading: "Construisez quelque chose de réel.",
      searchPlaceholder: "Rechercher des pages et actions", settingsTitle: "Réglages de l’expérience", language: "Langue",
      languageHelp: "Met à jour l’interface et le langage principal du produit.", appearance: "Apparence",
      appearanceHelp: "Suivez l’appareil ou choisissez clair ou sombre.", motion: "Animation", sound: "Retour sonore", haptics: "Retour tactile"
    },
    de: {
      platform: "Plattform", businessBuilder: "Business Builder", creatorStudio: "Creator Studio", growthStudio: "Growth Studio",
      tools: "Kostenlose Tools", pricing: "Preise", support: "Support", login: "Anmelden", start: "Kostenlos starten",
      menu: "Menü", command: "Befehl", experience: "Erlebnis", heroEyebrow: "Launch-Betriebssystem",
      heroHeading: "Arbeit in Bewegung bringen.", heroBody: "Business Builder, Creator Studio und Growth Studio sind über eine schnelle Betriebsebene verbunden.",
      primaryAction: "SONARA Nexus öffnen", secondaryAction: "Tools erkunden", tertiaryAction: "Pläne ansehen",
      productsKicker: "Drei verbundene Unternehmen", productsHeading: "Eine Betriebsebene. Drei fokussierte Arbeitsbereiche.",
      productsBody: "Jedes Unternehmen behält seine Werkzeuge und Daten, während Identität, Abrechnung, Support und Lieferung verbunden bleiben.",
      flowKicker: "Für Dynamik entwickelt", flowHeading: "Von der Absicht zum Ergebnis ohne Kontextverlust.",
      ctaKicker: "Mit dem nächsten Schritt beginnen", ctaHeading: "Etwas Echtes bauen.",
      searchPlaceholder: "Seiten und Aktionen durchsuchen", settingsTitle: "Erlebniseinstellungen", language: "Sprache",
      languageHelp: "Aktualisiert die Oberfläche und zentrale Produktsprache.", appearance: "Darstellung",
      appearanceHelp: "Gerät verwenden oder Hell/Dunkel wählen.", motion: "Bewegung", sound: "Klangfeedback", haptics: "Haptisches Feedback"
    }
  };

  let preferences;
  try {
    preferences = { ...defaults, ...JSON.parse(window.localStorage.getItem(preferenceKey) || "{}") };
  } catch {
    preferences = { ...defaults };
  }

  let audioContext;

  function resolveTheme(value) {
    if (value === "light" || value === "dark") return value;
    return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
  }

  function translate() {
    const dictionary = dictionaries[preferences.language] || dictionaries.en;
    root.lang = preferences.language;
    document.querySelectorAll("[data-i18n]").forEach((element) => {
      const value = dictionary[element.dataset.i18n];
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
  }

  function installHero() {
    if (!document.body.classList.contains("sonara-home-v3")) return;
    const stage = document.querySelector(".hero");
    if (!stage || stage.querySelector(".nexus-hero-visual")) return;
    stage.insertAdjacentHTML("beforeend", `<div class="nexus-hero-visual" aria-hidden="true"><div class="nexus-orbit" data-nexus-parallax><span class="nexus-ring"></span><span class="nexus-ring"></span><span class="nexus-ring"></span><span class="nexus-node nexus-node--forge"></span><span class="nexus-node nexus-node--canvas"></span><span class="nexus-node nexus-node--signal"></span><span class="nexus-orbit-label nexus-orbit-label--forge">Forge mode</span><span class="nexus-orbit-label nexus-orbit-label--canvas">Canvas mode</span><span class="nexus-orbit-label nexus-orbit-label--signal">Signal mode</span><span class="nexus-orbit-floor"></span></div></div>`);
  }

  function installRevealMotion() {
    const items = document.querySelectorAll("main>section:not(.hero),.nexus-section,.card,.nexus-product");
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

  function installParallax() {
    const target = document.querySelector("[data-nexus-parallax]");
    if (!target || reducedMotion || preferences.motion === "off" || window.innerWidth < 920) return;
    window.addEventListener("pointermove", (event) => {
      const x = (event.clientX / window.innerWidth - 0.5) * 8;
      const y = (event.clientY / window.innerHeight - 0.5) * -7;
      target.style.transform = `rotateX(${y}deg) rotateY(${x}deg)`;
    }, { passive: true });
  }

  function playTone(kind = "tap") {
    if (preferences.sound !== "on") return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    audioContext ||= new AudioContextClass();
    const now = audioContext.currentTime;
    const gain = audioContext.createGain();
    const oscillator = audioContext.createOscillator();
    oscillator.type = "triangle";
    oscillator.frequency.value = kind === "open" ? 320 : 420;
    gain.gain.setValueAtTime(0.03, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.14);
  }

  function installTactileFeedback() {
    window.addEventListener("pointerdown", (event) => {
      const control = event.target.closest?.("a,button,summary");
      if (!control) return;
      control.classList.add("nexus-press");
      if (preferences.haptics === "on" && window.navigator.vibrate) window.navigator.vibrate(7);
      playTone(control.hasAttribute("data-nexus-command") ? "open" : "tap");
    });
    window.addEventListener("pointerup", () => {
      document.querySelectorAll(".nexus-press").forEach((element) => element.classList.remove("nexus-press"));
    });
  }

  function installDialogs() {
    const commandDialog = document.querySelector("#nexus-command-dialog");
    const settingsDialog = document.querySelector("#nexus-settings-dialog");
    const commandList = commandDialog?.querySelector(".nexus-command-list");
    const commandInput = commandDialog?.querySelector("input");
    const links = [...document.querySelectorAll(".sonara-desktop-nav a")];

    if (commandList) {
      commandList.innerHTML = links.map((link) => `<li><a href="${link.getAttribute("href")}" data-label="${link.textContent.toLowerCase()}"><span>${link.textContent}</span><small>↵</small></a></li>`).join("");
    }

    const open = (dialog) => {
      dialog?.showModal?.();
      window.setTimeout(() => {
        if (dialog === commandDialog) commandInput?.focus();
      }, 30);
    };

    document.querySelectorAll("[data-nexus-command]").forEach((button) => { button.onclick = () => open(commandDialog); });
    document.querySelectorAll("[data-nexus-settings]").forEach((button) => { button.onclick = () => open(settingsDialog); });
    document.querySelectorAll("[data-dialog-close]").forEach((button) => { button.onclick = () => button.closest("dialog")?.close(); });
    commandInput?.addEventListener("input", () => {
      commandList?.querySelectorAll("li").forEach((item) => {
        item.hidden = !item.textContent.toLowerCase().includes(commandInput.value.toLowerCase());
      });
    });
    window.addEventListener("keydown", (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        open(commandDialog);
      }
    });
  }

  function installSettings() {
    document.querySelectorAll("[data-nexus-preference]").forEach((element) => element.addEventListener("change", () => {
      const name = element.dataset.nexusPreference;
      preferences[name] = element.type === "checkbox" ? (element.checked ? "on" : "off") : element.value;
      try { window.localStorage.setItem(preferenceKey, JSON.stringify(preferences)); } catch {}
      applyPreferences();
    }));
  }

  function installRouteProgress() {
    const progress = document.querySelector(".nexus-route-progress");
    document.addEventListener("click", (event) => {
      const link = event.target.closest?.("a[href]");
      if (!link || event.metaKey || event.ctrlKey) return;
      const url = new window.URL(link.href, window.location.href);
      if (url.origin !== window.location.origin || url.hash) return;
      if (!document.startViewTransition) progress?.classList.add("is-active");
    });
  }

  function initialize() {
    applyPreferences();
    installHero();
    installRevealMotion();
    installParallax();
    installDialogs();
    installSettings();
    installTactileFeedback();
    installRouteProgress();
    root.classList.add("nexus-ready");
    root.classList.remove("nexus-loading");
    const loader = document.querySelector("#nexus-loader");
    if (loader) window.setTimeout(() => { loader.hidden = true; }, 320);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true });
  else initialize();
})();
