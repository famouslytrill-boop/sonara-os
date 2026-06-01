import { describe, expect, it } from "vitest";
import {
  createCreatorAssetRecord,
  createCreatorSetupChecklist,
  createCreatorStudioStore,
  createRightsLabels,
  creatorReleaseChecklist
} from "./lib/creator-studio/index.ts";

describe("Creator Studio MVP records", () => {
  it("creates local setup records for proof, assets, project rooms, and offers", () => {
    const store = createCreatorStudioStore(createMemoryStorage());

    const proofCard = store.addProofCard({
      displayName: "Signal Maker",
      shortBio: "Creates release-ready audio and visuals.",
      focusArea: "Music release support",
      proofPoints: "Portfolio available on request.",
      contactAction: "Request a project review",
      rightsNote: "Rights reviewed per project."
    });
    const asset = store.addAssetRecord({
      title: "Cover concept",
      assetType: "image",
      sourceNote: "Created in-house.",
      usageNote: "Needs final license review before public use."
    });
    const projectRoom = store.addProjectRoom({
      projectName: "Single release",
      clientLabel: "Collaborator",
      scopeNote: "Artwork, short clips, release checklist.",
      nextStep: "Review assets"
    });
    const serviceOffer = store.addServiceOffer({
      offerName: "Release setup package",
      deliverables: "Proof card, asset checklist, booking/payment links.",
      turnaroundNote: "Timeline set after intake review.",
      priceNote: "Quote after scope review.",
      rightsNote: "No clearance claim until reviewed."
    });

    expect(proofCard.status).toBe("draft");
    expect(asset.rights_labels).toContain("license_review_required");
    expect(projectRoom.status).toBe("draft");
    expect(serviceOffer.rights_note).toContain("clearance");
    expect(store.getState().proofCards).toHaveLength(1);
    expect(store.getState().assetRecords).toHaveLength(1);
    expect(store.getState().projectRooms).toHaveLength(1);
    expect(store.getState().serviceOffers).toHaveLength(1);
  });

  it("flags missing asset source and usage notes for rights review", () => {
    const labels = createRightsLabels("", "");
    const asset = createCreatorAssetRecord(
      {
        title: "Unreviewed audio stem",
        assetType: "audio",
        sourceNote: "",
        usageNote: ""
      },
      "2026-05-18T00:00:00.000Z",
      "asset-test"
    );

    expect(labels).toEqual([
      "source_required",
      "usage_rights_unverified",
      "license_review_required"
    ]);
    expect(asset.rights_labels).toEqual(labels);
  });

  it("keeps the release checklist review-based instead of claiming rights clearance", () => {
    const state = createCreatorStudioStore(createMemoryStorage()).getState();
    const setupChecklist = createCreatorSetupChecklist(state);
    const checklistCopy = creatorReleaseChecklist
      .map((item) => `${item.title} ${item.description}`)
      .join(" ");

    expect(creatorReleaseChecklist.some((item) => item.required)).toBe(true);
    expect(setupChecklist.map((item) => item.route)).toContain("/creator-studio/proof-card");
    expect(checklistCopy).not.toMatch(/\bcleared\b/i);
    expect(checklistCopy).not.toMatch(/\blicensed\b/i);
  });
});

function createMemoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
    removeItem(key: string) {
      values.delete(key);
    }
  };
}
