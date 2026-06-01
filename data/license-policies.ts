export type LicenseGateStatus = "Allowed" | "Review Required" | "Restricted" | "Blocked" | "Reference Only";

export type LicensePolicyRecord = {
  label: string;
  status: LicenseGateStatus;
  summary: string;
  examples: string[];
};

export const licensePolicies: LicensePolicyRecord[] = [
  {
    label: "Permissive licenses",
    status: "Allowed",
    summary: "MIT, BSD, and Apache-2.0 are generally allowed after attribution, dependency, and patent-term review.",
    examples: ["MIT", "BSD-2-Clause", "BSD-3-Clause", "Apache-2.0"],
  },
  {
    label: "Copyleft and complex licenses",
    status: "Restricted",
    summary: "GPL, AGPL, LGPL, MPL, unclear dual licenses, and complex dependency chains require legal review before use.",
    examples: ["GPL", "AGPL", "LGPL", "MPL", "dual license"],
  },
  {
    label: "Model and media restrictions",
    status: "Blocked",
    summary: "Non-commercial model weights, private assets, copyrighted assets without rights, and deceptive media tools are blocked from paid features.",
    examples: ["non-commercial model", "unknown weights", "copyrighted assets", "voice cloning without consent"],
  },
  {
    label: "Research references",
    status: "Reference Only",
    summary: "External projects may be documented as research references without copying code, installing dependencies, or claiming integration.",
    examples: ["architecture notes", "workflow inspiration", "license review queue"],
  },
];
