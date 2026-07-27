import { ButtonLink, Card } from "./LaunchShell";

export function EmptyStateCard({
  title,
  body,
  actionLabel,
  actionHref,
  secondaryLabel,
  secondaryHref,
}: {
  title: string;
  body: string;
  actionLabel?: string;
  actionHref?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
}) {
  return (
    <Card title={title} status="Setup required">
      <p>{body}</p>
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
        {actionLabel && actionHref ? (
          <ButtonLink href={actionHref} variant="secondary">
            {actionLabel}
          </ButtonLink>
        ) : null}
        {secondaryLabel && secondaryHref ? (
          <ButtonLink href={secondaryHref} variant="quiet">
            {secondaryLabel}
          </ButtonLink>
        ) : null}
      </div>
    </Card>
  );
}
