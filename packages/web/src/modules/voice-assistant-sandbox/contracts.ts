export interface VoiceActionRequest {
  organization_id: string;
  consent: boolean;
  hiddenRecording?: boolean;
  voiceCloning?: boolean;
  stepUpConfirmed?: boolean;
  sensitiveAction?: boolean;
  mode: "creator_demo" | "business";
}
