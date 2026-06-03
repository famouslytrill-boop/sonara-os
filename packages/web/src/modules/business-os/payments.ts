import type { BusinessModule } from "./contracts.ts";
export const paymentsModule: BusinessModule = {
  id: "payments",
  name: "payments",
  status: "disabled",
  connectsToCustomerRecords: true,
  requiredScopes: ["admin", "member"],
  emitsAuditEvents: true
};
