export function createBillingRouteHelpers(basePath = "/billing") {
  return Object.freeze({
    overview() {
      return normalizeRoute(basePath);
    },
    checkout(tierId) {
      return normalizeRoute(`${basePath}/checkout/${encodeURIComponent(tierId)}`);
    },
    portal(customerId) {
      return normalizeRoute(`${basePath}/portal/${encodeURIComponent(customerId)}`);
    },
    invoices(customerId) {
      return normalizeRoute(`${basePath}/invoices/${encodeURIComponent(customerId)}`);
    }
  });
}

function normalizeRoute(route) {
  return route.replace(/\/+/g, "/");
}
