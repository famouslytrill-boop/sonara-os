import type { BusinessModule } from "./contracts.ts";
export const adminDashboardModule: BusinessModule = {
  id: "adminDashboard",
  name: "adminDashboard",
  status: "disabled",
  connectsToCustomerRecords: true,
  requiredScopes: ["admin", "member"],
  emitsAuditEvents: true
};
