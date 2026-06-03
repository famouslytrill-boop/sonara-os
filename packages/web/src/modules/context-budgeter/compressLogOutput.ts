import type { CompressedOutput } from "./contracts.ts";

export function compressLogOutput(log: string, originalId = "original"): CompressedOutput {
  const lines = log.split(/\r?\n/);
  const preservedErrorLines = lines.filter((line) =>
    /error|failed|exception|sqlstate|duplicate key/i.test(line)
  );
  const summary = lines.slice(0, 3).join("\n");
  return {
    summary,
    originalId,
    confidence: preservedErrorLines.length > 0 ? 0.9 : 0.75,
    warnings: preservedErrorLines.length ? ["important_error_lines_preserved"] : [],
    preservedErrorLines
  };
}
