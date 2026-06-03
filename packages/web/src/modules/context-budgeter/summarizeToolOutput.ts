export function summarizeToolOutput(output: string): string {
  return output.length <= 500 ? output : `${output.slice(0, 500)}\n[truncated; original preserved]`;
}
