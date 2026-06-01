export function communicationConsentRequired(channel: "email" | "sms" | "phone") {
  return channel === "sms" || channel === "phone" || channel === "email";
}
