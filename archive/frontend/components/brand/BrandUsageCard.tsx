export function BrandUsageCard() {
  const rules = [
    "Use parent branding for ecosystem, governance, security, billing, and infrastructure pages.",
    "Use entity branding inside entity dashboards and product-specific public sections.",
    "Use Launchpad only for launch-prep infrastructure surfaces.",
    "Do not stretch, crowd, recolor, or place logos on low-contrast backgrounds.",
    "Use ™ only when human-approved; never use ® unless registration exists.",
  ];

  return (
    <section className="rounded-3xl border border-[#332A40] bg-[#121018] p-6">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-[#00E5FF]">Usage Rules</p>
      <h2 className="mt-3 text-2xl font-black text-white">Digital-first, high-contrast, entity-specific.</h2>
      <ul className="mt-4 grid gap-3 text-sm leading-6 text-[#C4BFD0]">
        {rules.map((rule) => (
          <li key={rule} className="rounded-xl border border-[#332A40] bg-[#0B0F14] p-3">
            {rule}
          </li>
        ))}
      </ul>
    </section>
  );
}
