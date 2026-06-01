export interface SonaraReport {
  ok: true;
  system: string;
  publicNames: string[];
  internalEngines: string[];
  enabled: boolean;
  safetyRules: string[];
  nextActions: string[];
}
