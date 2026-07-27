import Link from "next/link";

export function AppSidebar({
  app,
  nav,
  accent,
}: {
  app: string;
  nav: readonly (readonly [string, string])[];
  accent: string;
}) {
  return (
    <aside className="card-surface rounded-3xl p-4">
      <p className="text-xs font-black uppercase tracking-wide text-slate-400">{app}</p>
      <ul className="mt-4 grid gap-2 text-sm">
        {nav.map(([label, href]) => (
          <li key={href}>
            <Link
              className="block rounded-2xl border border-transparent px-3 py-2 font-bold text-slate-200 transition hover:border-white/20 hover:bg-white/10"
              href={href}
              style={{ color: label === "Dashboard" ? accent : undefined }}
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}
