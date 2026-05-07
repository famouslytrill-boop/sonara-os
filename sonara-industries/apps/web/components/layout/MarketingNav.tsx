import Link from "next/link";

const links = [
  ["About", "/about"],
  ["TrackFoundry", "/trackfoundry"],
  ["LineReady", "/lineready"],
  ["NoticeGrid", "/noticegrid"],
  ["Docs", "/docs"],
  ["Trust", "/trust"],
  ["Legal", "/legal"],
] as const;

export function MarketingNav() {
  return (
    <nav className="container flex flex-wrap items-center justify-between gap-4 py-5">
      <Link href="/" className="text-lg font-black text-white">
        SONARA Industries
      </Link>
      <div className="flex flex-wrap gap-2 text-sm text-slate-200">
        {links.map(([label, href]) => (
          <Link className="readable-pill rounded-full px-3 py-2 transition hover:border-cyan-300 hover:text-white" key={href} href={href}>
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
