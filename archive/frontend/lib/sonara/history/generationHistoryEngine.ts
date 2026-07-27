import type { GenerationSnapshot, SonaraEngineName } from "./generationHistoryTypes";

export function hashGenerationInput(inputData: Record<string, unknown>, settingsSnapshot: Record<string, unknown> = {}) {
  const source = JSON.stringify({ inputData, settingsSnapshot }, Object.keys({ ...inputData, ...settingsSnapshot }).sort());
  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash << 5) - hash + source.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

export function createGenerationSnapshot(input: {
  engineName: SonaraEngineName;
  inputData: Record<string, unknown>;
  outputData: Record<string, unknown>;
  settingsSnapshot?: Record<string, unknown>;
  parentId?: string;
  label?: string;
  isSelected?: boolean;
}): GenerationSnapshot {
  const settingsSnapshot = input.settingsSnapshot ?? {};
  const inputHash = hashGenerationInput(input.inputData, settingsSnapshot);
  return {
    id: `gen_${input.engineName}_${inputHash}_${Date.now().toString(36)}`,
    parentId: input.parentId,
    engineName: input.engineName,
    engineVersion: "local_rules_v1",
    inputHash,
    inputData: input.inputData,
    settingsSnapshot,
    outputData: input.outputData,
    createdAt: new Date().toISOString(),
    label: input.label,
    isSelected: input.isSelected ?? false,
  };
}

export function regenerateFromSameData(snapshot: GenerationSnapshot): GenerationSnapshot {
  return createGenerationSnapshot({
    engineName: snapshot.engineName,
    inputData: snapshot.inputData,
    settingsSnapshot: snapshot.settingsSnapshot,
    outputData: snapshot.outputData,
    parentId: snapshot.id,
    label: "Regenerated from same data",
  });
}

export function restoreGeneration(snapshots: GenerationSnapshot[]) {
  return [...snapshots].reverse().find((snapshot) => snapshot.isSelected) ?? snapshots.at(-1) ?? null;
}

export function markSelectedGeneration(snapshots: GenerationSnapshot[], id: string) {
  return snapshots.map((snapshot) => ({ ...snapshot, isSelected: snapshot.id === id }));
}

export function compareGenerations(left: GenerationSnapshot, right: GenerationSnapshot) {
  const leftKeys = new Set(Object.keys(left.outputData));
  const rightKeys = new Set(Object.keys(right.outputData));
  const differences = [...new Set([...leftKeys, ...rightKeys])].filter(
    (key) => JSON.stringify(left.outputData[key]) !== JSON.stringify(right.outputData[key]),
  );
  return { leftId: left.id, rightId: right.id, differences };
}
