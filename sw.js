const APP_CACHE = "darts-app-v3"
const RUNTIME_CACHE = "darts-runtime-v3"

const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./countup.html",
  "./data.html",
  "./settings.html",
  "./news.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./css/base.css",
  "./css/theme.css",
  "./css/menu.css",
  "./css/news.css",
  "./css/layout/lay_core.css",
  "./css/layout/lay_data.css",
  "./css/layout/lay_header.css",
  "./css/layout/lay_input.css",
  "./css/layout/lay_menu.css",
  "./css/layout/lay_round.css",
  "./css/layout/lay_stats.css",
  "./css/responsive/desktop.css",
  "./css/responsive/tablet.css",
  "./css/responsive/phone.css",
  "./js/core/state.js",
  "./js/core/core.js",
  "./js/core/storage.js",
  "./js/data/data_loader.js",
  "./js/data/data_grouped.js",
  "./js/data/data_detail.js",
  "./js/data/rating.js",
  "./js/data/data.js",
  "./js/game/cu_ui.js",
  "./js/game/game_core.js",
  "./js/game/game_countup.js",
  "./js/game/stats.js",
  "./js/init/main.js",
  "./js/ui/chart.js",
  "./js/ui/news.js",
  "./js/ui/settings.js"
]

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(APP_CACHE).then(cache => cache.addAll(PRECACHE_URLS))
  )
  self.skipWaiting()
})

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== APP_CACHE && key !== RUNTIME_CACHE)
          .map(key => caches.delete(key))
      )
    })
  )
  self.clients.claim()
})

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return

  const requestUrl = new URL(event.request.url)
  if (requestUrl.origin !== self.location.origin) return

  // HTML is network-first so users receive updates quickly.
  const isDocumentRequest = event.request.mode === "navigate"
  if (isDocumentRequest) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const cloned = response.clone()
          caches.open(RUNTIME_CACHE).then(cache => cache.put(event.request, cloned))
          return response
        })
        .catch(() => caches.match(event.request))
    )
    return
  }

  // Static assets use stale-while-revalidate so updates are picked up
  // without waiting for users to clear cache manually.
  event.respondWith(
    caches.match(event.request).then(cached => {
      const networkFetch = fetch(event.request)
        .then(response => {
          const cloned = response.clone()
          caches.open(RUNTIME_CACHE).then(cache => cache.put(event.request, cloned))
          return response
        })
        .catch(() => null)

      if (cached) {
        event.waitUntil(networkFetch)
        return cached
      }

      return networkFetch.then(response => response || caches.match(event.request))
    })
  )
})