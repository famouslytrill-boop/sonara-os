import type { FeatureSpec, FeatureSpecSectionName, ImplementationTask } from "./types.ts";

const taskSources: readonly FeatureSpecSectionName[] = Object.freeze([
  "dataModelNotes",
  "routeRequirements",
  "apiRequirements",
  "securityRequirements",
  "privacyRequirements",
  "testRequirements",
  "launchGateRequirements"
]);

export function createTaskBreakdown(spec: FeatureSpec): readonly ImplementationTask[] {
  const tasks: ImplementationTask[] = [];
  for (const section of taskSources) {
    const entries = spec[section];
    if (!Array.isArray(entries)) {
      continue;
    }
    entries.forEach((entry, index) => {
      tasks.push(
        Object.freeze({
          id: `${spec.id}-${section}-${index + 1}`,
          title: titleFor(section, index + 1),
          description: entry,
          sourceSection: section,
          required: section !== "launchGateRequirements"
        })
      );
    });
  }
  return Object.freeze(tasks);
}

function titleFor(section: FeatureSpecSectionName, index: number): string {
  return `${section.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`)} ${index}`;
}
