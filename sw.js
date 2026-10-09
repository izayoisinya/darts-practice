const APP_CACHE = "darts-app-v83"
const RUNTIME_CACHE = "darts-runtime-v83"

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
  "./apple-touch-icon.png",
  "./css/base.css",
  "./css/theme.css",
  "./css/menu.css",
  "./css/news.css",
  "./css/layout/lay_core.css",
  "./css/layout/lay_data.css",
  "./css/layout/lay_header.css",
  "./css/layout/lay_input.css",
  "./css/layout/lay_menu.css",
  "./css/layout/lay_cricket.css",
  "./css/layout/lay_round.css",
  "./css/layout/lay_stats.css",
  "./css/responsive/desktop.css",
  "./css/responsive/tablet.css",
  "./css/responsive/phone.css",
  "./js/core/state.js",
  "./js/core/core.js",
  "./js/core/storage.js",
  "./js/core/backup.js",
  "./js/data/data_loader.js",
  "./js/data/data_grouped.js",
  "./js/data/data_detail.js",
  "./js/data/rating.js",
  "./js/data/data.js",
  "./js/data/heatmap.js",
  "./js/data/data_01.js",
  "./js/data/data_cricket.js",
  "./js/data/data_hub.js",
  "./js/game/board_input.js",
  "./js/game/cu_ui.js",
  "./js/game/game_core.js",
  "./js/game/game_01.js",
  "./js/game/game_cricket.js",
  "./js/game/game_countup.js",
  "./js/game/stats.js",
  "./js/init/main.js",
  "./js/ui/chart.js",
  "./js/ui/news.js",
  "./js/ui/settings.js"
]

self.addEventListener("install", event => {
  event.waitUntil(
    // ブラウザが手元に残している古いファイル（GitHub Pages は 10 分ほど残る）ではなく、必ずサーバーから取り直して入れる
    caches.open(APP_CACHE).then(cache =>
      cache.addAll(PRECACHE_URLS.map(url => new Request(url, { cache: "reload" })))
    )
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
  // ブラウザが手元に残している HTML をそのまま使わず、毎回サーバーに新しいか確かめる（cache: "no-cache"）。
  // これがないと、更新直後に画面ごとに新しい HTML と古い HTML が混ざることがある
  const isDocumentRequest = event.request.mode === "navigate"
  if (isDocumentRequest) {
    event.respondWith(
      fetch(event.request.url, { cache: "no-cache", credentials: "same-origin" })
        .then(response => {
          const cloned = response.clone()
          caches.open(RUNTIME_CACHE).then(cache => cache.put(event.request, cloned))
          return response
        })
        // オフラインのときは保存しておいた HTML を出す（countup.html?game=01 も countup.html で開けるよう、? 以降は見ない）
        .catch(() => caches.match(event.request, { ignoreSearch: true }))
    )
    return
  }

  // Static assets are cache-first for faster startup and offline use.
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached

      return fetch(event.request).then(response => {
        const cloned = response.clone()
        caches.open(RUNTIME_CACHE).then(cache => cache.put(event.request, cloned))
        return response
      })
    })
  )
})