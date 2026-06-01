export function LocalEdgeModeCard() {
  return (
    <article className="rounded-2xl border border-white/10 bg-[#081827] p-5">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#2DD4BF]">Optional</p>
      <h2 className="mt-3 text-lg font-black text-white">Local Edge Mode</h2>
      <p className="mt-3 text-sm leading-6 text-[#CBD5E1]">
        Local storage is planned for drafts, temporary processing, and offline review only. Cloud Postgres remains the source of truth.
      </p>
    </article>
  );
}
