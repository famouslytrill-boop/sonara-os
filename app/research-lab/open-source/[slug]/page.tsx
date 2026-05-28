import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicShell } from "../../../../components/PublicShell";
import { getOpenSourceTool, openSourceTools, openSourceToolStatuses } from "../../../../data/open-source-tools";

export function generateStaticParams() {
  return openSourceTools.map((tool) => ({ slug: tool.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const tool = getOpenSourceTool(slug);

  if (!tool) {
    return {
      title: "Open Source Candidate",
    };
  }

  return {
    title: tool.name,
    description: tool.notes,
  };
}

export default async function OpenSourceToolDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tool = getOpenSourceTool(slug);

  if (!tool) {
    notFound();
  }

  return (
    <PublicShell>
      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-[#2DD4BF]">Open Source Candidate</p>
        <h1 className="mt-3 max-w-4xl text-4xl font-black text-white">{tool.name}</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-[#CBD5E1]">{tool.notes}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <span className="rounded-full border border-white/15 bg-white/[0.04] px-3 py-1 text-xs font-black text-white">
            License risk: {tool.licenseRisk}
          </span>
          <span className="rounded-full border border-[#2DD4BF]/35 bg-[#2DD4BF]/10 px-3 py-1 text-xs font-black text-[#99F6E4]">
            {openSourceToolStatuses[tool.integrationStatus]}
          </span>
          <span className="rounded-full border border-white/15 bg-white/[0.04] px-3 py-1 text-xs font-black text-white">
            Commercial use: {tool.commercialUseStatus.replaceAll("_", " ")}
          </span>
        </div>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <DetailList title="Use cases" items={tool.useCase} />
        <DetailList title="Product fit" items={tool.productFit} />
        <DetailList title="Recommended action" items={tool.recommendedAction} />
        <DetailList title="Safety boundaries" items={tool.safetyBoundaries} />
      </section>

      <section className="mt-6 rounded-3xl border border-[#FFB454]/40 bg-[#FFB454]/10 p-6">
        <h2 className="text-2xl font-black text-white">Review status</h2>
        <p className="mt-3 text-sm leading-6 text-[#FDE68A]">
          License note: {tool.license} This record does not mean SONARA has copied code, installed a dependency, formed a
          partnership, or approved commercial use.
        </p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <Link
            href={tool.officialUrl}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 px-4 text-sm font-black text-white"
          >
            Official source
          </Link>
          <Link
            href="/research-lab/open-source"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#2DD4BF] px-4 text-sm font-black text-[#07111F]"
          >
            Back to watchlist
          </Link>
        </div>
      </section>
    </PublicShell>
  );
}

function DetailList({ title, items }: { title: string; items: string[] }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-[#081827] p-5">
      <h2 className="text-xl font-black text-white">{title}</h2>
      <ul className="mt-4 grid gap-2 text-sm leading-6 text-[#CBD5E1]">
        {items.map((item) => (
          <li key={item} className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
            {item}
          </li>
        ))}
      </ul>
    </article>
  );
}
