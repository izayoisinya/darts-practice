// ===============================
// ===== 初期化 ==================
// ===============================
document.addEventListener("DOMContentLoaded", initApp)

function enforceFreshClient() {
  const params = new URLSearchParams(location.search)

  if (params.has("keepCache")) return

  // Remove stale PWA cache/service worker so device testing reflects latest files.
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .getRegistrations()
      .then(registrations => Promise.all(registrations.map(reg => reg.unregister())))
      .catch(() => {})
  }

  if ("caches" in window) {
    caches
      .keys()
      .then(keys => Promise.all(keys.map(key => caches.delete(key))))
      .catch(() => {})
  }
}

function initApp() {
  enforceFreshClient()

  detectDevice()
  applyOrientationPreference()
  refreshLayout()
  initMenuSummary()
  
  // ダーツ入力ボタンのイベント登録
  if (document.getElementById("numberTable")) {
  setupTopButtons()
  }
  
  if (document.getElementById("roundContainer")) {
    initGame(true)
  }
  
  registerEvents()
  
  window.addEventListener("resize", refreshLayout)
  window.addEventListener("orientationchange", refreshLayout)
  
}

function getSavedSettings() {
  try {
    const raw = localStorage.getItem("dartsSettings")
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function applyOrientationPreference(mode) {
  const settings = getSavedSettings()
  const targetMode = mode ?? settings.orientationMode ?? "auto"
  const orientation = screen?.orientation

  if (!orientation) return Promise.resolve(false)

  if (targetMode === "auto") {
    if (typeof orientation.unlock === "function") {
      try {
        orientation.unlock()
        return Promise.resolve(true)
      } catch {
        return Promise.resolve(false)
      }
    }
    return Promise.resolve(false)
  }

  if (typeof orientation.lock !== "function") {
    return Promise.resolve(false)
  }

  const lockType = targetMode === "landscape" ? "landscape" : "portrait"

  return orientation
    .lock(lockType)
    .then(() => true)
    .catch(() => false)
}

window.applyOrientationPreference = applyOrientationPreference

function initMenuSummary() {
  const avgScoreEl = document.getElementById("menuAvgScore")
  const roundAvgEl = document.getElementById("menuRoundAvg")
  const gamesEl = document.getElementById("menuGamesPlayed")

  if (!avgScoreEl || !roundAvgEl || !gamesEl) return

  let sessions = []

  try {
    const raw = localStorage.getItem("dartsSessions")
    sessions = raw ? JSON.parse(raw) : []
  } catch {
    sessions = []
  }

  if (!Array.isArray(sessions) || sessions.length === 0) {
    avgScoreEl.textContent = "-"
    roundAvgEl.textContent = "-"
    gamesEl.textContent = "0"
    return
  }

  const countupSessions = sessions.filter(s => {
    return !s || typeof s !== "object"
      ? false
      : (s.gameType ?? "countup") === "countup"
  })

  const games = countupSessions.length

  if (games === 0) {
    avgScoreEl.textContent = "-"
    roundAvgEl.textContent = "-"
    gamesEl.textContent = "0"
    return
  }

  const totalScore = countupSessions.reduce((sum, s) => {
    const score = Number(s?.score)
    return sum + (Number.isFinite(score) ? score : 0)
  }, 0)

  const roundAvgList = countupSessions
    .map(s => Number(s?.roundAvg))
    .filter(Number.isFinite)

  const avgScore = totalScore / games
  const roundAvg = roundAvgList.length
    ? roundAvgList.reduce((sum, value) => sum + value, 0) / roundAvgList.length
    : 0

  avgScoreEl.textContent = avgScore.toFixed(1)
  roundAvgEl.textContent = roundAvg.toFixed(1)
  gamesEl.textContent = String(games)
}


// ===============================
// ===== イベント登録 ============
// ===============================
function registerEvents() {
  
  const body = document.body
  const overlay = document.getElementById("menuOverlay")
  const edge = document.getElementById("menuEdge")
  const menu = document.getElementById("sideMenu")
  const statsArea = document.querySelector(".stats-area")
  const roundArea = document.querySelector(".round-area")
  
  const nextBtn = document.getElementById("nextGameBtn")
  
  if (nextBtn) {
    nextBtn.addEventListener("click", nextGame)
  }
  
  // ===== menu open =====
  
  if (edge && menu) {
    edge.addEventListener("click", () => {
      menu.classList.add("open")
      body.classList.add("menu-open")
    })
  }
  
  // ===== round open (phone portrait) =====
  
  if (roundArea) {
    roundArea.addEventListener("click", () => {
      if (
        body.classList.contains("phone") &&
        body.classList.contains("portrait")
      ) {
        body.classList.toggle("round-open")
      }
    })
  }
  
  // ===== stats open (phone landscape) =====
  
  if (statsArea) {
    statsArea.addEventListener("click", () => {
    
      if (
        body.classList.contains("phone") &&
        body.classList.contains("landscape")
      ) {
      
        body.classList.toggle("iphone-stats-open")
      
        setTimeout(() => {
          if (typeof drawScoreChart === "function") {
            drawScoreChart()
          }
        }, 50)
      }
    })
  }
  
  // ===== side menu =====
  
  if (menu) {
    menu.querySelectorAll("button:not([data-link])").forEach(btn => {
      btn.addEventListener("click", () => {
        menu.classList.remove("open")
        body.classList.remove("menu-open")
      })
    })
  }
  
  if (overlay && menu) {
    overlay.addEventListener("click", () => {
      menu.classList.remove("open")
      body.classList.remove("menu-open")
    })
  }
  
  document.querySelectorAll("[data-link]").forEach(btn => {
    btn.addEventListener("click", () => {
      location.href = btn.dataset.link
    })
  })
  
}

