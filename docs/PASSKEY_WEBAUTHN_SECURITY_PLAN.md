# Passkey/WebAuthn Security Plan

SONARA should prepare for passkeys without storing biometric data.

Rules:

- Do not store fingerprints, face scans, voiceprints, or biometric templates.
- Do not create a server-side biometric store.
- Use passkeys/WebAuthn with platform authenticators.
- Store public keys only; user device handles fingerprint, face, or PIN unlock.
- Do not claim biometric login is live until implemented and tested through a secure provider.

Current status:

- Planned/not configured.
- Supabase Auth may be used if the selected auth setup supports passkeys; otherwise document a future provider.
