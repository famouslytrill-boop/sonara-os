import Link from "next/link";
import { ProductShell } from "../../components/ProductShell";

export default function AdminPage() {
  return (
    <ProductShell>
      <section className="rounded-lg border border-[#332A40] bg-[#191522] p-5 text-[#F9FAFB]">
        <p className="text-xs font-black uppercase text-[#FFB454]">Admin</p>
        <h1 className="mt-2 text-3xl font-black">Protected admin workspace placeholder.</h1>
        <p className="mt-3 max-w-2xl leading-7 text-[#C4BFD0]">
          Admin controls must be protected by auth, role checks, and audit logging before production use. Use the Founder Command Center for launch readiness summaries.
        </p>
        <Link className="mt-5 inline-flex min-h-11 items-center rounded-lg bg-[#9B5CFF] px-4 text-sm font-bold text-white" href="/founder">
          Open Founder Command Center
        </Link>
      </section>
    </ProductShell>
  );
}
