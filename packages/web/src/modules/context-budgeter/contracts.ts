export interface CompressedOutput {
  summary: string;
  originalId: string;
  confidence: number;
  warnings: string[];
  preservedErrorLines: string[];
}
