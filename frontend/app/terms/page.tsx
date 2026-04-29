import { ProductShell } from "../../components/ProductShell";

export default function TermsPage() {
  return (
    <ProductShell>
      <section className="rounded-lg border border-[#2A2A35] bg-[#171720] p-5">
        <p className="text-xs font-black uppercase text-[#22D3EE]">Legal</p>
        <h1 className="mt-2 text-3xl font-black">Terms of Service</h1>
        <div className="mt-3 grid max-w-3xl gap-4 leading-7 text-[#A1A1AA]">
          <p>
            SONARA OS™ provides music identity, release-readiness, workflow, and export tools. It does not guarantee income,
            placements, hits, legal outcomes, tax outcomes, streaming approval, copyright clearance, or distribution results.
          </p>
          <p>
            Users are responsible for rights clearance, credits, samples, likeness permissions, metadata accuracy, and
            compliance with the rules of any distributor, marketplace, platform, venue, or collaborator.
          </p>
          <p>
            SONARA does not provide fake streaming, bot activity, engagement manipulation, or unlicensed sound redistribution
            tools.
          </p>
          <p>
            SONARA Industries™, SONARA Records™, SONARA OS™, SONARA Vault™, SONARA Engine™, SONARA Exchange™, and SONARA
            Labs™ are claimed trademarks of SONARA Industries.
          </p>
        </div>
      </section>
    </ProductShell>
  );
}
