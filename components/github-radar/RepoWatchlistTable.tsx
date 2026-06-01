import { githubRadarRepos } from "@/data/github-radar-repos";

export function RepoWatchlistTable() {
  return (
    <div className="grid gap-3">
      {githubRadarRepos.filter((repo) => !repo.blocked).map((repo) => (
        <div key={repo.repoUrl} className="rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm text-[#CBD5E1]">
          <strong className="text-white">{repo.name}</strong> - {repo.category} - {repo.score}/100
        </div>
      ))}
    </div>
  );
}
