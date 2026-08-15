import { isTimeInQuietHours } from "../utils/notificationEngine"

export function getBrowserNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported"
  }
  return Notification.permission
}

export async function requestBrowserNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported"
  }

  try {
    const permission = await Notification.requestPermission()
    return permission
  } catch (err) {
    console.warn("Notification permission error:", err)
    return "denied"
  }
}

export async function dispatchNativeBrowserNotification({
  title,
  message,
  url = "/",
  priority = "NORMAL",
  preferences = {},
}) {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return false
  }

  if (Notification.permission !== "granted") {
    return false
  }

  // Check Quiet Hours: Suppress non-critical notifications during quiet hours
  if (
    preferences.quiet_hours_enabled &&
    isTimeInQuietHours(
      new Date(),
      preferences.quiet_hours_start || "22:30",
      preferences.quiet_hours_end || "07:00"
    )
  ) {
    if (priority !== "CRITICAL") {
      return false
    }
  }

  const options = {
    body: message,
    icon: "/icon-192.svg",
    badge: "/favicon.svg",
    tag: `coursepilot-${priority.toLowerCase()}`,
    data: { url },
    silent: priority === "LOW",
  }

  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.ready
      if (reg && reg.showNotification) {
        await reg.showNotification(title, options)
        return true
      }
    }

    new Notification(title, options)
    return true
  } catch (err) {
    console.warn("Native notification dispatch note:", err)
    return false
  }
}
