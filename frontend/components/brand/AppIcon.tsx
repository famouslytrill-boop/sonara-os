import { getEntityBrand } from "../../lib/brand/entities";
import { LogoMark } from "./LogoMark";

export function AppIcon({ entitySlug = "parent-company", className = "" }: { entitySlug?: string; className?: string }) {
  const brand = getEntityBrand(entitySlug);
  return (
    <div
      aria-label={`${brand.displayName} app icon preview`}
      className={`inline-flex items-center justify-center rounded-[22%] border border-white/10 p-2 shadow-[0_18px_70px_rgba(0,0,0,0.3)] ${className}`}
      style={{ background: brand.darkColor }}
    >
      <LogoMark entitySlug={brand.slug} size="lg" variant="icon" />
    </div>
  );
}
