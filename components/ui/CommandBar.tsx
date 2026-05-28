import Link from "next/link";

export function CommandBar({ links }: { links: { label: string; href: string }[] }) {
  return (
    <nav className="flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      {links.map((link) => (
        <Link
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 px-4 text-sm font-black text-white hover:border-[#2DD4BF]"
          href={link.href}
          key={link.href}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
