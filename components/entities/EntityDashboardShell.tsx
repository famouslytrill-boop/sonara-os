import Link from "next/link";
import { ReactNode } from "react";
import { entityDashboardSections, type EntityConfig } from "../../lib/entities/config";

export function EntityDashboardShell({
  entity,
  activePath = "",
  children,
}: {
  entity: EntityConfig;
  activePath?: string;
  children: ReactNode;
}) {
  const baseHref = `/dashboard/entities/${entity.slug}`;

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-[#332A40] bg-[#121018] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <Link href="/dashboard/entities" className="text-sm font-bold text-[#2DD4BF] hover:text-white">
              Entities
            </Link>
            <h1 className={`mt-3 bg-gradient-to-r ${entity.theme.gradient} bg-clip-text text-3xl font-black text-transparent sm:text-4xl`}>
              {entity.name}
            </h1>
            <p className="mt-3 text-base leading-7 text-[#C4BFD0]">{entity.description}</p>
          </div>
          <div className="rounded-2xl border border-[#332A40] bg-[#08070B] px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#8F879C]">Session Scope</p>
            <p className="mt-1 text-sm font-bold text-white">{entity.entityType}</p>
            <p className="mt-1 text-xs text-[#C4BFD0]">Cookie namespace is entity-specific.</p>
          </div>
        </div>
      </div>

      <nav className="grid gap-2 rounded-2xl border border-[#332A40] bg-[#0D0B12] p-2 text-sm font-bold sm:grid-cols-3 lg:grid-cols-9">
        {entityDashboardSections.map((section) => {
          const href = section.path ? `${baseHref}/${section.path}` : baseHref;
          const isActive = activePath === section.path;
          return (
            <Link
              key={section.path || "overview"}
              href={href}
              className={`rounded-xl px-3 py-2 text-center transition ${
                isActive ? "bg-[#F9FAFB] text-[#17131F]" : "text-[#C4BFD0] hover:bg-[#211B2D] hover:text-white"
              }`}
            >
              {section.label}
            </Link>
          );
        })}
      </nav>

      {children}
    </section>
  );
}
