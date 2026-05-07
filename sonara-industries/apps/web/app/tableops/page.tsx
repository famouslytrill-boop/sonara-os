import { DivisionShell } from "@/components/layout/DivisionShell";
import { FeatureGrid } from "@/components/ui/FeatureGrid";
import { ButtonLink } from "@/components/ui/Button";
import { divisions } from "@/lib/divisions";

export default function Page() {
  return (
    <DivisionShell division="tableops">
      <p className="text-sm font-black uppercase tracking-[0.22em] text-white/65">LineReady</p>
      <h1 className="app-heading mt-4 max-w-3xl font-black text-white">
        Dedicated restaurant operations and training system.
      </h1>
      <p className="mt-5 max-w-3xl text-lg leading-8 text-white/75">
        {divisions.tableops.purpose} It serves kitchens, food trucks, pop-ups,
        restaurants, and hospitality teams without blending music or civic dashboards.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <ButtonLink href={divisions.tableops.route + "/onboarding"} variant="tableops">Start onboarding</ButtonLink>
        <ButtonLink href={divisions.tableops.route + "/pricing"} variant="secondary">View pricing</ButtonLink>
      </div>
      <section className="mt-10">
        <FeatureGrid features={["Recipes", "Costing", "Prep", "Training", "Inventory", "Menus"]} />
      </section>
    </DivisionShell>
  );
}
