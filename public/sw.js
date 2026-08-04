// SONARA public-site service worker.
// The cache version stays aligned with the rendered asset token. Only
// public navigation and non-sensitive same-origin assets are handled here.
// Static assets use stale-while-revalidate; public navigations use network-first.
const VERSION = "sonara-ui-20260804-v8-print";
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
  "/brand/sonara-one-mark-v3.svg",
  "/brand/sonara-one-mark-v3-dark.svg",
  "/brand/sonara-industries-logo-v3.svg",
  "/brand/business-builder-mark-v3.svg",
  "/brand/creator-studio-mark-v3.svg",
  "/brand/growth-studio-mark-v3.svg",
  "/sonara-application-ui.css?v=sonara-ui-20260804-v8-print",
  "/sonara-one.js?v=sonara-ui-20260804-v8-print",
  "/sonara-design-system.css?v=sonara-ui-20260804-v8-print",
  "/sonara-depth.js?v=sonara-ui-20260804-v8-print",
  // Fonts are first-party now, so they are cacheable here. While they came from
  // fonts.gstatic.com they were cross-origin and this worker never saw them.
  "/sonara-fonts.css?v=sonara-ui-20260804-v8-print",
  "/fonts/geist-latin.woff2?v=sonara-ui-20260804-v8-print",
  "/fonts/geist-mono-latin.woff2?v=sonara-ui-20260804-v8-print"
];
const STATIC_PATTERN = /\.(css|js|svg|png|ico|webmanifest|woff2)$/;

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
