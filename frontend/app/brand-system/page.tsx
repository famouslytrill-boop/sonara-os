import { ProductShell } from "../../components/ProductShell";
import { brandSystem, ecosystemNavItems } from "../../config/brandSystem";

export default function BrandSystemPage() {
  return (
    <ProductShell>
      <section className="rounded-lg border border-[#2A2A35] bg-[#171720] p-5">
        <p className="text-xs font-black uppercase text-[#22D3EE]">Brand governance</p>
        <h1 className="mt-2 text-3xl font-black">SONARA Brand System™</h1>
        <p className="mt-3 max-w-3xl leading-7 text-[#A1A1AA]">
          Manage the official identity, trademarks, divisions, and public-facing language for the SONARA Industries™ ecosystem.
        </p>
        <div className="mt-6 rounded-lg border border-[#F59E0B] bg-[#21190C] p-4">
          <p className="text-sm font-black text-[#F59E0B]">Trademark Notice</p>
          <p className="mt-2 text-sm leading-6 text-[#F8FAFC]">{brandSystem.legal.trademarkNotice}</p>
        </div>
      </section>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <InfoCard title="Parent Company" items={[brandSystem.parentCompany.name, brandSystem.parentCompany.type, brandSystem.parentCompany.description]} />
        <InfoCard title="Legal Footer" items={[brandSystem.legal.footer]} />
        <InfoCard title="App Store Copy" items={[brandSystem.publicCopy.appStoreShort, brandSystem.publicCopy.appStoreLong]} />
        <InfoCard title="Export Rules" items={["Use prepareBrandedExport(content).", "Replace restricted symbols before export.", "Append the legal footer once."]} />
      </div>

      <section className="mt-6 rounded-lg border border-[#2A2A35] bg-[#171720] p-5">
        <p className="text-sm font-black">Brand Divisions</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {Object.values(brandSystem.divisions).map((division) => (
            <div key={division.name} className="rounded-lg border border-[#2A2A35] bg-[#111118] p-4">
              <p className="font-black">{division.name}</p>
              <p className="mt-1 text-xs font-black uppercase text-[#22D3EE]">{division.type}</p>
              <p className="mt-2 text-sm leading-6 text-[#A1A1AA]">{division.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <InfoCard title="Product Tiers" items={brandSystem.productTiers.map((tier) => `${tier.name}: ${tier.features.join(", ")}`)} />
        <InfoCard title="Ecosystem Routes" items={ecosystemNavItems.map((item) => `${item.label} -> ${item.route}: ${item.description}`)} />
      </section>
    </ProductShell>
  );
}

function InfoCard({ items, title }: { items: readonly string[]; title: string }) {
  return (
    <div className="rounded-lg border border-[#2A2A35] bg-[#171720] p-4">
      <p className="text-sm font-black">{title}</p>
      <ul className="mt-3 grid gap-2 text-sm leading-6 text-[#A1A1AA]">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
