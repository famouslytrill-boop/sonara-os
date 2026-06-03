export type SonaraLanguage = "en-US" | "es" | "fr" | "pt-BR";
export type SonaraUnitSystem = "imperial" | "metric";

export type UserPreferences = {
  language: SonaraLanguage;
  unitSystem: SonaraUnitSystem;
};

export const supportedLanguages: Array<{ value: SonaraLanguage; label: string; reviewRequired?: boolean }> = [
  { value: "en-US", label: "English (US)" },
  { value: "es", label: "Spanish", reviewRequired: true },
  { value: "fr", label: "French", reviewRequired: true },
  { value: "pt-BR", label: "Portuguese (Brazil)", reviewRequired: true },
];

export const supportedUnitSystems: Array<{ value: SonaraUnitSystem; label: string }> = [
  { value: "imperial", label: "Imperial" },
  { value: "metric", label: "Metric" },
];

export const defaultUserPreferences: UserPreferences = {
  language: "en-US",
  unitSystem: "imperial",
};

export function parseLanguage(value: FormDataEntryValue | string | null | undefined): SonaraLanguage {
  return supportedLanguages.some((language) => language.value === value) ? (value as SonaraLanguage) : defaultUserPreferences.language;
}

export function parseUnitSystem(value: FormDataEntryValue | string | null | undefined): SonaraUnitSystem {
  return supportedUnitSystems.some((unitSystem) => unitSystem.value === value) ? (value as SonaraUnitSystem) : defaultUserPreferences.unitSystem;
}
