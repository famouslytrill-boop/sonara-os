import { modelContract, type BaseModel } from "./base-model.ts";

export type CampaignModel = BaseModel & Readonly<{
  campaign_type: "email" | "sms_placeholder" | "call_placeholder" | "voicemail_placeholder" | "review_request" | "social_post_reminder" | "manual_follow_up_task";
  title: string;
  status: "draft" | "planned" | "requires_approval" | "blocked" | "completed";
  consent_required: boolean;
}>;

export const campaignModel = modelContract("campaigns", [
  "consent_required is true for phone, SMS, voicemail, and review request campaigns",
  "opt-outs override campaign status",
  "no campaign sends automatically from this foundation"
]);
