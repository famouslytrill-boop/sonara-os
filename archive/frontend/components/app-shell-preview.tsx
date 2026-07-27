import type { BrandDefinition, ProductMode } from "../lib/brand-registry";
import { productModes, roleCapabilities } from "../lib/brand-registry";

const modes = Object.keys(productModes) as ProductMode[];

export function AppShellPreview({ brand }: { brand: BrandDefinition }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#0B0B10] text-white">
      <div className="grid lg:grid-cols-[240px_1fr]">
        <aside className="border-b border-white/10 bg-black/30 p-4 lg:border-b-0 lg:border-r">
          <p className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: brand.theme.accent2 }}>
            {brand.name} App
          </p>
          <nav className="mt-4 grid gap-1">
            {brand.dashboard.sidebar.map((item) => (
              <a key={item} className="rounded-lg px-3 py-2 text-sm font-bold text-slate-300 hover:bg-white/10 hover:text-white">
                {item}
              </a>
            ))}
          </nav>
        </aside>

        <div className="p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: brand.theme.accent2 }}>
                Dashboard shell
              </p>
              <h2 className="mt-2 text-3xl font-black">Daily command view</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                Complexity starts hidden. Teams move through the mode system as the work becomes more serious.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {modes.map((mode) => (
                <div key={mode} className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
                  <p className="text-xs font-black">{mode}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">{productModes[mode]}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {brand.dashboard.metrics.map((metric) => (
              <div key={metric.label} className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-xs font-bold uppercase text-slate-400">{metric.label}</p>
                <p className="mt-2 text-3xl font-black" style={{ color: brand.theme.accent2 }}>
                  {metric.value}
                </p>
                <p className="mt-1 text-sm text-slate-300">{metric.helper}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_0.85fr]">
            <Panel title="Priority workflow" items={brand.dashboard.priorityWorkflow} accent={brand.theme.accent2} />
            <Panel title="Approval state" items={brand.dashboard.approvals} accent={brand.theme.accent} />
            <Panel title="Empty states" items={brand.dashboard.emptyStates} accent={brand.theme.accent2} />
            <Panel title="Clear actions" items={brand.dashboard.ctas} accent={brand.theme.accent} />
          </div>

          <div className="mt-5 rounded-xl border border-white/10 bg-black/25 p-4">
            <p className="text-sm font-black">Role-based UI</p>
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              {(["owner", "manager", "staff"] as const).map((role) => (
                <div key={role} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-xs font-black uppercase" style={{ color: brand.theme.accent2 }}>
                    {role}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-300">{roleCapabilities[role].join(", ")}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Panel({ accent, items, title }: { accent: string; items: string[]; title: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
      <p className="text-sm font-black text-white">{title}</p>
      <ul className="mt-3 grid gap-2 text-sm text-slate-300">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span style={{ color: accent }}>•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
