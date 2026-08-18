import { useEffect, useState } from "react"
import { promptInstall, isInstallAvailable } from "../lib/pwa"
import { CoursePilotMark } from "./CoursePilotLogo"

export function PWAInstallBanner() {
  const [canInstall, setCanInstall] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  )

  useEffect(() => {
    // Check if dismissed before
    const isDismissed = sessionStorage.getItem("coursepilot_pwa_dismissed")
    if (isDismissed) {
      setDismissed(true)
    }

    function handleCanInstall() {
      if (!sessionStorage.getItem("coursepilot_pwa_dismissed")) {
        setCanInstall(true)
      }
    }

    function handleInstalled() {
      setCanInstall(false)
    }

    function handleOnline() {
      setIsOnline(true)
    }

    function handleOffline() {
      setIsOnline(false)
    }

    window.addEventListener("coursepilot:can-install", handleCanInstall)
    window.addEventListener("coursepilot:installed", handleInstalled)
    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    if (isInstallAvailable() && !isDismissed) {
      setCanInstall(true)
    }

    return () => {
      window.removeEventListener("coursepilot:can-install", handleCanInstall)
      window.removeEventListener("coursepilot:installed", handleInstalled)
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  async function handleInstallClick() {
    const accepted = await promptInstall()
    if (accepted) {
      setCanInstall(false)
    }
  }

  function handleDismiss() {
    setDismissed(true)
    setCanInstall(false)
    sessionStorage.setItem("coursepilot_pwa_dismissed", "true")
  }

  return (
    <>
      {/* Offline Notification */}
      {!isOnline && (
        <div
          role="alert"
          className="sticky top-0 z-50 flex items-center justify-between bg-amber-600 px-4 py-2 text-xs font-semibold text-white shadow-sm"
        >
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span>You&apos;re offline. Some CoursePilot features require an active internet connection.</span>
          </div>
        </div>
      )}

      {/* Subtle Install Banner */}
      {canInstall && !dismissed && (
        <div className="fixed bottom-4 right-4 z-40 max-w-sm rounded-2xl border border-[#E4E4E7] bg-white p-3.5 shadow-xl transition-all duration-300 dark:border-[#27343a] dark:bg-[#141c1f]">
          <div className="flex items-start gap-3">
            <CoursePilotMark className="h-8 w-8 shrink-0 shadow-xs" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-[#18181B] dark:text-[#f4f4f5]">
                Install CoursePilot App
              </p>
              <p className="mt-0.5 text-[11px] text-[#52525B] leading-snug dark:text-[#a1a1aa]">
                Add to your home screen for distraction-free full-screen access.
              </p>
              <div className="mt-2.5 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleInstallClick}
                  className="rounded-xl bg-[#0F766E] px-3.5 py-1.5 text-[11px] font-bold text-white shadow-2xs hover:bg-[#115E59] transition active:scale-[0.98]"
                >
                  Install
                </button>
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="rounded-xl px-2.5 py-1.5 text-[11px] font-semibold text-[#71717A] hover:text-[#18181B] transition dark:hover:text-white"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default PWAInstallBanner
