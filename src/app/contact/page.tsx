import { Card, Grid, Notice, PageShell } from "@/components/sonara/LaunchShell";

export default function ContactPage() {
  return (
    <PageShell
      eyebrow="Contact"
      title="Contact SONARA Industries™."
      subtitle="Business inquiries, support, and launch coordination can start here."
    >
      <Notice>
        Email placeholder: support@sonaraindustries.com. Add a verified business
        inbox before public launch.
      </Notice>
      <Grid>
        <Card title="Business inquiries">
          <p>Use for partnerships, label workflows, store products, and launch planning.</p>
        </Card>
        <Card title="Customer support">
          <p>Use for account, billing, exports, sound rights, mobile/PWA, and app issues.</p>
        </Card>
      </Grid>
    </PageShell>
  );
}
