import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { PublicShell } from "../PublicShell";

export function ResearchLabAreaPage({
  eyebrow,
  title,
  description,
  sections,
}: {
  eyebrow: string;
  title: string;
  description: string;
  sections: { title: string; body: string }[];
}) {
  return (
    <PublicShell>
      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-[#2DD4BF]">{eyebrow}</p>
        <h1 className="mt-3 max-w-4xl text-4xl font-black text-white">{title}</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-[#CBD5E1]">{description}</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/research-lab/open-source"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#2DD4BF] px-4 text-sm font-black text-[#07111F]"
          >
            Open watchlist <ArrowRight size={16} />
          </Link>
          <Link
            href="/legal/open-source-policy"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 px-4 text-sm font-black text-white"
          >
            Review policy
          </Link>
        </div>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        {sections.map((section) => (
          <article key={section.title} className="rounded-2xl border border-white/10 bg-[#081827] p-5">
            <h2 className="text-xl font-black text-white">{section.title}</h2>
            <p className="mt-3 text-sm leading-6 text-[#CBD5E1]">{section.body}</p>
          </article>
        ))}
      </section>

      <section className="mt-6 rounded-3xl border border-[#FFB454]/40 bg-[#FFB454]/10 p-6">
        <div className="flex gap-3">
          <ShieldCheck className="mt-1 shrink-0 text-[#FDE68A]" size={22} />
          <div>
            <h2 className="text-xl font-black text-white">Review-gated by default</h2>
            <p className="mt-2 text-sm leading-6 text-[#FDE68A]">
              This page documents a research area only. It does not mean SONARA has installed a tool, copied code,
              connected a provider, approved commercial use, or shipped a live integration.
            </p>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
