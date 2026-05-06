export function StatCard({ label, value }: { label: string; value: string }) {
  return <div className="rounded-3xl border border-white/10 bg-black/20 p-4"><p className="text-sm text-slate-400">{label}</p><p className="mt-2 text-3xl font-black">{value}</p></div>;
}

