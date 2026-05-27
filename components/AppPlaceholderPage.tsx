import { AppDashboardShell } from "./AppDashboardShell";

const defaultCards = ["Setup progress", "Recent activity", "Money path", "Trust status", "Alerts", "Next best steps"];

export function AppPlaceholderPage({ title, cards = defaultCards }: { title: string; cards?: string[] }) {
  return (
    <AppDashboardShell title={title}>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <article key={card} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-sm font-black text-white">{card}</p>
            <p className="mt-2 text-sm leading-6 text-[#CBD5E1]">
              Setup mode. Real records, metrics, and actions appear only after auth, database, and provider configuration.
            </p>
          </article>
        ))}
      </section>
    </AppDashboardShell>
  );
}
