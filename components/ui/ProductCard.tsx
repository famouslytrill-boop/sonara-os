import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function ProductCard({
  title,
  description,
  href,
  accent = "#2DD4BF",
}: {
  title: string;
  description: string;
  href: string;
  accent?: string;
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <div className="h-1.5 w-20 rounded-full" style={{ background: accent }} />
      <h2 className="mt-4 text-xl font-black text-white">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-[#CBD5E1]">{description}</p>
      <Link
        className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 px-4 text-sm font-black text-white"
        href={href}
      >
        Open <ArrowRight size={16} />
      </Link>
    </article>
  );
}
