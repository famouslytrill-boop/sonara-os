import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { PublicShell } from "../../components/PublicShell";

const tutorialSteps = [
  {
    title: "Start a Creator Project",
    detail: "Add the song title, creator name, mood, audience, assets, timeline, and release context.",
  },
  {
    title: "Create a Song Fingerprint",
    detail: "SONARA maps unique key, rhythmic feel, harmonic identity, drum language, and vocal mode.",
  },
  {
    title: "Check Differentiation",
    detail: "The system looks for identity, anti-repetition, and enough detail to avoid generic outputs.",
  },
  {
    title: "Review Recommendations",
    detail: "Use Runtime Target Threshold, Prompt Length Mode, External Generator Settings, and Release Readiness.",
  },
  {
    title: "Prepare Release Assets",
    detail: "Build streaming metadata, release plan, visual direction, broadcast kit, sound pack manifest, and license sheet.",
  },
  {
    title: "Export and Launch",
    detail: "Export a branded release bundle and use it as launch infrastructure. Distribution stays outside SONARA.",
  },
];

export default function TutorialPage() {
  return (
    <PublicShell>
      <section className="rounded-lg border border-[#2A2A35] bg-[#171720] p-5 text-[#F8FAFC]">
        <p className="text-xs font-black uppercase text-[#22D3EE]">Tutorial</p>
        <h1 className="mt-2 text-3xl font-black">How SONARA OS™ works.</h1>
        <p className="mt-3 max-w-3xl leading-7 text-[#A1A1AA]">
          A simple workflow for turning creative ideas into organized song fingerprints, release plans, rights-aware exports, and launch-ready bundles.
        </p>
      </section>

      <section className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {tutorialSteps.map((step, index) => (
          <article key={step.title} className="rounded-lg border border-[#2A2A35] bg-[#171720] p-4">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#8B5CF6] text-sm font-black text-white">
                {index + 1}
              </span>
              <CheckCircle2 className="text-[#22C55E]" size={18} />
            </div>
            <h2 className="mt-4 text-lg font-black text-[#F8FAFC]">{step.title}</h2>
            <p className="mt-2 text-sm leading-6 text-[#A1A1AA]">{step.detail}</p>
          </article>
        ))}
      </section>

      <section className="mt-6 rounded-lg border border-[#2A2A35] bg-[#171720] p-5">
        <p className="text-sm font-black text-[#F8FAFC]">Ready to work?</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#8B5CF6] px-4 text-sm font-bold text-white" href="/create">
            Create a project <ArrowRight size={16} />
          </Link>
          <Link className="inline-flex min-h-11 items-center rounded-lg border border-[#2A2A35] bg-[#111118] px-4 text-sm font-bold text-[#F8FAFC]" href="/export">
            Build release pack
          </Link>
        </div>
      </section>
    </PublicShell>
  );
}
