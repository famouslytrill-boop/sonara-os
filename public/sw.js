// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
// SONARA public-site service worker.
// The cache version stays aligned with the rendered asset token. Only
// public navigation and non-sensitive same-origin assets are handled here.
// Static assets use stale-while-revalidate; public navigations use network-first.
const VERSION = "sonara-ui-20261009-v26-public-cache-boundary";
const CACHE_PREFIX = "sonara-public-";
// Separate cache namespace to evict previously stored extension-matched URLs
// when this tighter public-asset policy activates.
const CACHE_NAME = CACHE_PREFIX + VERSION + "-public-asset-guard-v6";
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
  "/sonara-application-ui.css?v=sonara-ui-20261009-v26-public-cache-boundary",
  "/sonara-one.js?v=sonara-ui-20261009-v26-public-cache-boundary",
  "/sonara-design-system.css?v=sonara-ui-20261009-v26-public-cache-boundary",
  "/sonara-depth.js?v=sonara-ui-20261009-v26-public-cache-boundary",
  // Fonts are first-party now, so they are cacheable here. While they came from
  // fonts.gstatic.com they were cross-origin and this worker never saw them.
  "/sonara-fonts.css?v=sonara-ui-20261009-v26-public-cache-boundary",
  "/fonts/geist-latin.woff2?v=sonara-ui-20261009-v26-public-cache-boundary",
  "/fonts/geist-mono-latin.woff2?v=sonara-ui-20261009-v26-public-cache-boundary"
];
const ESSENTIAL_PUBLIC_STAGE = [
  OFFLINE_URL,
  `/sonara-application-ui.css?v=${VERSION}`,
  `/sonara-design-system.css?v=${VERSION}`,
  `/sonara-one.js?v=${VERSION}`
];
const STATIC_PATTERN = /\.(css|js|svg|png|ico|webmanifest|woff2)$/;
// Offline caching is limited to files served from the known public asset
// namespace. A private API or user-file URL must never become cacheable just
// because its last path segment happens to end in .png or .js.
const PUBLIC_ASSET_PATH = /^\/(?:[a-z0-9][a-z0-9-]*\.(?:css|js|svg|png|ico|webmanifest|woff2)|(?:brand|fonts|icons)\/(?:[a-z0-9_-]+\/)*[a-z0-9_-]+\.(?:css|js|svg|png|ico|webmanifest|woff2))$/i;
const PUBLIC_ROOT_ASSETS = new Set([
  ...PUBLIC_STAGE.map((asset) => new URL(asset, self.location.origin).pathname),
  "/sonara-prepaint.js",
  "/sonara-experience-controls.js",
  "/sonara-product-entry.css"
]);

function isPublicStaticRequest(url, request = {}) {
  if (["no-store", "no-cache", "reload"].includes(request.cache) || request.headers?.has("authorization")) return false;
  if (!STATIC_PATTERN.test(url.pathname) || !PUBLIC_ASSET_PATH.test(url.pathname)) return false;
  // Unknown root-level .js/.css URLs may be generated or customer-specific.
  // Treat only positively enumerated public asset files as reusable.
  if (url.pathname.lastIndexOf("/") === 0 && !PUBLIC_ROOT_ASSETS.has(url.pathname)) return false;
  // Versioned assets use exactly the current opaque release token. Do not
  // persist unknown query parameters (including accidental one-time tokens).
  if (!url.search) return true;
  return url.searchParams.size === 1 && url.searchParams.get("v") === VERSION;
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

function isSensitiveResponse(response) {
  if (!response || response.status !== 200 || !response.ok ||
      response.type === "opaque" || response.redirected) return true;
  const cacheControl = response.headers.get("cache-control") || "";
  const vary = response.headers.get("vary") || "";
  return /(?:^|,)\s*(?:private|no-store|no-cache|must-revalidate)(?:\s*[,=]|\s*$)/i.test(cacheControl) ||
    /(?:^|,)\s*(?:\*|cookie|authorization)\s*(?:,|$)/i.test(vary) ||
    response.headers.has("set-cookie");
}

function isCacheableResponse(response, url) {
  if (isSensitiveResponse(response) || (url && !hasExpectedMediaType(url, response))) return false;
  // Public assets must be deliberately cacheable; an unrelated route that
  // happens to serve .js and has no cache policy is not public by default.
  const cacheControl = response.headers.get("cache-control") || "";
  return /(?:^|,)\s*public\s*(?:,|$)/i.test(cacheControl);
}

function isPublicOfflineResponse(response) {
  if (isSensitiveResponse(response)) return false;
  const mediaType = (response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  // Only the explicitly public, generic /offline page is eligible. Other
  // HTML routes keep no-store and never enter the service-worker cache.
  const policy = response.headers.get("cache-control") || "";
  return mediaType === "text/html" && /(?:^|,)\s*public\s*(?:,|$)/i.test(policy);
}

// A current public asset can become private, be removed or stop serving the
// advertised MIME type. A no-store header does not evict older Cache API data.
// Purge only on an authoritative response, never on a transient 5xx/429,
// partial (206) revalidation or an offline network exception.
function mustRevokePublicAsset(response, url) {
  if (!response || isCacheableResponse(response, url)) return false;
  return response.redirected || [200, 401, 403, 404, 410, 451].includes(response.status);
}

// Precache deliberately anonymous public resources. A worker installed while
// someone is signed in must not store a cookie-personalized response, even if a
// future public route forgets its Cache-Control header.
async function precachePublicResource(cache, relativeUrl) {
  const target = new URL(relativeUrl, self.location.origin);
  if (relativeUrl !== OFFLINE_URL && !isPublicStaticRequest(target)) {
    throw new Error("Unsafe asset configured for offline precache");
  }
  const request = new Request(target.href, {
    credentials: "omit",
    cache: "no-store",
    redirect: "error"
  });
  const response = await fetch(request);
  if (relativeUrl === OFFLINE_URL && !isPublicOfflineResponse(response)) {
    throw new Error("Public offline fallback unavailable");
  }
  if (relativeUrl === OFFLINE_URL &&
      !/(?:^|,)\s*public(?:\s*,|\s*$)/i.test(response.headers.get("cache-control") || "")) {
    throw new Error("Offline fallback requires explicit public cache policy");
  }
  if (response.status !== 200 || !isCacheableResponse(response) || response.redirected ||
      (response.url && new URL(response.url).origin !== self.location.origin)) {
    throw new Error("Offline resource must be an anonymous public response");
  }
  if (!(relativeUrl === OFFLINE_URL ? isPublicOfflineResponse(response) : hasExpectedMediaType(target, response))) {
    throw new Error("Offline resource returned an unexpected content type");
  }
  await cache.put(target.href, response);
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    // Validate the entire manifest before any network request or cache write.
    if (ESSENTIAL_PUBLIC_STAGE.some((url) => !PUBLIC_STAGE.includes(url)) ||
        PUBLIC_STAGE.some((url) => url !== OFFLINE_URL &&
          !isPublicStaticRequest(new URL(url, self.location.origin)))) {
      throw new Error("Unsafe asset configured for offline precache");
    }
    try {
      const cache = await caches.open(CACHE_NAME);
      // A broken core installation must not replace a working offline shell.
      for (const url of ESSENTIAL_PUBLIC_STAGE) {
        await precachePublicResource(cache, url);
      }
      await Promise.allSettled(PUBLIC_STAGE
        .filter((url) => !ESSENTIAL_PUBLIC_STAGE.includes(url))
        .map((url) => precachePublicResource(cache, url)));
    } catch (error) {
      await caches.delete(CACHE_NAME);
      throw error;
    }
  })());
  // Do not force activation: existing tabs may still require old cache assets.
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
      fetch(event.request, { cache: "no-store" }).catch(() => caches.open(CACHE_NAME).then((cache) => cache.match(OFFLINE_URL)))
    );
    return;
  }

  if (url.pathname === "/sw.js" || !isPublicStaticRequest(url, event.request)) return;

  // Public static files must be identical for authenticated and anonymous
  // callers. Fetch and key them without cookies or client certificates, even
  // when the calling page uses the browser's default same-origin credentials.
  // Never rely on reading Set-Cookie in a service worker: browsers can filter it.
  const publicRequest = new Request(event.request, { credentials: "omit", cache: "no-cache", redirect: "error" });
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(publicRequest).then((cached) => {
        // Revalidate the underlying HTTP cache even when a versioned asset
        // has a long immutable lifetime. Otherwise CacheStorage might see
        // only the browser's year-old 200 and never learn about a revocation.
        // Conditional HTTP validation limits transfer when the asset is unchanged.
        const refresh = fetch(publicRequest, { cache: "no-cache" })
          .then(async (response) => {
            if (isCacheableResponse(response, url)) {
              // Cache failures must not hide a valid network response.
              await cache.put(publicRequest, response.clone()).catch(() => {});
            } else if (mustRevokePublicAsset(response, url)) {
              // Do not continue serving an older public copy after a definite
              // authorization, removal or MIME/cache-policy change.
              await cache.delete(publicRequest).catch(async () => {
                // If per-entry removal fails, evict the worker's own cache.
                // Never touch other application-owned CacheStorage entries.
                await caches.delete(CACHE_NAME).catch(() => {});
              });
            }
            return response;
          })
          .catch((error) => { if (cached) return cached; throw error; });
        // Keep the worker alive for revalidation and its CacheStorage write.
        // A cached response remains immediate; a first download still waits
        // for the persistence attempt, without turning an error into a 500.
        event.waitUntil(refresh.then(() => {}, () => {}));
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
