import { brandSystem } from "../config/brandSystem";

export function BrandLegalFooter() {
  return (
    <footer className="mx-auto max-w-6xl px-4 pb-6 text-xs leading-5 text-[#A1A1AA]">
      {brandSystem.legal.footer}
    </footer>
  );
}
