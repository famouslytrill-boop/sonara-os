import { AppModulePage } from "@/components/layout/AppModulePage";

export default function Page() {
  return (
    <AppModulePage
      division="civic"
      title="Documents"
      description="Public document import and search placeholders for source-linked civic information."
      features={["Document imports", "Search", "Source metadata"]}
    />
  );
}
