import "server-only";

export { getSupportEmailReadiness } from "../email/email-config";
export { sendSupportEmailNotification } from "../email/send-support-email";
export type { SupportEmailPayload, SupportEmailResult } from "../email/send-support-email";
