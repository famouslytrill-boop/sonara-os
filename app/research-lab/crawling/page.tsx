import type { Metadata } from "next";
import { PublicShell } from "../../../components/PublicShell";
import { researchSourceTypes } from "../../../data/research-source-types";
import { crawlPolicyDefaults, crawlPolicyRules } from "../../../lib/research/crawl-policy";

export const metadata: Metadata = {
  title: "Safe Web Research Policy",
  description: "Crawl4AI-style research intake planning with permission, rate limit, robots, and source safety gates.",
};

export default function CrawlingPolicyPage() {
  return (
    <PublicShell>
      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-[#2DD4BF]">Safe Web Research</p>
        <h1 className="mt-3 max-w-4xl text-4xl font-black text-white">Public-source research must be permission-aware.</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-[#CBD5E1]">
          This is a Crawl4AI-style adapter plan for future user-authorized and public research intake. Live crawling is
          disabled until dependencies, hosting, queueing, robots handling, storage, and legal review are complete.
        </p>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        {crawlPolicyRules.map((rule) => (
          <article key={rule.label} className="rounded-2xl border border-white/10 bg-[#081827] p-5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#99F6E4]">{rule.status.replaceAll("_", " ")}</p>
            <h2 className="mt-3 text-xl font-black text-white">{rule.label}</h2>
            <p className="mt-3 text-sm leading-6 text-[#CBD5E1]">{rule.detail}</p>
          </article>
        ))}
      </section>

      <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-6">
        <h2 className="text-2xl font-black text-white">Research source intake placeholder</h2>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <Placeholder label="URL review" value="User-provided URL required" />
          <Placeholder label="Permission checkbox" value="Owner confirms permission before collection" />
          <Placeholder label="Crawl depth" value={crawlPolicyDefaults.maxDepth} />
          <Placeholder label="Rate limit" value={crawlPolicyDefaults.rateLimit} />
          <Placeholder label="Storage" value={crawlPolicyDefaults.storage} />
          <Placeholder label="Live crawling" value={crawlPolicyDefaults.liveCrawling} />
        </div>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        {researchSourceTypes.map((source) => (
          <article key={source.label} className="rounded-2xl border border-white/10 bg-[#081827] p-5">
            <h2 className="text-xl font-black text-white">{source.label}</h2>
            <p className="mt-3 text-sm font-bold text-[#99F6E4]">Default: {source.defaultStatus.replaceAll("_", " ")}</p>
            <p className="mt-3 text-sm leading-6 text-[#CBD5E1]">{source.examples.join(", ")}</p>
          </article>
        ))}
      </section>
    </PublicShell>
  );
}

function Placeholder({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#081827] p-4">
      <p className="text-sm font-black text-white">{label}</p>
      <p className="mt-2 text-sm leading-6 text-[#CBD5E1]">{value}</p>
    </div>
  );
}
