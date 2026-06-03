import type { BusinessModule, MoneyPathStage } from "./contracts.ts";
export const moneyPathStages: MoneyPathStage[] = [
  "lead",
  "appointment",
  "quote",
  "invoice_payment_link",
  "follow_up",
  "review",
  "referral",
  "repeat_customer"
];
export const businessModules: BusinessModule[] = [
  "crm",
  "quotes",
  "payments",
  "bookings",
  "reviews",
  "inventory_records",
  "project_pipeline",
  "customer_records",
  "admin_dashboard"
].map((id) => ({
  id,
  name: id.replaceAll("_", " "),
  status: "disabled",
  connectsToCustomerRecords: true,
  requiredScopes: ["admin", "member"],
  emitsAuditEvents: true
}));
export function getBusinessModule(id: string) {
  return businessModules.find((module) => module.id === id);
}
export * from "./contracts.ts";
