import { sonaraBusinessPrinciplesLayer } from "../config/sonara/businessPrinciples";

export function SonaraLegalFooter() {
  return (
    <footer className="mx-auto max-w-6xl px-4 pb-6 text-xs leading-5 text-[#A1A1AA]">
      SONARA Industries™ and SONARA™ systems are claimed marks of SONARA Industries. {sonaraBusinessPrinciplesLayer.exportNotice}
    </footer>
  );
}
