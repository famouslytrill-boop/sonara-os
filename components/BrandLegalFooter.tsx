import Link from "next/link";

export function BrandLegalFooter() {
  return (
    <footer className="mx-auto max-w-7xl px-4 pb-6 text-xs leading-5 text-[#CBD5E1]">
      <div className="mb-3 flex flex-wrap gap-3">
        <Link href="/about" className="font-bold text-[#2DD4BF]">
          About
        </Link>
        <Link href="/trust" className="font-bold text-[#2DD4BF]">
          Trust
        </Link>
        <Link href="/legal" className="font-bold text-[#2DD4BF]">
          Legal
        </Link>
        <Link href="/support" className="font-bold text-[#2DD4BF]">
          Support
        </Link>
        <Link href="/legal/privacy" className="font-bold text-[#2DD4BF]">
          Privacy
        </Link>
        <Link href="/legal/terms" className="font-bold text-[#2DD4BF]">
          Terms
        </Link>
        <Link href="/contact" className="font-bold text-[#2DD4BF]">
          Contact
        </Link>
      </div>
      <p>
        SONARA Industries provides shared infrastructure for Business Builder, Creator Studio, and Growth Studio.
        Product claims, legal policies, billing settings, and security controls require human review before public launch.
      </p>
    </footer>
  );
}
