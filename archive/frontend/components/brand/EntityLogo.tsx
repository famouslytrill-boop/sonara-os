import { BrandLogo } from "./BrandLogo";
import type { LogoSize, LogoVariant } from "./LogoMark";

export function EntityLogo({
  entitySlug,
  variant = "full",
  size = "md",
  showTagline = true,
  className,
}: {
  entitySlug: string;
  variant?: LogoVariant;
  size?: LogoSize;
  showTagline?: boolean;
  className?: string;
}) {
  return <BrandLogo className={className} entitySlug={entitySlug} showTagline={showTagline} size={size} variant={variant} />;
}
