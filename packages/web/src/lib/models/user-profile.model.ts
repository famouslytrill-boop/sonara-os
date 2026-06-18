import { modelContract, type BaseModel } from "./base-model.ts";

export type UserProfileModel = BaseModel & Readonly<{
  display_name: string;
  role: "owner" | "admin" | "member";
}>;

export const userProfileModel = modelContract("organization_memberships", [
  "owner_user_id maps to the authenticated user",
  "role must be one of owner, admin, or member",
  "active membership is required before private records are read"
]);
