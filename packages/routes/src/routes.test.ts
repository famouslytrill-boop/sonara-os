import { describe, expect, it } from "vitest";
import { createAdminRouteHelpers, createBillingRouteHelpers } from "./index.ts";

describe("route helpers", () => {
  it("builds billing routes and encodes dynamic values", () => {
    const routes = createBillingRouteHelpers();

    expect(routes.overview()).toBe("/billing");
    expect(routes.checkout("release bundle")).toBe("/billing/checkout/release%20bundle");
    expect(routes.portal("customer 1")).toBe("/billing/portal/customer%201");
    expect(routes.invoices("customer 1")).toBe("/billing/invoices/customer%201");
  });

  it("builds admin routes and encodes dynamic values", () => {
    const routes = createAdminRouteHelpers();

    expect(routes.dashboard()).toBe("/admin");
    expect(routes.users()).toBe("/admin/users");
    expect(routes.user("user 1")).toBe("/admin/users/user%201");
    expect(routes.auditLog()).toBe("/admin/audit-log");
    expect(routes.featureFlags()).toBe("/admin/feature-flags");
  });
});
