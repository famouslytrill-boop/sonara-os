import { AppModulePage } from "@/components/layout/AppModulePage";

export default function Page() {
  return (
    <AppModulePage
      division="music"
      title="Transcripts"
      description="Audio and video transcription records for music projects, interviews, sessions, and release prep."
      features={["Audio transcripts", "Video transcripts", "Reference notes"]}
    />
  );
}
