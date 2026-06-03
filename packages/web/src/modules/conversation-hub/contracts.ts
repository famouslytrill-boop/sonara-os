export type Channel = "email" | "sms" | "voice" | "rcs" | "imessage_vendor_future";
export interface OutboundMessageDraft {
  organization_id: string;
  channel: Channel;
  body: string;
  approvedBy?: string;
  purpose: string;
}
