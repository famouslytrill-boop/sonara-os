import Link from "next/link";

export function BrandLegalFooter() {
  return (
    <footer className="mx-auto max-w-6xl px-4 pb-6 text-xs leading-5 text-[#C4BFD0]">
      <div className="mb-3 flex flex-wrap gap-3">
        <Link href="/about" className="font-bold text-[#00E5FF]">About</Link>
        <Link href="/docs" className="font-bold text-[#00E5FF]">Docs</Link>
        <Link href="/brand" className="font-bold text-[#00E5FF]">Brand</Link>
        <Link href="/trust" className="font-bold text-[#00E5FF]">Trust</Link>
        <Link href="/legal" className="font-bold text-[#00E5FF]">Legal</Link>
        <Link href="/support" className="font-bold text-[#00E5FF]">Support</Link>
        <Link href="/privacy" className="font-bold text-[#00E5FF]">Privacy</Link>
        <Link href="/terms" className="font-bold text-[#00E5FF]">Terms</Link>
        <Link href="/contact" className="font-bold text-[#00E5FF]">Contact</Link>
      </div>
      <p>
        SONARA Industries owns independent software companies with shared infrastructure, security standards,
        billing discipline, and product boundaries. TrackFoundry, LineReady, and NoticeGrid each stand as independent
        child brands. Marks, logos, and public claims require legal review before final trademark use.
      </p>
    </footer>
  );
}
