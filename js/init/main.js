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
  renderSideMenu()

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
    // 01 で進行中のゲームがないときは、始める前に設定（点数・上がり方・ラウンド）を選ぶ
    const hasSavedGame = !!localStorage.getItem(SAVE_KEY)
    initGame(true)
    setupZeroOneScreen()
    if (GAME_TYPE === "01") {
      renderZeroOneRecord()
      if (!hasSavedGame) openZeroOneSetup()
    }
  }
  
  registerEvents()
  
  window.addEventListener("resize", refreshLayout)
  window.addEventListener("orientationchange", refreshLayout)

  // 設定画面から戻ったとき（ページがキャッシュから表示されたとき）も表示エリアの設定を反映する
  window.addEventListener("pageshow", () => {
    refreshLayout()
    refitViewportHeightSoon()
  })
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      refreshLayout()
      refitViewportHeightSoon()
    }
  })
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", fitViewportHeight)
  }
  
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

  // カウントアップ画面：3 本指でスワイプして戻る（cu_ui.js。画面のどこからでも）
  if (document.getElementById("roundContainer")) {
    setupThreeFingerUndo(document)
  }
  
  if (nextBtn) {
    nextBtn.addEventListener("click", nextGame)
  }
  
  // ===== side menu（右端タップ・スワイプで開閉） =====
  
  if (edge && menu && overlay) {
    setupSideMenu(menu, edge, overlay)
  }

  // ===== 画面の端からのスワイプで戻る・進むを止める =====

  setupEdgeSwipeGuard()
  
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
      // サイドメニューの今いる画面のボタンは、開き直さずにメニューを閉じるだけ
      if (btn.classList.contains("current")) {
        setSideMenuOpen(false)
        return
      }
      location.href = btn.dataset.link
    })
  })
  
}


// ===============================
// ===== サイドメニュー ===========
// ===============================
// 右から横にすべって出てくるメニュー（lay_menu.css）。
//   開く：右端の細い帯をタップ / 画面の右端付近（SIDE_MENU_SWIPE_ZONE）から左へスワイプ
//   閉じる：外側をタップ / メニューを右へスワイプ / メニューのボタンを押す
// スワイプ中は指に合わせて動き、離したときに半分以上（または素早く）動かしていれば開閉する
const SIDE_MENU_SWIPE_SPEED = 0.4  // px / ms。これより速く払ったら距離が短くても開閉する
// 画面の右端からこの幅の中で触れたら、メニューを開くスワイプとして扱う。
// Android はジェスチャーナビゲーションの「戻る」が画面の端を使うので、端から少し内側で始めても開けるよう広くする
const SIDE_MENU_SWIPE_ZONE = 48
const SIDE_MENU_SWIPE_ZONE_ANDROID = 96

// 画面の左右の端から触れたときは、ブラウザの「端からスワイプして戻る・進む」を止める（setupEdgeSwipeGuard()）。
// 画面の余白（base.css の --gutter。スマホは 12px）より狭くして、端のボタンのタップを止めないようにする
const EDGE_SWIPE_GUARD = 10

function getSideMenuSwipeZone() {
  return /Android/i.test(navigator.userAgent) ? SIDE_MENU_SWIPE_ZONE_ANDROID : SIDE_MENU_SWIPE_ZONE
}

// 右端付近からのタッチか（データ画面の History / Stats の切り替えスワイプと重ならないようにするため）
function isSideMenuSwipeStart(clientX) {
  return !!document.getElementById("sideMenu") &&
    clientX >= window.innerWidth - getSideMenuSwipeZone()
}

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

  // マウス（PC）はクリックで開閉する。タッチは下のスワイプの処理で扱う
  edge.addEventListener("click", () => setSideMenuOpen(true))
  overlay.addEventListener("click", () => setSideMenuOpen(false))

  let drag = null

  document.addEventListener("touchstart", event => {
    if (event.touches.length !== 1) {
      drag = null
      return
    }

    const touch = event.touches[0]
    const isOpen = menu.classList.contains("open")
    const target = event.target instanceof Element ? event.target : null

    let fromOpen
    if (isOpen) {
      // 開いているときは、メニューか外側の幕から始めたときだけ
      if (!target || !(menu.contains(target) || overlay.contains(target))) return
      fromOpen = true
    } else {
      if (!isSideMenuSwipeStart(touch.clientX)) return
      fromOpen = false
    }

    drag = {
      fromOpen,
      // 端のタップは、ブラウザのクリックが出ない（setupEdgeSwipeGuard() で止めている）ので自分で開閉する
      tapOpens: !fromOpen && (touch.clientX >= window.innerWidth - EDGE_SWIPE_GUARD || target === edge),
      tapCloses: fromOpen && !!target && overlay.contains(target),
      startX: touch.clientX,
      startY: touch.clientY,
      lastX: touch.clientX,
      startTime: Date.now(),
      width: menu.offsetWidth,
      moving: false
    }
  }, { passive: true, capture: true })

  document.addEventListener("touchmove", event => {
    if (!drag || event.touches.length !== 1) return

    const touch = event.touches[0]
    const dx = touch.clientX - drag.startX
    const dy = touch.clientY - drag.startY

    // 縦の動きが大きいときは、画面やメニューの中のスクロールとして扱う
    if (!drag.moving) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
      if (Math.abs(dy) > Math.abs(dx) || (!drag.fromOpen && dx > 0)) {
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
  }, { passive: false, capture: true })

  const end = event => {
    if (!drag || event.touches.length > 0) return

    const current = drag
    drag = null

    if (!current.moving) {
      if (event.type !== "touchend") return
      if (current.tapOpens) setSideMenuOpen(true)
      if (current.tapCloses) setSideMenuOpen(false)
      return
    }

    const dx = current.lastX - current.startX
    const speed = dx / Math.max(1, Date.now() - current.startTime)
    const shown = current.fromOpen ? current.width - dx : -dx

    let open = shown > current.width / 2
    if (speed <= -SIDE_MENU_SWIPE_SPEED) open = true
    if (speed >= SIDE_MENU_SWIPE_SPEED) open = false

    setSideMenuOpen(open)
  }

  document.addEventListener("touchend", end, { capture: true })
  document.addEventListener("touchcancel", end, { capture: true })
}

// 画面の左右の端から触れたときは、ブラウザの「端からスワイプして戻る・進む」が動かないよう、
// そのタッチの既定の動きを止める（iPhone / iPad の Safari 向け）。
// Chrome などの横スクロールでの戻る・進むは base.css の overscroll-behavior-x で止めている
function setupEdgeSwipeGuard() {

  document.addEventListener("touchstart", event => {
    if (event.touches.length !== 1) return

    const x = event.touches[0].clientX
    if (x <= EDGE_SWIPE_GUARD || x >= window.innerWidth - EDGE_SWIPE_GUARD) {
      event.preventDefault()
    }
  }, { passive: false, capture: true })
}
