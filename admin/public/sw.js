const CACHE_NAME = 'nomad-static-v1'
const PRECACHE_URLS = [
  '/manifest.webmanifest',
  '/favicon-192x192.png',
  '/favicon-512x512.png',
  '/project_nomad_logo.webp',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => cacheName !== CACHE_NAME)
            .map((cacheName) => caches.delete(cacheName))
        )
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)

  if (
    request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/storage/') ||
    url.pathname.startsWith('/pmtiles/') ||
    url.pathname.startsWith('/basemaps-assets/')
  ) {
    return
  }

  const isStaticAsset =
    request.destination !== '' && ['script', 'style', 'image', 'font'].includes(request.destination)
  const isPrecachedAsset = PRECACHE_URLS.includes(url.pathname)
  if (!isStaticAsset && !isPrecachedAsset) return

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse

      return fetch(request).then((response) => {
        if (response.ok) {
          const responseToCache = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache))
        }
        return response
      })
    })
  )
})
