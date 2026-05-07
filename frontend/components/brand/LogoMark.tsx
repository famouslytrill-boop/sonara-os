import { getEntityBrand, type BrandSlug } from "../../lib/brand/entities";

export type LogoVariant = "full" | "mark" | "icon" | "monochrome";
export type LogoSize = "xs" | "sm" | "md" | "lg" | "xl";

const sizeByName: Record<LogoSize, number> = {
  xs: 24,
  sm: 32,
  md: 44,
  lg: 64,
  xl: 96,
};

function InnerGlyph({ slug, color }: { slug: BrandSlug; color: string }) {
  switch (slug) {
    case "creator-music-technology":
      return (
        <g stroke={color} strokeLinecap="round" strokeWidth="5">
          <path d="M36 64V48" />
          <path d="M50 74V38" />
          <path d="M64 68V44" />
          <path d="M78 58V52" />
        </g>
      );
    case "business-operations":
      return (
        <g fill="none" stroke={color} strokeLinejoin="round" strokeWidth="4">
          <path d="M44 48 64 37l20 11v25L64 84 44 73Z" />
          <path d="m44 48 20 12 20-12" />
          <path d="M64 60v24" />
        </g>
      );
    case "community-public-information":
      return (
        <g fill="none" stroke={color} strokeLinecap="round" strokeWidth="4">
          <path d="M64 78V52" />
          <circle cx="64" cy="45" r="6" fill={color} stroke="none" />
          <path d="M48 58a22 22 0 0 1 32 0" />
          <path d="M39 46a36 36 0 0 1 50 0" />
        </g>
      );
    case "launchpad":
      return (
        <g fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="5">
          <path d="M44 76 76 44" />
          <path d="M52 44h24v24" />
          <path d="M42 86h28" />
        </g>
      );
    default:
      return (
        <g fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="4">
          <path d="M42 48 64 35l22 13v26L64 87 42 74Z" />
          <path d="M33 64h18" />
          <path d="M77 64h18" />
          <circle cx="64" cy="64" r="8" fill={color} stroke="none" />
        </g>
      );
  }
}

export function LogoMark({
  entitySlug = "parent-company",
  variant = "mark",
  size = "md",
  className = "",
}: {
  entitySlug?: BrandSlug | string;
  variant?: LogoVariant;
  size?: LogoSize;
  className?: string;
}) {
  const brand = getEntityBrand(entitySlug);
  const px = sizeByName[size];
  const primary = variant === "monochrome" ? "currentColor" : brand.primaryColor;
  const secondary = variant === "monochrome" ? "currentColor" : brand.secondaryColor;
  const accent = variant === "monochrome" ? "currentColor" : brand.accentColor;

  return (
    <svg
      aria-label={`${brand.displayName} logo mark`}
      className={className}
      height={px}
      role="img"
      viewBox="0 0 128 128"
      width={px}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect fill={variant === "icon" ? brand.darkColor : "transparent"} height="128" rx="28" width="128" />
      <path d="M64 10 110 37v54l-46 27-46-27V37Z" fill={primary} opacity="0.18" />
      <path d="M64 16 104 40v48l-40 24-40-24V40Z" fill="none" stroke={primary} strokeWidth="6" />
      <path d="M64 26 94 44v40l-30 18-30-18V44Z" fill={secondary} opacity="0.18" />
      <InnerGlyph color={accent} slug={brand.slug} />
    </svg>
  );
}
