import { brandSystem } from "../config/brandSystem";
import Link from "next/link";

export function BrandLegalFooter() {
  return (
    <footer className="mx-auto max-w-6xl px-4 pb-6 text-xs leading-5 text-[#C4BFD0]">
      <div className="mb-3 flex flex-wrap gap-3">
        <Link href="/trust" className="font-bold text-[#2DD4BF]">Trust</Link>
        <Link href="/support" className="font-bold text-[#2DD4BF]">Support</Link>
        <Link href="/privacy" className="font-bold text-[#2DD4BF]">Privacy</Link>
        <Link href="/terms" className="font-bold text-[#2DD4BF]">Terms</Link>
        <Link href="/contact" className="font-bold text-[#2DD4BF]">Contact</Link>
      </div>
      <p>{brandSystem.legal.footer}</p>
    </footer>
  );
}
