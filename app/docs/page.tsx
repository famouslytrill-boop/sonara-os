import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell } from "../../components/PublicShell";

export const metadata: Metadata = {
  title: "Docs",
  description:
    "Launch and operating documentation for SONARA Industries.",
};

const docs = [
  {
    title: "Launch Boundaries",
    body: "Paid users, production uploads, public notices, and billing require real auth, RLS, webhooks, and QA.",
    href: "/legal",
  },
  {
    title: "Trust Model",
    body: "Public, billing, role, deletion, notification, and generated alert actions stay approval-gated.",
    href: "/trust",
  },
  {
    title: "Product Overview",
    body: "TrackFoundry, LineReady, and NoticeGrid each stand independently under SONARA Industries.",
    href: "/",
  },
];

export default function DocsPage() {
  return (
    <PublicShell>
      <section className="rounded-3xl border border-[#1F2937] bg-[#111827] p-6">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-[#00E5FF]">
          Docs
        </p>
        <h1 className="mt-3 max-w-3xl text-4xl font-black text-white">
          Practical launch documentation.
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-[#C4BFD0]">
          These docs keep the MVP honest: what is safe to browse today, what
          needs manual setup, and which actions require human approval before
          they can affect customers or public information.
        </p>
      </section>
      <section className="mt-6 grid gap-4 md:grid-cols-3">
        {docs.map((doc) => (
          <Link
            className="rounded-3xl border border-[#1F2937] bg-[#111827] p-5 transition hover:-translate-y-0.5 hover:border-[#00E5FF]"
            href={doc.href}
            key={doc.title}
          >
            <h2 className="text-lg font-black text-white">{doc.title}</h2>
            <p className="mt-3 text-sm leading-6 text-[#C4BFD0]">{doc.body}</p>
          </Link>
        ))}
      </section>
    </PublicShell>
  );
}
