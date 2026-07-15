// SONARA service worker.
// Versioned caching so old CSS/JS never stays stuck: bumping VERSION (kept in
// sync with the ?v= asset token) discards every previous cache on activate.
// Navigations are network-first with an offline fallback; same-origin static
// assets are stale-while-revalidate so updates land on the next visit.
const VERSION = "interface-dom-20260715";
const CACHE_NAME = "sonara-stage-" + VERSION;
const OFFLINE_URL = "/offline";
const PUBLIC_STAGE = ["/", OFFLINE_URL, "/manifest.webmanifest"];
const STATIC_PATTERN = /\.(css|js|svg|png|ico|webmanifest)$/;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PUBLIC_STAGE)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const url = new URL(event.request.url);

  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/account/") ||
    url.hostname.includes("stripe.com")
  ) {
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  if (url.origin === self.location.origin && STATIC_PATTERN.test(url.pathname)) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(event.request).then((cached) => {
          const refresh = fetch(event.request)
            .then((response) => {
              if (response && response.ok) cache.put(event.request, response.clone());
              return response;
            })
            .catch(() => cached);
          return cached || refresh;
        })
      )
    );
  }
});
