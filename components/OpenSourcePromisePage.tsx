import Link from "next/link";
import { PublicShell } from "./PublicShell";

export function OpenSourcePromisePage({
  title,
  description,
  sections,
}: {
  title: string;
  description: string;
  sections: { title: string; body: string }[];
}) {
  return (
    <PublicShell>
      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-[#2DD4BF]">Open-source philosophy</p>
        <h1 className="mt-3 max-w-4xl text-4xl font-black text-white">{title}</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-[#CBD5E1]">{description}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {["Free to Start", "Open-Source Friendly", "Reference Only", "Review Required", "Restricted", "Blocked"].map(
            (badge) => (
              <span key={badge} className="rounded-full border border-white/15 bg-[#081827] px-3 py-1 text-xs font-black text-[#E2E8F0]">
                {badge}
              </span>
            ),
          )}
        </div>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#2DD4BF] px-4 text-sm font-black text-[#07111F]" href="/research-lab/open-source">
            Open watchlist
          </Link>
          <Link className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 px-4 text-sm font-black text-white" href="/legal/open-source-policy">
            Legal policy
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
    </PublicShell>
  );
}
