import type { GitHubRadarRepo } from "@/data/github-radar-repos";

export function RepoRiskMatrix({ repo }: { repo: GitHubRadarRepo }) {
  const rows = [
    ["License", repo.licenseRisk],
    ["Security", repo.securityStatus],
    ["Privacy", repo.privacyStatus],
    ["Integration", repo.integrationStatus],
  ];
  return (
    <dl className="grid gap-2 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
          <dt className="font-bold text-white">{label}</dt>
          <dd className="text-[#CBD5E1]">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
