import { getPasskeyReadiness } from "../../lib/sonara/auth/passkeyReadiness";

export function PasskeyReadinessCard() {
  const readiness = getPasskeyReadiness();

  return (
    <section className="rounded-lg border border-[#332A40] bg-[#191522] p-4 text-[#F9FAFB]">
      <p className="text-xs font-black uppercase text-[#FFB454]">Passkey/WebAuthn Readiness</p>
      <h3 className="mt-2 text-xl font-black">{readiness.passkeySupported ? "Configured" : "Planned, not configured"}</h3>
      <p className="mt-2 text-sm leading-6 text-[#C4BFD0]">
        SONARA should use passkeys through a secure provider later. The app must never store biometric data.
      </p>
      <ul className="mt-3 grid gap-2 text-sm leading-6 text-[#C4BFD0]">
        {readiness.securityWarnings.map((warning) => (
          <li key={warning}>{warning}</li>
        ))}
      </ul>
    </section>
  );
}
