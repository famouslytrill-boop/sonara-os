import Link from "next/link";
import { PublicShell } from "../../components/PublicShell";

const trustNotes = [
  "Trust Shield: approval-ready controls for public proof, customer messaging, payment changes, security changes, and policy edits.",
  "Proof-to-Payment: business proof, offers, bookings, payment options, and reviews stay connected without storing raw card data.",
  "Access Control: app and admin surfaces are designed for authenticated, role-scoped access.",
  "Billing & Entitlements: paid features should depend on verified Stripe state, not success-page redirects.",
  "AI Governance: generated content is draft-only until reviewed when it affects customers, legal text, pricing, proof, or synthetic media.",
  "Launch Readiness: setup-required states are visible instead of fake completion labels.",
] as const;

export default function TrustPage() {
  return (
    <PublicShell>
      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-white">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-[#2DD4BF]">Trust & security</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-black">Shared trust systems with clear human review gates.</h1>
        <p className="mt-4 max-w-3xl leading-7 text-[#CBD5E1]">
          SONARA Industries presents trust as a working operating discipline, not a guarantee. Security, privacy, legal,
          payment, and AI-sensitive actions require configuration and review before launch.
        </p>
      </section>
      <section className="mt-6 grid gap-3 lg:grid-cols-2">
        {trustNotes.map((note) => (
          <article key={note} className="rounded-2xl border border-white/10 bg-[#081827] p-4 text-sm leading-6 text-[#CBD5E1]">
            {note}
          </article>
        ))}
      </section>
      <section className="mt-6 rounded-3xl border border-[#FFB454]/40 bg-[#FFB454]/10 p-6">
        <h2 className="text-xl font-black text-white">No fake claims</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#FDE68A]">
          The platform does not claim guaranteed revenue, guaranteed customers, guaranteed compliance, guaranteed uptime,
          guaranteed cybersecurity, legal advice, tax advice, financial advice, fake certifications, or fake testimonials.
        </p>
        <Link
          className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-[#2DD4BF] px-5 text-sm font-black text-[#07111F]"
          href="/legal/security"
        >
          Read security policy
        </Link>
      </section>
    </PublicShell>
  );
}
