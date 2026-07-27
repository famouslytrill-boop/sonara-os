"use strict";

(() => {
  const root = document.documentElement;
  const preferenceKey = "sonara:nexus:preferences:v2";
  const legacyPreferenceKey = "sonara:nexus:preferences:v1";
  const startupKey = "sonara:startup:v3";
  const startupStartedAt = window.performance?.now?.() || Date.now();
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
      platform: "SONARA One", products: "Companies", businessBuilder: "Business Builder", creatorStudio: "Creator Studio", growthStudio: "Growth Studio",
      tools: "Free tools", pricing: "Pricing", support: "Support", login: "Log in", start: "Create account", dashboard: "Dashboard", settings: "Settings", admin: "Administration", logout: "Log out",
      menu: "Menu", command: "Command", experience: "Experience", heroEyebrow: "Build. Create. Grow.",
      heroHeading: "Launch your work. Run it professionally. Grow with evidence.",
      heroBody: "Business Builder, Creator Studio, and Growth Studio give founders, creators, and small teams focused tools inside one connected account.",
      productsKicker: "Three connected companies", productsHeading: "Choose the studio that matches the work.",
      productsBody: "Each company has a clear job, its own workflow, and honest availability while identity, billing, evidence, and support stay connected.",
      flowKicker: "One connected operating path", flowHeading: "Move from first setup to measurable progress.",
      ctaKicker: "Start with the next real step", ctaHeading: "Create a free account. Add paid systems only when they are verified.",
      searchPlaceholder: "Search companies, pages, and actions", settingsTitle: "Experience settings", language: "Language",
      languageHelp: "Updates the core interface language.", appearance: "Appearance", appearanceHelp: "Follow your device or choose light or dark.",
      motion: "Motion", sound: "Sound feedback", haptics: "Tactile feedback"
    },
    es: {
      platform: "SONARA One", products: "Empresas", businessBuilder: "Business Builder", creatorStudio: "Creator Studio", growthStudio: "Growth Studio",
      tools: "Herramientas gratis", pricing: "Precios", support: "Soporte", login: "Iniciar sesión", start: "Crear cuenta", dashboard: "Panel", settings: "Ajustes", admin: "Administración", logout: "Cerrar sesión",
      menu: "Menú", command: "Comandos", experience: "Experiencia", heroEyebrow: "Crea. Construye. Crece.",
      heroHeading: "Lanza tu trabajo. Opéralo profesionalmente. Crece con evidencia.",
      heroBody: "Business Builder, Creator Studio y Growth Studio ofrecen a fundadores, creadores y equipos pequeños herramientas enfocadas dentro de una sola cuenta conectada.",
      productsKicker: "Tres empresas conectadas", productsHeading: "Elige el estudio que corresponde al trabajo.",
      productsBody: "Cada empresa tiene una función clara, su propio flujo y disponibilidad honesta, mientras identidad, facturación, evidencia y soporte permanecen conectados.",
      flowKicker: "Una ruta operativa conectada", flowHeading: "Pasa de la configuración inicial al progreso medible.",
      ctaKicker: "Empieza con el siguiente paso real", ctaHeading: "Crea una cuenta gratis. Añade sistemas de pago solo cuando estén verificados.",
      searchPlaceholder: "Buscar empresas, páginas y acciones", settingsTitle: "Ajustes de experiencia", language: "Idioma",
      languageHelp: "Actualiza el idioma principal de la interfaz.", appearance: "Apariencia", appearanceHelp: "Sigue tu dispositivo o elige claro u oscuro.",
      motion: "Movimiento", sound: "Sonido", haptics: "Respuesta táctil"
    },
    fr: {
      platform: "SONARA One", products: "Entreprises", businessBuilder: "Business Builder", creatorStudio: "Creator Studio", growthStudio: "Growth Studio",
      tools: "Outils gratuits", pricing: "Tarifs", support: "Assistance", login: "Connexion", start: "Créer un compte", dashboard: "Tableau de bord", settings: "Réglages", admin: "Administration", logout: "Déconnexion",
      menu: "Menu", command: "Commande", experience: "Expérience", heroEyebrow: "Créez. Construisez. Développez.",
      heroHeading: "Lancez votre travail. Gérez-le professionnellement. Progressez avec des preuves.",
      heroBody: "Business Builder, Creator Studio et Growth Studio offrent aux fondateurs, créateurs et petites équipes des outils ciblés dans un compte connecté.",
      productsKicker: "Trois entreprises connectées", productsHeading: "Choisissez le studio adapté au travail.",
      productsBody: "Chaque entreprise a une mission claire, son propre flux et une disponibilité honnête, tandis que l’identité, la facturation, les preuves et l’assistance restent connectées.",
      flowKicker: "Un parcours opérationnel connecté", flowHeading: "Passez de la configuration initiale à des progrès mesurables.",
      ctaKicker: "Commencez par la prochaine étape réelle", ctaHeading: "Créez un compte gratuit. Ajoutez des systèmes payants uniquement après vérification.",
      searchPlaceholder: "Rechercher des entreprises, pages et actions", settingsTitle: "Réglages de l’expérience", language: "Langue",
      languageHelp: "Met à jour la langue principale de l’interface.", appearance: "Apparence", appearanceHelp: "Suivez l’appareil ou choisissez clair ou sombre.",
      motion: "Animation", sound: "Retour sonore", haptics: "Retour tactile"
    },
    de: {
      platform: "SONARA One", products: "Unternehmen", businessBuilder: "Business Builder", creatorStudio: "Creator Studio", growthStudio: "Growth Studio",
      tools: "Kostenlose Tools", pricing: "Preise", support: "Support", login: "Anmelden", start: "Konto erstellen", dashboard: "Übersicht", settings: "Einstellungen", admin: "Administration", logout: "Abmelden",
      menu: "Menü", command: "Befehl", experience: "Erlebnis", heroEyebrow: "Aufbauen. Gestalten. Wachsen.",
      heroHeading: "Starten Sie Ihre Arbeit. Führen Sie sie professionell. Wachsen Sie mit Nachweisen.",
      heroBody: "Business Builder, Creator Studio und Growth Studio bieten Gründern, Kreativen und kleinen Teams fokussierte Werkzeuge in einem verbundenen Konto.",
      productsKicker: "Drei verbundene Unternehmen", productsHeading: "Wählen Sie das Studio, das zur Aufgabe passt.",
      productsBody: "Jedes Unternehmen hat eine klare Aufgabe, einen eigenen Ablauf und ehrliche Verfügbarkeit, während Identität, Abrechnung, Nachweise und Support verbunden bleiben.",
      flowKicker: "Ein verbundener Betriebsweg", flowHeading: "Von der ersten Einrichtung zu messbarem Fortschritt.",
      ctaKicker: "Mit dem nächsten echten Schritt beginnen", ctaHeading: "Erstellen Sie ein kostenloses Konto. Fügen Sie bezahlte Systeme erst nach der Verifizierung hinzu.",
      searchPlaceholder: "Unternehmen, Seiten und Aktionen durchsuchen", settingsTitle: "Erlebniseinstellungen", language: "Sprache",
      languageHelp: "Aktualisiert die zentrale Oberflächensprache.", appearance: "Darstellung", appearanceHelp: "Gerät verwenden oder Hell/Dunkel wählen.",
      motion: "Bewegung", sound: "Klangfeedback", haptics: "Haptisches Feedback"
    },
    pt: {
      platform: "SONARA One", products: "Empresas", businessBuilder: "Business Builder", creatorStudio: "Creator Studio", growthStudio: "Growth Studio",
      tools: "Ferramentas grátis", pricing: "Preços", support: "Suporte", login: "Entrar", start: "Criar conta", dashboard: "Painel", settings: "Configurações", admin: "Administração", logout: "Sair",
      menu: "Menu", command: "Comando", experience: "Experiência", heroEyebrow: "Construa. Crie. Cresça.",
      heroHeading: "Lance seu trabalho. Opere profissionalmente. Cresça com evidências.",
      heroBody: "Business Builder, Creator Studio e Growth Studio oferecem a fundadores, criadores e pequenas equipes ferramentas focadas em uma conta conectada.",
      productsKicker: "Três empresas conectadas", productsHeading: "Escolha o estúdio que corresponde ao trabalho.",
      productsBody: "Cada empresa tem uma função clara, seu próprio fluxo e disponibilidade honesta, enquanto identidade, cobrança, evidências e suporte permanecem conectados.",
      flowKicker: "Um caminho operacional conectado", flowHeading: "Passe da configuração inicial para um progresso mensurável.",
      ctaKicker: "Comece com o próximo passo real", ctaHeading: "Crie uma conta gratuita. Adicione sistemas pagos somente quando forem verificados.",
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
    root.dataset.sonaraMotion = preferences.motion;
    root.dataset.sonaraSound = preferences.sound;
    root.dataset.sonaraHaptics = preferences.haptics;
    translate();
    document.querySelectorAll("[data-sonara-preference]").forEach((element) => {
      const name = element.dataset.sonaraPreference;
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
    if (!hero || hero.querySelector(".sonara-hero-scene")) return;
    hero.insertAdjacentHTML("beforeend", `
      <div class="sonara-hero-scene" aria-hidden="true">
        <div class="sonara-prism-stage" data-sonara-depth>
          <span class="sonara-grid-plane"></span>
          <span class="sonara-ribbon sonara-ribbon--forge"></span>
          <span class="sonara-ribbon sonara-ribbon--canvas"></span>
          <span class="sonara-ribbon sonara-ribbon--signal"></span>
          <span class="sonara-core"></span>
          <span class="sonara-label sonara-label--forge">FORGE · OPERATE</span>
          <span class="sonara-label sonara-label--canvas">CANVAS · CREATE</span>
          <span class="sonara-label sonara-label--signal">SIGNAL · GROW</span>
        </div>
      </div>`);
  }

  function installRevealMotion() {
    const items = document.querySelectorAll("main>section:not(.hero),.sonara-section,.sonara-cta,.card,.sonara-product");
    items.forEach((item) => { item.dataset.sonaraReveal = ""; });
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
    const target = document.querySelector("[data-sonara-depth]");
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
      control.classList.add("sonara-press");
      pulse(control.hasAttribute("data-sonara-command") ? 8 : 5);
      playTone(control.hasAttribute("data-sonara-command") ? "open" : "tap");
    });
    for (const type of ["pointerup", "pointercancel", "blur"]) {
      window.addEventListener(type, () => document.querySelectorAll(".sonara-press").forEach((element) => element.classList.remove("sonara-press")));
    }
  }

  function closeDialog(dialog) {
    if (!dialog?.open) return;
    dialog.close();
    if (lastFocusedElement?.focus) lastFocusedElement.focus();
  }

  function installDialogs() {
    const commandDialog = document.querySelector("#sonara-command-dialog");
    const settingsDialog = document.querySelector("#sonara-settings-dialog");
    const commandList = commandDialog?.querySelector(".sonara-command-list");
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

    document.querySelectorAll("[data-sonara-command]").forEach((button) => { button.onclick = () => open(commandDialog); });
    document.querySelectorAll("[data-sonara-settings]").forEach((button) => { button.onclick = () => open(settingsDialog); });
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
    document.querySelectorAll("[data-sonara-preference]").forEach((element) => element.addEventListener("change", () => {
      const name = element.dataset.sonaraPreference;
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

  /* SONARA MOTION START */
  function installStartupExperience() {
    const loader = document.querySelector("#sonara-loader");
    if (!loader) return;

    const status = loader.querySelector("[data-sonara-loader-status]");
    const skip = loader.querySelector("[data-sonara-loader-skip]");
    let firstVisit = true;
    try {
      firstVisit = window.sessionStorage.getItem(startupKey) !== "seen";
      window.sessionStorage.setItem(startupKey, "seen");
    } catch {}

    loader.dataset.mode = firstVisit ? "startup" : "route";
    if (status) status.textContent = firstVisit ? "Preparing your workspace" : "Loading SONARA One";

    let closed = false;
    const hide = () => {
      if (closed) return;
      closed = true;
      loader.classList.add("is-ready");
      root.classList.add("sonara-ready");
      window.setTimeout(() => { loader.hidden = true; }, reducedMotion ? 0 : 320);
    };

    const elapsed = (window.performance?.now?.() || Date.now()) - startupStartedAt;
    const minimum = reducedMotion ? 0 : (firstVisit ? 680 : 100);
    const finish = () => window.setTimeout(hide, Math.max(0, minimum - elapsed));

    if (document.readyState === "complete") finish();
    else window.addEventListener("load", finish, { once: true });

    window.setTimeout(hide, firstVisit ? 2600 : 1400);
    skip?.addEventListener("click", hide, { once: true });
  }
  /* SONARA MOTION END */

  function installRouteProgress() {
    const progress = document.querySelector(".sonara-route-progress");
    document.addEventListener("click", (event) => {
      const link = event.target.closest?.("a[href]");
      if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target === "_blank") return;
      const url = new window.URL(link.href, window.location.href);
      if (url.origin !== window.location.origin || url.hash || link.hasAttribute("download")) return;
      progress?.classList.add("is-active");
      const loader = document.querySelector("#sonara-loader");
      if (loader) {
        loader.hidden = false;
        loader.dataset.mode = "route";
        loader.classList.remove("is-ready");
        const status = loader.querySelector("[data-sonara-loader-status]");
        if (status) status.textContent = "Loading SONARA One";
      }
      root.classList.add("sonara-leaving");
    });
    window.addEventListener("pageshow", () => {
      progress?.classList.remove("is-active");
      root.classList.remove("sonara-leaving");
      const loader = document.querySelector("#sonara-loader");
      if (loader) {
        loader.classList.add("is-ready");
        loader.hidden = true;
      }
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
    root.classList.remove("sonara-loading");
    installStartupExperience();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true });
  else initialize();
})();

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
