import { AppModulePage } from "@/components/layout/AppModulePage";

export default function Page() {
  return (
    <AppModulePage
      division="music"
      title="Projects"
      description="SONARA One project records for songs, releases, prompts, transcripts, and export-ready creative bundles."
      features={["Project list", "Release context", "Quality warnings"]}
    />
  );
}
