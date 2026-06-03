import type { BusinessModule } from "./contracts.ts";
export const quotesModule: BusinessModule = {
  id: "quotes",
  name: "quotes",
  status: "disabled",
  connectsToCustomerRecords: true,
  requiredScopes: ["admin", "member"],
  emitsAuditEvents: true
};
