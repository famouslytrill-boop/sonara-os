export type NotificationSoundKey =
  | "success"
  | "warning"
  | "approval_needed"
  | "payment_event"
  | "security_alert"
  | "support_alert";

export type NotificationSoundPreference = Readonly<{
  mutedByDefault: true;
  userControlled: true;
  reducedMotionRespected: true;
  reducedSoundRespected: true;
  autoplayBlocked: true;
  enabledKeys: readonly NotificationSoundKey[];
}>;

export const notificationSoundPreference: NotificationSoundPreference = Object.freeze({
  mutedByDefault: true,
  userControlled: true,
  reducedMotionRespected: true,
  reducedSoundRespected: true,
  autoplayBlocked: true,
  enabledKeys: Object.freeze([
    "success",
    "warning",
    "approval_needed",
    "payment_event",
    "security_alert",
    "support_alert"
  ] as readonly NotificationSoundKey[])
});

export function canPlayNotificationSound(userEnabled: boolean): boolean {
  return userEnabled && !notificationSoundPreference.mutedByDefault;
}
