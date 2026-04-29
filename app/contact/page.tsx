import { ProductShell } from "../../components/ProductShell";

export default function ContactPage() {
  return (
    <ProductShell>
      <section className="rounded-lg border border-[#2A2A35] bg-[#171720] p-5">
        <p className="text-xs font-black uppercase text-[#22D3EE]">Contact</p>
        <h1 className="mt-2 text-3xl font-black">Contact SONARA Industries™</h1>
        <p className="mt-3 max-w-3xl leading-7 text-[#A1A1AA]">
          Support email placeholder: support@sonaraindustries.com. Add the final business address and response policy before
          public launch.
        </p>
      </section>
    </ProductShell>
  );
}
