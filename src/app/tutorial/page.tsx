import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  ButtonLink,
  Card,
  Grid,
  Notice,
  PageShell,
} from "@/components/sonara/LaunchShell";

const tutorialSteps = [
  "Welcome to SONARA OS™",
  "Create your first music project",
  "Use SONARA Core™ for music as a whole",
  "Review Genre / Arrangement guidance",
  "Paste or draft lyrics",
  "Choose explicitness mode",
  "Use Lyric Structure Engine™",
  "Use Word Intelligence",
  "Use Runtime Target",
  "Write the Style / Production Prompt",
  "Review External Generator Settings if needed",
  "Build Export Bundle",
  "Visit Store / Upgrade",
];

export default function TutorialPage() {
  const hasTutorialVideo = existsSync(join(process.cwd(), "public", "tutorial.mp4"));

  return (
    <PageShell
      eyebrow="Tutorial"
      title="Learn the browser-first SONARA OS™ workflow."
      subtitle="A simple path from first idea to structured lyrics, arrangement notes, rights-aware assets, and export-ready creative bundles."
      actions={
        <>
          <ButtonLink href="/create">Start Creating</ButtonLink>
          <ButtonLink href="/dashboard" variant="secondary">
            Open Dashboard
          </ButtonLink>
        </>
      }
    >
      <Notice>
        Use SONARA OS™ from your browser. No desktop install required for the
        core workflow. Founder/developer tools are separate from normal user
        access.
      </Notice>

      <Notice>
        {hasTutorialVideo ? (
          <video
            controls
            src="/tutorial.mp4"
            style={{ width: "100%", borderRadius: "18px" }}
          />
        ) : (
          "SONARA OS™ video walkthrough coming soon."
        )}
      </Notice>

      <Grid>
        {tutorialSteps.map((step, index) => (
          <Card key={step} title={`${index + 1}. ${step}`}>
            <p>
              Follow this step to keep the music workflow focused,
              rights-aware, and export-ready for traditional, AI-assisted, or
              hybrid creation.
            </p>
          </Card>
        ))}
      </Grid>
    </PageShell>
  );
}
