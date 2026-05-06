import { ButtonLink } from "./Button";

export function CTAButtons({
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
  variant = "primary",
}: {
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  variant?: "primary" | "music" | "tableops" | "civic" | "admin";
}) {
  return (
    <div className="mt-8 flex flex-wrap gap-3">
      <ButtonLink href={primaryHref} variant={variant}>
        {primaryLabel}
      </ButtonLink>
      {secondaryHref && secondaryLabel ? (
        <ButtonLink href={secondaryHref} variant="secondary">
          {secondaryLabel}
        </ButtonLink>
      ) : null}
    </div>
  );
}
