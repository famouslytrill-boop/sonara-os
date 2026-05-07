import Link from "next/link";

const links = [
  ["Products", "/#products"],
  ["TrackFoundry", "/trackfoundry"],
  ["LineReady", "/lineready"],
  ["NoticeGrid", "/noticegrid"],
  ["Pricing", "/pricing"],
  ["Trust", "/trust"],
  ["Docs", "/docs"],
] as const;

export function MarketingNav() {
  return (
    <nav aria-label="Primary navigation" className="container sticky top-0 z-40 flex flex-col gap-3 py-4 backdrop-blur md:flex-row md:items-center md:justify-between md:gap-4 md:py-5">
      <Link href="/" className="tap-target inline-flex items-center gap-3 rounded-2xl text-base font-black text-white md:text-lg" aria-label="SONARA Industries home">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl border border-cyan-300/35 bg-slate-950 text-sm font-black text-cyan-200 shadow-lg shadow-cyan-950/30">SI</span>
        <span className="min-w-0 leading-tight">
          <span className="block truncate">SONARA Industries</span>
          <span className="block text-[0.68rem] font-bold uppercase tracking-[0.2em] text-slate-400">House of brands</span>
        </span>
      </Link>
      <div className="flex max-w-full gap-2 overflow-x-auto pb-1 text-sm text-slate-200 md:flex-wrap md:justify-end md:overflow-visible md:pb-0">
        {links.map(([label, href]) => (
          <Link className="readable-pill tap-target inline-flex shrink-0 items-center rounded-full px-3 py-2 text-xs font-bold transition hover:border-cyan-300 hover:text-white md:text-sm" key={href} href={href}>
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
