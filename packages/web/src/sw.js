const CACHE_VERSION = "sonara-notifications-20260915-v1";

function readPushPayload(data) {
  try {
    return data?.json?.() || {};
  } catch {
    return {};
  }
}

function getSafeTargetUrl(value) {
  return typeof value === "string" && value.startsWith("/") ? value : "/app";
}

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  const payload = readPushPayload(event.data);
  const title = typeof payload.title === "string" ? payload.title : "SONARA Industries";
  const options = {
    body: typeof payload.body === "string" ? payload.body : "You have an approved SONARA update.",
    tag: typeof payload.tag === "string" ? payload.tag : CACHE_VERSION,
    data: { url: getSafeTargetUrl(payload.url) },
    renotify: false
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = getSafeTargetUrl(event.notification.data?.url);
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => "focus" in client);
      return existing ? existing.focus() : self.clients.openWindow(targetUrl);
    })
  );
});
