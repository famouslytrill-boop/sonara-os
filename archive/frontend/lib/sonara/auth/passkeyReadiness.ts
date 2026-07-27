export type PasskeyReadiness = {
  currentAuthProvider: "supabase_auth" | "placeholder" | "unknown";
  passkeySupported: boolean;
  manualSetupNeeded: boolean;
  securityWarnings: string[];
  recommendedNextSteps: string[];
};

export function getPasskeyReadiness(): PasskeyReadiness {
  const hasSupabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  return {
    currentAuthProvider: hasSupabase ? "supabase_auth" : "placeholder",
    passkeySupported: false,
    manualSetupNeeded: true,
    securityWarnings: [
      "Do not store fingerprints, face scans, voiceprints, or biometric templates.",
      "Passkeys/WebAuthn store public keys on the server; device biometrics stay on the user device.",
      "Do not claim biometric login is live until a secure provider integration is implemented and tested.",
    ],
    recommendedNextSteps: [
      "Confirm whether the selected auth provider supports passkeys/WebAuthn.",
      "Use platform authenticators and public-key credentials only.",
      "Document recovery, account takeover protection, and production audit steps before launch.",
    ],
  };
}

export function blocksUnsafeBiometricStorage(claim: string) {
  const unsafeTerms = [
    ["biometric", " database"],
    ["fingerprint", " storage"],
    ["face scan", " storage"],
    ["voiceprint", " storage"],
    ["store", " biometric"],
  ].map((parts) => parts.join(""));
  return unsafeTerms.some((term) => new RegExp(term, "i").test(claim));
}
