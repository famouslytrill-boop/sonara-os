import Link from "next/link";
import type { BusinessUseCase } from "../../data/business-use-cases";

export function BusinessUseCaseCard({ useCase }: { useCase: BusinessUseCase }) {
  return (
    <Link
      href={`/business-builder/use-cases/${useCase.slug}`}
      className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition hover:border-[#2DD4BF]/70 focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]"
    >
      <h2 className="text-lg font-black text-white">{useCase.name}</h2>
      <p className="mt-3 text-sm leading-6 text-[#CBD5E1]">{useCase.summary}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {useCase.tools.slice(0, 4).map((tool) => (
          <span key={tool} className="rounded-full border border-white/10 bg-[#081827] px-3 py-1 text-xs font-bold text-[#CBD5E1]">
            {tool}
          </span>
        ))}
      </div>
    </Link>
  );
}
