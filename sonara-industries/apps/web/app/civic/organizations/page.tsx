import { AppModulePage } from "@/components/layout/AppModulePage";

export default function Page() {
  return (
    <AppModulePage
      division="civic"
      title="Organizations"
      description="Organization profile surfaces for libraries, nonprofits, local groups, civic partners, and public access teams."
      features={["Profile pages", "Public links", "Verified partner status"]}
    />
  );
}
