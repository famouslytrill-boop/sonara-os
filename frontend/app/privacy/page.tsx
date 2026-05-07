import { SiteHeader } from "../../components/site-header";

export default function PrivacyPage() {
  const items = [
    "Account, organization, membership, and product-scope data may be stored when auth is connected.",
    "TrackFoundry can store artist profiles, tracks, transcripts, release notes, prompt exports, rights placeholders, and media metadata.",
    "LineReady can store employee scheduling, job titles, recipe costs, vendor links, compliance records, and operational notes.",
    "NoticeGrid can store organization pages, feed sources, notices, events, digest preferences, source checks, and suggestion-box items.",
    "Optional provider keys are controlled by the organization and must stay server-side.",
    "Public content should be reviewed before publication; generated drafts remain drafts until approved.",
  ];

  return (
    <div className="min-h-screen bg-[#07070A] text-white">
      <SiteHeader />
      <main className="mx-auto grid max-w-4xl gap-6 px-4 py-8">
        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">Privacy</p>
          <h1 className="mt-3 text-4xl font-black">Privacy and data scope</h1>
          <p className="mt-3 leading-7 text-slate-300">
            SONARA Industries uses organization-scoped product data. Production access must be enforced by real auth, RLS, server-side service roles, and audit logs.
          </p>
        </section>
        <section className="grid gap-3">
          {items.map((item) => (
            <article key={item} className="rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm leading-6 text-slate-300">
              {item}
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
