export const voiceCommandRegistry = [
  { command: "open dashboard", risk: "low", execution: "navigation draft" },
  { command: "create campaign", risk: "medium", execution: "draft only" },
  { command: "send customer message", risk: "high", execution: "blocked without owner approval" },
] as const;
