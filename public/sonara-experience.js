// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
(() => {
  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const params = new URLSearchParams(window.location.search);
  const PUBLIC_PWA_PATHS = new Set([
    "/",
    "/start",
    "/products",
    "/service-catalog",
    "/free-tools",
    "/pricing",
    "/how-it-works",
    "/tutorials",
    "/help",
    "/docs",
    "/contact",
    "/security",
    "/accessibility",
    // Login/signup remain outside service-worker registration and navigation.
    "/offline",
    "/business-builder",
    "/creator-studio",
    "/growth-studio"
  ]);

  function notify(title, message) {
    const toast = document.createElement("div");
    toast.className = "sonara-toast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    toast.innerHTML = "<strong>" + clean(title) + "</strong><span>" + clean(message) + "</span>";
    document.body.appendChild(toast);
    window.setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(8px)";
      window.setTimeout(() => toast.remove(), 260);
    }, 5200);
  }

  function isPublicPwaPage(pathname) {
    return PUBLIC_PWA_PATHS.has(pathname) || pathname.startsWith("/legal/");
  }

  function canRegisterServiceWorker() {
    const hostname = window.location.hostname;
    const localDevelopment = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
    return Boolean("serviceWorker" in navigator && (window.isSecureContext || localDevelopment));
  }

  // A prepared update does not mean an active form can safely be reloaded.
  // The update stays ready until the customer applies it or closes old tabs.
  let updateNoticeVisible = false;
  function showUpdateReady(registration) {
    if (updateNoticeVisible || !registration.waiting || !navigator.serviceWorker.controller) return;
    updateNoticeVisible = true;

    const notice = document.createElement("div");
    notice.className = "sonara-toast";
    notice.setAttribute("role", "status");
    notice.setAttribute("aria-live", "polite");
    const message = document.createElement("span");
    message.textContent = "A SONARA update is ready. Save your work before applying it.";
    const button = document.createElement("button");
    button.className = "action";
    button.type = "button";
    button.textContent = "Apply update";
    notice.appendChild(message);
    notice.appendChild(button);
    document.body.appendChild(notice);

    button.addEventListener("click", () => {
      // A conservative guard: forms and editors may hold unsaved content,
      // including values filled by password managers without input events.
      const editable = document.querySelector("form input:not([type=hidden]), form textarea, form select, [contenteditable=true]");
      if (editable && !window.confirm("Applying this update reloads the page. Save or copy any unfinished work first. Apply now?")) return;
      const waiting = registration.waiting;
      if (!waiting) {
        message.textContent = "The update has changed. Reload the page when convenient.";
        button.disabled = true;
        return;
      }
      button.disabled = true;
      message.textContent = "Applying your update…";
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        window.location.reload();
      }, { once: true });
      try {
        waiting.postMessage({ type: "SKIP_WAITING" });
      } catch {
        message.textContent = "Could not apply the update. Reload or try again later.";
        button.disabled = false;
      }
    });
  }

  function scheduleServiceWorkerRegistration() {
    if (!canRegisterServiceWorker() || !isPublicPwaPage(window.location.pathname)) return;

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .then((registration) => {
          showUpdateReady(registration);
          registration.update().catch(() => undefined);
          // Long-lived tabs check only on foreground return; no polling timer,
          // network loop, or background battery drain.
          let lastCheckedAt = Date.now();
          document.addEventListener("visibilitychange", () => {
            if (document.visibilityState !== "visible" || Date.now() - lastCheckedAt < 60 * 60 * 1000) return;
            lastCheckedAt = Date.now();
            registration.update().catch(() => undefined);
          });
          registration.addEventListener("updatefound", () => {
            const worker = registration.installing;
            if (!worker) return;
            worker.addEventListener("statechange", () => {
              if (worker.state === "installed" && navigator.serviceWorker.controller) {
                window.setTimeout(() => showUpdateReady(registration), 0);
              }
            });
          });
        })
        .catch(() => undefined);
    };

    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(register, { timeout: 3000 });
    } else {
      window.addEventListener("load", () => window.setTimeout(register, 0), { once: true });
    }
  }

  if (params.get("account") === "created") {
    notify("Account created", "You are signed in. Choose Business Builder, Creator Studio, or Growth Studio to start working.");
    if (history.replaceState) history.replaceState(null, "", window.location.pathname);
  }

  if (!reduceMotion) {
    document.querySelectorAll(".card").forEach((card, index) => {
      card.style.opacity = "0";
      card.style.transform = "translateY(12px)";
      card.style.transition = "opacity .34s ease, transform .34s ease";
      window.setTimeout(() => {
        card.style.opacity = "1";
        card.style.transform = "translateY(0)";
      }, 70 + index * 38);
    });
  }

  scheduleServiceWorkerRegistration();
  document.documentElement.classList.add("sonara-js-ready");

  function clean(value) {
    return String(value || "").replace(/[&<>]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[char]);
  }
})();
