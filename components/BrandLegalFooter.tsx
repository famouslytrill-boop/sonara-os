import Link from "next/link";

export function BrandLegalFooter() {
  return (
    <footer className="mx-auto max-w-6xl px-4 pb-6 text-xs leading-5 text-[#C4BFD0]">
      <div className="mb-3 flex flex-wrap gap-3">
        <Link href="/brand" className="font-bold text-[#00E5FF]">Brand</Link>
        <Link href="/trust" className="font-bold text-[#00E5FF]">Trust</Link>
        <Link href="/support" className="font-bold text-[#00E5FF]">Support</Link>
        <Link href="/privacy" className="font-bold text-[#00E5FF]">Privacy</Link>
        <Link href="/terms" className="font-bold text-[#00E5FF]">Terms</Link>
        <Link href="/contact" className="font-bold text-[#00E5FF]">Contact</Link>
      </div>
      <p>
        SONARA Industries owns independent software companies with shared infrastructure, security standards,
        billing discipline, and product boundaries. Working names, marks, and logos require legal review before final trademark use.
      </p>
    </footer>
  );
}
