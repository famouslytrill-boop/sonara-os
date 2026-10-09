// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
// SONARA public-site service worker.
// The cache version stays aligned with the rendered asset token. Only
// public navigation and non-sensitive same-origin assets are handled here.
// Static assets use stale-while-revalidate; public navigations use network-first.
const VERSION = "sonara-ui-20261007-v23-native-navigation";
const CACHE_PREFIX = "sonara-public-";
// Separate cache namespace to evict previously stored extension-matched URLs
// when this tighter public-asset policy activates.
const CACHE_NAME = CACHE_PREFIX + VERSION + "-public-asset-guard-v2";
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
  "/sonara-application-ui.css?v=sonara-ui-20261007-v23-native-navigation",
  "/sonara-one.js?v=sonara-ui-20261007-v23-native-navigation",
  "/sonara-design-system.css?v=sonara-ui-20261007-v23-native-navigation",
  "/sonara-depth.js?v=sonara-ui-20261007-v23-native-navigation",
  // Fonts are first-party now, so they are cacheable here. While they came from
  // fonts.gstatic.com they were cross-origin and this worker never saw them.
  "/sonara-fonts.css?v=sonara-ui-20261007-v23-native-navigation",
  "/fonts/geist-latin.woff2?v=sonara-ui-20261007-v23-native-navigation",
  "/fonts/geist-mono-latin.woff2?v=sonara-ui-20261007-v23-native-navigation"
];
const STATIC_PATTERN = /\.(css|js|svg|png|ico|webmanifest|woff2)$/;

// An extension is not proof of public access. For example, a tenant report
// served at /api/tenant/chart.png must never enter the origin-wide Cache API.
// The Express public/ tree uses root assets, /brand/ and /fonts/ only.
function isPublicStaticAsset(url, request) {
  if (!STATIC_PATTERN.test(url.pathname) || url.pathname === "/sw.js") return false;
  const publicRoot = /^\/[^/]+\.(?:css|js|svg|png|ico|webmanifest|woff2)$/.test(url.pathname);
  const publicDirectory = url.pathname.startsWith("/brand/") || url.pathname.startsWith("/fonts/");
  if (!publicRoot && !publicDirectory) return false;

  // Asset revisions use ?v=... . Any other query (token, signature, session,
  // redirect, etc.) bypasses the Cache API; never retain bearer-style URLs.
  if (url.search) {
    const keys = [...url.searchParams.keys()];
    if (keys.length !== 1 || keys[0] !== "v" ||
        !/^[a-z0-9._-]{1,100}$/i.test(url.searchParams.get("v") || "")) return false;
  }
  if (request.cache === "no-store" ||
      (request.headers && request.headers.has("authorization"))) return false;
  return true;
}

function isPublicNavigation(pathname) {
  return PUBLIC_NAVIGATION_PATHS.has(pathname) || pathname.startsWith("/legal/");
}

// Check both URL and response type to prevent HTML fallback / login pages
// from being stored as scripts, styles, fonts or images (web cache deception).
const ASSET_MEDIA_TYPES = Object.freeze({
  css: ["text/css"],
  js: ["text/javascript", "application/javascript"],
  svg: ["image/svg+xml"],
  png: ["image/png"],
  ico: ["image/x-icon", "image/vnd.microsoft.icon"],
  webmanifest: ["application/manifest+json", "application/json"],
  woff2: ["font/woff2"]
});

function hasExpectedMediaType(url, response) {
  const extension = url.pathname.split(".").pop().toLowerCase();
  const expected = ASSET_MEDIA_TYPES[extension];
  if (!expected) return false;
  const mediaType = (response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  return expected.includes(mediaType);
}

function isCacheableResponse(response, url) {
  if (!response || response.status !== 200 || !response.ok ||
      response.type === "opaque" || response.redirected ||
      !hasExpectedMediaType(url, response)) return false;
  const cacheControl = response.headers.get("cache-control") || "";
  const vary = response.headers.get("vary") || "";
  return !/(private|no-store)/i.test(cacheControl) &&
    !/(^|,)\s*(\*|cookie|authorization)\s*(,|$)/i.test(vary) &&
    !response.headers.has("set-cookie");
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Never precache session-aware responses. Offline is a fixed public
      // page requested without cookies; a missing fallback must fail install.
      const offlineResponse = await fetch(OFFLINE_URL, { credentials: "omit", cache: "no-store" });
      if (!offlineResponse.ok || offlineResponse.status !== 200 ||
          offlineResponse.redirected ||
          !(offlineResponse.headers.get("content-type") || "").toLowerCase().startsWith("text/html") ||
          offlineResponse.headers.has("set-cookie")) {
        throw new Error("Public offline fallback unavailable");
      }
      await cache.put(OFFLINE_URL, offlineResponse);
      await Promise.allSettled(PUBLIC_STAGE.filter((url) => url !== OFFLINE_URL).map(async (path) => {
        const url = new URL(path, self.location.origin);
        const response = await fetch(path, { credentials: "omit" });
        if (isPublicStaticAsset(url, { cache: "default" }) &&
            isCacheableResponse(response, url)) await cache.put(path, response);
      }));
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

  if (url.pathname === "/sw.js" || !isPublicStaticAsset(url, event.request)) return;

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(event.request).then((cached) => {
        const refresh = fetch(event.request)
          .then((response) => {
            if (isCacheableResponse(response, url)) {
              // Extend the fetch event lifetime without delaying a cached
              // response while persistent storage finishes.
              event.waitUntil(cache.put(event.request, response.clone()).catch(() => {}));
            }
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

// Validate both receipt and click paths. WHATWG URL parsing treats backslashes
// after a leading slash as authority separators, so `startsWith("/")` alone
// does not guarantee a same-origin notification click.
function safeNotificationPath(value) {
  if (typeof value !== "string" || value.length > 2048 ||
      !value.startsWith("/") || value.startsWith("//") ||
      [...value].some((character) => character === "\\" ||
        character.charCodeAt(0) <= 0x20 || character.charCodeAt(0) === 0x7f)) {
    return "/dashboard";
  }
  try {
    const parsed = new URL(value, self.location.origin);
    if (parsed.origin !== self.location.origin) return "/dashboard";
    return parsed.pathname + parsed.search + parsed.hash;
  } catch {
    return "/dashboard";
  }
}

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
      path: safeNotificationPath(parsed.path),
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
  const path = safeNotificationPath(event.notification.data && event.notification.data.path);
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      // Focus a tab that is already open rather than opening a second one. A
      // person with the app open who taps a notification expects to be taken
      // to it, not given a duplicate.
      for (const client of windows) {
        try {
          const open = new URL(client.url);
          if (open.origin === self.location.origin &&
              open.pathname + open.search + open.hash === path &&
              "focus" in client) return client.focus();
        } catch {
          // Ignore stale or malformed client URLs; still open the safe path.
        }
      }
      if (windows.length && "focus" in windows[0]) {
        return windows[0].focus().then(() => self.clients.openWindow(path));
      }
      return self.clients.openWindow(path);
    })
  );
});
