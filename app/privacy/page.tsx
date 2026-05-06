import { ProductShell } from "../../components/ProductShell";

export default function PrivacyPage() {
  return (
    <ProductShell>
      <section className="rounded-3xl border border-[#2A2A35] bg-[#171720] p-6">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-[#22D3EE]">Legal template</p>
        <h1 className="mt-3 text-3xl font-black">Privacy Policy Template</h1>
        <div className="mt-4 grid max-w-3xl gap-4 leading-7 text-[#A1A1AA]">
          <p>
            Umbrella Technologies is a working parent brand direction for separate systems serving creator technology, business
            operations, and community/public information workflows.
          </p>
          <p>
            Product data may include account details, organization membership, project notes, uploaded asset metadata, billing
            status, audit events, connector settings, and setup-required integration state.
          </p>
          <p>
            Server-only credentials must remain in hosting secret storage. Public frontend configuration may only use framework-safe
            public environment variables.
          </p>
          <p>This template must be reviewed by a qualified attorney before production launch.</p>
        </div>
      </section>
    </ProductShell>
  );
}
