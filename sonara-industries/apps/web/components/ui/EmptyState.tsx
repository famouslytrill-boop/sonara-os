import { ButtonLink } from "./Button";

export function EmptyState({
  title,
  body,
  actionLabel,
  actionHref,
}: {
  title: string;
  body: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-white/20 bg-black/20 p-6 text-center">
      <h3 className="font-black text-white">{title}</h3>
      <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-300">{body}</p>
      {actionLabel && actionHref ? (
        <div className="mt-5">
          <ButtonLink href={actionHref} variant="secondary">
            {actionLabel}
          </ButtonLink>
        </div>
      ) : null}
    </div>
  );
}
