import { CreateWorkbench } from "../../components/CreateWorkbench";
import { ProductShell } from "../../components/ProductShell";

type InstrumentRole = {
  name: string;
  purpose: string;
  howToUse: string;
};

const workflowSteps = [
  "Enter the song title.",
  "Add the creator, artist, or team name.",
  "Describe the mood, hook, audience, mix state, assets, and timeline.",
  "Run SONARA Core.",
  "Review the fingerprint, readiness state, runtime target, prompt length mode, and external generator settings.",
  "Save the project when Supabase is connected, or export the release package from the Export page.",
];

const instruments: InstrumentRole[] = [
  {
    name: "Drums",
    purpose: "Controls energy, movement, bounce, and street or commercial feel.",
    howToUse: "Use tight drums for clean pop or R&B. Use harder kicks, trap hats, and 808 movement for rap, drill, trap, or darker records.",
  },
  {
    name: "Bass / 808",
    purpose: "Gives the song weight, emotion, and physical impact.",
    howToUse: "Use long gliding 808s for trap and pain records. Use shorter bass notes for pop, dance, and radio-ready tracks.",
  },
  {
    name: "Piano / Keys",
    purpose: "Builds emotion, melody, intimacy, and harmonic identity.",
    howToUse: "Use soft piano for vulnerable songs. Use dark keys for luxury, villain, trap, or nighttime moods.",
  },
  {
    name: "Guitar",
    purpose: "Adds warmth, pain, country influence, acoustic texture, or a live-band feeling.",
    howToUse: "Use clean guitar for emotional songs. Use muted guitar loops for modern country, pop rap, or melodic records.",
  },
  {
    name: "Synths / Pads",
    purpose: "Creates atmosphere, space, tension, and cinematic emotion.",
    howToUse: "Use wide pads for dreamy hooks. Use darker synths for tension, mystery, or futuristic brand identity.",
  },
  {
    name: "Strings / Choir",
    purpose: "Adds drama, scale, cinematic lift, and premium emotion.",
    howToUse: "Use strings in bridges, intros, or final hooks. Use choir lightly for power, suspense, or spiritual weight.",
  },
  {
    name: "Vocals",
    purpose: "Carries identity, emotion, cadence, hook, and replay value.",
    howToUse: "Use conversational verses, memorable hooks, controlled ad-libs, stacked harmonies, and delay throws for a finished sound.",
  },
];

export default function CreatePage() {
  return (
    <ProductShell>
      <div className="grid gap-6">
        <CreateWorkbench />

        <section className="rounded-lg border border-[#2A2A35] bg-[#171720] p-5 text-[#F8FAFC]">
          <p className="text-xs font-black uppercase text-[#22D3EE]">Workflow</p>
          <h2 className="mt-2 text-2xl font-black">How to use the song builder</h2>
          <ol className="mt-4 grid gap-2 text-sm leading-6 text-[#A1A1AA]">
            {workflowSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>

        <section className="rounded-lg border border-[#2A2A35] bg-[#171720] p-5 text-[#F8FAFC]">
          <p className="text-xs font-black uppercase text-[#22D3EE]">Instrument Guide</p>
          <h2 className="mt-2 text-2xl font-black">How SONARA Core reads the arrangement</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {instruments.map((instrument) => (
              <article key={instrument.name} className="rounded-lg border border-[#2A2A35] bg-[#111118] p-4">
                <h3 className="text-sm font-black text-[#F8FAFC]">{instrument.name}</h3>
                <p className="mt-2 text-sm leading-6 text-[#A1A1AA]">{instrument.purpose}</p>
                <p className="mt-2 text-sm leading-6 text-[#A1A1AA]">{instrument.howToUse}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </ProductShell>
  );
}
