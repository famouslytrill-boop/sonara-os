(() => {
  "use strict";

  const shell = document.querySelector("[data-sonara-cohesive]");
  if (!shell) return;

  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
  const productPanel = shell.querySelector("#sonara-product-panel");
  const productTabs = [...shell.querySelectorAll("[data-sonara-product]")];
  const milestoneButtons = [...shell.querySelectorAll("[data-sonara-milestone]")];
  const toast = shell.querySelector("[data-sonara-cohesive-toast]");
  let toastTimer;

  const products = {
    "business-builder": {
      index: "01 / BUSINESS BUILDER",
      name: "Business Builder",
      action: "Launch and operate",
      description: "Create the offer, connect records, publish the customer path, verify payment readiness, and run the business through one guided workflow.",
      route: "/business-builder",
      primaryRoute: "/business-builder/launch-readiness",
      logo: "/brand/business-builder-mark.svg",
      milestones: ["Identity", "Offer", "Records", "Customer path"]
    },
    "creator-studio": {
      index: "02 / CREATOR STUDIO",
      name: "Creator Studio",
      action: "Create and release",
      description: "Organize assets, rights notes, offers, release planning, monetization readiness, and creator records in one connected studio.",
      route: "/creator-studio",
      primaryRoute: "/creator-studio/assets",
      logo: "/brand/creator-studio-mark.svg",
      milestones: ["Assets", "Rights", "Offer", "Release"]
    },
    "growth-studio": {
      index: "03 / GROWTH STUDIO",
      name: "Growth Studio",
      action: "Understand and grow",
      description: "Turn campaigns, leads, reviews, referrals, and consent-safe customer signals into explainable next actions.",
      route: "/growth-studio",
      primaryRoute: "/growth-studio/campaigns",
      logo: "/brand/growth-studio-mark.svg",
      milestones: ["Goal", "Audience", "Campaign", "Review"]
    }
  };

  const launchSteps = [
    { label: "FOUNDATION", title: "Give the business a clear identity.", copy: "Name the organization, define who it serves, and create the first clear customer promise." },
    { label: "VALUE", title: "Turn the promise into a real offer.", copy: "Define the customer outcome, scope, price, proof, and responsible next action." },
    { label: "DURABILITY", title: "Connect records and access.", copy: "Create the organization boundary, owner membership, and durable records needed for saved work." },
    { label: "CONVERSION", title: "Publish a usable customer path.", copy: "Connect contact, intake, booking, support, and offer routes so interest can become a real interaction." },
    { label: "COMMERCE", title: "Verify payment and delivery.", copy: "Use configured checkout, signed provider updates, persisted entitlement, and a visible delivery process." },
    { label: "TRUST", title: "Review launch readiness honestly.", copy: "Separate configured, missing, deferred, owner-approved, and qualified-review states before launch." },
    { label: "MOMENTUM", title: "Operate, learn, and grow.", copy: "Keep customers, completed work, reviews, referrals, and next actions connected to the decisions that created them." }
  ];

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function announce(message) {
    if (!toast) return;
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.hidden = false;
    if (!reduceMotion && toast.animate) {
      toast.animate(
        [{ opacity: 0, transform: "translate(-50%, 10px)" }, { opacity: 1, transform: "translate(-50%, 0)" }],
        { duration: 220, easing: "cubic-bezier(.2,.78,.2,1)" }
      );
    }
    toastTimer = window.setTimeout(() => { toast.hidden = true; }, 2400);
  }

  function renderProduct(product) {
    if (!productPanel || !product) return;
    productPanel.innerHTML = `<div class="sonara-cohesive-product-copy">
      <span>${escapeHtml(product.index)}</span>
      <h3>${escapeHtml(product.description)}</h3>
      <p>Use one account, one trusted organization boundary, and one visible path from setup to real saved work.</p>
      <div class="sonara-cohesive-product-actions"><a class="action" href="${escapeHtml(product.route)}">Explore product</a><a class="action" href="${escapeHtml(product.primaryRoute)}">Open first workflow</a></div>
    </div>
    <div class="sonara-cohesive-product-preview" aria-label="${escapeHtml(product.name)} workflow preview">
      <div class="sonara-cohesive-preview-bar"><span>${escapeHtml(product.name)}</span><b>Connected workspace</b></div>
      <div class="sonara-cohesive-preview-focus"><img src="${escapeHtml(product.logo)}" width="76" height="76" alt=""><div><small>NEXT RESPONSIBLE ACTION</small><strong>${escapeHtml(product.action)}</strong><p>${escapeHtml(product.description)}</p></div></div>
      <ol>${product.milestones.map((milestone, index) => `<li><span>0${index + 1}</span><strong>${escapeHtml(milestone)}</strong><small>${index === 0 ? "Ready to begin" : "Opens with context"}</small></li>`).join("")}</ol>
    </div>`;
    shell.dataset.sonaraProductCurrent = product.name.toLowerCase().replaceAll(" ", "-");
    if (!reduceMotion && productPanel.animate) {
      productPanel.animate(
        [{ opacity: .55, transform: "translateY(12px) scale(.995)" }, { opacity: 1, transform: "none" }],
        { duration: 380, easing: "cubic-bezier(.2,.78,.2,1)" }
      );
    }
  }

  productTabs.forEach((tab, tabIndex) => {
    tab.addEventListener("click", () => {
      const product = products[tab.dataset.sonaraProduct];
      if (!product) return;
      productTabs.forEach((candidate) => candidate.setAttribute("aria-selected", String(candidate === tab)));
      productPanel?.setAttribute("aria-labelledby", tab.id || `sonara-product-tab-${tabIndex}`);
      renderProduct(product);
      announce(`${product.name} selected.`);
    });
  });

  milestoneButtons.forEach((button, index) => {
    button.addEventListener("click", () => {
      const step = launchSteps[index];
      if (!step) return;
      milestoneButtons.forEach((candidate) => candidate.setAttribute("aria-pressed", String(candidate === button)));
      shell.querySelector("[data-sonara-step-label]").textContent = step.label;
      shell.querySelector("[data-sonara-step-title]").textContent = step.title;
      shell.querySelector("[data-sonara-step-copy]").textContent = step.copy;
      announce(`${button.textContent.trim()} milestone selected.`);
    });
  });

  if (window.matchMedia?.("(pointer: fine)")?.matches && !reduceMotion) {
    const interfaceFace = document.querySelector(".sonara-home-v3 .sonara-interface-face");
    interfaceFace?.addEventListener("pointermove", (event) => {
      const rect = interfaceFace.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width - .5) * 2.3;
      const y = ((event.clientY - rect.top) / rect.height - .5) * -1.4;
      interfaceFace.style.transform = `perspective(1400px) rotateY(${(-3.25 + x).toFixed(2)}deg) rotateX(${(1.3 + y).toFixed(2)}deg)`;
    }, { passive: true });
    interfaceFace?.addEventListener("pointerleave", () => { interfaceFace.style.transform = ""; }, { passive: true });
  }
})();
