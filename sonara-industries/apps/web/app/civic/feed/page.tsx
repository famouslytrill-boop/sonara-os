import { AppModulePage } from "@/components/layout/AppModulePage";

export default function Page() {
  return (
    <AppModulePage
      division="civic"
      title="Public Feed"
      description="A source-linked public information feed for local updates, organizations, events, and community notices."
      features={["Source links", "Confidence labels", "Correction path"]}
    />
  );
}
