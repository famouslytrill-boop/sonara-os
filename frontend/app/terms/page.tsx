import { SiteHeader } from "../../components/site-header";

export default function TermsPage() {
  const terms = [
    "SONARA Industries owns shared standards and infrastructure; TrackFoundry, LineReady, and NoticeGrid remain independent products.",
    "The software provides workflow intelligence, drafts, scoring, and operating guidance. It does not guarantee legal, copyright, financial, labor, civic, or business outcomes.",
    "TrackFoundry users remain responsible for rights clearance, splits, releases, and avoiding copyrighted imitation.",
    "LineReady is not a payroll provider, POS processor, bank, insurer, or regulated payment processor.",
    "NoticeGrid is not a government authority, voting system, emergency dispatch system, medical alert system, or law-enforcement platform.",
    "Risky actions such as public notices, public links, mass notifications, billing changes, role escalation, user deletion, and public-facing generated claims require approval.",
  ];

  return (
    <div className="min-h-screen bg-[#07070A] text-white">
      <SiteHeader />
      <main className="mx-auto grid max-w-4xl gap-6 px-4 py-8">
        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">Terms</p>
          <h1 className="mt-3 text-4xl font-black">Use the system with human judgment.</h1>
          <p className="mt-3 leading-7 text-slate-300">
            These launch terms are placeholders for review by counsel before paid customers or public NoticeGrid workflows go live.
          </p>
        </section>
        <section className="grid gap-3">
          {terms.map((item) => (
            <article key={item} className="rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm leading-6 text-slate-300">
              {item}
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
