import { getDeploymentConfig } from "../../config/deployment.ts";
import { getSupabaseBrowserClient } from "../supabase/client.ts";

export type BrowserNotificationState = Readonly<{
  supported: boolean;
  permission: NotificationPermission | "unsupported";
  configured: boolean;
  message: string;
}>;

export function getBrowserNotificationState(): BrowserNotificationState {
  if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) {
    return Object.freeze({
      supported: false,
      permission: "unsupported",
      configured: false,
      message: "This browser does not support web notifications. Email remains available."
    });
  }

  const configured = Boolean(getDeploymentConfig().publicAuth.vapidPublicKey);
  return Object.freeze({
    supported: true,
    permission: Notification.permission,
    configured,
    message: configured
      ? "Notifications are opt-in and remain off until you enable them."
      : "Setup required: an administrator must configure NEXT_PUBLIC_VAPID_PUBLIC_KEY."
  });
}

export async function subscribeToPushNotifications() {
  const state = getBrowserNotificationState();
  if (!state.supported || !state.configured) {
    return failure(state.message);
  }

  const client = getSupabaseBrowserClient();
  if (!client) {
    return failure("Setup required: sign-in and Supabase browser auth must be configured first.");
  }
  const { data } = await client.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) {
    return failure("Sign in before enabling notifications.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return failure("Notifications remain off until browser permission is granted.");
  }

  try {
    const registration = await navigator.serviceWorker.register("/sw.js");
    const applicationServerKey = decodeBase64Url(
      getDeploymentConfig().publicAuth.vapidPublicKey ?? ""
    );
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey
    });
    const response = await fetch("/api/notifications/subscribe", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        subscription: subscription.toJSON(),
        userAgent: navigator.userAgent.slice(0, 240)
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok !== true) {
      return failure(payload.message || "The notification subscription could not be saved.");
    }
    return Object.freeze({ ok: true as const, message: "Notifications are enabled for this device." });
  } catch {
    return failure("The browser notification setup could not be completed. Try again later.");
  }
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = window.atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function failure(message: string) {
  return Object.freeze({ ok: false as const, message });
}
