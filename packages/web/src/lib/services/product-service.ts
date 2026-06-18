import { publicPricingCatalog } from "../product-catalog/product-catalog.ts";
import { createServiceReadiness } from "./database-service.ts";

export function createProductServiceReadiness() {
  return createServiceReadiness("product catalog", "static_shell", "ready_for_adapter", [
    `${publicPricingCatalog.length} public pricing catalog items are defined.`,
    "Future add-ons are hidden by default.",
    "Checkout must resolve server-side Stripe price IDs by plan id."
  ]);
}
