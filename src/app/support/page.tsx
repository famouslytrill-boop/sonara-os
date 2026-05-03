import { Card, Grid, Notice, PageShell } from "@/components/sonara/LaunchShell";

const categories = [
  "Account",
  "Billing",
  "Exports",
  "Sound rights",
  "App bug",
  "Feature request",
  "Mobile/PWA",
  "Writing/lyrics",
];

export default function SupportPage() {
  return (
    <PageShell
      eyebrow="Support"
      title="Support for SONARA OS™."
      subtitle="Use this page for launch support routing until a ticketing or email integration is configured."
    >
      <Notice>
        Contact placeholder: support@sonaraindustries.com. Form submission is
        not faked in this launch pass.
      </Notice>
      <Grid>
        {categories.map((category) => (
          <Card key={category} title={category}>
            <p>
              Support category prepared for routing, documentation, and future
              ticket intake.
            </p>
          </Card>
        ))}
      </Grid>
    </PageShell>
  );
}
