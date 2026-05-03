import {
  ButtonLink,
  Card,
  Grid,
  Notice,
  PageShell,
} from "@/components/sonara/LaunchShell";

export default function LoginPage() {
  return (
    <PageShell
      eyebrow="Login"
      title="SONARA OS™"
      subtitle="Log in to access your creator operating system."
      actions={
        <>
          <ButtonLink href="/dashboard">Open OS Preview</ButtonLink>
          <ButtonLink href="/" variant="secondary">
            Back Home
          </ButtonLink>
        </>
      }
    >
      <Notice>
        Production authentication is not faked here. Connect Supabase Auth or a
        secure auth provider before requiring real user accounts.
      </Notice>
      <Grid>
        <Card title="Auth status" status="Setup required">
          <p>
            This launch route is ready for a real login provider. Until auth is
            configured, use the OS preview routes for navigation and QA only.
          </p>
        </Card>
        <Card title="Security direction" status="Future-safe">
          <p>
            Passkeys/WebAuthn can be added later through a secure provider.
            SONARA should never store biometric data.
          </p>
        </Card>
      </Grid>
    </PageShell>
  );
}
