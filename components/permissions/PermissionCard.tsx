export function PermissionCard({ title, body }: { title: string; body: string }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <h2 className="text-lg font-black text-white">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-[#CBD5E1]">{body}</p>
    </article>
  );
}
