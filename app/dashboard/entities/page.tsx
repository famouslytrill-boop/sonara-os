import Link from "next/link";
import { ProductShell } from "../../../components/ProductShell";
import { entityConfigs } from "../../../lib/entities/config";

export default function EntitiesPage() {
  return (
    <ProductShell>
      <section className="space-y-6">
        <div className="rounded-3xl border border-[#332A40] bg-[#121018] p-6">
          <p className="text-sm font-black uppercase tracking-[0.24em] text-[#2DD4BF]">Entity Operations</p>
          <h1 className="mt-3 max-w-4xl text-3xl font-black text-white sm:text-5xl">
            Separate operating entities with scoped browser, heartbeat, agent, automation, and connector infrastructure.
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-[#C4BFD0]">
            Each entity has its own workspace, logs, approvals, safety boundaries, and setup-required external integrations.
            Parent admin governance is the only cross-entity layer.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-4">
          {entityConfigs.map((entity) => (
            <Link
              key={entity.slug}
              href={`/dashboard/entities/${entity.slug}`}
              className="rounded-2xl border border-[#332A40] bg-[#191522] p-5 transition hover:-translate-y-1 hover:border-[#2DD4BF] hover:shadow-[0_24px_80px_rgba(0,0,0,0.35)]"
            >
              <div className={`h-1.5 rounded-full bg-gradient-to-r ${entity.theme.gradient}`} />
              <h2 className="mt-5 text-xl font-black text-white">{entity.name}</h2>
              <p className="mt-3 text-sm leading-6 text-[#C4BFD0]">{entity.description}</p>
              <p className="mt-4 text-xs font-black uppercase tracking-[0.2em] text-[#8F879C]">{entity.audience}</p>
            </Link>
          ))}
        </div>
      </section>
    </ProductShell>
  );
}
