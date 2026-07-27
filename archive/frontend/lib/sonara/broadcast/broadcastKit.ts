export type BroadcastKitInput = {
  projectTitle: string;
  creatorName?: string;
  releaseMoment?: string;
  mood?: string;
};

export type BroadcastKit = {
  streamTitle: string;
  sceneList: string[];
  obsSceneRecommendations: string[];
  audioRoutingNotes: string[];
  releaseListeningSessionOutline: string[];
  livePremiereChecklist: string[];
  visualOverlaySuggestions: string[];
  exportableBroadcastPlan: string;
};

export function buildBroadcastKit(input: BroadcastKitInput): BroadcastKit {
  const title = input.projectTitle.trim() || "SONARA Demo Release";
  const creator = input.creatorName?.trim() || "Demo Artist";
  const releaseMoment = input.releaseMoment?.trim() || "release listening session";
  const mood = input.mood?.trim() || "focused, premium, and clear";

  const sceneList = [
    "Starting soon",
    "Host welcome",
    "Project context",
    "First listen",
    "Breakdown and notes",
    "Audience call-to-action",
    "Closing slate",
  ];

  const obsSceneRecommendations = [
    "Create one OBS scene per section so the host can move through the event cleanly.",
    "Keep overlays readable on mobile with large title text and high-contrast lower thirds.",
    "Use a simple now-playing panel for the song title, creator name, and release link placeholder.",
  ];

  const audioRoutingNotes = [
    "Route microphone and music playback as separate sources.",
    "Keep music playback below speaking level during host notes.",
    "Run a private test recording before the premiere to confirm levels and latency.",
  ];

  const releaseListeningSessionOutline = [
    `Open with ${creator} and the creative purpose of "${title}".`,
    `Frame the session as a ${releaseMoment} with a ${mood} tone.`,
    "Play the record or preview once without interruption.",
    "Return for a short breakdown of hook, sound, visuals, and release plan.",
    "End with the next practical action: save, pre-save, store visit, or mailing list.",
  ];

  const livePremiereChecklist = [
    "Confirm stream title, thumbnail, description, and privacy state.",
    "Confirm release links or store links are accurate before going live.",
    "Check microphone, music playback, camera, lighting, and internet stability.",
    "Keep a backup copy of talking points and release notes outside the streaming tool.",
    "Save the recording for later clips, recap posts, and archive use.",
  ];

  const visualOverlaySuggestions = [
    "Title lower third",
    "Creator name lower third",
    "Now listening slate",
    "Release date or store CTA",
    "Final thank-you slate",
  ];

  return {
    streamTitle: `${creator} - ${title} | OBS-ready broadcast kit`,
    sceneList,
    obsSceneRecommendations,
    audioRoutingNotes,
    releaseListeningSessionOutline,
    livePremiereChecklist,
    visualOverlaySuggestions,
    exportableBroadcastPlan: [
      `# ${title} Broadcast Kit`,
      "",
      `Creator: ${creator}`,
      `Tone: ${mood}`,
      "",
      "This is an OBS-ready broadcast kit export. It does not control OBS directly.",
      "",
      "## Scenes",
      ...sceneList.map((scene) => `- ${scene}`),
      "",
      "## OBS Scene Recommendations",
      ...obsSceneRecommendations.map((note) => `- ${note}`),
      "",
      "## Audio Routing Notes",
      ...audioRoutingNotes.map((note) => `- ${note}`),
      "",
      "## Listening Session Outline",
      ...releaseListeningSessionOutline.map((note) => `- ${note}`),
      "",
      "## Premiere Checklist",
      ...livePremiereChecklist.map((item) => `- ${item}`),
      "",
      "## Overlay Suggestions",
      ...visualOverlaySuggestions.map((item) => `- ${item}`),
    ].join("\n"),
  };
}
