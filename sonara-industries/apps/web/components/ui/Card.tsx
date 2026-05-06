import type { ReactNode } from "react";

export function Card({
  title,
  children,
  accent,
}: {
  title?: string;
  children: ReactNode;
  accent?: string;
}) {
  return (
    <section className="card-surface rounded-3xl p-5 backdrop-blur">
      {title ? (
        <h3 className="mb-3 text-lg font-black text-slate-50" style={accent ? { color: accent } : undefined}>
          {title}
        </h3>
      ) : null}
      {children}
    </section>
  );
}
