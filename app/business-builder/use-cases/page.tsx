import { BusinessUseCaseCard } from "../../../components/business-builder/BusinessUseCaseCard";
import { PublicShell } from "../../../components/PublicShell";
import { businessUseCases } from "../../../data/business-use-cases";

export default function BusinessUseCasesPage() {
  return (
    <PublicShell>
      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-[#2DD4BF]">Business Builder</p>
        <h1 className="mt-3 max-w-4xl text-4xl font-black text-white">Business support matrix</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-[#CBD5E1]">
          Business Builder helps businesses create simple sub-apps, customer records, booking paths, intake forms,
          service pages, and lightweight databases without needing to code.
        </p>
      </section>
      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {businessUseCases.map((useCase) => (
          <BusinessUseCaseCard key={useCase.slug} useCase={useCase} />
        ))}
      </section>
    </PublicShell>
  );
}
