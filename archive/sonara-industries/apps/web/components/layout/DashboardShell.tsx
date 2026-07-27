export function DashboardShell({ sidebar, children }: { sidebar: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
      {sidebar}
      <section>{children}</section>
    </div>
  );
}
