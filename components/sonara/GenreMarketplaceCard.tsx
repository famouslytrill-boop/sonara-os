import { getGenreMarketplacePlan } from "../../lib/sonara/marketplace/genreMarketplaceEngine";

export function GenreMarketplaceCard() {
  const plan = getGenreMarketplacePlan();
  return (
    <section className="rounded-lg border border-[#332A40] bg-[#191522] p-4 text-[#F9FAFB]">
      <p className="text-xs font-black uppercase text-[#F472B6]">SONARA Exchange™</p>
      <h3 className="mt-2 text-xl font-black">Marketplace delayed for launch safety</h3>
      <p className="mt-2 text-sm text-[#C4BFD0]">Status: {plan.launchStatus}</p>
      <ul className="mt-3 grid gap-1 text-sm leading-6 text-[#C4BFD0]">
        {plan.allowedNow.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
