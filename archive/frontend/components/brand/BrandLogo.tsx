import { getEntityBrand, type BrandSlug } from "../../lib/brand/entities";
import { LogoMark, type LogoSize, type LogoVariant } from "./LogoMark";

export function BrandLogo({
  entitySlug = "parent-company",
  variant = "full",
  size = "md",
  showTagline = false,
  className = "",
}: {
  entitySlug?: BrandSlug | string;
  variant?: LogoVariant;
  size?: LogoSize;
  showTagline?: boolean;
  className?: string;
}) {
  const brand = getEntityBrand(entitySlug);
  const markOnly = variant === "mark" || variant === "icon" || variant === "monochrome";

  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <LogoMark entitySlug={brand.slug} size={size} variant={variant === "full" ? "mark" : variant} />
      {!markOnly ? (
        <div>
          <p className="font-black leading-tight text-white">{brand.displayName}</p>
          {showTagline ? <p className="text-xs font-bold text-[#C4BFD0]">{brand.tagline}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
