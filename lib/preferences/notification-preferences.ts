export type NotificationPreferenceState = {
  soundEffects: boolean;
  voiceAnnouncements: boolean;
  haptics: boolean;
  visualAlerts: boolean;
  emailAlerts: boolean;
  smsAlerts: boolean;
  browserPush: boolean;
};

export const defaultNotificationPreferences: NotificationPreferenceState = {
  soundEffects: false,
  voiceAnnouncements: false,
  haptics: false,
  visualAlerts: true,
  emailAlerts: false,
  smsAlerts: false,
  browserPush: false,
};

const storageKey = "sonara.notification-preferences.v1";

export function readNotificationPreferences(): NotificationPreferenceState {
  if (typeof window === "undefined") {
    return defaultNotificationPreferences;
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    return raw ? { ...defaultNotificationPreferences, ...JSON.parse(raw) } : defaultNotificationPreferences;
  } catch {
    return defaultNotificationPreferences;
  }
}

export function writeNotificationPreferences(preferences: NotificationPreferenceState) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(storageKey, JSON.stringify(preferences));
}

export const soundPalette = [
  "success chime",
  "muted tick",
  "warm confirmation pulse",
  "warning knock",
  "blocked-action thud",
  "payment-link sparkle",
  "booking-confirm tone",
  "review-received chime",
] as const;
