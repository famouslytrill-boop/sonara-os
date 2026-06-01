export type LegalReadinessStorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type LegalRiskLevel = "low" | "medium" | "high" | "critical";

export type LegalReviewArea =
  | "contract_prep"
  | "policy_review_prep"
  | "attorney_review_packet"
  | "rights_licensing"
  | "campaign_claim_review"
  | "ai_governance_review";

export type LegalProductArea =
  | "business_builder"
  | "creator_studio"
  | "growth_studio"
  | "security_center";

export type LegalRecordStatus = "draft" | "review_required";

export type LegalChecklistItem = Readonly<{
  id: string;
  title: string;
  description: string;
  area: LegalReviewArea;
  riskLevel: LegalRiskLevel;
  humanReviewRequired: boolean;
}>;

export type LegalRiskEvaluation = Readonly<{
  riskLevel: LegalRiskLevel;
  humanReviewRequired: boolean;
  blockedReasons: readonly string[];
}>;

export type AttorneyReviewPacketDraft = Readonly<{
  id: string;
  organization_id: string;
  packet_name: string;
  product_area: LegalProductArea;
  summary: string;
  open_questions: string;
  document_list: string;
  risk_level: LegalRiskLevel;
  human_review_required: boolean;
  status: LegalRecordStatus;
  created_at: string;
}>;

export type RightsLicensingTrackerDraft = Readonly<{
  id: string;
  organization_id: string;
  asset_title: string;
  source_note: string;
  usage_scope: string;
  rights_holder_note: string;
  risk_level: LegalRiskLevel;
  human_review_required: boolean;
  status: LegalRecordStatus;
  created_at: string;
}>;

export type CampaignClaimReviewDraft = Readonly<{
  id: string;
  organization_id: string;
  campaign_name: string;
  claim_text: string;
  evidence_note: string;
  channel: string;
  risk_level: LegalRiskLevel;
  human_review_required: boolean;
  status: LegalRecordStatus;
  created_at: string;
}>;

export type LegalReadinessState = Readonly<{
  attorneyPackets: readonly AttorneyReviewPacketDraft[];
  rightsTrackers: readonly RightsLicensingTrackerDraft[];
  campaignClaimReviews: readonly CampaignClaimReviewDraft[];
}>;

export type AttorneyReviewPacketInput = Readonly<{
  packetName: string;
  productArea: LegalProductArea;
  summary: string;
  openQuestions: string;
  documentList: string;
}>;

export type RightsLicensingTrackerInput = Readonly<{
  assetTitle: string;
  sourceNote: string;
  usageScope: string;
  rightsHolderNote: string;
}>;

export type CampaignClaimReviewInput = Readonly<{
  campaignName: string;
  claimText: string;
  evidenceNote: string;
  channel: string;
}>;

const storageKey = "sonara-legal-readiness-records";
const localOrganizationId = "local_legal_readiness_setup";

export const legalRiskLabels: Record<LegalRiskLevel, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical"
};

export const legalProductAreaLabels: Record<LegalProductArea, string> = {
  business_builder: "Business Builder",
  creator_studio: "Creator Studio",
  growth_studio: "Growth Studio",
  security_center: "Security Center"
};

export const legalReadinessChecklist: readonly LegalChecklistItem[] = Object.freeze([
  Object.freeze({
    id: "contract-prep",
    title: "Contract Prep Checklist",
    description:
      "Collect parties, scope, dates, deliverables, payment terms, and open questions for attorney review.",
    area: "contract_prep",
    riskLevel: "high",
    humanReviewRequired: true
  }),
  Object.freeze({
    id: "policy-review-prep",
    title: "Policy Review Prep",
    description:
      "Prepare privacy, refund, usage, content, and customer-facing policy notes for legal review.",
    area: "policy_review_prep",
    riskLevel: "high",
    humanReviewRequired: true
  }),
  Object.freeze({
    id: "attorney-review-packet",
    title: "Attorney Review Packet",
    description:
      "Create a draft packet with context, document list, risk notes, and unanswered questions.",
    area: "attorney_review_packet",
    riskLevel: "high",
    humanReviewRequired: true
  }),
  Object.freeze({
    id: "rights-licensing-tracker",
    title: "Rights & Licensing Tracker",
    description:
      "Track asset source, intended usage, rights holder notes, and review status before release.",
    area: "rights_licensing",
    riskLevel: "high",
    humanReviewRequired: true
  }),
  Object.freeze({
    id: "campaign-claim-review",
    title: "Campaign Claim Review",
    description:
      "Review campaign claims against available evidence before publishing customer-facing copy.",
    area: "campaign_claim_review",
    riskLevel: "high",
    humanReviewRequired: true
  }),
  Object.freeze({
    id: "ai-governance-review",
    title: "AI Governance Review",
    description:
      "Placeholder review for generated content, data use, approvals, and provider boundaries.",
    area: "ai_governance_review",
    riskLevel: "medium",
    humanReviewRequired: false
  })
]);

export const legalReadinessSafetyRules: readonly string[] = Object.freeze([
  "Preparation only; not legal advice.",
  "High-risk legal items require human review before use.",
  "No guaranteed compliance, outcome, clearance, or enforceability claims.",
  "Legal notices cannot be sent automatically.",
  "Draft packets store setup notes only; attorney review remains required for legal decisions."
]);

export const initialLegalReadinessState: LegalReadinessState = Object.freeze({
  attorneyPackets: Object.freeze([]),
  rightsTrackers: Object.freeze([]),
  campaignClaimReviews: Object.freeze([])
});

export function getLegalRiskLabel(level: LegalRiskLevel): string {
  return legalRiskLabels[level];
}

export function requiresHumanReview(level: LegalRiskLevel): boolean {
  return level === "high" || level === "critical";
}

export function evaluateLegalTextRisk(text: string): LegalRiskEvaluation {
  const normalized = text.toLowerCase();
  const blockedReasons: string[] = [];

  if (
    /\bguarantee[sd]?\b/.test(normalized) ||
    /\bguaranteed compliance\b/.test(normalized) ||
    /\bauto(?:matically)?\s+send\b/.test(normalized) ||
    /\bsend\s+legal\s+notice\b/.test(normalized)
  ) {
    blockedReasons.push("Blocked legal or compliance automation claim.");
  }

  if (/\breplace(?:s|d)?\s+(a\s+)?(lawyer|attorney|counsel)\b/.test(normalized)) {
    blockedReasons.push("Blocked attorney-substitution wording.");
  }

  if (blockedReasons.length > 0) {
    return Object.freeze({
      riskLevel: "critical",
      humanReviewRequired: true,
      blockedReasons: Object.freeze(blockedReasons)
    });
  }

  if (
    /\b(contract|agreement|terms|privacy|refund|license|licensing|copyright|trademark|claim|claims|policy|notice|compliance)\b/.test(
      normalized
    )
  ) {
    return Object.freeze({
      riskLevel: "high",
      humanReviewRequired: true,
      blockedReasons: Object.freeze([])
    });
  }

  if (normalized.trim().length > 0) {
    return Object.freeze({
      riskLevel: "medium",
      humanReviewRequired: false,
      blockedReasons: Object.freeze([])
    });
  }

  return Object.freeze({
    riskLevel: "low",
    humanReviewRequired: false,
    blockedReasons: Object.freeze([])
  });
}

export function createLegalReadinessStore(
  storage: LegalReadinessStorageLike | null = getBrowserStorage()
) {
  let state = readStoredState(storage);

  function getState() {
    return state;
  }

  function addAttorneyPacket(input: AttorneyReviewPacketInput) {
    const record = createAttorneyReviewPacketDraft(input);
    state = Object.freeze({
      ...state,
      attorneyPackets: Object.freeze([...state.attorneyPackets, record])
    });
    writeStoredState(storage, state);
    return record;
  }

  function addRightsTracker(input: RightsLicensingTrackerInput) {
    const record = createRightsLicensingTrackerDraft(input);
    state = Object.freeze({
      ...state,
      rightsTrackers: Object.freeze([...state.rightsTrackers, record])
    });
    writeStoredState(storage, state);
    return record;
  }

  function addCampaignClaimReview(input: CampaignClaimReviewInput) {
    const record = createCampaignClaimReviewDraft(input);
    state = Object.freeze({
      ...state,
      campaignClaimReviews: Object.freeze([...state.campaignClaimReviews, record])
    });
    writeStoredState(storage, state);
    return record;
  }

  function clear() {
    state = initialLegalReadinessState;
    storage?.removeItem(storageKey);
  }

  return Object.freeze({
    getState,
    addAttorneyPacket,
    addRightsTracker,
    addCampaignClaimReview,
    clear
  });
}

export function createAttorneyReviewPacketDraft(
  input: AttorneyReviewPacketInput,
  createdAt = new Date().toISOString(),
  id = createRecordId("legal_packet")
): AttorneyReviewPacketDraft {
  const evaluation = evaluateLegalTextRisk(
    `${input.packetName} ${input.summary} ${input.openQuestions} ${input.documentList}`
  );
  return Object.freeze({
    id,
    organization_id: localOrganizationId,
    packet_name: input.packetName.trim(),
    product_area: input.productArea,
    summary: input.summary.trim(),
    open_questions: input.openQuestions.trim(),
    document_list: input.documentList.trim(),
    risk_level: evaluation.riskLevel,
    human_review_required: evaluation.humanReviewRequired,
    status: evaluation.humanReviewRequired ? "review_required" : "draft",
    created_at: createdAt
  });
}

export function createRightsLicensingTrackerDraft(
  input: RightsLicensingTrackerInput,
  createdAt = new Date().toISOString(),
  id = createRecordId("rights_tracker")
): RightsLicensingTrackerDraft {
  const evaluation = evaluateLegalTextRisk(
    `${input.assetTitle} ${input.sourceNote} ${input.usageScope} ${input.rightsHolderNote} licensing`
  );
  return Object.freeze({
    id,
    organization_id: localOrganizationId,
    asset_title: input.assetTitle.trim(),
    source_note: input.sourceNote.trim(),
    usage_scope: input.usageScope.trim(),
    rights_holder_note: input.rightsHolderNote.trim(),
    risk_level: evaluation.riskLevel,
    human_review_required: evaluation.humanReviewRequired,
    status: evaluation.humanReviewRequired ? "review_required" : "draft",
    created_at: createdAt
  });
}

export function createCampaignClaimReviewDraft(
  input: CampaignClaimReviewInput,
  createdAt = new Date().toISOString(),
  id = createRecordId("campaign_claim")
): CampaignClaimReviewDraft {
  const evaluation = evaluateLegalTextRisk(
    `${input.campaignName} ${input.claimText} ${input.evidenceNote} claim`
  );
  return Object.freeze({
    id,
    organization_id: localOrganizationId,
    campaign_name: input.campaignName.trim(),
    claim_text: input.claimText.trim(),
    evidence_note: input.evidenceNote.trim(),
    channel: input.channel.trim(),
    risk_level: evaluation.riskLevel,
    human_review_required: evaluation.humanReviewRequired,
    status: evaluation.humanReviewRequired ? "review_required" : "draft",
    created_at: createdAt
  });
}

function readStoredState(storage: LegalReadinessStorageLike | null): LegalReadinessState {
  const raw = storage?.getItem(storageKey);
  if (!raw) {
    return initialLegalReadinessState;
  }
  try {
    return normalizeState(JSON.parse(raw));
  } catch {
    storage?.removeItem(storageKey);
    return initialLegalReadinessState;
  }
}

function normalizeState(value: unknown): LegalReadinessState {
  if (!value || typeof value !== "object") {
    return initialLegalReadinessState;
  }
  const candidate = value as Partial<LegalReadinessState>;
  return Object.freeze({
    attorneyPackets: Object.freeze(
      Array.isArray(candidate.attorneyPackets) ? candidate.attorneyPackets : []
    ),
    rightsTrackers: Object.freeze(
      Array.isArray(candidate.rightsTrackers) ? candidate.rightsTrackers : []
    ),
    campaignClaimReviews: Object.freeze(
      Array.isArray(candidate.campaignClaimReviews) ? candidate.campaignClaimReviews : []
    )
  });
}

function writeStoredState(storage: LegalReadinessStorageLike | null, state: LegalReadinessState) {
  storage?.setItem(storageKey, JSON.stringify(state));
}

function getBrowserStorage(): LegalReadinessStorageLike | null {
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
