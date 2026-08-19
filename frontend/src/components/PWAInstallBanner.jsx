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
        <div className="fixed bottom-4 right-4 z-40 max-w-sm rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-xl transition-all duration-300">
          <div className="flex items-start gap-3">
            <CoursePilotMark className="h-8 w-8 shrink-0 shadow-xs" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-900">
                Install CoursePilot App
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500 leading-snug">
                Add to your home screen for distraction-free full-screen access.
              </p>
              <div className="mt-2.5 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleInstallClick}
                  className="rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-bold text-white shadow-xs hover:bg-slate-800 transition active:scale-[0.98]"
                >
                  Install
                </button>
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-slate-500 hover:text-slate-800 transition"
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
