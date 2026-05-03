<<<<<<< HEAD
const CACHE_NAME = "sonara-shell-v1";
const PUBLIC_SHELL = ["/", "/offline", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PUBLIC_SHELL)));
=======
const CACHE_NAME = "sonara-os-v1";
const OFFLINE_URL = "/offline";
const CORE_ASSETS = ["/", "/dashboard", "/create", "/library", "/export", "/settings", OFFLINE_URL, "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)));
>>>>>>> 7176af92909d4c152a7097a15c8ad57645d8b9ca
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
<<<<<<< HEAD
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
  );
=======
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))));
>>>>>>> 7176af92909d4c152a7097a15c8ad57645d8b9ca
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
<<<<<<< HEAD
  const url = new URL(event.request.url);

  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/account/") ||
    url.hostname.includes("stripe.com")
  ) {
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("/offline"))
    );
  }
=======
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        return cached || caches.match(OFFLINE_URL);
      }),
  );
>>>>>>> 7176af92909d4c152a7097a15c8ad57645d8b9ca
});
