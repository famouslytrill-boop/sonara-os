import { SiteHeader } from "../../components/site-header";

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-[#07070A] text-white">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">Offline</p>
          <h1 className="mt-3 text-4xl font-black">SONARA Industries is offline.</h1>
          <p className="mt-3 max-w-3xl leading-7 text-slate-300">
            Reconnect to open TrackFoundry, LineReady, NoticeGrid, pricing, security, and research pages.
          </p>
        </section>
      </main>
    </div>
  );
}
