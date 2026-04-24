import type { WorkflowStep } from "./sessionContext.ts";

export const uploadProgressStates = Object.freeze([0, 23, 67, 100]);

export type UploadSimulationSnapshot = Readonly<{
  progress: number;
  label: string;
}>;

export function createUploadSimulationSnapshots(
  fileName: string
): readonly UploadSimulationSnapshot[] {
  return uploadProgressStates.map((progress) =>
    Object.freeze({
      progress,
      label: progress === 100 ? `Decoded ${fileName}` : `Decoding ${fileName}`
    })
  );
}

export function completeUploadSimulation(fileName: string): {
  uploadedFileName: string;
  currentStep: WorkflowStep;
} {
  return {
    uploadedFileName: fileName,
    currentStep: "analyze"
  };
}
