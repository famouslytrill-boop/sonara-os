import { AppModulePage } from "@/components/layout/AppModulePage";

export default function Page() {
  return (
    <AppModulePage
      division="civic"
      title="Broadcast"
      description="Community broadcast planning, public access post workflows, transcripts, and source-linked updates."
      features={["Broadcast posts", "Transcript archive", "Public access workflow"]}
    />
  );
}
