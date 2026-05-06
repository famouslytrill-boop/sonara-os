import { AppModulePage } from "@/components/layout/AppModulePage";

export default function Page() {
  return (
    <AppModulePage
      division="music"
      title="Projects"
      description="SoundOS project records for songs, releases, prompts, transcripts, and export-ready creative bundles."
      features={["Project list", "Release context", "Quality warnings"]}
    />
  );
}
