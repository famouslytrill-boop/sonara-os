import {
  ButtonLink,
  Card,
  Grid,
  Notice,
  PageShell,
} from "@/components/sonara/LaunchShell";

const dashboardCards = [
  {
    title: "Create Song",
    href: "/create",
    text: "Start a song blueprint, lyric structure, runtime target, and export path.",
  },
  {
    title: "Create Album",
    href: "/library",
    text: "Organize multiple creator projects into a catalog workflow.",
  },
  {
    title: "Build Sound Pack",
    href: "/vault",
    text: "Classify user-owned or rights-cleared assets for a personal Vault export.",
  },
  {
    title: "Prepare Release",
    href: "/export",
    text: "Assemble metadata notes, rights sheets, prompt packs, and release bundles.",
  },
  {
    title: "View Tutorial",
    href: "/tutorial",
    text: "Walk through the SONARA OS™ workflow from idea to export.",
  },
  {
    title: "Open Store / Upgrade",
    href: "/store",
    text: "Review pricing, export products, and payment setup status.",
  },
];

export default function DashboardPage() {
  return (
    <PageShell
      nav="app"
      eyebrow="Dashboard"
      title="SONARA OS™ workspace."
      subtitle="A clean operating system for songs, lyrics, sounds, releases, rights checks, and export-ready creator work."
      actions={
        <>
          <ButtonLink href="/create">Create Project</ButtonLink>
          <ButtonLink href="/store" variant="secondary">
            Store / Upgrade
          </ButtonLink>
        </>
      }
    >
      <Notice>
        Auth, persistence, and payment entitlements should be connected before
        this dashboard is treated as a private production workspace.
      </Notice>
      <Grid>
        {dashboardCards.map((card) => (
          <Card key={card.title} title={card.title}>
            <p>{card.text}</p>
            <ButtonLink href={card.href} variant="secondary">
              Open
            </ButtonLink>
          </Card>
        ))}
      </Grid>
    </PageShell>
  );
}
