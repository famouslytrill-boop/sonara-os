export function getSupportEmailReadiness() {
  const hasProvider = Boolean(process.env.RESEND_API_KEY || process.env.SENDGRID_API_KEY || process.env.SMTP_HOST);
  const hasRecipient = Boolean(process.env.SUPPORT_EMAIL || process.env.CONTACT_EMAIL);
  const hasSender = Boolean(process.env.RESEND_FROM_EMAIL || process.env.SMTP_USER);

  return {
    configured: hasProvider && hasRecipient && hasSender,
    hasProvider,
    hasRecipient,
    hasSender,
  };
}

export async function sendSupportEmailNotification() {
  return {
    sent: false,
    reason: "Outbound support email is intentionally disabled until the selected provider adapter is reviewed.",
  };
}
