export const emailTemplateTechnologyPolicy = Object.freeze({
  foundationEmailsReferenceOnly: true,
  outboundProviderRequired: true,
  noFakeEmailDeliveryClaims: true,
  rules: Object.freeze([
    "Email templates may be adapted only after license and accessibility review.",
    "Inbound Cloudflare Email Routing does not provide outbound sending.",
    "Outbound support notifications require Resend, Postmark, or another configured provider."
  ])
});
