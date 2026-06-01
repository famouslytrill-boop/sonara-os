export function BusinessToolStack({ tools }: { tools: string[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#081827] p-5">
      <h2 className="text-lg font-black text-white">Tool stack</h2>
      <ul className="mt-4 grid gap-2 text-sm text-[#CBD5E1] sm:grid-cols-2">
        {tools.map((tool) => (
          <li key={tool} className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
            {tool}
          </li>
        ))}
      </ul>
    </div>
  );
}
