import type { ActivationState, ActivationStep, ActivationStepId } from "./activationTypes";

const activationLabels: Record<ActivationStepId, string> = {
  create_first_project: "Create first project",
  generate_song_fingerprint: "Generate first Song Fingerprint",
  review_genre_arrangement_core: "Review Genre/Arrangement Core",
  review_runtime_target: "Review Runtime Target",
  review_prompt_length: "Review Prompt Length Mode",
  review_external_generator_settings: "Review External Generator Settings",
  add_authentic_writer_details: "Add Authentic Writer details",
  add_lyric_structure: "Add Lyric Structure",
  export_first_prompt_pack: "Export first Prompt Pack",
  visit_store_pricing: "Visit Store/Pricing",
  upgrade_plan: "Upgrade Plan",
};

export function calculateActivationState(completed: Partial<Record<ActivationStepId, boolean>> = {}): ActivationState {
  const steps = (Object.keys(activationLabels) as ActivationStepId[]).map((id) => ({
    id,
    label: activationLabels[id],
    completed: Boolean(completed[id]),
  }));
  const score = Math.round((steps.filter((step) => step.completed).length / steps.length) * 100);
  const nextBestStep = steps.find((step) => !step.completed) ?? steps[steps.length - 1];

  return { steps, score, nextBestStep };
}

export function activationStepFromFeature(feature: string): ActivationStep {
  const id = (feature in activationLabels ? feature : "create_first_project") as ActivationStepId;
  return { id, label: activationLabels[id], completed: false };
}
