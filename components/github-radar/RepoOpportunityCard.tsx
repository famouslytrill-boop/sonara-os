import type { GitHubRadarRepo } from "@/data/github-radar-repos";
import { RepoScoreBadge } from "./RepoScoreBadge";
import { LicenseRiskBadge } from "./LicenseRiskBadge";
import { ProductFitBadge } from "./ProductFitBadge";

export function RepoOpportunityCard({ repo }: { repo: GitHubRadarRepo }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-[#081827] p-5">
      <div className="flex flex-wrap items-center gap-2">
        <RepoScoreBadge score={repo.score} />
        <LicenseRiskBadge risk={repo.licenseRisk} />
      </div>
      <h2 className="mt-4 text-xl font-black text-white">{repo.name}</h2>
      <p className="mt-2 text-sm leading-6 text-[#CBD5E1]">{repo.recommendedAction}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {repo.productFit.map((fit) => (
          <ProductFitBadge key={fit} label={fit} />
        ))}
      </div>
    </article>
  );
}
