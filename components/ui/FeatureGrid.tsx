export function FeatureGrid({ items }: { items: { title: string; body: string }[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <article key={item.title} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <h2 className="text-lg font-black text-white">{item.title}</h2>
          <p className="mt-3 text-sm leading-6 text-[#CBD5E1]">{item.body}</p>
        </article>
      ))}
    </div>
  );
}
