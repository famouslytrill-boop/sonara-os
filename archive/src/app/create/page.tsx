import { AuthenticityScoreCard } from "@/components/sonara/AuthenticityScoreCard";
import { CreateWorkflowForm } from "@/components/sonara/CreateWorkflowForm";
import { ReleaseReadinessCard } from "@/components/sonara/ReleaseReadinessCard";
import { WordIntelligenceCard } from "@/components/sonara/WordIntelligenceCard";
import {
  ButtonLink,
  Card,
  Grid,
  Notice,
  PageShell,
} from "@/components/sonara/LaunchShell";
import { uxCopy } from "@/config/uxCopy";

const workflow = [
  "Project Setup",
  "Lyrics Section",
  "Word Intelligence",
  "Style / Production Prompt",
  "Lyric Structure",
  "Arrangement + Runtime",
  "Export",
];

export default function CreatePage() {
  return (
    <PageShell
      nav="app"
      eyebrow="Create"
      title="Create music projects from idea to export."
      subtitle="Create supports traditional, AI-assisted, and hybrid workflows with lyrics, word intelligence, arrangement notes, sound direction, rights-aware assets, and project bundle preparation."
      actions={
        <>
          <ButtonLink href="/export">Prepare Export</ButtonLink>
          <ButtonLink href="/tutorial" variant="secondary">
            View Tutorial
          </ButtonLink>
        </>
      }
    >
      <Notice>
        {uxCopy.globalHelp.whatIsCreate} Lyrics support up to 5,000 characters.
        Style / Production Prompt supports up to 1,000 characters.
      </Notice>

      <Grid>
        {workflow.map((step) => (
          <Card key={step} title={step}>
            <p>
              A beginner-friendly step that keeps the music workflow clear,
              separate, and export-ready.
            </p>
          </Card>
        ))}
      </Grid>

      <section style={{ marginTop: "24px" }}>
        <CreateWorkflowForm />
      </section>

      <section style={{ marginTop: "24px" }}>
        <Grid>
          <WordIntelligenceCard />
          <AuthenticityScoreCard />
          <ReleaseReadinessCard />
        </Grid>
      </section>
    </PageShell>
  );
}
