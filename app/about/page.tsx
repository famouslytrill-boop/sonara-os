import { PublicShell } from "../../components/PublicShell";
import { products } from "../../lib/houseBrands";

export default function AboutPage() {
  return (
    <PublicShell>
      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-[#2DD4BF]">About</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-black text-white">SONARA Industries builds practical operating systems.</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-[#CBD5E1]">
          The company organizes shared infrastructure for three focused product companies: Business Builder, Creator
          Studio, and Growth Studio.
        </p>
      </section>
      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        {products.map((product) => (
          <article key={product.route} className="rounded-2xl border border-white/10 bg-[#081827] p-5">
            <h2 className="text-xl font-black text-white">{product.name}</h2>
            <p className="mt-2 text-sm leading-6 text-[#CBD5E1]">{product.positioning}</p>
          </article>
        ))}
      </section>
    </PublicShell>
  );
}
