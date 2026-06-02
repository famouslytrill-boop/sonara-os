export const telegramAlertPolicy = Object.freeze({
  mail2TelegramReferenceOnly: true,
  internalAlertsOnly: true,
  customerDataAllowed: false,
  tokenLoggingAllowed: false,
  rules: Object.freeze([
    "Do not send private support content to chat tools without owner approval.",
    "Redact email addresses, phone numbers, customer names, and provider tokens.",
    "Telegram alert adapters require explicit admin setup and audit logs."
  ])
});
