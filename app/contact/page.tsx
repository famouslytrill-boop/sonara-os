import { ProductShell } from "../../components/ProductShell";

export default function ContactPage() {
  return (
    <ProductShell>
      <section className="rounded-3xl border border-[#2A2A35] bg-[#171720] p-6">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-[#22D3EE]">Contact</p>
        <h1 className="mt-3 text-3xl font-black">Contact Umbrella Technologies</h1>
        <p className="mt-3 max-w-3xl leading-7 text-[#A1A1AA]">
          Support email placeholder: support@sonaraindustries.com. Add the final business address, response policy, and legal
          contact routing before public launch.
        </p>
      </section>
    </ProductShell>
  );
}
