import { AppModulePage } from "@/components/layout/AppModulePage";

export default function Page() {
  return (
    <AppModulePage
      division="music"
      title="Exports"
      description="SoundOS export bundles for prompts, production notes, DAW prep, release readiness, and catalog records."
      features={["Prompt bundles", "Production bundles", "Release bundles"]}
    />
  );
}
