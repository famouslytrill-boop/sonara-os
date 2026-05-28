import { OpenSourcePromisePage } from "../../../components/OpenSourcePromisePage";

export default function OpenSourcePhilosophyPage() {
  return (
    <OpenSourcePromisePage
      title="Responsible open-source use is a product discipline."
      description="SONARA prefers free and open foundations where they are safe, maintained, commercially usable, and appropriate for the product."
      sections={[
        {
          title: "Respect licenses",
          body: "GPL, AGPL, non-commercial model weights, and unclear-license projects are not copied into proprietary app packages without review.",
        },
        {
          title: "Keep core access simple",
          body: "Paid tiers are for hosted convenience, higher limits, automation, collaboration, support, and service-heavy features.",
        },
      ]}
    />
  );
}
