import Link from "next/link";
import { PublicShell } from "../../components/PublicShell";
import { TrustBadges } from "../../components/sonara/TrustBadges";

const trustNotes = [
  "SONARA does not guarantee copyright ownership outcomes; users remain responsible for rights clearance.",
  "Unknown sound rights are blocked from raw sample-pack export.",
  "Music-use-only sounds can support finished songs but cannot be redistributed as raw packs.",
  "NonCommercial assets cannot be used in paid or commercial products without separate permission.",
  "Open-license data requires item-level verification before packaging.",
  "OpenAI is optional; local rules remain the default provider.",
  "Private user projects are not public demos.",
  "Web payments are handled through Stripe when configured.",
  "SONARA uses ™ marks unless official registrations exist.",
  "SONARA does not offer fake streaming, bot growth, or platform manipulation tools.",
  "SONARA does not store biometric data; future passkey login must keep device biometrics on the user's device.",
] as const;

export default function TrustPage() {
  return (
    <PublicShell>
      <section className="rounded-lg border border-[#332A40] bg-[#191522] p-5 text-[#F9FAFB]">
        <p className="text-xs font-black uppercase text-[#FFB454]">Trust & safety</p>
        <h1 className="mt-2 text-3xl font-black">Rights-aware creator infrastructure.</h1>
        <p className="mt-3 max-w-3xl leading-7 text-[#C4BFD0]">
          SONARA is built for clear workflows, supervised autonomy, creator-guided exports, and honest launch boundaries.
        </p>
      </section>
      <section className="mt-6">
        <TrustBadges />
      </section>
      <section className="mt-6 rounded-lg border border-[#332A40] bg-[#191522] p-5">
        <ul className="grid gap-3 text-sm leading-6 text-[#C4BFD0]">
          {trustNotes.map((note) => (
            <li key={note}>- {note}</li>
          ))}
        </ul>
        <Link className="mt-5 inline-flex min-h-11 items-center rounded-lg bg-[#9B5CFF] px-4 text-sm font-bold text-white" href="/support">
          Contact support
        </Link>
      </section>
    </PublicShell>
  );
}
