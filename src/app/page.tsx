import {
  ButtonLink,
  Card,
  Grid,
  Notice,
  PageShell,
} from "@/components/sonara/LaunchShell";
import { cloudArchitecture } from "@/config/cloudArchitecture";
import { competitiveDifferentiation } from "@/config/competitiveDifferentiation";
import { productPositioning } from "@/config/productPositioning";

const bentoCards = [
  "Idea to Arrangement",
  "Lyrics to Structure",
  "Word Intelligence",
  "Sound Direction",
  "Rights-Aware Vault",
  "Metadata Readiness",
  "Release Strategy",
  "Export Bundles",
];

export default function HomePage() {
  return (
    <PageShell
      eyebrow="SONARA Industries™"
      title="SONARA Industries™"
      subtitle="A creator operating system for music as a whole."
      actions={
        <>
          <ButtonLink href="/dashboard">Launch SONARA OS™</ButtonLink>
          <ButtonLink href="/pricing" variant="secondary">
            View Pricing
          </ButtonLink>
        </>
      }
    >
      <Notice>
        SONARA OS™ helps artists, songwriters, producers, bands, labels,
        engineers, managers, content creators, and music entrepreneurs turn ideas
        into structured songs, release-ready assets, and export-ready creative
        bundles. Use SONARA OS™ from your browser. No desktop install required
        for the core workflow.
      </Notice>

      <section style={{ maxWidth: "920px", marginBottom: "26px" }}>
        <h2>Built for traditional, AI-assisted, and hybrid music workflows.</h2>
        <p style={{ color: "#6E657A", lineHeight: 1.7, fontSize: "18px" }}>
          {productPositioning.primaryPositioning}
        </p>
        <p style={{ color: "#6E657A", lineHeight: 1.7, fontSize: "18px" }}>
          {cloudArchitecture.principle}
        </p>
      </section>

      <Grid>
        {bentoCards.map((title) => (
          <Card key={title} title={title}>
            <p>
              A focused part of the SONARA OS™ workflow that connects writing,
              arrangement, sound direction, rights, metadata, and release
              readiness.
            </p>
          </Card>
        ))}
      </Grid>

      <section style={{ marginTop: "28px" }}>
        <h2>What SONARA is not</h2>
        <Grid>
          {competitiveDifferentiation.notThis.map((item) => (
            <Card key={item} title={item}>
              <p>
                SONARA OS™ stays focused on creator infrastructure, rights-aware
                exports, and music business workflow.
              </p>
            </Card>
          ))}
        </Grid>
      </section>
    </PageShell>
  );
}
