import { createServiceReadiness } from "./database-service.ts";

export function createCampaignServiceReadiness() {
  return createServiceReadiness("growth campaigns", "static_shell", "ready_for_adapter", [
    "Campaigns are drafts by default.",
    "Phone, SMS, and voicemail placeholders require consent and review before activation.",
    "Opt-outs override every outreach workflow."
  ]);
}
