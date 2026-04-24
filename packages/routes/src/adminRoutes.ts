export function createAdminRouteHelpers(basePath: string = "/admin") {
  return Object.freeze({
    dashboard() {
      return normalizeRoute(basePath);
    },
    users() {
      return normalizeRoute(`${basePath}/users`);
    },
    user(userId: string) {
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

function normalizeRoute(route: string) {
  return route.replace(/\/+/g, "/");
}
