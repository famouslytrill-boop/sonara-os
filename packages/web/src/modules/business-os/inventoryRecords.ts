import type { BusinessModule } from "./contracts.ts";
export const inventoryRecordsModule: BusinessModule = {
  id: "inventoryRecords",
  name: "inventoryRecords",
  status: "disabled",
  connectsToCustomerRecords: true,
  requiredScopes: ["admin", "member"],
  emitsAuditEvents: true
};
