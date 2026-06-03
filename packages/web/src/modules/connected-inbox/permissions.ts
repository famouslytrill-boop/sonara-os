import type { MailboxRecord } from "./contracts.ts";
export function canAccessMailbox(mailbox: MailboxRecord, organization_id: string) {
  return mailbox.organization_id === organization_id && !mailbox.tokenStoredClientSide;
}
