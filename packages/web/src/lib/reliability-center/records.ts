export type ReliabilityStorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type ReliabilityProviderId =
  | "vercel"
  | "supabase"
  | "stripe"
  | "openai"
  | "anthropic"
  | "gemini"
  | "kimi"
  | "cloudflare"
  | "github"
  | "email_provider"
  | "sms_provider";

export type ProviderHealthStatus = "unknown" | "manual_review" | "degraded" | "disabled";
export type IncidentSeverity = "low" | "medium" | "high" | "critical";
export type IncidentStatus = "draft" | "investigating" | "monitoring" | "resolved";
export type ContinuityModeStatus = "off" | "manual_ready" | "manual_active";

export type ProviderHealthCard = Readonly<{
  id: ReliabilityProviderId;
  name: string;
  category: "hosting" | "database" | "payments" | "ai" | "network" | "source" | "messaging";
  healthStatus: ProviderHealthStatus;
  manualReviewRequired: boolean;
  notes: string;
}>;

export type IncidentRecord = Readonly<{
  id: string;
  organization_id: string;
  title: string;
  affected_provider: ReliabilityProviderId;
  severity: IncidentSeverity;
  status: IncidentStatus;
  owner_note: string;
  created_at: string;
}>;

export type ContinuityModeState = Readonly<{
  status: ContinuityModeStatus;
  manualOnly: true;
  autoFailoverEnabled: false;
  publicStatusEnabled: false;
  lastReviewedAt: string;
}>;

export type DegradedFeatureState = Readonly<{
  id: string;
  featureName: string;
  state: "normal_review" | "degraded_review" | "paused_review";
  notes: string;
}>;

export type WebhookReplayQueueStub = Readonly<{
  id: string;
  provider: ReliabilityProviderId;
  status: "stub_only";
  notes: string;
}>;

export type RecoveryChecklistItem = Readonly<{
  id: string;
  title: string;
  description: string;
  required: boolean;
}>;

export type ReliabilityCenterState = Readonly<{
  incidents: readonly IncidentRecord[];
  continuityMode: ContinuityModeState;
}>;

export type IncidentInput = Readonly<{
  title: string;
  affectedProvider: ReliabilityProviderId;
  severity: IncidentSeverity;
  ownerNote: string;
}>;

const storageKey = "sonara-reliability-center-records";
const localOrganizationId = "local_reliability_setup";

export const reliabilityProviderLabels: Record<ReliabilityProviderId, string> = {
  vercel: "Vercel",
  supabase: "Supabase",
  stripe: "Stripe",
  openai: "OpenAI",
  anthropic: "Anthropic",
  gemini: "Gemini",
  kimi: "Kimi",
  cloudflare: "Cloudflare",
  github: "GitHub",
  email_provider: "Email provider",
  sms_provider: "SMS provider"
};

export const incidentSeverityLabels: Record<IncidentSeverity, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical"
};

export const providerHealthCards: readonly ProviderHealthCard[] = Object.freeze([
  createProviderHealthCard("vercel", "hosting"),
  createProviderHealthCard("supabase", "database"),
  createProviderHealthCard("stripe", "payments"),
  createProviderHealthCard("openai", "ai"),
  createProviderHealthCard("anthropic", "ai"),
  createProviderHealthCard("gemini", "ai"),
  createProviderHealthCard("kimi", "ai", "disabled"),
  createProviderHealthCard("cloudflare", "network"),
  createProviderHealthCard("github", "source"),
  createProviderHealthCard("email_provider", "messaging"),
  createProviderHealthCard("sms_provider", "messaging")
]);

export const degradedFeatureStates: readonly DegradedFeatureState[] = Object.freeze([
  Object.freeze({
    id: "provider-calls",
    featureName: "Provider calls",
    state: "degraded_review",
    notes: "Provider-dependent features require manual review when health is unknown."
  }),
  Object.freeze({
    id: "payment-links",
    featureName: "Payment links",
    state: "normal_review",
    notes: "Provider-hosted links only. No custody or card handling is enabled."
  }),
  Object.freeze({
    id: "status-page",
    featureName: "Public status page",
    state: "paused_review",
    notes: "Public status is private/off by default for the MVP."
  })
]);

export const webhookReplayQueueStub: readonly WebhookReplayQueueStub[] = Object.freeze([
  Object.freeze({
    id: "stripe-webhook-replay",
    provider: "stripe",
    status: "stub_only",
    notes: "Webhook replay requires verified signatures and approval before use."
  }),
  Object.freeze({
    id: "provider-webhook-replay",
    provider: "github",
    status: "stub_only",
    notes: "Replay queue is a planning stub. No automatic replay is enabled."
  })
]);

export const recoveryChecklist: readonly RecoveryChecklistItem[] = Object.freeze([
  Object.freeze({
    id: "identify-provider",
    title: "Identify affected provider",
    description: "Confirm the provider and affected user-facing workflow before action.",
    required: true
  }),
  Object.freeze({
    id: "review-severity",
    title: "Review severity",
    description: "Assign severity from observed impact. Do not claim live status without evidence.",
    required: true
  }),
  Object.freeze({
    id: "manual-continuity",
    title: "Manual continuity mode",
    description: "Use manual continuity only. Auto-failover is not enabled in the MVP.",
    required: true
  }),
  Object.freeze({
    id: "owner-communication",
    title: "Owner communication",
    description: "Prepare reviewed communication before any public status update.",
    required: true
  }),
  Object.freeze({
    id: "post-incident-review",
    title: "Post-incident review",
    description: "Document cause, recovery steps, and follow-up actions after resolution.",
    required: false
  })
]);

export const defaultContinuityModeState: ContinuityModeState = Object.freeze({
  status: "off",
  manualOnly: true,
  autoFailoverEnabled: false,
  publicStatusEnabled: false,
  lastReviewedAt: "Not reviewed"
});

export const publicStatusPageConfig = Object.freeze({
  enabled: false,
  visibility: "private" as const,
  message:
    "Public status page is private/off by default. Use internal reliability review before publishing status updates."
});

export const initialReliabilityCenterState: ReliabilityCenterState = Object.freeze({
  incidents: Object.freeze([]),
  continuityMode: defaultContinuityModeState
});

export function createReliabilityCenterStore(
  storage: ReliabilityStorageLike | null = getBrowserStorage()
) {
  let state = readStoredState(storage);

  function getState() {
    return state;
  }

  function addIncident(input: IncidentInput) {
    const incident = createIncidentRecord(input);
    state = Object.freeze({
      ...state,
      incidents: Object.freeze([...state.incidents, incident])
    });
    writeStoredState(storage, state);
    return incident;
  }

  function setContinuityMode(status: ContinuityModeStatus) {
    state = Object.freeze({
      ...state,
      continuityMode: Object.freeze({
        status,
        manualOnly: true,
        autoFailoverEnabled: false,
        publicStatusEnabled: false,
        lastReviewedAt: new Date().toISOString()
      })
    });
    writeStoredState(storage, state);
    return state.continuityMode;
  }

  function clear() {
    state = initialReliabilityCenterState;
    storage?.removeItem(storageKey);
  }

  return Object.freeze({ getState, addIncident, setContinuityMode, clear });
}

export function createIncidentRecord(
  input: IncidentInput,
  createdAt = new Date().toISOString(),
  id = createRecordId("incident")
): IncidentRecord {
  return Object.freeze({
    id,
    organization_id: localOrganizationId,
    title: input.title.trim(),
    affected_provider: input.affectedProvider,
    severity: input.severity,
    status: "draft",
    owner_note: input.ownerNote.trim(),
    created_at: createdAt
  });
}

export function createRecoveryChecklist(): readonly RecoveryChecklistItem[] {
  return recoveryChecklist;
}

function createProviderHealthCard(
  id: ReliabilityProviderId,
  category: ProviderHealthCard["category"],
  healthStatus: ProviderHealthStatus = "unknown"
): ProviderHealthCard {
  return Object.freeze({
    id,
    name: reliabilityProviderLabels[id],
    category,
    healthStatus,
    manualReviewRequired: true,
    notes:
      healthStatus === "disabled"
        ? "Disabled by default. Manual review required before use."
        : "No live health check is connected. Manual review required."
  });
}

function readStoredState(storage: ReliabilityStorageLike | null): ReliabilityCenterState {
  const raw = storage?.getItem(storageKey);
  if (!raw) {
    return initialReliabilityCenterState;
  }
  try {
    return normalizeState(JSON.parse(raw));
  } catch {
    storage?.removeItem(storageKey);
    return initialReliabilityCenterState;
  }
}

function normalizeState(value: unknown): ReliabilityCenterState {
  if (!value || typeof value !== "object") {
    return initialReliabilityCenterState;
  }
  const candidate = value as Partial<ReliabilityCenterState>;
  return Object.freeze({
    incidents: Object.freeze(Array.isArray(candidate.incidents) ? candidate.incidents : []),
    continuityMode: normalizeContinuityMode(candidate.continuityMode)
  });
}

function normalizeContinuityMode(value: unknown): ContinuityModeState {
  if (!value || typeof value !== "object") {
    return defaultContinuityModeState;
  }
  const candidate = value as Partial<ContinuityModeState>;
  return Object.freeze({
    status: candidate.status ?? "off",
    manualOnly: true,
    autoFailoverEnabled: false,
    publicStatusEnabled: false,
    lastReviewedAt: candidate.lastReviewedAt ?? "Not reviewed"
  });
}

function writeStoredState(storage: ReliabilityStorageLike | null, state: ReliabilityCenterState) {
  storage?.setItem(storageKey, JSON.stringify(state));
}

function getBrowserStorage(): ReliabilityStorageLike | null {
  if (typeof localStorage === "undefined") {
    return null;
  }
  if (
    typeof localStorage.getItem !== "function" ||
    typeof localStorage.setItem !== "function" ||
    typeof localStorage.removeItem !== "function"
  ) {
    return null;
  }
  return localStorage;
}

function createRecordId(prefix: string): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `${prefix}_${random}`;
}
