import { Card } from "@/components/ui/Card";

export function MediaIntakePanel() {
  return (
    <Card title="Audio / Video Intake">
      <p className="text-sm leading-6 text-slate-300">
        Upload audio, video, references, and documents into TrackFoundry media queues for metadata
        extraction, transcription placeholders, and release preparation.
      </p>
    </Card>
  );
}
