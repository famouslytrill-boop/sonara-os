import type { Metadata } from "next";
import { PublicShell } from "../../../components/PublicShell";

export const metadata: Metadata = {
  title: "Recommendation Research",
  description: "Ethical recommendation research for Growth Studio and Smart Recommendations.",
};

const allowed = [
  "content quality checklist",
  "audience fit scoring from user-provided context",
  "post consistency planning",
  "timing observations",
  "format comparison",
  "campaign learning notes",
  "creator/business education",
] as const;

const blocked = [
  "spam automation",
  "engagement bait engine",
  "botting",
  "fake accounts",
  "platform manipulation",
  "scraping private user data",
  "bypassing platform rules",
  "misinformation amplification",
] as const;

export default function RecommendationResearchPage() {
  return (
    <PublicShell>
      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-[#2DD4BF]">Recommendation Research</p>
        <h1 className="mt-3 max-w-4xl text-4xl font-black text-white">Recommendation systems must stay transparent.</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-[#CBD5E1]">
          Growth Studio can suggest next steps, but it cannot auto-execute risky actions or build manipulative feed
          mechanics.
        </p>
      </section>
      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <ListBlock title="Allowed research" items={allowed} tone="safe" />
        <ListBlock title="Blocked behavior" items={blocked} tone="blocked" />
      </section>
    </PublicShell>
  );
}

function ListBlock({ title, items, tone }: { title: string; items: readonly string[]; tone: "safe" | "blocked" }) {
  const color = tone === "safe" ? "text-[#BBF7D0]" : "text-[#FECACA]";

  return (
    <article className="rounded-2xl border border-white/10 bg-[#081827] p-5">
      <h2 className="text-xl font-black text-white">{title}</h2>
      <ul className="mt-4 grid gap-2">
        {items.map((item) => (
          <li key={item} className={`rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold ${color}`}>
            {item}
          </li>
        ))}
      </ul>
    </article>
  );
}
