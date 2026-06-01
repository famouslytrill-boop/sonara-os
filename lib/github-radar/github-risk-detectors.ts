const blockedSignals = [/piracy/i, /copyright.?circumvention/i, /credential harvesting/i, /platform bypass/i, /malware/i, /exploit/i, /biometric/i, /tactical/i];

export function detectRepoRisk(text: string) {
  return blockedSignals.some((signal) => signal.test(text)) ? "blocked" : "review_required";
}
