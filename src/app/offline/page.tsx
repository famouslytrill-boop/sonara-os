import { ButtonLink, Notice, PageShell } from "@/components/sonara/LaunchShell";

export default function OfflinePage() {
  return (
    <PageShell
      eyebrow="Offline"
      title="SONARA OS™ offline fallback."
      subtitle="This page is available for future PWA fallback routing."
      actions={
        <>
          <ButtonLink href="/dashboard">Try Dashboard</ButtonLink>
          <ButtonLink href="/" variant="secondary">
            Public Site
          </ButtonLink>
        </>
      }
    >
      <Notice>
        If you see this in a future PWA build, reconnect and retry. Offline
        project persistence must be tested before launch.
      </Notice>
    </PageShell>
  );
}
