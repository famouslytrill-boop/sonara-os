export type CreatorStudioStorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type CreatorRecordStatus = "draft" | "setup";
export type CreatorAssetType = "audio" | "video" | "image" | "document" | "other";
export type RightsReviewLabel =
  | "source_required"
  | "usage_rights_unverified"
  | "license_review_required";

export type CreatorProofCardDraft = Readonly<{
  id: string;
  organization_id: string;
  display_name: string;
  short_bio: string;
  focus_area: string;
  proof_points: string;
  contact_action: string;
  rights_note: string;
  status: CreatorRecordStatus;
  created_at: string;
}>;

export type CreatorAssetRecord = Readonly<{
  id: string;
  organization_id: string;
  title: string;
  asset_type: CreatorAssetType;
  source_note: string;
  usage_note: string;
  rights_labels: readonly RightsReviewLabel[];
  status: CreatorRecordStatus;
  created_at: string;
}>;

export type ProjectRoomRecord = Readonly<{
  id: string;
  organization_id: string;
  project_name: string;
  client_label: string;
  scope_note: string;
  next_step: string;
  status: CreatorRecordStatus;
  created_at: string;
}>;

export type CreatorServiceOfferDraft = Readonly<{
  id: string;
  organization_id: string;
  offer_name: string;
  deliverables: string;
  turnaround_note: string;
  price_note: string;
  rights_note: string;
  status: CreatorRecordStatus;
  created_at: string;
}>;

export type ReleaseChecklistItem = Readonly<{
  id: string;
  title: string;
  description: string;
  required: boolean;
}>;

export type CreatorStudioState = Readonly<{
  proofCards: readonly CreatorProofCardDraft[];
  assetRecords: readonly CreatorAssetRecord[];
  projectRooms: readonly ProjectRoomRecord[];
  serviceOffers: readonly CreatorServiceOfferDraft[];
}>;

export type CreatorProofCardInput = Readonly<{
  displayName: string;
  shortBio: string;
  focusArea: string;
  proofPoints: string;
  contactAction: string;
  rightsNote: string;
}>;

export type CreatorAssetInput = Readonly<{
  title: string;
  assetType: CreatorAssetType;
  sourceNote: string;
  usageNote: string;
}>;

export type ProjectRoomInput = Readonly<{
  projectName: string;
  clientLabel: string;
  scopeNote: string;
  nextStep: string;
}>;

export type CreatorServiceOfferInput = Readonly<{
  offerName: string;
  deliverables: string;
  turnaroundNote: string;
  priceNote: string;
  rightsNote: string;
}>;

const storageKey = "sonara-creator-studio-records";
const localOrganizationId = "local_creator_setup";

export const creatorAssetTypeLabels: Record<CreatorAssetType, string> = {
  audio: "Audio",
  video: "Video",
  image: "Image",
  document: "Document",
  other: "Other"
};

export const rightsReviewLabels: Record<RightsReviewLabel, string> = {
  source_required: "Source required",
  usage_rights_unverified: "Usage rights unverified",
  license_review_required: "License review required"
};

export const creatorReleaseChecklist: readonly ReleaseChecklistItem[] = Object.freeze([
  Object.freeze({
    id: "proof-card",
    title: "Proof Card draft",
    description: "Creator profile, proof points, contact action, and rights note are drafted.",
    required: true
  }),
  Object.freeze({
    id: "asset-rights",
    title: "Asset rights review",
    description: "Every asset has a source note and usage note before release planning.",
    required: true
  }),
  Object.freeze({
    id: "service-offer",
    title: "Service offer draft",
    description: "Service deliverables and next steps are clear before sharing.",
    required: true
  }),
  Object.freeze({
    id: "payment-booking",
    title: "Payment and booking setup",
    description: "Provider-hosted payment and owner-reviewed booking links are prepared.",
    required: true
  }),
  Object.freeze({
    id: "campaign-assets",
    title: "Campaign assets",
    description: "Placeholder until reviewed brand and rights-safe creative tools are wired.",
    required: false
  })
]);

export const initialCreatorStudioState: CreatorStudioState = Object.freeze({
  proofCards: Object.freeze([]),
  assetRecords: Object.freeze([]),
  projectRooms: Object.freeze([]),
  serviceOffers: Object.freeze([])
});

export function createCreatorStudioStore(
  storage: CreatorStudioStorageLike | null = getBrowserStorage()
) {
  let state = readStoredState(storage);

  function getState() {
    return state;
  }

  function addProofCard(input: CreatorProofCardInput) {
    const record = createCreatorProofCardDraft(input);
    state = Object.freeze({
      ...state,
      proofCards: Object.freeze([...state.proofCards, record])
    });
    writeStoredState(storage, state);
    return record;
  }

  function addAssetRecord(input: CreatorAssetInput) {
    const record = createCreatorAssetRecord(input);
    state = Object.freeze({
      ...state,
      assetRecords: Object.freeze([...state.assetRecords, record])
    });
    writeStoredState(storage, state);
    return record;
  }

  function addProjectRoom(input: ProjectRoomInput) {
    const record = createProjectRoomRecord(input);
    state = Object.freeze({
      ...state,
      projectRooms: Object.freeze([...state.projectRooms, record])
    });
    writeStoredState(storage, state);
    return record;
  }

  function addServiceOffer(input: CreatorServiceOfferInput) {
    const record = createCreatorServiceOfferDraft(input);
    state = Object.freeze({
      ...state,
      serviceOffers: Object.freeze([...state.serviceOffers, record])
    });
    writeStoredState(storage, state);
    return record;
  }

  function clear() {
    state = initialCreatorStudioState;
    storage?.removeItem(storageKey);
  }

  return Object.freeze({
    getState,
    addProofCard,
    addAssetRecord,
    addProjectRoom,
    addServiceOffer,
    clear
  });
}

export function createCreatorProofCardDraft(
  input: CreatorProofCardInput,
  createdAt = new Date().toISOString(),
  id = createRecordId("creator-proof")
): CreatorProofCardDraft {
  return Object.freeze({
    id,
    organization_id: localOrganizationId,
    display_name: input.displayName.trim(),
    short_bio: input.shortBio.trim(),
    focus_area: input.focusArea.trim(),
    proof_points: input.proofPoints.trim(),
    contact_action: input.contactAction.trim(),
    rights_note: input.rightsNote.trim(),
    status: "draft",
    created_at: createdAt
  });
}

export function createCreatorAssetRecord(
  input: CreatorAssetInput,
  createdAt = new Date().toISOString(),
  id = createRecordId("asset")
): CreatorAssetRecord {
  return Object.freeze({
    id,
    organization_id: localOrganizationId,
    title: input.title.trim(),
    asset_type: input.assetType,
    source_note: input.sourceNote.trim(),
    usage_note: input.usageNote.trim(),
    rights_labels: Object.freeze(createRightsLabels(input.sourceNote, input.usageNote)),
    status: "draft",
    created_at: createdAt
  });
}

export function createProjectRoomRecord(
  input: ProjectRoomInput,
  createdAt = new Date().toISOString(),
  id = createRecordId("project")
): ProjectRoomRecord {
  return Object.freeze({
    id,
    organization_id: localOrganizationId,
    project_name: input.projectName.trim(),
    client_label: input.clientLabel.trim(),
    scope_note: input.scopeNote.trim(),
    next_step: input.nextStep.trim(),
    status: "draft",
    created_at: createdAt
  });
}

export function createCreatorServiceOfferDraft(
  input: CreatorServiceOfferInput,
  createdAt = new Date().toISOString(),
  id = createRecordId("creator-offer")
): CreatorServiceOfferDraft {
  return Object.freeze({
    id,
    organization_id: localOrganizationId,
    offer_name: input.offerName.trim(),
    deliverables: input.deliverables.trim(),
    turnaround_note: input.turnaroundNote.trim(),
    price_note: input.priceNote.trim(),
    rights_note: input.rightsNote.trim(),
    status: "draft",
    created_at: createdAt
  });
}

export function createRightsLabels(
  sourceNote: string,
  usageNote: string
): readonly RightsReviewLabel[] {
  const labels = new Set<RightsReviewLabel>();
  if (!sourceNote.trim()) {
    labels.add("source_required");
  }
  if (!usageNote.trim()) {
    labels.add("usage_rights_unverified");
  }
  labels.add("license_review_required");
  return Object.freeze([...labels]);
}

export function createCreatorSetupChecklist(state: CreatorStudioState) {
  return Object.freeze([
    Object.freeze({
      title: "Draft Proof Card",
      route: "/creator-studio/proof-card",
      isComplete: state.proofCards.length > 0
    }),
    Object.freeze({
      title: "Add first asset record",
      route: "/creator-studio/asset-vault",
      isComplete: state.assetRecords.length > 0
    }),
    Object.freeze({
      title: "Create project room",
      route: "/creator-studio/project-rooms",
      isComplete: state.projectRooms.length > 0
    }),
    Object.freeze({
      title: "Draft service offer",
      route: "/creator-studio/service-offers",
      isComplete: state.serviceOffers.length > 0
    }),
    Object.freeze({
      title: "Review release checklist",
      route: "/creator-studio/release-checklist",
      isComplete: false
    })
  ]);
}

function readStoredState(storage: CreatorStudioStorageLike | null): CreatorStudioState {
  const raw = storage?.getItem(storageKey);
  if (!raw) {
    return initialCreatorStudioState;
  }
  try {
    return normalizeState(JSON.parse(raw));
  } catch {
    storage?.removeItem(storageKey);
    return initialCreatorStudioState;
  }
}

function normalizeState(value: unknown): CreatorStudioState {
  if (!value || typeof value !== "object") {
    return initialCreatorStudioState;
  }
  const candidate = value as Partial<CreatorStudioState>;
  return Object.freeze({
    proofCards: Object.freeze(Array.isArray(candidate.proofCards) ? candidate.proofCards : []),
    assetRecords: Object.freeze(
      Array.isArray(candidate.assetRecords) ? candidate.assetRecords : []
    ),
    projectRooms: Object.freeze(
      Array.isArray(candidate.projectRooms) ? candidate.projectRooms : []
    ),
    serviceOffers: Object.freeze(
      Array.isArray(candidate.serviceOffers) ? candidate.serviceOffers : []
    )
  });
}

function writeStoredState(storage: CreatorStudioStorageLike | null, state: CreatorStudioState) {
  storage?.setItem(storageKey, JSON.stringify(state));
}

function getBrowserStorage(): CreatorStudioStorageLike | null {
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
