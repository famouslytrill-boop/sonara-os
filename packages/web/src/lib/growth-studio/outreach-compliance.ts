export type CampaignType =
  | "email"
  | "sms_placeholder"
  | "call_placeholder"
  | "voicemail_placeholder"
  | "review_request"
  | "social_post_reminder"
  | "manual_follow_up_task";

export type ConsentRecord = Readonly<{
  contact_id: string;
  consent_source: string;
  consent_timestamp: string;
  channels: readonly CampaignType[];
}>;

export type OptOutRecord = Readonly<{
  contact_id: string;
  channel: CampaignType | "all";
  created_at: string;
}>;

export const phoneOutreachComplianceWarning =
  "Phone, SMS, and voicemail outreach may be regulated. Confirm valid consent and honor opt-outs before contacting anyone.";

export function canActivateCampaign(input: {
  campaignType: CampaignType;
  contactId: string;
  consentRecords: readonly ConsentRecord[];
  optOuts: readonly OptOutRecord[];
}): { allowed: boolean; reason: string; requiresAdminReview: boolean } {
  const optedOut = input.optOuts.some(
    (record) =>
      record.contact_id === input.contactId &&
      (record.channel === "all" || record.channel === input.campaignType)
  );
  if (optedOut) {
    return decision(false, "Opt-out overrides this campaign.", true);
  }
  if (requiresConsent(input.campaignType)) {
    const consent = input.consentRecords.some(
      (record) =>
        record.contact_id === input.contactId && record.channels.includes(input.campaignType)
    );
    if (!consent) {
      return decision(false, "Valid consent record is required before activation.", true);
    }
  }
  return decision(true, "Campaign can move to owner/admin review. No sending is automatic.", true);
}

export function requiresConsent(campaignType: CampaignType): boolean {
  return ["sms_placeholder", "call_placeholder", "voicemail_placeholder", "review_request"].includes(
    campaignType
  );
}

function decision(allowed: boolean, reason: string, requiresAdminReview: boolean) {
  return Object.freeze({ allowed, reason, requiresAdminReview });
}
