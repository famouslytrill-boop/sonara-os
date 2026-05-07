import type { BrandDefinition } from "../lib/brand-registry";

export function ModuleGrid({ brand }: { brand: BrandDefinition }) {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {brand.modules.map((module) => (
        <article key={module.name} className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-sm font-black text-white">{module.name}</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">{module.description}</p>
        </article>
      ))}
    </section>
  );
}
