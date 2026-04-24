export function createAdminRouteHelpers(basePath = "/admin") {
  return Object.freeze({
    dashboard() {
      return normalizeRoute(basePath);
    },
    users() {
      return normalizeRoute(`${basePath}/users`);
    },
    user(userId) {
      return normalizeRoute(`${basePath}/users/${encodeURIComponent(userId)}`);
    },
    auditLog() {
      return normalizeRoute(`${basePath}/audit-log`);
    },
    featureFlags() {
      return normalizeRoute(`${basePath}/feature-flags`);
    }
  });
}

function normalizeRoute(route) {
  return route.replace(/\/+/g, "/");
}
