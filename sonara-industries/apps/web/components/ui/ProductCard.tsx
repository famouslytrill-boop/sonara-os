import Link from "next/link";
import { Card } from "./Card";

export function ProductCard({
  title,
  body,
  href,
  accent,
  meta,
}: {
  title: string;
  body: string;
  href: string;
  accent: string;
  meta?: string;
}) {
  return (
    <Link className="block transition hover:-translate-y-1" href={href}>
      <Card title={title} accent={accent}>
        <p className="text-sm leading-6 text-slate-300">{body}</p>
        {meta ? <p className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-400">{meta}</p> : null}
      </Card>
    </Link>
  );
}
