import { AppDashboardShell } from "./AppDashboardShell";

export function ReadinessAppPage({
  title,
  description,
  cards,
}: {
  title: string;
  description: string;
  cards: { title: string; body: string; status?: string }[];
}) {
  return (
    <AppDashboardShell title={title}>
      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
        <p className="max-w-3xl text-sm leading-6 text-[#CBD5E1]">{description}</p>
      </section>
      <section className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <article key={card.title} className="rounded-2xl border border-white/10 bg-[#081827] p-5">
            {card.status ? (
              <p className="mb-3 w-fit rounded-full border border-[#2DD4BF]/35 bg-[#2DD4BF]/10 px-3 py-1 text-xs font-black text-[#99F6E4]">
                {card.status}
              </p>
            ) : null}
            <h2 className="text-lg font-black text-white">{card.title}</h2>
            <p className="mt-3 text-sm leading-6 text-[#CBD5E1]">{card.body}</p>
          </article>
        ))}
      </section>
    </AppDashboardShell>
  );
}
