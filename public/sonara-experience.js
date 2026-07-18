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
    "/login",
    "/signup",
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

  function scheduleServiceWorkerRegistration() {
    if (!canRegisterServiceWorker() || !isPublicPwaPage(window.location.pathname)) return;

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .then((registration) => {
          registration.update().catch(() => undefined);
          registration.addEventListener("updatefound", () => {
            const worker = registration.installing;
            if (!worker) return;
            worker.addEventListener("statechange", () => {
              if (worker.state === "installed" && navigator.serviceWorker.controller) {
                notify("Update ready", "Refresh when convenient to use the latest SONARA interface.");
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
