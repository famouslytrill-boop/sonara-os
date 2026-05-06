import { DivisionShell } from "@/components/layout/DivisionShell";
import { FeatureGrid } from "@/components/ui/FeatureGrid";
import { ButtonLink } from "@/components/ui/Button";
import { divisions } from "@/lib/divisions";

export default function Page() {
  return (
    <DivisionShell division="music">
      <p className="text-sm font-black uppercase tracking-[0.22em] text-white/65">SoundOS</p>
      <h1 className="app-heading mt-4 max-w-3xl font-black text-white">
        Dedicated music identity and release-readiness system.
      </h1>
      <p className="mt-5 max-w-3xl text-lg leading-8 text-white/75">
        {divisions.music.purpose} It serves artists, songwriters, producers, labels,
        managers, and creators without blending restaurant or civic workflows into the product.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <ButtonLink href="/music/onboarding" variant="music">Start onboarding</ButtonLink>
        <ButtonLink href="/music/pricing" variant="secondary">View pricing</ButtonLink>
      </div>
      <section className="mt-10">
        <FeatureGrid features={["Artist Genome", "Projects", "Catalog Vault", "Transcripts", "Exports", "Release Readiness"]} />
      </section>
    </DivisionShell>
  );
}
