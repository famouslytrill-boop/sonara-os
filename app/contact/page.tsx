import { PublicShell } from "../../components/PublicShell";

export default function ContactPage() {
  return (
    <PublicShell>
      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-[#2DD4BF]">Contact</p>
        <h1 className="mt-3 text-4xl font-black text-white">Contact SONARA Industries</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-[#CBD5E1]">
          For launch access, billing questions, privacy requests, or support, use the owner-approved support email
          configured in production. Do not send secrets, passwords, card numbers, payout information, or private customer
          data through public contact forms.
        </p>
        <div className="mt-5 rounded-2xl border border-white/10 bg-[#081827] p-4 text-sm font-bold text-white">
          Support email: {process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support email to be configured"}
        </div>
      </section>
    </PublicShell>
  );
}
