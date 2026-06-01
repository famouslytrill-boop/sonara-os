import { notFound } from "next/navigation";
import { BusinessToolStack } from "../../../../components/business-builder/BusinessToolStack";
import { LaunchChecklistPreview } from "../../../../components/business-builder/LaunchChecklistPreview";
import { MoneyPathPreview } from "../../../../components/business-builder/MoneyPathPreview";
import { PublicShell } from "../../../../components/PublicShell";
import { businessUseCases, getBusinessUseCase } from "../../../../data/business-use-cases";

export function generateStaticParams() {
  return businessUseCases.map((useCase) => ({ slug: useCase.slug }));
}

export default async function BusinessUseCaseDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const useCase = getBusinessUseCase(slug);

  if (!useCase) notFound();

  return (
    <PublicShell>
      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-[#2DD4BF]">Business use case</p>
        <h1 className="mt-3 max-w-4xl text-4xl font-black text-white">{useCase.name}</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-[#CBD5E1]">{useCase.summary}</p>
      </section>
      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <BusinessToolStack tools={useCase.tools} />
        <LaunchChecklistPreview />
        <MoneyPathPreview />
      </section>
    </PublicShell>
  );
}
