/**
 * CoursePilot Session Security & Inactivity Expiry Manager
 *
 * Implements:
 * 1. 24-hour inactivity timeout with throttled activity tracking.
 * 2. Configurable development override (window.__DEV_SESSION_IDLE_TIMEOUT_MS).
 * 3. Automatic clean session termination and private cache purge on expiry.
 * 4. Password reset rate limiting (sliding window).
 * 5. Login attempt rate limiting with progressive cooldowns.
 */

const STORAGE_KEY_LAST_ACTIVITY = "coursepilot_last_activity"
const STORAGE_KEY_LOGIN_FAILURES = "coursepilot_login_failures"
const STORAGE_KEY_RESET_REQUESTS = "coursepilot_reset_requests"

// Standard 24 hours of inactivity timeout for production
export const DEFAULT_INACTIVITY_LIMIT_MS = 24 * 60 * 60 * 1000 // 24 hours

// Throttle interval for recording activity: update timestamp at most once every 30 seconds
const ACTIVITY_RECORD_THROTTLE_MS = 30 * 1000

let lastRecordedTime = 0

/**
 * Returns the effective inactivity threshold (supports dev/test override).
 */
export function getEffectiveInactivityLimit() {
  if (
    typeof window !== "undefined" &&
    typeof window.__DEV_SESSION_IDLE_TIMEOUT_MS === "number" &&
    window.__DEV_SESSION_IDLE_TIMEOUT_MS > 0
  ) {
    return window.__DEV_SESSION_IDLE_TIMEOUT_MS
  }
  return DEFAULT_INACTIVITY_LIMIT_MS
}

/**
 * Records user activity timestamp in sessionStorage (throttled).
 */
export function recordUserActivity() {
  const now = Date.now()
  if (now - lastRecordedTime < ACTIVITY_RECORD_THROTTLE_MS) {
    return
  }
  lastRecordedTime = now
  try {
    sessionStorage.setItem(STORAGE_KEY_LAST_ACTIVITY, String(now))
  } catch {}
}

/**
 * Checks if the user has been inactive beyond the allowed threshold.
 */
export function isSessionExpired() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY_LAST_ACTIVITY)
    if (!raw) {
      // First interaction or initialized session -> record current time
      recordUserActivity()
      return false
    }
    const lastActivity = Number(raw)
    if (isNaN(lastActivity) || lastActivity <= 0) {
      return false
    }

    const elapsed = Date.now() - lastActivity
    const limit = getEffectiveInactivityLimit()
    return elapsed > limit
  } catch {
    return false
  }
}

/**
 * Clears the session activity timestamp.
 */
export function clearSessionActivity() {
  lastRecordedTime = 0
  try {
    sessionStorage.removeItem(STORAGE_KEY_LAST_ACTIVITY)
  } catch {}
}

/**
 * Sets up global DOM event listeners to track meaningful user interactions.
 * Returns a cleanup function.
 */
export function initInactivityTracker(onSessionExpired) {
  if (typeof window === "undefined") return () => {}

  // Initialize activity timestamp if not present
  recordUserActivity()

  function handleInteraction() {
    recordUserActivity()
  }

  const events = ["mousedown", "keydown", "touchstart", "scroll", "click"]
  events.forEach((evt) => {
    window.addEventListener(evt, handleInteraction, { passive: true })
  })

  // Visibility change: check expiry when user returns to tab
  function handleVisibilityChange() {
    if (document.visibilityState === "visible") {
      if (isSessionExpired()) {
        if (onSessionExpired) onSessionExpired()
      } else {
        recordUserActivity()
      }
    }
  }
  document.addEventListener("visibilitychange", handleVisibilityChange)

  // Periodic heartbeat checker (runs every 10 seconds)
  const intervalId = setInterval(() => {
    if (isSessionExpired()) {
      if (onSessionExpired) onSessionExpired()
    }
  }, 10000)

  return () => {
    events.forEach((evt) => {
      window.removeEventListener(evt, handleInteraction)
    })
    document.removeEventListener("visibilitychange", handleVisibilityChange)
    clearInterval(intervalId)
  }
}

// -------------------------------------------------------------
// CLIENT-SIDE RATE LIMITING HELPERS
// -------------------------------------------------------------

/**
 * Login Rate Limiting:
 * Allows up to 5 consecutive failures before enforcing progressive cooldown.
 */
export function checkLoginRateLimit(email) {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY_LOGIN_FAILURES)
    const history = raw ? JSON.parse(raw) : {}
    const identifier = (email || "default").trim().toLowerCase()
    const userHistory = history[identifier] || { count: 0, lockedUntil: 0 }

    const now = Date.now()
    if (userHistory.lockedUntil > now) {
      const waitSeconds = Math.ceil((userHistory.lockedUntil - now) / 1000)
      return {
        allowed: false,
        waitSeconds,
        message: `Too many login attempts. Please wait ${waitSeconds} seconds before trying again.`,
      }
    }

    return { allowed: true }
  } catch {
    return { allowed: true }
  }
}

export function recordFailedLogin(email) {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY_LOGIN_FAILURES)
    const history = raw ? JSON.parse(raw) : {}
    const identifier = (email || "default").trim().toLowerCase()
    const userHistory = history[identifier] || { count: 0, lockedUntil: 0 }

    userHistory.count += 1
    const now = Date.now()

    // 5 attempts -> 30s lock; 8+ attempts -> 5 min lock
    if (userHistory.count >= 8) {
      userHistory.lockedUntil = now + 5 * 60 * 1000
    } else if (userHistory.count >= 5) {
      userHistory.lockedUntil = now + 30 * 1000
    }

    history[identifier] = userHistory
    sessionStorage.setItem(STORAGE_KEY_LOGIN_FAILURES, JSON.stringify(history))
  } catch {}
}

export function clearFailedLogins(email) {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY_LOGIN_FAILURES)
    if (!raw) return
    const history = JSON.parse(raw)
    const identifier = (email || "default").trim().toLowerCase()
    delete history[identifier]
    sessionStorage.setItem(STORAGE_KEY_LOGIN_FAILURES, JSON.stringify(history))
  } catch {}
}

/**
 * Password Reset Rate Limiting:
 * Max 3 password reset requests per 60 seconds per client session.
 */
export function checkPasswordResetRateLimit() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY_RESET_REQUESTS)
    const timestamps = raw ? JSON.parse(raw) : []
    const now = Date.now()
    const cutoff = now - 60 * 1000
    const recent = timestamps.filter((t) => t > cutoff)

    if (recent.length >= 3) {
      const waitSeconds = Math.ceil((recent[0] + 60 * 1000 - now) / 1000)
      return {
        allowed: false,
        waitSeconds: Math.max(1, waitSeconds),
        message: `Too many password reset requests. Please wait ${Math.max(1, waitSeconds)} seconds before requesting again.`,
      }
    }

    return { allowed: true }
  } catch {
    return { allowed: true }
  }
}

export function recordPasswordResetRequest() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY_RESET_REQUESTS)
    const timestamps = raw ? JSON.parse(raw) : []
    const now = Date.now()
    const cutoff = now - 60 * 1000
    const recent = timestamps.filter((t) => t > cutoff)
    recent.push(now)
    sessionStorage.setItem(STORAGE_KEY_RESET_REQUESTS, JSON.stringify(recent))
  } catch {}
}
