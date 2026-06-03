import type { BusinessModule } from "./contracts.ts";
export const customerRecordsModule: BusinessModule = {
  id: "customerRecords",
  name: "customerRecords",
  status: "disabled",
  connectsToCustomerRecords: true,
  requiredScopes: ["admin", "member"],
  emitsAuditEvents: true
};
