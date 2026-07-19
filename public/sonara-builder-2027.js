(() => {
  "use strict";

  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
  const finePointer = window.matchMedia?.("(pointer: fine)")?.matches ?? false;
  const body = document.body;
  const header = document.querySelector("body > header");
  const root = document.querySelector("[data-sonara-builder]");

  body.classList.add("sonara-builder-ui");

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function safeStorageGet(key) {
    try { return window.localStorage.getItem(key); } catch { return null; }
  }

  function safeStorageSet(key, value) {
    try { window.localStorage.setItem(key, String(value)); } catch { /* Storage can be unavailable in restricted contexts. */ }
  }

  function addMobileNavigation() {
    if (!header || header.querySelector(".sonara-builder-menu-toggle")) return;
    const navigation = header.querySelector('nav[aria-label="Primary"]');
    if (!navigation) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "sonara-builder-menu-toggle";
    button.setAttribute("aria-label", "Open navigation");
    button.setAttribute("aria-expanded", "false");
    navigation.id ||= "sonara-primary-navigation";
    button.setAttribute("aria-controls", navigation.id);
    header.append(button);

    button.addEventListener("click", () => {
      const open = header.dataset.builderMenuOpen === "true";
      header.dataset.builderMenuOpen = String(!open);
      button.setAttribute("aria-expanded", String(!open));
      button.setAttribute("aria-label", open ? "Open navigation" : "Close navigation");
    });

    navigation.addEventListener("click", (event) => {
      if (!event.target.closest("a")) return;
      header.dataset.builderMenuOpen = "false";
      button.setAttribute("aria-expanded", "false");
      button.setAttribute("aria-label", "Open navigation");
    });

    document.addEventListener("click", (event) => {
      if (header.contains(event.target)) return;
      header.dataset.builderMenuOpen = "false";
      button.setAttribute("aria-expanded", "false");
      button.setAttribute("aria-label", "Open navigation");
    });
  }

  function addScrollProgress() {
    const progress = document.createElement("div");
    progress.setAttribute("aria-hidden", "true");
    Object.assign(progress.style, {
      position: "fixed",
      inset: "0 auto auto 0",
      zIndex: "250",
      width: "0%",
      height: "3px",
      background: "linear-gradient(90deg,var(--builder-violet),var(--builder-coral),var(--builder-cyan))",
      pointerEvents: "none",
      transition: reduceMotion ? "none" : "width 80ms linear"
    });
    document.body.append(progress);

    let frame = 0;
    const update = () => {
      frame = 0;
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      progress.style.width = `${Math.min(100, Math.max(0, window.scrollY / max * 100))}%`;
    };
    window.addEventListener("scroll", () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    }, { passive: true });
    window.addEventListener("resize", update, { passive: true });
    update();
  }

  function addRouteTransitions() {
    if (reduceMotion || typeof document.startViewTransition !== "function") return;
    document.addEventListener("click", (event) => {
      const anchor = event.target.closest("a[href]");
      if (!anchor || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || url.hash || anchor.target || anchor.hasAttribute("download")) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      event.preventDefault();
      document.startViewTransition(() => { window.location.href = url.href; });
    });
  }

  function addRevealObserver() {
    if (reduceMotion || !("IntersectionObserver" in window)) return;
    const candidates = document.querySelectorAll(
      ".sonara-builder-system > section, body.sonara-standard-page .hero, body.sonara-standard-page .grid > .card, body.sonara-admin .grid > .card"
    );
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.animate(
          [{ opacity: .25, transform: "translateY(22px)" }, { opacity: 1, transform: "none" }],
          { duration: 620, easing: "cubic-bezier(.2,.78,.2,1)", fill: "both" }
        );
        observer.unobserve(entry.target);
      });
    }, { threshold: .07, rootMargin: "0px 0px -7% 0px" });
    candidates.forEach((candidate) => observer.observe(candidate));
  }

  function addCardIndices() {
    document.querySelectorAll("body.sonara-standard-page .grid > .card, body.sonara-admin .grid > .card").forEach((card, index) => {
      if (card.querySelector("[data-builder-card-index]")) return;
      const marker = document.createElement("span");
      marker.dataset.builderCardIndex = "";
      marker.textContent = String(index + 1).padStart(2, "0");
      Object.assign(marker.style, {
        display: "block",
        marginBottom: "24px",
        color: "var(--builder-accent)",
        fontFamily: "var(--mono)",
        fontSize: "10px",
        fontWeight: "800",
        letterSpacing: ".12em"
      });
      card.prepend(marker);
    });
  }

  function addPointerDepth() {
    if (!finePointer || reduceMotion) return;
    const stage = document.querySelector(".sonara-builder-live-canvas") || document.querySelector(".sonara-home-v3 .sonara-interface-face");
    if (!stage) return;
    stage.addEventListener("pointermove", (event) => {
      const rect = stage.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width - .5) * 3.4;
      const y = ((event.clientY - rect.top) / rect.height - .5) * -2.1;
      stage.style.transform = `perspective(1600px) rotateY(${(-3 + x).toFixed(2)}deg) rotateX(${(1.2 + y).toFixed(2)}deg)`;
    }, { passive: true });
    stage.addEventListener("pointerleave", () => { stage.style.transform = ""; }, { passive: true });
  }

  if (root) {
    const productPanel = root.querySelector("#sonara-builder-product-panel");
    const productTabs = [...root.querySelectorAll("[data-builder-product]")];
    const roleButtons = [...root.querySelectorAll("[data-builder-role]")];
    const milestoneButtons = [...root.querySelectorAll("[data-sonara-milestone]")];
    const toast = root.querySelector("[data-sonara-builder-toast]");
    let toastTimer = 0;

    const products = {
      "business-builder": {
        index: 0,
        name: "Business Builder",
        action: "Launch and operate",
        description: "Create the offer, connect records, publish the customer path, verify payment readiness, and run the business through one guided workflow.",
        route: "/business-builder",
        primaryRoute: "/business-builder/launch-readiness",
        logo: "/brand/business-builder-mark.svg",
        milestones: ["Identity", "Offer", "Records", "Customer path"]
      },
      "creator-studio": {
        index: 1,
        name: "Creator Studio",
        action: "Create and release",
        description: "Organize assets, rights notes, offers, release planning, monetization readiness, and creator records in one connected studio.",
        route: "/creator-studio",
        primaryRoute: "/creator-studio/assets",
        logo: "/brand/creator-studio-mark.svg",
        milestones: ["Assets", "Rights", "Offer", "Release"]
      },
      "growth-studio": {
        index: 2,
        name: "Growth Studio",
        action: "Understand and grow",
        description: "Turn campaigns, leads, reviews, referrals, and consent-safe customer signals into explainable next actions.",
        route: "/growth-studio",
        primaryRoute: "/growth-studio/campaigns",
        logo: "/brand/growth-studio-mark.svg",
        milestones: ["Goal", "Audience", "Campaign", "Review"]
      }
    };

    const roleContent = {
      founder: {
        title: "Your next launch move",
        action: "Complete the organization boundary",
        copy: "Create the durable account and membership records required before customer and payment activity becomes authoritative."
      },
      creator: {
        title: "Your next release move",
        action: "Organize the release package",
        copy: "Connect assets, rights notes, offers, and release milestones before publishing or monetizing the work."
      },
      team: {
        title: "Your next operating move",
        action: "Align roles and shared records",
        copy: "Give each person the correct access while customer, payment, support, and approval records stay organization-scoped."
      }
    };

    const launchSteps = [
      { label: "FOUNDATION", title: "Give the business a clear identity.", copy: "Name the organization, define who it serves, and create the first clear customer promise.", evidence: ["Organization identity", "Audience definition", "Customer promise"] },
      { label: "VALUE", title: "Turn the promise into a real offer.", copy: "Define the outcome, scope, price, proof, and responsible customer next action.", evidence: ["Offer record", "Scope and price", "Proof requirements"] },
      { label: "DURABILITY", title: "Connect records and access.", copy: "Create the organization boundary, owner membership, and durable records required for saved work.", evidence: ["Organization membership", "Access boundary", "Durable records"] },
      { label: "CONVERSION", title: "Publish a usable customer path.", copy: "Connect contact, intake, booking, support, and offer routes so interest becomes a real interaction.", evidence: ["Contact path", "Intake route", "Support route"] },
      { label: "COMMERCE", title: "Verify payment and delivery.", copy: "Use configured checkout, signed provider updates, persisted entitlement, and a visible delivery process.", evidence: ["Checkout entry", "Signed update", "Delivery workflow"] },
      { label: "TRUST", title: "Review launch readiness honestly.", copy: "Separate configured, missing, deferred, owner-approved, and qualified-review states before launch.", evidence: ["Readiness evidence", "Owner approval", "Open review boundaries"] },
      { label: "MOMENTUM", title: "Operate, learn, and grow.", copy: "Keep customers, completed work, reviews, referrals, and next actions connected to the decisions that created them.", evidence: ["Customer activity", "Proof workflow", "Next actions"] }
    ];

    function announce(message) {
      if (!toast) return;
      window.clearTimeout(toastTimer);
      toast.textContent = message;
      toast.hidden = false;
      if (!reduceMotion && toast.animate) {
        toast.animate(
          [{ opacity: 0, transform: "translate(-50%, 10px)" }, { opacity: 1, transform: "translate(-50%, 0)" }],
          { duration: 230, easing: "cubic-bezier(.18,1.35,.32,1)" }
        );
      }
      toastTimer = window.setTimeout(() => { toast.hidden = true; }, 2400);
    }

    function renderProduct(product) {
      if (!productPanel || !product) return;
      productPanel.innerHTML = `<div class="sonara-builder-product-copy">
        <span>0${product.index + 1} / ${escapeHtml(product.name.toUpperCase())}</span>
        <h3>${escapeHtml(product.description)}</h3>
        <p>Open the real workflow, save work to the organization boundary, and keep billing, support, approvals, and evidence connected.</p>
        <div class="sonara-builder-inline-actions"><a class="action" href="${escapeHtml(product.route)}">Explore ${escapeHtml(product.name)}</a><a class="action" href="${escapeHtml(product.primaryRoute)}">Open first workflow</a></div>
      </div>
      <div class="sonara-builder-workspace-preview" aria-label="${escapeHtml(product.name)} workspace preview">
        <div class="sonara-builder-preview-top"><span><img src="${escapeHtml(product.logo)}" width="34" height="34" alt="">${escapeHtml(product.name)}</span><b>Connected workspace</b></div>
        <div class="sonara-builder-preview-summary"><div class="sonara-builder-progress-orbit" aria-hidden="true"><i></i><strong>${product.milestones.length}</strong><small>steps</small></div><div><small>NEXT RESPONSIBLE ACTION</small><strong>${escapeHtml(product.action)}</strong><p>${escapeHtml(product.description)}</p></div></div>
        <ol>${product.milestones.map((milestone, index) => `<li><span>0${index + 1}</span><div><strong>${escapeHtml(milestone)}</strong><small>${index === 0 ? "Ready to begin" : "Opens with context"}</small></div><b>${index === 0 ? "→" : "○"}</b></li>`).join("")}</ol>
      </div>`;
      root.dataset.sonaraProductCurrent = product.name.toLowerCase().replaceAll(" ", "-");
      const accent = product.index === 1 ? "var(--builder-coral)" : product.index === 2 ? "var(--builder-cyan)" : "var(--builder-violet)";
      const accentSoft = product.index === 1 ? "var(--builder-coral-soft)" : product.index === 2 ? "var(--builder-cyan-soft)" : "var(--builder-violet-soft)";
      root.style.setProperty("--builder-accent", accent);
      root.style.setProperty("--builder-accent-soft", accentSoft);
      if (!reduceMotion && productPanel.animate) {
        productPanel.animate(
          [{ opacity: .5, transform: "translateY(14px) scale(.994)" }, { opacity: 1, transform: "none" }],
          { duration: 430, easing: "cubic-bezier(.2,.78,.2,1)" }
        );
      }
    }

    productTabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const product = products[tab.dataset.builderProduct];
        if (!product) return;
        productTabs.forEach((candidate) => candidate.setAttribute("aria-selected", String(candidate === tab)));
        productPanel?.setAttribute("aria-labelledby", tab.id);
        renderProduct(product);
        announce(`${product.name} selected.`);
      });
      tab.addEventListener("keydown", (event) => {
        if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const current = productTabs.indexOf(tab);
        const next = event.key === "Home" ? 0 : event.key === "End" ? productTabs.length - 1 : (current + (event.key === "ArrowRight" ? 1 : -1) + productTabs.length) % productTabs.length;
        productTabs[next].focus();
        productTabs[next].click();
      });
    });

    roleButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const role = roleContent[button.dataset.builderRole];
        if (!role) return;
        roleButtons.forEach((candidate) => candidate.setAttribute("aria-pressed", String(candidate === button)));
        root.querySelector("[data-builder-role-title]").textContent = role.title;
        root.querySelector("[data-builder-role-action]").textContent = role.action;
        root.querySelector("[data-builder-role-copy]").textContent = role.copy;
        safeStorageSet("sonara-marketing-role", button.dataset.builderRole);
        announce(`Experience updated for ${button.textContent.trim()}.`);
      });
    });

    milestoneButtons.forEach((button, index) => {
      button.addEventListener("click", () => {
        const step = launchSteps[index];
        if (!step) return;
        milestoneButtons.forEach((candidate) => candidate.setAttribute("aria-pressed", String(candidate === button)));
        root.querySelector("[data-sonara-step-label]").textContent = step.label;
        root.querySelector("[data-sonara-step-title]").textContent = step.title;
        root.querySelector("[data-sonara-step-copy]").textContent = step.copy;
        const evidence = root.querySelector(".sonara-builder-step-evidence ul");
        if (evidence) evidence.innerHTML = step.evidence.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
        announce(`${button.textContent.trim()} milestone selected.`);
      });
    });

    const savedRole = safeStorageGet("sonara-marketing-role");
    root.querySelector(`[data-builder-role="${savedRole}"]`)?.click();
  }

  addMobileNavigation();
  addScrollProgress();
  addRouteTransitions();
  addRevealObserver();
  addCardIndices();
  addPointerDepth();
})();
