import { ProductShell } from "../../components/ProductShell";

export default function OfflinePage() {
  return (
    <ProductShell>
      <section className="rounded-lg border border-[#2A2A35] bg-[#171720] p-5">
        <p className="text-xs font-black uppercase text-[#22D3EE]">Offline</p>
        <h1 className="mt-2 text-3xl font-black">SONARA OS™ is offline.</h1>
        <p className="mt-3 max-w-3xl leading-7 text-[#A1A1AA]">
          Reconnect to continue building songs, releases, artist systems, and studio workflows.
        </p>
      </section>
    </ProductShell>
  );
}
