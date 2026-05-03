import { Card, Grid, Notice, PageShell } from "@/components/sonara/LaunchShell";

const trustItems = [
  "Payments are handled by Stripe on web.",
  "SONARA does not store payment card data.",
  "Unknown sound rights are blocked.",
  "Users are responsible for rights clearance.",
  "OpenAI is optional; core launch pages render without an OpenAI key.",
  "No biometric data is stored.",
  "No guarantees of streams, royalties, playlist placement, distribution approval, or commercial success.",
  "SONARA OS™ is cloud-first and browser-first.",
  "No desktop install required for the core workflow.",
  "No public kit marketplace at launch.",
];

export default function TrustPage() {
  return (
    <PageShell
      eyebrow="Trust"
      title="Trust, rights, and safety."
      subtitle="SONARA Industries™ is built around honest music workflows, rights-aware exports, secure payments, and clear launch boundaries."
    >
      <Notice>
        SONARA OS™ helps organize and prepare creative work. It does not
        guarantee copyright ownership, streams, royalties, playlist placement,
        distribution approval, or commercial success.
      </Notice>
      <Grid>
        {trustItems.map((item) => (
          <Card key={item} title={item}>
            <p>
              This policy protects creators, customers, collaborators, and the
              SONARA OS™ launch path.
            </p>
          </Card>
        ))}
      </Grid>
    </PageShell>
  );
}
