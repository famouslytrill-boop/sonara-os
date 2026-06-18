import { modelContract, type BaseModel } from "./base-model.ts";

export type OrderModel = BaseModel & Readonly<{
  order_type: "subscription" | "setup_service" | "future_addon";
  amount_label: string;
  provider_status: "draft" | "requires_provider_setup" | "paid" | "refunded";
}>;

export const orderModel = modelContract("payment_records", [
  "amount_label is display-only and not proof of payment",
  "provider_status must come from verified provider events",
  "refunds require owner approval"
]);
