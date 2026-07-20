"use strict";

(() => {
  const root = document.documentElement;
  const storageKey = "sonara:nexus:preferences:v1";
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
  const defaultPreferences = {
    language: "en",
    theme: "system",
    motion: reducedMotion ? "off" : "on",
    sound: "off",
    haptics: "on"
  };

  const dictionaries = {
    en: {
      platform: "Platform",
      forge: "SONARA Forge",
      canvas: "SONARA Canvas",
      signal: "SONARA Signal",
      tools: "Free tools",
      pricing: "Pricing",
      support: "Support",
      login: "Log in",
      start: "Start Free",
      menu: "Menu",
      command: "Command",
      experience: "Experience",
      heroEyebrow: "Adaptive operating system",
      heroHeading: "Make work move.",
      heroBody: "Shape the business, create the release, reach the audience, and keep every next action connected through one fast operating layer.",
      primaryAction: "Enter SONARA Nexus",
      secondaryAction: "Explore free tools",
      tertiaryAction: "See plans",
      productsKicker: "Three operating modes",
      productsHeading: "One system. Three ways to move.",
      productsBody: "Each workspace has its own rhythm, records, and tools while identity, billing, support, and delivery remain connected.",
      flowKicker: "Designed for momentum",
      flowHeading: "From intent to outcome without losing context.",
      proofKicker: "Live operational truth",
      proofHeading: "Fast when it can be. Honest when setup is required.",
      ctaKicker: "Start with the next useful action",
      ctaHeading: "Build something real before adding complexity.",
      close: "Close",
      searchPlaceholder: "Search pages and actions",
      settingsTitle: "Experience settings",
      language: "Language",
      languageHelp: "Updates the interface shell and core product language.",
      appearance: "Appearance",
      appearanceHelp: "Follow your device or choose light or dark.",
      motion: "Motion",
      motionHelp: "Purposeful transitions, never required to understand status.",
      sound: "Sound feedback",
      soundHelp: "Original synthesized SONARA tones. Off by default.",
      haptics: "Tactile feedback",
      hapticsHelp: "Uses device vibration only where the browser supports it.",
      on: "On",
      off: "Off",
      system: "System",
      light: "Light",
      dark: "Dark"
    },
    es: {
      platform: "Plataforma", forge: "SONARA Forge", canvas: "SONARA Canvas", signal: "SONARA Signal", tools: "Herramientas gratis", pricing: "Precios", support: "Soporte", login: "Iniciar sesión", start: "Comenzar gratis", menu: "Menú", command: "Comandos", experience: "Experiencia",
      heroEyebrow: "Sistema operativo adaptable", heroHeading: "Haz que el trabajo avance.", heroBody: "Da forma al negocio, crea el lanzamiento, llega a la audiencia y mantén cada siguiente acción conectada en una capa operativa rápida.", primaryAction: "Entrar a SONARA Nexus", secondaryAction: "Explorar herramientas gratis", tertiaryAction: "Ver planes",
      productsKicker: "Tres modos operativos", productsHeading: "Un sistema. Tres formas de avanzar.", productsBody: "Cada espacio tiene su propio ritmo, registros y herramientas, mientras identidad, facturación, soporte y entrega siguen conectados.",
      flowKicker: "Diseñado para el impulso", flowHeading: "De la intención al resultado sin perder el contexto.", proofKicker: "Verdad operativa en vivo", proofHeading: "Rápido cuando puede. Claro cuando falta configuración.", ctaKicker: "Empieza con la siguiente acción útil", ctaHeading: "Construye algo real antes de añadir complejidad.",
      close: "Cerrar", searchPlaceholder: "Buscar páginas y acciones", settingsTitle: "Ajustes de experiencia", language: "Idioma", languageHelp: "Actualiza la interfaz y el lenguaje principal del producto.", appearance: "Apariencia", appearanceHelp: "Sigue tu dispositivo o elige claro u oscuro.", motion: "Movimiento", motionHelp: "Transiciones útiles, nunca necesarias para entender el estado.", sound: "Sonido", soundHelp: "Tonos originales sintetizados de SONARA. Desactivados por defecto.", haptics: "Respuesta táctil", hapticsHelp: "Usa vibración solo cuando el navegador la admite.", on: "Activado", off: "Desactivado", system: "Sistema", light: "Claro", dark: "Oscuro"
    },
    fr: {
      platform: "Plateforme", forge: "SONARA Forge", canvas: "SONARA Canvas", signal: "SONARA Signal", tools: "Outils gratuits", pricing: "Tarifs", support: "Assistance", login: "Connexion", start: "Commencer gratuitement", menu: "Menu", command: "Commande", experience: "Expérience",
      heroEyebrow: "Système d’exploitation adaptatif", heroHeading: "Faites avancer le travail.", heroBody: "Structurez l’activité, créez la sortie, atteignez le public et gardez chaque prochaine action connectée dans une couche opérationnelle rapide.", primaryAction: "Entrer dans SONARA Nexus", secondaryAction: "Explorer les outils gratuits", tertiaryAction: "Voir les offres",
      productsKicker: "Trois modes opératoires", productsHeading: "Un système. Trois façons d’avancer.", productsBody: "Chaque espace possède son rythme, ses données et ses outils, tandis que l’identité, la facturation, l’assistance et la livraison restent connectées.",
      flowKicker: "Conçu pour l’élan", flowHeading: "De l’intention au résultat sans perdre le contexte.", proofKicker: "Vérité opérationnelle en direct", proofHeading: "Rapide quand c’est possible. Clair lorsqu’une configuration est requise.", ctaKicker: "Commencez par la prochaine action utile", ctaHeading: "Construisez quelque chose de réel avant d’ajouter de la complexité.",
      close: "Fermer", searchPlaceholder: "Rechercher des pages et des actions", settingsTitle: "Réglages de l’expérience", language: "Langue", languageHelp: "Met à jour l’interface et le langage principal du produit.", appearance: "Apparence", appearanceHelp: "Suivez l’appareil ou choisissez clair ou sombre.", motion: "Animation", motionHelp: "Des transitions utiles, jamais nécessaires pour comprendre l’état.", sound: "Retour sonore", soundHelp: "Tonalités SONARA originales et synthétisées. Désactivées par défaut.", haptics: "Retour tactile", hapticsHelp: "Utilise la vibration uniquement si le navigateur la prend en charge.", on: "Activé", off: "Désactivé", system: "Système", light: "Clair", dark: "Sombre"
    },
    de: {
      platform: "Plattform", forge: "SONARA Forge", canvas: "SONARA Canvas", signal: "SONARA Signal", tools: "Kostenlose Tools", pricing: "Preise", support: "Support", login: "Anmelden", start: "Kostenlos starten", menu: "Menü", command: "Befehl", experience: "Erlebnis",
      heroEyebrow: "Adaptives Betriebssystem", heroHeading: "Arbeit in Bewegung bringen.", heroBody: "Geschäft formen, Veröffentlichung erstellen, Zielgruppen erreichen und jeden nächsten Schritt in einer schnellen Betriebsebene verbinden.", primaryAction: "SONARA Nexus öffnen", secondaryAction: "Kostenlose Tools erkunden", tertiaryAction: "Pläne ansehen",
      productsKicker: "Drei Betriebsmodi", productsHeading: "Ein System. Drei Wege vorwärts.", productsBody: "Jeder Arbeitsbereich hat seinen eigenen Rhythmus, seine Daten und Werkzeuge; Identität, Abrechnung, Support und Lieferung bleiben verbunden.",
      flowKicker: "Für Dynamik entwickelt", flowHeading: "Von der Absicht zum Ergebnis, ohne Kontext zu verlieren.", proofKicker: "Operative Wahrheit in Echtzeit", proofHeading: "Schnell, wenn möglich. Klar, wenn Einrichtung nötig ist.", ctaKicker: "Mit dem nächsten nützlichen Schritt beginnen", ctaHeading: "Etwas Echtes bauen, bevor Komplexität hinzukommt.",
      close: "Schließen", searchPlaceholder: "Seiten und Aktionen durchsuchen", settingsTitle: "Erlebniseinstellungen", language: "Sprache", languageHelp: "Aktualisiert Oberfläche und zentrale Produktsprache.", appearance: "Darstellung", appearanceHelp: "Geräteeinstellung verwenden oder Hell/Dunkel wählen.", motion: "Bewegung", motionHelp: "Zweckmäßige Übergänge, nie erforderlich zum Verstehen des Status.", sound: "Klangfeedback", soundHelp: "Originale synthetisierte SONARA-Töne. Standardmäßig aus.", haptics: "Haptisches Feedback", hapticsHelp: "Verwendet Vibration nur, wenn der Browser sie unterstützt.", on: "An", off: "Aus", system: "System", light: "Hell", dark: "Dunkel"
    }
  };

  const exactVisibleReplacements = new Map([
    ["Business Builder", "SONARA Forge"],
    ["Creator Studio", "SONARA Canvas"],
    ["Growth Studio", "SONARA Signal"],
    ["Build. Create. Grow.", "Make work move."],
    ["Build what matters.", "Make work move."]
  ]);

  let preferences = loadPreferences();
  let audioContext;
  let commandItems = [];

  function loadPreferences() {
    try {
      return { ...defaultPreferences, ...JSON.parse(localStorage.getItem(storageKey) || "{}") };
    } catch {
      return { ...defaultPreferences };
    }
  }

