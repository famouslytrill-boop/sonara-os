import { buildSoundIdentity } from "../../lib/sonara/soundIdentity/soundIdentityEngine";
import type { SoundIdentityResult } from "../../lib/sonara/soundIdentity/soundIdentityTypes";

export function SoundIdentityCard({ identity = buildSoundIdentity() }: { identity?: SoundIdentityResult }) {
  return (
    <section className="rounded-lg border border-[#332A40] bg-[#191522] p-4 text-[#F9FAFB]">
      <p className="text-xs font-black uppercase text-[#2DD4BF]">Sound Identity</p>
      <h3 className="mt-2 text-xl font-black">Signature sound checks</h3>
      <ul className="mt-3 grid gap-1 text-sm leading-6 text-[#C4BFD0]">
        {identity.signatureElements.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
