import { PublicShell } from "../PublicShell";
import { CreatorToolCard } from "./CreatorToolCard";
import { getCreatorToolsByCategory, type CreatorToolCategory } from "../../data/creator-tools";

export function CreatorToolCategoryPage({ category, title }: { category: CreatorToolCategory; title: string }) {
  const tools = getCreatorToolsByCategory(category);

  return (
    <PublicShell>
      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-[#2DD4BF]">Creator Tool Library</p>
        <h1 className="mt-3 text-4xl font-black text-white">{title}</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-[#CBD5E1]">
          These are external references and setup notes only. Any production integration requires license, security,
          safety, commercial-use, and product-fit review.
        </p>
      </section>
      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        {tools.map((tool) => (
          <CreatorToolCard key={tool.slug} tool={tool} />
        ))}
      </section>
    </PublicShell>
  );
}
