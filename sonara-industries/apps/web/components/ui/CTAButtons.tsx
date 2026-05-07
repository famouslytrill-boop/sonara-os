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
    <div className="cta-row mt-8">
      <ButtonLink href={primaryHref} variant={variant} className="w-full sm:w-auto">
        {primaryLabel}
      </ButtonLink>
      {secondaryHref && secondaryLabel ? (
        <ButtonLink href={secondaryHref} variant="secondary" className="w-full sm:w-auto">
          {secondaryLabel}
        </ButtonLink>
      ) : null}
    </div>
  );
}
