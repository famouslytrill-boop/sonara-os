import { PublicShell } from "./PublicShell";

export function LegalPolicyPage({
  title,
  description,
  sections,
}: {
  title: string;
  description: string;
  sections: string[];
}) {
  return (
    <PublicShell>
      <article className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-[#2DD4BF]">Review-ready template</p>
        <h1 className="mt-3 text-4xl font-black text-white">{title}</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-[#CBD5E1]">{description}</p>
        <div className="mt-6 grid gap-4">
          <section className="rounded-2xl border border-[#FFB454]/40 bg-[#FFB454]/10 p-4">
            <h2 className="text-base font-black text-white">Effective date and review status</h2>
            <p className="mt-2 text-sm leading-6 text-[#FDE68A]">
              Effective date: [To be added]. Last updated: [To be added]. This page requires qualified legal review before
              paid public launch.
            </p>
          </section>
          {sections.map((section) => (
            <section key={section} className="rounded-2xl border border-white/10 bg-[#081827] p-4">
              <p className="text-sm leading-7 text-[#CBD5E1]">{section}</p>
            </section>
          ))}
        </div>
      </article>
    </PublicShell>
  );
}
