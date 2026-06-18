export type RevenueModelItem = Readonly<{
  id: string;
  label: string;
  monthlyPriceRange: string;
  status: "setup_mode" | "needs_review" | "ready_for_checkout_mapping";
  rules: readonly string[];
}>;

export const profitabilityRules = Object.freeze([
  "Do not claim guaranteed income, customers, or growth.",
  "Do not show revenue totals until real Stripe records exist.",
  "Marketplace fees require future legal and payment review.",
  "Provider pass-through costs must be documented before charging."
]);

export const revenueModelItems: readonly RevenueModelItem[] = Object.freeze([
  item("no_cost_plan", "Free tier", "$0", "needs_review"),
  item("starter_plan", "SONARA One Starter", "$9/mo", "ready_for_checkout_mapping"),
  item("core_plan", "SONARA One Core", "$29/mo", "ready_for_checkout_mapping"),
  item("growth_plan", "SONARA One Growth", "$59/mo", "ready_for_checkout_mapping"),
  item("business_plan", "SONARA One Pro", "$99/mo", "ready_for_checkout_mapping"),
  item("scale_plan", "SONARA One Agency/Scale", "$199/mo or custom", "needs_review"),
  item("setup_99", "Profile setup", "$99 one-time", "ready_for_checkout_mapping"),
  item("setup_299", "Business launch setup", "$299 one-time", "ready_for_checkout_mapping"),
  item("setup_499", "Premium setup", "$499 one-time", "ready_for_checkout_mapping")
]);

export function summarizeRevenueModel(): Readonly<{ items: number; noGuarantees: true }> {
  return Object.freeze({ items: revenueModelItems.length, noGuarantees: true });
}

function item(
  id: string,
  label: string,
  monthlyPriceRange: string,
  status: RevenueModelItem["status"]
): RevenueModelItem {
  return Object.freeze({
    id,
    label,
    monthlyPriceRange,
    status,
    rules: profitabilityRules
  });
}
