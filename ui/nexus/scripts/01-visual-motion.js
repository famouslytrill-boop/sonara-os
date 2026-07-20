  function savePreferences() {
    try { localStorage.setItem(storageKey, JSON.stringify(preferences)); } catch {}
  }

  function resolveTheme(value) {
    if (value === "light" || value === "dark") return value;
    return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
  }

  function applyPreferences() {
    const language = dictionaries[preferences.language] ? preferences.language : "en";
    root.lang = language;
    root.dir = "ltr";
    root.dataset.theme = resolveTheme(preferences.theme);
    root.dataset.nexusMotion = preferences.motion;
    root.dataset.nexusSound = preferences.sound;
    root.dataset.nexusHaptics = preferences.haptics;
    applyTranslations(language);
    syncSettingsControls();
  }

  function applyTranslations(language) {
    const dictionary = dictionaries[language] || dictionaries.en;
    document.querySelectorAll("[data-i18n]").forEach((element) => {
      const key = element.getAttribute("data-i18n");
      if (!key || !dictionary[key]) return;
      if (element instanceof HTMLInputElement && element.type === "search") element.placeholder = dictionary[key];
      else element.textContent = dictionary[key];
    });
  }

  function replaceLegacyVisibleNames() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || ["SCRIPT", "STYLE", "CODE", "PRE", "TEXTAREA"].includes(parent.tagName)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      const raw = node.nodeValue || "";
      const trimmed = raw.trim();
      if (exactVisibleReplacements.has(trimmed)) {
        node.nodeValue = raw.replace(trimmed, exactVisibleReplacements.get(trimmed));
      } else {
        let value = raw;
        value = value.replace(/\bBusiness Builder\b/g, "SONARA Forge");
        value = value.replace(/\bCreator Studio\b/g, "SONARA Canvas");
        value = value.replace(/\bGrowth Studio\b/g, "SONARA Signal");
        node.nodeValue = value;
      }
    }
  }

  function buildHeroVisual() {
    if (!document.body.classList.contains("sonara-home-v3")) return;
    const hero = document.querySelector(".hero.sonara-hero-stage");
    if (!hero || hero.querySelector(".nexus-hero-visual")) return;
    const visual = document.createElement("div");
    visual.className = "nexus-hero-visual";
    visual.setAttribute("aria-hidden", "true");
    visual.innerHTML = `
      <div class="nexus-orbit" data-nexus-parallax>
        <span class="nexus-ring"></span><span class="nexus-ring"></span><span class="nexus-ring"></span>
        <span class="nexus-node nexus-node--forge"></span><span class="nexus-node nexus-node--canvas"></span><span class="nexus-node nexus-node--signal"></span>
        <span class="nexus-orbit-label nexus-orbit-label--forge">Forge</span>
        <span class="nexus-orbit-label nexus-orbit-label--canvas">Canvas</span>
        <span class="nexus-orbit-label nexus-orbit-label--signal">Signal</span>
        <span class="nexus-orbit-floor"></span>
      </div>`;
    hero.append(visual);
  }

  function prepareRevealMotion() {
    const targets = document.querySelectorAll("main > section:not(.hero), .nexus-section, .card, .nexus-product, .sonara-product-card");
    targets.forEach((target) => target.setAttribute("data-nexus-reveal", ""));
    if (preferences.motion === "off" || reducedMotion || !("IntersectionObserver" in window)) {
      targets.forEach((target) => target.classList.add("is-visible"));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    }, { rootMargin: "0px 0px -8%", threshold: .08 });
    targets.forEach((target) => observer.observe(target));
  }

  function prepareParallax() {
    const target = document.querySelector("[data-nexus-parallax]");
    if (!target || preferences.motion === "off" || reducedMotion || window.innerWidth < 920) return;
    let frame = 0;
    window.addEventListener("pointermove", (event) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        const x = (event.clientX / window.innerWidth - .5) * 8;
        const y = (event.clientY / window.innerHeight - .5) * -7;
        target.style.transform = `rotateX(${y}deg) rotateY(${x}deg)`;
        frame = 0;
      });
    }, { passive: true });
