export const publicLanguageMap = Object.freeze({
  company: "SONARA Industries",
  platform: "SONARA Industries",
  products: ["Business Builder", "Creator Studio", "Growth Studio"],
  sharedTools: [
    "Payment Links",
    "Connected Links",
    "Launch Checklist",
    "Trust Shield",
    "Help Center",
    "Safe Release Lab",
    "Proof Builder",
    "Privacy Timeline"
  ]
});

export const internalTermsBlockedFromPublicUi = [
  "ImplementationSequencer",
  "RepoBootstrapEngine",
  "DeveloperHandoffEngine",
  "ErrorRecoveryPlaybookEngine",
  "DependencyResolutionPlanner",
  "OneCommandCheckRunner",
  "LaunchWorkQueueEngine"
];

export function containsBlockedInternalPublicTerm(text: string): boolean {
  return internalTermsBlockedFromPublicUi.some((term) => text.includes(term));
}
