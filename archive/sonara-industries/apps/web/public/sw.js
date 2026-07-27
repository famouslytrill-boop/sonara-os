const CACHE_NAME = "sonara-industries-shell-v1";
const SHELL_URLS = ["/", "/offline", "/legal", "/trust"];
const NEVER_CACHE = ["/billing", "/api/", "/logout", "checkout.stripe.com", "hooks.stripe.com"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
  );
});

self.addEventListener("fetch", (event) => {
  const url = event.request.url;
  if (event.request.method !== "GET" || NEVER_CACHE.some((pattern) => url.includes(pattern))) {
    return;
  }
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request).then((cached) => cached || caches.match("/offline"))),
  );
});
