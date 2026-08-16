/**
 * Theme Management Utility for CoursePilot
 * Supports "light", "dark", and "system" modes with persistence in localStorage.
 */

const THEME_STORAGE_KEY = "coursepilot_theme"

export function getStoredTheme() {
  if (typeof window === "undefined") return "light"
  return localStorage.getItem(THEME_STORAGE_KEY) || "system"
}

export function isSystemDark() {
  if (typeof window === "undefined" || !window.matchMedia) return false
  return window.matchMedia("(prefers-color-scheme: dark)").matches
}

export function applyTheme(theme) {
  if (typeof window === "undefined") return

  localStorage.setItem(THEME_STORAGE_KEY, theme)
  const root = document.documentElement

  const shouldBeDark =
    theme === "dark" || (theme === "system" && isSystemDark())

  if (shouldBeDark) {
    root.classList.add("dark")
  } else {
    root.classList.remove("dark")
  }
}

export function initTheme() {
  if (typeof window === "undefined") return

  const theme = getStoredTheme()
  applyTheme(theme)

  // Listen for system theme changes if set to system
  if (window.matchMedia) {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    const handler = () => {
      const current = getStoredTheme()
      if (current === "system") {
        applyTheme("system")
      }
    }

    try {
      mediaQuery.addEventListener("change", handler)
    } catch {
      mediaQuery.addListener(handler)
    }
  }
}
