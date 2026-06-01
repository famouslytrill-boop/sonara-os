export function SafetyBoundaryNotice({ items }: { items: string[] }) {
  return (
    <div className="rounded-2xl border border-[#FFB454]/40 bg-[#FFB454]/10 p-5">
      <h2 className="text-lg font-black text-white">Safety boundaries</h2>
      <ul className="mt-3 grid gap-2 text-sm leading-6 text-[#FDE68A]">
        {items.map((item) => (
          <li key={item} className="rounded-xl border border-[#FFB454]/30 bg-[#07111F]/70 px-4 py-3">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
