export interface MailboxRecord {
  organization_id: string;
  mailbox_id: string;
  user_role: string;
  tokenStoredClientSide?: boolean;
}
export interface AttachmentRecord {
  organization_id: string;
  file_id: string;
  privacyLabel?: string;
}
export interface AIDraft {
  organization_id: string;
  approved: boolean;
  body: string;
}
