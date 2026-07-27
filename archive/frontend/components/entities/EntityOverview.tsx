import Link from "next/link";
import type { EntityConfig } from "../../lib/entities/config";
import { createEntityHeartbeatSummary } from "../../lib/entities/operations";
import { getSessionCookieName } from "../../lib/entities/security";

export function EntityOverview({ entity }: { entity: EntityConfig }) {
  const heartbeat = createEntityHeartbeatSummary(entity);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="rounded-2xl border border-[#332A40] bg-[#191522] p-5 lg:col-span-2">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-[#8F879C]">Operating Boundary</p>
        <h2 className="mt-3 text-2xl font-black text-white">Independent workspace, isolated data, scoped operations.</h2>
        <p className="mt-3 leading-7 text-[#C4BFD0]">
          This entity has its own browser workspace, heartbeat status, proactive actions, agent registry,
          automation queue, connectors, logs, approvals, and safety boundaries. External integrations stay
          setup_required until credentials and runtimes are configured by a human operator.
        </p>
        <div className="mt-4 h-1.5 rounded-full" style={{ background: `linear-gradient(90deg, ${entity.theme.accent}, transparent)` }} />
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {[
            ["Audience", entity.audience],
            ["Session cookie", getSessionCookieName(entity.slug)],
            ["Health score", `${heartbeat.healthScore}/100`],
            ["Current status", heartbeat.status],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-[#332A40] bg-[#121018] p-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8F879C]">{label}</p>
              <p className="mt-2 text-sm font-bold text-white">{value}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-2xl border border-[#332A40] bg-[#191522] p-5">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-[#8F879C]">Next Actions</p>
        <div className="mt-4 space-y-3">
          {entity.proactiveActions.map((action) => (
            <div key={action.title} className="rounded-xl border border-[#332A40] bg-[#121018] p-3">
              <p className="font-bold text-white">{action.title}</p>
              <p className="mt-1 text-xs text-[#C4BFD0]">
                {action.priority} priority {action.requiresApproval ? " · approval required" : " · safe local check"}
              </p>
            </div>
          ))}
        </div>
        <Link
          href={`/dashboard/entities/${entity.slug}/actions`}
          className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#F9FAFB] px-4 text-sm font-black text-[#17131F] hover:bg-[#FFB454]"
        >
          Open Actions
        </Link>
      </div>
    </div>
  );
}
