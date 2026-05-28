import Link from "next/link";
import { AppDashboardShell } from "../../../components/AppDashboardShell";

const researchCards = [
  {
    title: "Model Comparison Lab",
    body: "Setup-gated provider comparison with no live API calls until server-side keys, safety review, and cost controls exist.",
    href: "/app/research/model-comparison",
  },
  {
    title: "Open Source Watchlist",
    body: "External projects are documented as reference-only, review-required, or blocked before adoption.",
    href: "/research-lab/open-source",
  },
  {
    title: "Safe Web Research",
    body: "Crawling remains disabled until permission, robots handling, rate limits, queues, storage, and legal review are ready.",
    href: "/research-lab/crawling",
  },
] as const;

export default function AppResearchPage() {
  return (
    <AppDashboardShell title="Research Lab">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {researchCards.map((card) => (
          <Link key={card.title} href={card.href} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 hover:border-[#2DD4BF]">
            <p className="text-sm font-black text-white">{card.title}</p>
            <p className="mt-2 text-sm leading-6 text-[#CBD5E1]">{card.body}</p>
          </Link>
        ))}
      </section>
    </AppDashboardShell>
  );
}
