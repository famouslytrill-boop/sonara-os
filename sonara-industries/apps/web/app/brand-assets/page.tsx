import type { Metadata } from "next";
import Image from "next/image";
import { BrandShell } from "@/components/layout/BrandShell";

export const metadata: Metadata = {
  title: "Brand Assets",
  description: "Download approved SONARA Industries, TrackFoundry, LineReady, and NoticeGrid logo assets.",
  alternates: { canonical: "/brand-assets" },
  openGraph: {
    title: "Brand Assets | SONARA Industries",
    description: "Approved downloadable logo and mark assets for SONARA Industries and its child brands.",
    images: ["/brand/sonara/og-image.svg"],
  },
};

const assets = [
  { brand: "SONARA Industries", type: "SVG logo", use: "Website headers, pitch decks, partner pages.", src: "/brand/sonara/logo.svg" },
  { brand: "SONARA Industries", type: "SVG mark", use: "App icons, social avatars, compact UI, favicons.", src: "/brand/sonara/mark.svg" },
  { brand: "TrackFoundry", type: "SVG logo", use: "Product headers, music software pages, partner decks.", src: "/brand/trackfoundry/logo.svg" },
  { brand: "TrackFoundry", type: "SVG mark", use: "Compact product UI, avatars, app shell marks.", src: "/brand/trackfoundry/mark.svg" },
  { brand: "LineReady", type: "SVG logo", use: "Restaurant operations pages, sales decks, partner pages.", src: "/brand/lineready/logo.svg" },
  { brand: "LineReady", type: "SVG mark", use: "Compact product UI, avatars, app shell marks.", src: "/brand/lineready/mark.svg" },
  { brand: "NoticeGrid", type: "SVG logo", use: "Public information pages, organization pages, partner decks.", src: "/brand/noticegrid/logo.svg" },
  { brand: "NoticeGrid", type: "SVG mark", use: "Compact product UI, avatars, app shell marks.", src: "/brand/noticegrid/mark.svg" },
] as const;

export default function BrandAssetsPage() {
  return (
    <BrandShell>
      <section className="py-8 md:py-12">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">Brand assets</p>
        <h1 className="app-heading mt-3 max-w-4xl font-black text-white">Approved downloadable logos and marks.</h1>
        <p className="mt-5 max-w-3xl text-base leading-8 text-slate-300">
          Use these files for public previews, partner decks, website references, and product pages. Do not upload unofficial marks, copied icons, or assets your organization does not own or license.
        </p>
      </section>

      <section className="responsive-grid three-up" aria-label="Downloadable brand assets">
        {assets.map((asset) => (
          <article key={asset.src} className="card-surface rounded-3xl p-4">
            <div className="grid min-h-32 place-items-center rounded-2xl border border-slate-700/70 bg-slate-950 p-4">
              <Image className="brand-logo-img max-h-24" src={asset.src} alt={`${asset.brand} ${asset.type}`} width={420} height={140} />
            </div>
            <h2 className="mt-4 text-lg font-black text-white">{asset.brand}</h2>
            <p className="mt-1 text-sm font-bold text-cyan-200">{asset.type}</p>
            <p className="mt-3 min-h-12 text-sm leading-6 text-slate-300">{asset.use}</p>
            <a className="tap-target mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950 hover:bg-cyan-200" href={asset.src} download aria-label={`Download ${asset.brand} ${asset.type}`}>
              Download
            </a>
          </article>
        ))}
      </section>
    </BrandShell>
  );
}
