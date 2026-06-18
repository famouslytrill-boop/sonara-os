import { modelContract, type BaseModel } from "./base-model.ts";

export type CompanyAccountModel = BaseModel & Readonly<{
  name: string;
  product_area: "Business Builder" | "Creator Studio" | "Growth Studio" | "Shared";
}>;

export const companyAccountModel = modelContract("organizations", [
  "name is required",
  "owner_user_id is required for first owner setup",
  "organization memberships control access"
]);
