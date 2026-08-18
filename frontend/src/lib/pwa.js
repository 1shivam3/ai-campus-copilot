// PWA Service Worker Registration & Install Prompt Manager

let deferredPrompt = null

export function registerServiceWorker() {
  if (typeof window !== "undefined" && "serviceWorker" in navigator) {
    // 1. Clean up legacy caches immediately on app boot
    if ("caches" in window) {
      caches.keys().then((keys) => {
        keys.forEach((k) => {
          if (k === "coursepilot-shell-v1") {
            caches.delete(k).catch(() => {})
          }
        })
      }).catch(() => {})
    }

    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          // Immediately check for updates
          try {
            reg.update()
          } catch {}

          // Check for service worker updates
          reg.addEventListener("updatefound", () => {
            const installingWorker = reg.installing
            if (installingWorker) {
              installingWorker.addEventListener("statechange", () => {
                if (
                  installingWorker.state === "installed" &&
                  navigator.serviceWorker.controller
                ) {
                  // Post skip waiting to activate immediately
                  installingWorker.postMessage({ type: "SKIP_WAITING" })
                  console.info("[PWA] CoursePilot updated to latest version.")
                }
              })
            }
          })
        })
        .catch((err) => {
          console.warn("Service worker registration notice:", err)
        })
    })

    // Listen for controller changes to ensure smooth seamless upgrade
    let refreshing = false
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!refreshing) {
        refreshing = true
        // Only auto-reload if user was stuck on an outdated build
        const isStuck = sessionStorage.getItem("coursepilot_chunk_error_reloaded")
        if (isStuck) {
          sessionStorage.removeItem("coursepilot_chunk_error_reloaded")
          window.location.reload()
        }
      }
    })
  }
}

// Capture native install prompt
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault()
    deferredPrompt = e
    window.dispatchEvent(new CustomEvent("coursepilot:can-install"))
  })

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null
    window.dispatchEvent(new CustomEvent("coursepilot:installed"))
  })
}

export function promptInstall() {
  if (!deferredPrompt) {
    return Promise.resolve(false)
  }

  deferredPrompt.prompt()
  return deferredPrompt.userChoice.then((choiceResult) => {
    deferredPrompt = null
    return choiceResult.outcome === "accepted"
  })
}

export function isInstallAvailable() {
  return Boolean(deferredPrompt)
}
