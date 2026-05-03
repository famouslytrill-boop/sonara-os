import { Card, Grid, Notice, PageShell } from "@/components/sonara/LaunchShell";

export default function TermsPage() {
  return (
    <PageShell
      eyebrow="Terms"
      title="Terms of service placeholder."
      subtitle="Basic launch terms for SONARA Industries™ and SONARA OS™ workflows."
    >
      <Notice>
        These terms are a placeholder and should be reviewed before production.
      </Notice>
      <Grid>
        <Card title="Rights clearance">
          <p>Users are responsible for clearing rights to lyrics, recordings, samples, artwork, metadata, and exported materials.</p>
        </Card>
        <Card title="No guaranteed outcomes">
          <p>SONARA does not guarantee streams, playlisting, distribution approval, revenue, or business results.</p>
        </Card>
        <Card title="Marketplace delayed">
          <p>Public kit marketplace features are not available at launch. SONARA Vault™ focuses on organize, classify, verify, and export tools.</p>
        </Card>
      </Grid>
    </PageShell>
  );
}
