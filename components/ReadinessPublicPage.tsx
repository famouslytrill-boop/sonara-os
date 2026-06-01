import Link from "next/link";
import { PublicShell } from "./PublicShell";

export type ReadinessLink = {
  label: string;
  href: string;
};

export function ReadinessPublicPage({
  eyebrow,
  title,
  description,
  sections,
  links = [],
}: {
  eyebrow: string;
  title: string;
  description: string;
  sections: { title: string; body: string; items?: string[] }[];
  links?: ReadinessLink[];
}) {
  return (
    <PublicShell>
      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-[#2DD4BF]">{eyebrow}</p>
        <h1 className="mt-3 max-w-4xl text-4xl font-black leading-tight text-white">{title}</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-[#CBD5E1]">{description}</p>
        {links.length ? (
          <div className="mt-6 flex flex-wrap gap-3">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="inline-flex min-h-11 items-center rounded-xl border border-white/15 px-4 text-sm font-black text-white hover:border-[#2DD4BF] focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]"
              >
                {link.label}
              </Link>
            ))}
          </div>
        ) : null}
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        {sections.map((section) => (
          <article key={section.title} className="rounded-2xl border border-white/10 bg-[#081827] p-5">
            <h2 className="text-xl font-black text-white">{section.title}</h2>
            <p className="mt-3 text-sm leading-6 text-[#CBD5E1]">{section.body}</p>
            {section.items?.length ? (
              <ul className="mt-4 grid gap-2 text-sm text-[#CBD5E1]">
                {section.items.map((item) => (
                  <li key={item} className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
                    {item}
                  </li>
                ))}
              </ul>
            ) : null}
          </article>
        ))}
      </section>
    </PublicShell>
  );
}
