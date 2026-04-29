import { Fingerprint, Music2 } from "lucide-react";
import { ProductShell } from "../../components/ProductShell";
import { ProjectLibrary } from "../../components/ProjectLibrary";

const libraryStates = [
  { label: "Fingerprints", value: "Ready for Supabase" },
  { label: "Release plans", value: "Structured JSON" },
  { label: "Storage", value: "Private assets only" },
];

export default function LibraryPage() {
  return (
    <ProductShell>
      <section className="rounded-lg border border-[#2A2A35] bg-[#171720] p-5 text-[#F8FAFC]">
        <p className="text-xs font-black uppercase text-[#22D3EE]">Library</p>
        <h1 className="mt-2 text-3xl font-black text-[#F8FAFC]">Build an Artist System.</h1>
        <p className="mt-3 max-w-2xl leading-7 text-[#A1A1AA]">
          The library is for identity, release state, sound direction, and artist-business organization. It is not a streaming catalog, analytics clone, or distributor.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {libraryStates.map((item) => (
            <div key={item.label} className="rounded-lg border border-[#2A2A35] bg-[#111118] p-4">
              <Music2 className="text-[#22D3EE]" size={22} />
              <p className="mt-3 text-sm font-black text-[#F8FAFC]">{item.label}</p>
              <p className="mt-1 text-sm text-[#A1A1AA]">{item.value}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 rounded-lg border border-[#2A2A35] bg-[#111118] p-4">
          <div className="flex items-center gap-3">
            <Fingerprint className="text-[#8B5CF6]" size={24} />
            <p className="font-black text-[#F8FAFC]">Next launch step</p>
          </div>
          <p className="mt-2 text-sm leading-6 text-[#A1A1AA]">
            Connect Supabase to persist fingerprints, release plans, and private export packages.
          </p>
        </div>
        <ProjectLibrary />
      </section>
    </ProductShell>
  );
}
