export function Tabs({ items }: { items: string[] }) {
  return <div className="flex flex-wrap gap-2">{items.map((item) => <button className="rounded-full border border-white/10 px-3 py-2 text-sm font-bold" key={item}>{item}</button>)}</div>;
}

