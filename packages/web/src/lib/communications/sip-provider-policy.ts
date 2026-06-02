export const sipProviderPolicy = Object.freeze({
  linphoneReferenceOnly: true,
  sipCredentialsClientSideAllowed: false,
  emergencyCallingClaimsAllowed: false,
  robocallingAllowed: false,
  rules: Object.freeze([
    "Linphone iPhone is a restricted SIP/VoIP architecture reference only.",
    "GPL-3.0 source cannot be copied or bundled into closed-source product code without legal review.",
    "SIP credentials must remain server/admin-side and redacted from logs."
  ])
});
