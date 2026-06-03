import type { BusinessModule } from "./contracts.ts";
export const projectPipelineModule: BusinessModule = {
  id: "projectPipeline",
  name: "projectPipeline",
  status: "disabled",
  connectsToCustomerRecords: true,
  requiredScopes: ["admin", "member"],
  emitsAuditEvents: true
};
