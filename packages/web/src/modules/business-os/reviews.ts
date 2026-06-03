import type { BusinessModule } from "./contracts.ts";
export const reviewsModule: BusinessModule = {
  id: "reviews",
  name: "reviews",
  status: "disabled",
  connectsToCustomerRecords: true,
  requiredScopes: ["admin", "member"],
  emitsAuditEvents: true
};
