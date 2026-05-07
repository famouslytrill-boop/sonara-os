import Link from "next/link";
import { PublicShell } from "../../components/PublicShell";

const trustNotes = [
  "SONARA Industries is the parent company behind independent systems serving creators, restaurants, and communities.",
  "Each company surface keeps its own onboarding, dashboards, permissions, and operational boundaries.",
  "Stripe handles payment collection when billing is configured; this app does not store payment card data.",
  "Private workspace data must remain protected by Supabase authentication, RLS policies, and server-side entitlement checks.",
  "Community/Public Information organizes public and organization-submitted information; it does not imply official government partnership unless separately verified.",
  "Launchpad does not guarantee deployment success, revenue, approval, market demand, or legal clearance.",
  "Unsupported connectors, agents, automations, and external runtimes remain setup-required until credentials and approvals are configured.",
  "Brand names and logo directions require trademark and legal review before final public launch.",
] as const;

export default function TrustPage() {
  return (
    <PublicShell>
      <section className="rounded-3xl border border-[#332A40] bg-[#121018] p-6 text-[#F9FAFB]">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-[#00E5FF]">Trust & safety</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-black">Shared security spine. Separate company data.</h1>
        <p className="mt-4 max-w-3xl leading-7 text-[#C4BFD0]">
          The platform is designed for clear boundaries across the parent company, creator tools, business operations, and
          community information workflows.
        </p>
      </section>
      <section className="mt-6 rounded-3xl border border-[#332A40] bg-[#121018] p-6">
        <ul className="grid gap-3 text-sm leading-6 text-[#C4BFD0]">
          {trustNotes.map((note) => (
            <li key={note}>- {note}</li>
          ))}
        </ul>
        <Link
          className="mt-5 inline-flex min-h-11 items-center rounded-full bg-[#00E5FF] px-5 text-sm font-black text-[#0B0F14]"
          href="/support"
        >
          Contact support
        </Link>
      </section>
    </PublicShell>
  );
}
