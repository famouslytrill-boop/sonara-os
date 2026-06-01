import { githubRadarRepos } from "@/data/github-radar-repos";

export function RepoBlocklistPanel() {
  return (
    <section className="rounded-2xl border border-red-300/25 bg-red-300/10 p-5">
      <h2 className="text-lg font-black text-red-100">Blocked Repository Classes</h2>
      <ul className="mt-3 grid gap-2 text-sm text-red-50">
        {githubRadarRepos.filter((repo) => repo.blocked).map((repo) => (
          <li key={repo.repoUrl}>{repo.name}: {repo.blockedReason}</li>
        ))}
      </ul>
    </section>
  );
}
