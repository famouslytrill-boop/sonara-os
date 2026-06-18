import { modelContract, type BaseModel } from "./base-model.ts";

export type ProductModel = BaseModel & Readonly<{
  product_key: "business_builder" | "creator_studio" | "growth_studio" | "sonara_one";
  name: string;
  status: "active" | "future_flagged" | "retired";
}>;

export const productModel = modelContract("provider_registry", [
  "product_key is required",
  "future add-ons stay hidden unless feature flags are enabled",
  "public claims must match shipped status"
]);
