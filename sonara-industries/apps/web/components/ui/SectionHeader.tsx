export function SectionHeader({
  eyebrow,
  title,
  body,
}: {
  eyebrow?: string;
  title: string;
  body?: string;
}) {
  return (
    <header className="mb-6 max-w-3xl">
      {eyebrow ? <p className="text-xs font-black uppercase tracking-wide text-cyan-300">{eyebrow}</p> : null}
      <h2 className="mt-2 text-2xl font-black text-white md:text-4xl">{title}</h2>
      {body ? <p className="mt-3 text-base leading-7 text-slate-300">{body}</p> : null}
    </header>
  );
}
