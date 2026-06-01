export type PipelineStage = "collaborator" | "prospect" | "follow-up";
export type AudienceSegment = "core fans" | "casual listeners" | "high-value supporters";
export type ExperimentSurface = "hooks" | "covers" | "release timing";

export type CreatorContact = Readonly<{
  name: string;
  role: string;
  stage: PipelineStage;
  nextStep: string;
}>;

export type SubmissionPackage = Readonly<{
  bio: string;
  epk: string;
  privateLink: string;
  pitchSheet: string;
}>;

export type LicensingTrackerItem = Readonly<{
  opportunity: string;
  useCase: string;
  status: string;
}>;

export type AudienceSignal = Readonly<{
  segment: AudienceSegment;
  size: string;
  signal: string;
}>;

export type ExperimentWorkspace = Readonly<{
  surface: ExperimentSurface;
  variantA: string;
  variantB: string;
  successMetric: string;
}>;

export type GrowthState = Readonly<{
  creatorContacts: readonly CreatorContact[];
  submissionPackage: SubmissionPackage;
  licensingTracker: readonly LicensingTrackerItem[];
  audienceSignals: readonly AudienceSignal[];
  experiments: readonly ExperimentWorkspace[];
}>;

export const growthState: GrowthState = Object.freeze({
  creatorContacts: Object.freeze([
    Object.freeze({
      name: "Maya Chen",
      role: "Vocal collaborator",
      stage: "collaborator",
      nextStep: "Send hook brief and reference bounce."
    }),
    Object.freeze({
      name: "Northline Sync",
      role: "Licensing prospect",
      stage: "prospect",
      nextStep: "Package instrumental and clean edit."
    }),
    Object.freeze({
      name: "Jules Rivera",
      role: "Playlist editor",
      stage: "follow-up",
      nextStep: "Share private link after visualizer cutdown."
    })
  ]),
  submissionPackage: Object.freeze({
    bio: "Concise creator bio with release context and catalog angle.",
    epk: "Press photo, cover art, release notes, and approved credits.",
    privateLink: "Private streaming link for A&R evaluation.",
    pitchSheet: "One-page hook, audience, sync, and release plan summary."
  }),
  licensingTracker: Object.freeze([
    Object.freeze({
      opportunity: "Indie film trailer",
      useCase: "Moody thirty-second instrumental bed",
      status: "Needs clean master"
    }),
    Object.freeze({
      opportunity: "Creator campaign",
      useCase: "Short-form loop with no lead vocal",
      status: "Ready to pitch"
    })
  ]),
  audienceSignals: Object.freeze([
    Object.freeze({
      segment: "core fans",
      size: "1.8k",
      signal: "High saves and repeat listens."
    }),
    Object.freeze({
      segment: "casual listeners",
      size: "12k",
      signal: "Strong discovery but low profile clicks."
    }),
    Object.freeze({
      segment: "high-value supporters",
      size: "340",
      signal: "Merch, presets, and paid bundle intent."
    })
  ]),
  experiments: Object.freeze([
    Object.freeze({
      surface: "hooks",
      variantA: "Open with vocal motif.",
      variantB: "Open with drum stop and title phrase.",
      successMetric: "Three-second hold rate"
    }),
    Object.freeze({
      surface: "covers",
      variantA: "Minimal title lockup.",
      variantB: "Motion still with waveform trace.",
      successMetric: "Click-through rate"
    }),
    Object.freeze({
      surface: "release timing",
      variantA: "Friday morning release.",
      variantB: "Tuesday evening soft drop.",
      successMetric: "First-day saves"
    })
  ])
});
