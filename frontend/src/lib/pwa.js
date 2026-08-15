// PWA Service Worker Registration & Install Prompt Manager

let deferredPrompt = null

export function registerServiceWorker() {
  if (typeof window !== "undefined" && "serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          // Check for service worker updates
          reg.addEventListener("updatefound", () => {
            const installingWorker = reg.installing
            if (installingWorker) {
              installingWorker.addEventListener("statechange", () => {
                if (
                  installingWorker.state === "installed" &&
                  navigator.serviceWorker.controller
                ) {
                  // A new update is available in the background
                  console.info("CoursePilot update available.")
                }
              })
            }
          })
        })
        .catch((err) => {
          console.warn("Service worker registration notice:", err)
        })
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
