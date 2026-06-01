export type PermissionKey = "camera" | "microphone" | "voice" | "contacts" | "phone" | "notifications" | "geolocation";

export const permissionRegistry: Record<PermissionKey, { label: string; risk: "low" | "medium" | "high"; rule: string }> = {
  camera: { label: "Camera", risk: "medium", rule: "Request only after user action; no hidden capture." },
  microphone: { label: "Microphone", risk: "high", rule: "Request only after user action; show listening state." },
  voice: { label: "Voice commands", risk: "high", rule: "Draft-only commands with visible review before action." },
  contacts: { label: "Contacts", risk: "high", rule: "Never auto-import; require explicit selection and consent." },
  phone: { label: "Phone/SMS", risk: "high", rule: "Planning only unless approved provider and consent records exist." },
  notifications: { label: "Notifications", risk: "medium", rule: "Opt-in, revocable, and not used for hidden alerts." },
  geolocation: { label: "Location", risk: "high", rule: "Optional; no covert tracking or employee/customer monitoring." },
};
