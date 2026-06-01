export function ResearchSourceCard({
  title,
  description,
  status,
}: {
  title: string;
  description: string;
  status: string;
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <p className="w-fit rounded-full border border-[#2DD4BF]/35 bg-[#2DD4BF]/10 px-3 py-1 text-xs font-black text-[#99F6E4]">
        {status}
      </p>
      <h2 className="mt-4 text-lg font-black text-white">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-[#CBD5E1]">{description}</p>
    </article>
  );
}
