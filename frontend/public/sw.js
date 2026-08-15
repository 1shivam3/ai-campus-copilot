const CACHE_NAME = "coursepilot-shell-v1"
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/favicon.svg",
  "/icon-192.svg",
  "/icon-512.svg",
  "/icon-maskable.svg",
  "/manifest.webmanifest",
]

// Install: Cache core application shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  )
})

// Activate: Clean up previous cache versions
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames.map((name) => {
            if (name !== CACHE_NAME) {
              return caches.delete(name)
            }
          })
        )
      )
      .then(() => self.clients.claim())
  )
})

// Fetch: Secure caching strategy
self.addEventListener("fetch", (event) => {
  const { request } = event
  const url = new URL(request.url)

  // 1. Never intercept non-GET requests
  if (request.method !== "GET") {
    return
  }

  // 2. NEVER cache private Supabase data or AI backend responses
  // This guarantees user data isolation is never compromised
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

  // 3. Navigation requests (HTML SPA routing): Network-first with Cache fallback
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/index.html") || caches.match("/"))
    )
    return
  }

  // 4. Static assets (CSS, JS, Fonts, Images): Stale-while-revalidate / Cache-first
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

// Handle Notification Click Events
self.addEventListener("notificationclick", (event) => {
  event.notification.close()

  const targetUrl = event.notification.data?.url || "/"

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        // If a window is already open, focus it
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            if (client.navigate && targetUrl !== "/") {
              client.navigate(targetUrl)
            }
            return client.focus()
          }
        }
        // Otherwise open a new window
        if (clients.openWindow) {
          return clients.openWindow(targetUrl)
        }
      })
  )
})
