import { ProductShell } from "../../components/ProductShell";

export default function PrivacyPage() {
  return (
    <ProductShell>
      <section className="rounded-lg border border-[#2A2A35] bg-[#171720] p-5">
        <p className="text-xs font-black uppercase text-[#22D3EE]">Legal</p>
        <h1 className="mt-2 text-3xl font-black">Privacy Policy</h1>
        <div className="mt-3 grid max-w-3xl gap-4 leading-7 text-[#A1A1AA]">
          <p>
            SONARA Industries™ stores only the creator workflow data needed to operate song fingerprints, release plans,
            private export packages, account services, and launch-readiness tools.
          </p>
          <p>
            Project data may include account details, project notes, export files, release metadata, sound upload metadata,
            attribution notes, license proof references, and workspace settings.
          </p>
          <p>
            Optional provider keys are user-controlled. SONARA OS™ must run in Local Rules mode without a paid provider key,
            and bring-your-own-key provider use should be enabled only by the workspace owner.
          </p>
          <p>Support contact placeholder: support@sonaraindustries.com.</p>
        </div>
      </section>
    </ProductShell>
  );
}
