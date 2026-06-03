import type { BusinessModule } from "./contracts.ts";
export const bookingsModule: BusinessModule = {
  id: "bookings",
  name: "bookings",
  status: "disabled",
  connectsToCustomerRecords: true,
  requiredScopes: ["admin", "member"],
  emitsAuditEvents: true
};
