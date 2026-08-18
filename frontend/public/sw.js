const CACHE_NAME = "coursepilot-shell-v2"
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/favicon.svg",
  "/icon-192.svg",
  "/icon-512.svg",
  "/icon-maskable.svg",
  "/manifest.webmanifest",
]

// 1. Install: Pre-cache core application shell and skip waiting immediately
self.addEventListener("install", (event) => {
  self.skipWaiting()
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS).catch((err) => console.warn("SW precache note:", err)))
  )
})

// 2. Activate: Clean up all legacy caches (v1 and any unrecognized caches) and claim clients
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames.map((name) => {
            if (name !== CACHE_NAME) {
              console.info("[SW] Removing legacy cache:", name)
              return caches.delete(name)
            }
          })
        )
      )
      .then(() => self.clients.claim())
  )
})

// 3. Message handler: Allow application to command skipWaiting or clear caches
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting()
  }
  if (event.data && event.data.type === "CLEAR_ALL_CACHES") {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
    )
  }
})

// 4. Fetch: Secure network-first navigation with graceful fallback
self.addEventListener("fetch", (event) => {
  const { request } = event
  const url = new URL(request.url)

  // A. Never intercept non-GET requests
  if (request.method !== "GET") {
    return
  }

  // B. NEVER cache private Supabase data or AI backend responses
  if (
    url.hostname.includes("supabase.co") ||
    url.hostname.includes("onrender.com") ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/rest/") ||
    url.pathname.startsWith("/auth/") ||
    url.pathname.startsWith("/storage/")
  ) {
    return
  }

  // C. Navigation requests (HTML SPA routing): Network-first with cache fallback
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put("/index.html", clone))
          }
          return networkResponse
        })
        .catch(() => caches.match("/index.html").then((cached) => cached || caches.match("/")))
    )
    return
  }

  // D. Static assets (CSS, JS, Fonts, Images): Stale-while-revalidate
  if (
    url.pathname.startsWith("/assets/") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".js") ||
    url.hostname.includes("fonts.googleapis.com") ||
    url.hostname.includes("fonts.gstatic.com")
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseToCache = networkResponse.clone()
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseToCache)
              })
            }
            return networkResponse
          })
          .catch(() => cachedResponse)

        return cachedResponse || fetchPromise
      })
    )
    return
  }
})

// 5. Handle Notification Click Events
self.addEventListener("notificationclick", (event) => {
  event.notification.close()

  const targetUrl = event.notification.data?.url || "/"

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            if (client.navigate && targetUrl !== "/") {
              client.navigate(targetUrl)
            }
            return client.focus()
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(targetUrl)
        }
      })
  )
})
