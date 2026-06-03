export function resolveContradiction(previous: string, next: string) {
  return {
    value: next,
    warning: previous !== next ? "contradiction_recorded" : "no_contradiction"
  };
}
