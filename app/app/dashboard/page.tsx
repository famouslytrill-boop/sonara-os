import Link from "next/link";
import { AppDashboardShell } from "../../../components/AppDashboardShell";
import { ensureUserWorkspace } from "../../../lib/auth/workspace";
import { buildProductionReadinessCards } from "../../../lib/readiness/production";

export default async function AppDashboardPage() {
  const workspace = await ensureUserWorkspace();
  const dashboardCards = buildProductionReadinessCards(workspace);

  return (
    <AppDashboardShell title="Operational dashboard">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {dashboardCards.map((card) => (
          <Link key={card.title} href={card.href} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 hover:border-[#2DD4BF]">
            <p className="mb-3 w-fit rounded-full border border-[#2DD4BF]/35 bg-[#2DD4BF]/10 px-3 py-1 text-xs font-black uppercase text-[#99F6E4]">
              {card.status.replace("_", " ")}
            </p>
            <p className="text-sm font-black text-white">{card.title}</p>
            <p className="mt-2 text-sm leading-6 text-[#CBD5E1]">{card.body}</p>
          </Link>
        ))}
      </section>
    </AppDashboardShell>
  );
}
