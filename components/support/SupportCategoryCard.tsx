import Link from "next/link";

export function SupportCategoryCard({
  title,
  description,
  href = "/contact",
}: {
  title: string;
  description: string;
  href?: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition hover:border-[#2DD4BF]/60 hover:bg-white/[0.07] focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]"
    >
      <h2 className="text-lg font-black text-white">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-[#CBD5E1]">{description}</p>
    </Link>
  );
}
