// ===============================
// ===== 初期化 ==================
// ===============================
document.addEventListener("DOMContentLoaded", initApp)

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("./sw.js")
      .catch(() => {})
  }
}

async function initApp() {
  registerServiceWorker()

  if (typeof initSessionsStorage === "function") {
    await initSessionsStorage()
  }

  detectDevice()
  applyGamePanelVisibility()
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

  // 設定画面から戻ったとき（ページがキャッシュから表示されたとき）も表示エリアの設定を反映する
  window.addEventListener("pageshow", refreshLayout)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refreshLayout()
  })
  
}

function getSavedSettings() {
  try {
    const raw = localStorage.getItem("dartsSettings")
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

// カウントアップ画面の Rounds / Stats の表示・非表示（設定画面の Game Panels）
// body に hide-round-area / hide-stats-area を付け、CSS でレイアウトを切り替える
function applyGamePanelVisibility() {
  const roundArea = document.querySelector(".round-area")
  const statsArea = document.querySelector(".stats-area")
  if (!roundArea || !statsArea) return

  const panels = getSavedSettings().gamePanels || {}
  const showRound = panels.round !== false
  const showStats = panels.stats !== false

  document.body.classList.toggle("hide-round-area", !showRound)
  document.body.classList.toggle("hide-stats-area", !showStats)

  // 隠したエリアを開いた状態のまま残さない
  if (!showRound) document.body.classList.remove("round-open")
  if (!showStats) document.body.classList.remove("iphone-stats-open")

  // ボード入力のときの戻るボタン（設定画面の Board Undo Button。初期値は隠す）
  document.body.classList.toggle("hide-undo-button", getSavedSettings().boardUndoButton !== true)
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

  const sessions = readSessions()

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

  // カウントアップ画面：3 本指で左にスワイプして戻る（cu_ui.js）
  const gameContainer = document.querySelector(".container")
  if (gameContainer && document.getElementById("roundContainer")) {
    setupThreeFingerUndo(gameContainer)
  }
  
  if (nextBtn) {
    nextBtn.addEventListener("click", nextGame)
  }
  
  // ===== side menu（右端タップ・スワイプで開閉） =====
  
  if (edge && menu && overlay) {
    setupSideMenu(menu, edge, overlay)
  }
  
  // ===== round open (phone portrait) =====
  
  if (roundArea) {
    roundArea.addEventListener("click", () => {
      if (
        body.classList.contains("phone") &&
        body.classList.contains("portrait")
      ) {
        toggleAreaLayout("round-open")
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
      
        // 開き終わってからグラフを描き直す（途中の大きさで描かないため）
        toggleAreaLayout("iphone-stats-open", () => {
          if (typeof drawScoreChart === "function") {
            drawScoreChart()
          }
        })
      }
    })
  }
  
  // ===== side menu（ボタンを押したら閉じる） =====
  
  if (menu) {
    menu.querySelectorAll("button:not([data-link])").forEach(btn => {
      btn.addEventListener("click", () => setSideMenuOpen(false))
    })
  }
  
  document.querySelectorAll("[data-link]").forEach(btn => {
    btn.addEventListener("click", () => {
      location.href = btn.dataset.link
    })
  })
  
}


// ===============================
// ===== サイドメニュー ===========
// ===============================
// 右から横にすべって出てくるメニュー（lay_menu.css）。
//   開く：右端の細い帯をタップ / 右端から左へスワイプ
//   閉じる：外側をタップ / メニューを右へスワイプ / メニューのボタンを押す
// スワイプ中は指に合わせて動き、離したときに半分以上（または素早く）動かしていれば開閉する
const SIDE_MENU_SWIPE_SPEED = 0.4  // px / ms。これより速く払ったら距離が短くても開閉する

function setSideMenuOpen(open) {

  const menu = document.getElementById("sideMenu")
  const overlay = document.getElementById("menuOverlay")
  if (!menu) return

  menu.classList.remove("dragging")
  menu.style.transform = ""
  if (overlay) {
    overlay.classList.remove("dragging")
    overlay.style.opacity = ""
  }

  menu.classList.toggle("open", open)
  document.body.classList.toggle("menu-open", open)
}

function setupSideMenu(menu, edge, overlay) {

  edge.addEventListener("click", () => setSideMenuOpen(true))
  overlay.addEventListener("click", () => setSideMenuOpen(false))

  let drag = null

  // fromOpen：開いた状態から閉じる向きに動かしているか
  const start = (event, fromOpen) => {
    if (event.touches.length !== 1) return
    const touch = event.touches[0]
    drag = {
      fromOpen,
      startX: touch.clientX,
      startY: touch.clientY,
      lastX: touch.clientX,
      startTime: Date.now(),
      width: menu.offsetWidth,
      moving: false
    }
  }

  const move = event => {
    if (!drag || event.touches.length !== 1) return

    const touch = event.touches[0]
    const dx = touch.clientX - drag.startX
    const dy = touch.clientY - drag.startY

    // 縦の動きが大きいときは、メニューの中のスクロールとして扱う
    if (!drag.moving) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
      if (Math.abs(dy) > Math.abs(dx)) {
        drag = null
        return
      }
      drag.moving = true
      menu.classList.add("dragging")
      overlay.classList.add("dragging")
      document.body.classList.add("menu-open")
    }

    event.preventDefault()
    drag.lastX = touch.clientX

    // メニューが画面に出ている幅（0〜メニューの幅）
    const shown = drag.fromOpen
      ? Math.max(0, Math.min(drag.width, drag.width - dx))
      : Math.max(0, Math.min(drag.width, -dx))

    menu.style.transform = `translateX(${drag.width - shown}px)`
    overlay.style.opacity = String(shown / drag.width)
  }

  const end = () => {
    if (!drag) return

    const current = drag
    drag = null
    if (!current.moving) return

    const dx = current.lastX - current.startX
    const speed = dx / Math.max(1, Date.now() - current.startTime)
    const shown = current.fromOpen ? current.width - dx : -dx

    let open = shown > current.width / 2
    if (speed <= -SIDE_MENU_SWIPE_SPEED) open = true
    if (speed >= SIDE_MENU_SWIPE_SPEED) open = false

    setSideMenuOpen(open)
  }

  edge.addEventListener("touchstart", event => start(event, false), { passive: true })
  menu.addEventListener("touchstart", event => start(event, true), { passive: true })
  overlay.addEventListener("touchstart", event => start(event, true), { passive: true })

  const targets = [edge, menu, overlay]
  targets.forEach(target => {
    target.addEventListener("touchmove", move, { passive: false })
    target.addEventListener("touchend", end)
    target.addEventListener("touchcancel", end)
  })
}
