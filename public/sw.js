// Minimal service worker: satisfies Android/Chrome's installability
// requirement (a fetch handler) and gives a basic cache-then-network
// fallback so the app shell still opens if connectivity drops for a moment.
// This is not an offline-transactions story — creating a transaction always
// needs a live connection to the backend — it's just resilience for the
// static shell itself.

const CACHE_NAME = 'paypulse-pos-v1'

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      try {
        const fresh = await fetch(event.request)
        if (fresh.ok && event.request.url.startsWith(self.location.origin)) {
          cache.put(event.request, fresh.clone())
        }
        return fresh
      } catch {
        const cached = await cache.match(event.request)
        if (cached) return cached
        throw new Error('offline and not cached')
      }
    }),
  )
})
