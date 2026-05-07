export type VaultStackItem = {
  name: string;
  status: "ready" | "needs_license_review" | "blocked";
  note: string;
};

export type VaultStackPlan = {
  purpose: string;
  items: VaultStackItem[];
  exportWarnings: string[];
};
