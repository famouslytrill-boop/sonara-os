import Link from "next/link";
import { PublicShell } from "../../components/PublicShell";

export default function LoginPage() {
  return (
    <PublicShell>
      <section className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-white/[0.04] p-6">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-[#2DD4BF]">Login</p>
        <h1 className="mt-3 text-4xl font-black text-white">SONARA One access</h1>
        <p className="mt-4 text-sm leading-7 text-[#CBD5E1]">
          Authentication is setup-gated in this shell. Production login must be connected to the approved auth provider
          before private workspaces or admin routes go live.
        </p>
        <Link
          href="/app"
          className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-[#2DD4BF] px-5 text-sm font-black text-[#07111F]"
        >
          View app shell
        </Link>
      </section>
    </PublicShell>
  );
}
