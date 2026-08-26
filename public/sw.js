// SONARA public-site service worker.
// The cache version stays aligned with the rendered asset token. Only
// public navigation and non-sensitive same-origin assets are handled here.
// Static assets use stale-while-revalidate; public navigations use network-first.
const VERSION = "sonara-ui-20260811-v11-rebrand";
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
  "/sonara-application-ui.css?v=sonara-ui-20260811-v11-rebrand",
  "/sonara-one.js?v=sonara-ui-20260811-v11-rebrand",
  "/sonara-design-system.css?v=sonara-ui-20260811-v11-rebrand",
  "/sonara-depth.js?v=sonara-ui-20260811-v11-rebrand",
  // Fonts are first-party now, so they are cacheable here. While they came from
  // fonts.gstatic.com they were cross-origin and this worker never saw them.
  "/sonara-fonts.css?v=sonara-ui-20260811-v11-rebrand",
  "/fonts/geist-latin.woff2?v=sonara-ui-20260811-v11-rebrand",
  "/fonts/geist-mono-latin.woff2?v=sonara-ui-20260811-v11-rebrand"
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

// ---------------------------------------------------------------------------
// Push notifications.
// ---------------------------------------------------------------------------
//
// The receiving end of `lib/sonara-web-push.cjs`. Added 26 August 2026, when
// there was a sender and an encrypted payload and nothing in the browser
// listening for one.
//
// Everything here is deliberately defensive about the payload, for a reason
// worth stating: a service worker crash is invisible. There is no console
// anybody is watching, no error page, and no user-visible failure -- the
// notification simply never appears, and the sender's own logs say it was
// delivered. So a malformed payload has to degrade to a plain notification
// rather than throw.

function readPush(event) {
  // Three states, not two. No data at all is a legitimate push (some services
  // send a wake-up with no body); unparseable data is a different thing and
  // must not be reported as the first.
  if (!event.data) return { title: "SONARA", body: "" };
  try {
    const parsed = event.data.json();
    if (!parsed || typeof parsed !== "object") throw new Error("not an object");
    return {
      // Trimmed and bounded. A title long enough to fill a lock screen is a
      // notification a person cannot read, and the length is chosen by whoever
      // sent it rather than by us.
      title: String(parsed.title || "SONARA").slice(0, 80),
      body: String(parsed.body || "").slice(0, 240),
      // Only a same-origin path is kept. An absolute URL here would let a push
      // payload decide where a click lands, which is an open redirect with a
      // notification in front of it.
      path: typeof parsed.path === "string" && parsed.path.startsWith("/") && !parsed.path.startsWith("//")
        ? parsed.path
        : "/dashboard",
      // Collapses repeats of the same subject rather than stacking them.
      tag: typeof parsed.tag === "string" ? parsed.tag.slice(0, 40) : undefined
    };
  } catch {
    // The push arrived and we could not read it. Still worth telling somebody
    // something happened rather than silently dropping it.
    return { title: "SONARA", body: "You have an update.", path: "/dashboard" };
  }
}

self.addEventListener("push", (event) => {
  const message = readPush(event);
  event.waitUntil(
    self.registration.showNotification(message.title, {
      body: message.body,
      tag: message.tag,
      // No sound, no vibration, and not requiring interaction. AGENTS.md:
      // sounds and haptics must be off or explicitly user-controlled by
      // default, and a notification is not the place to take that decision.
      silent: true,
      requireInteraction: false,
      data: { path: message.path }
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = (event.notification.data && event.notification.data.path) || "/dashboard";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      // Focus a tab that is already open rather than opening a second one. A
      // person with the app open who taps a notification expects to be taken
      // to it, not given a duplicate.
      for (const client of windows) {
        if (client.url.includes(path) && "focus" in client) return client.focus();
      }
      if (windows.length && "focus" in windows[0]) {
        return windows[0].focus().then(() => self.clients.openWindow(path));
      }
      return self.clients.openWindow(path);
    })
  );
});
