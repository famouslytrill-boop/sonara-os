import { BRAND_ENTITIES } from "../../lib/brand/entities";

export function BrandColorSwatches({ entitySlug }: { entitySlug?: string }) {
  const brands = entitySlug ? BRAND_ENTITIES.filter((brand) => brand.slug === entitySlug) : BRAND_ENTITIES;

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      {brands.map((brand) => (
        <div key={brand.slug} className="rounded-2xl border border-[#332A40] bg-[#121018] p-4">
          <p className="text-sm font-black text-white">{brand.displayName}</p>
          <div className="mt-4 grid grid-cols-5 overflow-hidden rounded-xl border border-[#332A40]">
            {[brand.primaryColor, brand.secondaryColor, brand.accentColor, brand.darkColor, brand.lightColor].map((color) => (
              <div key={color} className="h-12" style={{ background: color }} title={color} />
            ))}
          </div>
          <p className="mt-3 text-xs font-bold text-[#C4BFD0]">{brand.primaryColor} / {brand.secondaryColor}</p>
        </div>
      ))}
    </div>
  );
}
