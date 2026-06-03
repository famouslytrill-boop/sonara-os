import type { BusinessModule } from "./contracts.ts";
export const crmModule: BusinessModule = {
  id: "crm",
  name: "crm",
  status: "disabled",
  connectsToCustomerRecords: true,
  requiredScopes: ["admin", "member"],
  emitsAuditEvents: true
};
