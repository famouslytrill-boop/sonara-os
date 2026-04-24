export function createBillingRouteHelpers(basePath: string = "/billing") {
  return Object.freeze({
    overview() {
      return normalizeRoute(basePath);
    },
    checkout(tierId: string) {
      return normalizeRoute(`${basePath}/checkout/${encodeURIComponent(tierId)}`);
    },
    portal(customerId: string) {
      return normalizeRoute(`${basePath}/portal/${encodeURIComponent(customerId)}`);
    },
    invoices(customerId: string) {
      return normalizeRoute(`${basePath}/invoices/${encodeURIComponent(customerId)}`);
    }
  });
}

function normalizeRoute(route: string) {
  return route.replace(/\/+/g, "/");
}
