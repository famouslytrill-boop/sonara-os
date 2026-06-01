export type GrowthStudioStorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type GrowthRecordStatus = "draft" | "setup";
export type CampaignChannel = "email" | "social" | "local" | "referral" | "other";

export type GrowthCampaignRecord = Readonly<{
  id: string;
  organization_id: string;
  campaign_name: string;
  audience: string;
  channel: CampaignChannel;
  offer_note: string;
  checklist_note: string;
  status: GrowthRecordStatus;
  created_at: string;
}>;

export type GrowthOfferDraft = Readonly<{
  id: string;
  organization_id: string;
  offer_name: string;
  target_customer: string;
  value_note: string;
  price_note: string;
  proof_needed: string;
  status: GrowthRecordStatus;
  created_at: string;
}>;

export type WinBackCustomerTag = Readonly<{
  id: string;
  organization_id: string;
  customer_label: string;
  reason: string;
  next_step: string;
  consent_note: string;
  status: GrowthRecordStatus;
  created_at: string;
}>;

export type ReferralCampaignDraft = Readonly<{
  id: string;
  organization_id: string;
  campaign_name: string;
  reward_note: string;
  invite_message: string;
  disclosure_note: string;
  status: GrowthRecordStatus;
  created_at: string;
}>;

export type ReviewRequestChecklistItem = Readonly<{
  id: string;
  title: string;
  description: string;
  required: boolean;
}>;

export type GrowthStudioState = Readonly<{
  campaigns: readonly GrowthCampaignRecord[];
  offers: readonly GrowthOfferDraft[];
  winBackTags: readonly WinBackCustomerTag[];
  referralCampaigns: readonly ReferralCampaignDraft[];
}>;

export type GrowthCampaignInput = Readonly<{
  campaignName: string;
  audience: string;
  channel: CampaignChannel;
  offerNote: string;
  checklistNote: string;
}>;

export type GrowthOfferInput = Readonly<{
  offerName: string;
  targetCustomer: string;
  valueNote: string;
  priceNote: string;
  proofNeeded: string;
}>;

export type WinBackCustomerInput = Readonly<{
  customerLabel: string;
  reason: string;
  nextStep: string;
  consentNote: string;
}>;

export type ReferralCampaignInput = Readonly<{
  campaignName: string;
  rewardNote: string;
  inviteMessage: string;
  disclosureNote: string;
}>;

const storageKey = "sonara-growth-studio-records";
const localOrganizationId = "local_growth_setup";

export const campaignChannelLabels: Record<CampaignChannel, string> = {
  email: "Email",
  social: "Social",
  local: "Local",
  referral: "Referral",
  other: "Other"
};

export const reviewRequestChecklist: readonly ReviewRequestChecklistItem[] = Object.freeze([
  Object.freeze({
    id: "permission",
    title: "Customer permission",
    description: "Ask for permission before using names, testimonials, or private details.",
    required: true
  }),
  Object.freeze({
    id: "truthful-copy",
    title: "Truthful request copy",
    description: "Use simple review request language without fake ratings or pressure.",
    required: true
  }),
  Object.freeze({
    id: "external-profile",
    title: "External profile link",
    description: "Review links need owner review before public sharing.",
    required: true
  }),
  Object.freeze({
    id: "moderation",
    title: "Owner moderation",
    description: "Testimonials need owner approval before they appear anywhere public.",
    required: true
  }),
  Object.freeze({
    id: "incentive-disclosure",
    title: "Incentive disclosure",
    description: "Any incentive must be clearly disclosed and reviewed before use.",
    required: false
  })
]);

export const initialGrowthStudioState: GrowthStudioState = Object.freeze({
  campaigns: Object.freeze([]),
  offers: Object.freeze([]),
  winBackTags: Object.freeze([]),
  referralCampaigns: Object.freeze([])
});

export function createGrowthStudioStore(
  storage: GrowthStudioStorageLike | null = getBrowserStorage()
) {
  let state = readStoredState(storage);

  function getState() {
    return state;
  }

  function addCampaign(input: GrowthCampaignInput) {
    const record = createGrowthCampaignRecord(input);
    state = Object.freeze({
      ...state,
      campaigns: Object.freeze([...state.campaigns, record])
    });
    writeStoredState(storage, state);
    return record;
  }

  function addOffer(input: GrowthOfferInput) {
    const record = createGrowthOfferDraft(input);
    state = Object.freeze({
      ...state,
      offers: Object.freeze([...state.offers, record])
    });
    writeStoredState(storage, state);
    return record;
  }

  function addWinBackTag(input: WinBackCustomerInput) {
    const record = createWinBackCustomerTag(input);
    state = Object.freeze({
      ...state,
      winBackTags: Object.freeze([...state.winBackTags, record])
    });
    writeStoredState(storage, state);
    return record;
  }

  function addReferralCampaign(input: ReferralCampaignInput) {
    const record = createReferralCampaignDraft(input);
    state = Object.freeze({
      ...state,
      referralCampaigns: Object.freeze([...state.referralCampaigns, record])
    });
    writeStoredState(storage, state);
    return record;
  }

  function clear() {
    state = initialGrowthStudioState;
    storage?.removeItem(storageKey);
  }

  return Object.freeze({
    getState,
    addCampaign,
    addOffer,
    addWinBackTag,
    addReferralCampaign,
    clear
  });
}

export function createGrowthCampaignRecord(
  input: GrowthCampaignInput,
  createdAt = new Date().toISOString(),
  id = createRecordId("growth-campaign")
): GrowthCampaignRecord {
  return Object.freeze({
    id,
    organization_id: localOrganizationId,
    campaign_name: input.campaignName.trim(),
    audience: input.audience.trim(),
    channel: input.channel,
    offer_note: input.offerNote.trim(),
    checklist_note: input.checklistNote.trim(),
    status: "draft",
    created_at: createdAt
  });
}

export function createGrowthOfferDraft(
  input: GrowthOfferInput,
  createdAt = new Date().toISOString(),
  id = createRecordId("growth-offer")
): GrowthOfferDraft {
  return Object.freeze({
    id,
    organization_id: localOrganizationId,
    offer_name: input.offerName.trim(),
    target_customer: input.targetCustomer.trim(),
    value_note: input.valueNote.trim(),
    price_note: input.priceNote.trim(),
    proof_needed: input.proofNeeded.trim(),
    status: "draft",
    created_at: createdAt
  });
}

export function createWinBackCustomerTag(
  input: WinBackCustomerInput,
  createdAt = new Date().toISOString(),
  id = createRecordId("win-back")
): WinBackCustomerTag {
  return Object.freeze({
    id,
    organization_id: localOrganizationId,
    customer_label: input.customerLabel.trim(),
    reason: input.reason.trim(),
    next_step: input.nextStep.trim(),
    consent_note: input.consentNote.trim(),
    status: "draft",
    created_at: createdAt
  });
}

export function createReferralCampaignDraft(
  input: ReferralCampaignInput,
  createdAt = new Date().toISOString(),
  id = createRecordId("referral")
): ReferralCampaignDraft {
  return Object.freeze({
    id,
    organization_id: localOrganizationId,
    campaign_name: input.campaignName.trim(),
    reward_note: input.rewardNote.trim(),
    invite_message: input.inviteMessage.trim(),
    disclosure_note: input.disclosureNote.trim(),
    status: "draft",
    created_at: createdAt
  });
}

export function createGrowthSetupChecklist(state: GrowthStudioState) {
  return Object.freeze([
    Object.freeze({
      title: "Draft campaign",
      route: "/growth-studio/campaigns",
      isComplete: state.campaigns.length > 0
    }),
    Object.freeze({
      title: "Draft offer",
      route: "/growth-studio/offers",
      isComplete: state.offers.length > 0
    }),
    Object.freeze({
      title: "Create win-back list",
      route: "/growth-studio/win-back",
      isComplete: state.winBackTags.length > 0
    }),
    Object.freeze({
      title: "Review request flow",
      route: "/growth-studio/review-requests",
      isComplete: false
    }),
    Object.freeze({
      title: "Draft referral campaign",
      route: "/growth-studio/referrals",
      isComplete: state.referralCampaigns.length > 0
    })
  ]);
}

function readStoredState(storage: GrowthStudioStorageLike | null): GrowthStudioState {
  const raw = storage?.getItem(storageKey);
  if (!raw) {
    return initialGrowthStudioState;
  }
  try {
    return normalizeState(JSON.parse(raw));
  } catch {
    storage?.removeItem(storageKey);
    return initialGrowthStudioState;
  }
}

function normalizeState(value: unknown): GrowthStudioState {
  if (!value || typeof value !== "object") {
    return initialGrowthStudioState;
  }
  const candidate = value as Partial<GrowthStudioState>;
  return Object.freeze({
    campaigns: Object.freeze(Array.isArray(candidate.campaigns) ? candidate.campaigns : []),
    offers: Object.freeze(Array.isArray(candidate.offers) ? candidate.offers : []),
    winBackTags: Object.freeze(Array.isArray(candidate.winBackTags) ? candidate.winBackTags : []),
    referralCampaigns: Object.freeze(
      Array.isArray(candidate.referralCampaigns) ? candidate.referralCampaigns : []
    )
  });
}

function writeStoredState(storage: GrowthStudioStorageLike | null, state: GrowthStudioState) {
  storage?.setItem(storageKey, JSON.stringify(state));
}

function getBrowserStorage(): GrowthStudioStorageLike | null {
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
