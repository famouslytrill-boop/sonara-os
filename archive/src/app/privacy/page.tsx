import { Card, Grid, Notice, PageShell } from "@/components/sonara/LaunchShell";

export default function PrivacyPage() {
  return (
    <PageShell
      eyebrow="Privacy"
      title="Privacy policy placeholder."
      subtitle="This launch page explains current privacy intent. It should be reviewed before production."
    >
      <Notice>
        This is not lawyer-reviewed legal advice. Replace with reviewed policy
        language before broad public launch.
      </Notice>
      <Grid>
        <Card title="Data use">
          <p>SONARA should not sell user data. Project data should be used to operate requested creator workflows.</p>
        </Card>
        <Card title="Payments">
          <p>Web payments are handled through Stripe once configured. Do not store raw card data in SONARA source code.</p>
        </Card>
        <Card title="Biometrics">
          <p>SONARA does not collect, store, or process biometric data. Future passkeys should keep device biometrics on the user device.</p>
        </Card>
      </Grid>
    </PageShell>
  );
}
