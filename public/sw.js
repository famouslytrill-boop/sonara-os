// SONARA public-site service worker.
// The cache version stays aligned with the rendered ?v= asset token. Only
// public navigation and non-sensitive same-origin assets are handled here.
// Static assets use stale-while-revalidate; public navigations use network-first.
const VERSION = "clark-ui-20260718-preferences";
const CACHE_PREFIX = "sonara-public-";
const CACHE_NAME = CACHE_PREFIX + VERSION;
const OFFLINE_URL = "/offline";
const PUBLIC_NAVIGATION_PATHS = new Set([
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
  OFFLINE_URL,
  "/business-builder",
  "/creator-studio",
  "/growth-studio"
]);
const PUBLIC_STAGE = [
  OFFLINE_URL,
  "/site.webmanifest",
  "/favicon.svg",
  "/brand/sonara-industries-mark.svg",
  "/sonara-brand-system.css?v=" + VERSION,
  "/sonara-friendly-premium.css?v=" + VERSION,
  "/sonara-interface-engine.css?v=" + VERSION,
  "/sonara-launch-ui.css?v=" + VERSION,
  "/sonara-experience.js?v=" + VERSION,
  "/sonara-interface-engine.js?v=" + VERSION
];
const STATIC_PATTERN = /\.(css|js|svg|png|ico|webmanifest)$/;

function isPublicNavigation(pathname) {
  return PUBLIC_NAVIGATION_PATHS.has(pathname) || pathname.startsWith("/legal/");
}

function isCacheableResponse(response) {
  if (!response || !response.ok || response.type === "opaque") return false;
  const cacheControl = response.headers.get("cache-control") || "";
  return !/(private|no-store)/i.test(cacheControl) && !response.headers.has("set-cookie");
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.add(OFFLINE_URL);
      await Promise.allSettled(
        PUBLIC_STAGE.filter((url) => url !== OFFLINE_URL).map((url) => cache.add(url))
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === "navigate") {
    if (!isPublicNavigation(url.pathname)) return;
    event.respondWith(
      fetch(event.request, { cache: "no-store" }).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  if (url.pathname === "/sw.js" || !STATIC_PATTERN.test(url.pathname)) return;

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(event.request).then((cached) => {
        const refresh = fetch(event.request)
          .then((response) => {
            if (isCacheableResponse(response)) cache.put(event.request, response.clone());
            return response;
          })
          .catch(() => cached);
        return cached || refresh;
      })
    )
  );
});
