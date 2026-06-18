import { modelContract, type BaseModel } from "./base-model.ts";

export type SubscriptionModel = BaseModel & Readonly<{
  stripe_customer_reference?: string;
  plan_id: string;
  status: "draft" | "trialing" | "active" | "past_due" | "canceled";
}>;

export const subscriptionModel = modelContract("subscription_records", [
  "Stripe identifiers stay server-side or redacted",
  "status changes require signed webhook verification",
  "raw card numbers and CVV are never stored"
]);
