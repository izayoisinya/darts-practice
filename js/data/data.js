let viewMode = "game"
let rangeChartWired = false
let dataPanelMode = "history"
let dataPanelSwipeBound = false
let panelTouchStartX = 0
let panelTouchStartY = 0
let panelSwipeBlockedByTabs = false
const chartAxisFontFamily = "'Segoe UI', 'Noto Sans JP', sans-serif"
let initialChartRefreshQueued = false

// データ画面（data.html）以外で読み込まれても初期化しない
function isDataPage() {
  return body.classList.contains("page-data")
}

// グラフが隠れていて描けないときの再試行（最大 10 回 ≒ 1 秒で打ち切る）
// 隠れているグラフは、表示されたとき（パネル切り替えなど）に描き直す
const CHART_RETRY_LIMIT = 10
const chartRetryCounts = {}

function scheduleChartRetry(key, draw) {
  const count = chartRetryCounts[key] || 0
  if (count >= CHART_RETRY_LIMIT) return
  chartRetryCounts[key] = count + 1
  setTimeout(draw, 100)
}

function resetChartRetry(key) {
  chartRetryCounts[key] = 0
}

// 縦軸の範囲を決める。点が 1 つだけ・同じスコアばかりのときも
// 目盛りが重ならないよう、最低 40 点の幅を取って点を真ん中に置く
const MIN_SCORE_AXIS_RANGE = 40

function getScoreAxis(scores) {
  let min = Math.min(...scores)
  let max = Math.max(...scores)

  if (max - min < MIN_SCORE_AXIS_RANGE) {
    const mid = (min + max) / 2
    min = Math.max(0, Math.round(mid - MIN_SCORE_AXIS_RANGE / 2))
    max = min + MIN_SCORE_AXIS_RANGE
  }

  return { minScore: min, scoreRange: max - min }
}

// 点が 1 つだけのときは横方向の真ん中に置く
function getChartStartX(padding, graphWidth, length) {
  return length === 1 ? padding + graphWidth / 2 : padding
}

function setScoreChartTitle(text) {
  const title = document.getElementById("scoreChartTitle")
  if (title) title.textContent = text
}

// 今表示しているグラフを描き直す（パネル切り替え・画面の回転時）
let lastDetailChartArgs = null

function redrawVisibleCharts() {
  if (detailViewMode) {
    if (lastDetailChartArgs) drawDetailGroupChart(...lastDetailChartArgs)
  } else {
    refreshGameChartsNow()
  }
}

let chartResizeTimer = null

function queueChartRedrawForResize() {
  if (!isDataPage()) return
  clearTimeout(chartResizeTimer)
  chartResizeTimer = setTimeout(redrawVisibleCharts, 150)
}

window.addEventListener("resize", queueChartRedrawForResize)
window.addEventListener("orientationchange", queueChartRedrawForResize)

// 縦向き（スマホ・タブレット）は History / Stats を切り替えて 1 パネルずつ表示する
function isPhonePortraitDataView() {
  return body.classList.contains("portrait") &&
    (body.classList.contains("phone") || body.classList.contains("tablet"))
}

function setupHiDPICanvas(canvas, fallbackHeight = 220) {
  if (!canvas) return null

  // inline style を先にリセットして CSS (width:100%) が有効な状態で計測する
  canvas.style.width = ''
  canvas.style.height = ''

  const cssWidth = canvas.offsetWidth || 0
  const cssHeight = canvas.offsetHeight || fallbackHeight
  if (!cssWidth || !cssHeight) return null

  const dpr = Math.min(window.devicePixelRatio || 1, 3)
  const backingWidth = Math.max(1, Math.round(cssWidth * dpr))
  const backingHeight = Math.max(1, Math.round(cssHeight * dpr))
  canvas.width = backingWidth
  canvas.height = backingHeight
  // style は設定しない → CSS の width:100% がそのまま表示サイズを管理する

  const ctx = canvas.getContext("2d")
  if (!ctx) return null
  const scaleX = backingWidth / cssWidth
  const scaleY = backingHeight / cssHeight
  ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"

  return { ctx, width: cssWidth, height: cssHeight, dpr }
}

function setChartAxisTextStyle(ctx) {
  ctx.fillStyle = "rgba(255,255,255,0.62)"
  ctx.font = `600 9px ${chartAxisFontFamily}`
  ctx.textAlign = "right"
  ctx.textBaseline = "middle"
}

function getChartPadding() {
  const isPhone = body.classList.contains("phone")
  return {
    left: isPhone ? 27 : 34,
    right: isPhone ? 8 : 8,
    vertical: 34
  }
}

function setDataPanel(mode) {
  if (mode !== "history" && mode !== "stats") return
  dataPanelMode = mode
  const main = document.querySelector("main.data-container")
  if (main) main.classList.toggle("panel-stats", mode === "stats")
  document.querySelectorAll(".panel-switcher button").forEach(btn => {
    const isActive = btn.dataset.panel === mode
    btn.classList.toggle("active", isActive)
    btn.setAttribute("aria-pressed", isActive ? "true" : "false")
  })

  // Stats パネルを開いたら、隠れていて描けなかったグラフを描き直す
  if (mode === "stats") {
    requestAnimationFrame(redrawVisibleCharts)
  }
}

function setupDataPanelSwipe() {
  if (dataPanelSwipeBound) return

  const container = document.querySelector("main.data-container")
  if (!container) return

  container.addEventListener("touchstart", e => {
    if (!isPhonePortraitDataView()) return
    const target = e.target instanceof Element ? e.target : null
    if (target && target.closest(".tabs-container")) {
      panelSwipeBlockedByTabs = true
      return
    }
    panelSwipeBlockedByTabs = false
    if (!e.touches || !e.touches[0]) return
    // 画面の右端付近からのスワイプはサイドメニューを開く操作なので、パネルは切り替えない（main.js）
    if (typeof isSideMenuSwipeStart === "function" && isSideMenuSwipeStart(e.touches[0].clientX)) {
      panelSwipeBlockedByTabs = true
      return
    }
    panelTouchStartX = e.touches[0].clientX
    panelTouchStartY = e.touches[0].clientY
  }, { passive: true })

  container.addEventListener("touchend", e => {
    if (!isPhonePortraitDataView()) return
    if (viewMode === "analysis") return
    if (panelSwipeBlockedByTabs) {
      panelSwipeBlockedByTabs = false
      return
    }
    if (!e.changedTouches || !e.changedTouches[0]) return

    const dx = e.changedTouches[0].clientX - panelTouchStartX
    const dy = e.changedTouches[0].clientY - panelTouchStartY
    const absDx = Math.abs(dx)
    const absDy = Math.abs(dy)

    if (absDx < 55 || absDx <= absDy * 1.2) return

    if (dx < 0 && dataPanelMode !== "stats") {
      setDataPanel("stats")
      return
    }

    if (dx > 0 && dataPanelMode !== "history") {
      setDataPanel("history")
    }
  }, { passive: true })

  container.addEventListener("touchcancel", () => {
    panelSwipeBlockedByTabs = false
  }, { passive: true })

  dataPanelSwipeBound = true
}

function refreshGameChartsNow() {
  if (detailViewMode) return
  if (viewMode === "game") drawGameScoresChart()
  if (viewMode === "analysis") drawAnalysisCharts()
}

function queueInitialGameChartRefresh() {
  if (initialChartRefreshQueued) return
  initialChartRefreshQueued = true

  // 端末ごとのレイアウト確定タイミング差を吸収するため複数回再描画
  requestAnimationFrame(() => {
    refreshGameChartsNow()
  })

  setTimeout(() => {
    refreshGameChartsNow()
  }, 180)

  setTimeout(() => {
    refreshGameChartsNow()
    initialChartRefreshQueued = false
  }, 520)
}

// ===============================
// ===== タブの表示・非表示 =======
// ===============================
// 設定画面の Data Tabs（dartsSettings.dataTabs）で選んだタブだけを出す。Game は常に表示
// Day / Week / Month / Year は一旦お休み（2026.10.8。日付はトップのカレンダーで見る）。コード（data_grouped.js / data_detail.js）は残してあり、ここに足せば戻せる
const DATA_VIEW_TABS = ["analysis"]

function readDataTabSettings() {
  try {
    const parsed = JSON.parse(localStorage.getItem("dartsSettings") || "{}")
    return parsed && parsed.dataTabs && typeof parsed.dataTabs === "object"
      ? parsed.dataTabs
      : {}
  } catch {
    return {}
  }
}

function getVisibleViews() {
  const tabs = readDataTabSettings()
  return ["game"].concat(DATA_VIEW_TABS.filter(view => tabs[view] !== false))
}

// 隠したタブが選ばれていたら Game に戻す
function ensureViewIsVisible(mode) {
  return getVisibleViews().includes(mode) ? mode : "game"
}

function applyDataViewTabVisibility() {
  const visible = getVisibleViews()
  document.querySelectorAll(".tabs-container button[data-view]").forEach(btn => {
    btn.style.display = visible.includes(btn.dataset.view) ? "" : "none"
  })
}

function updateViewTabs(mode) {
  applyDataViewTabVisibility()
  document.querySelectorAll(".tabs-container button").forEach(btn => {
    const isActive = btn.dataset.view === mode
    btn.classList.toggle("active", isActive)
    btn.setAttribute("aria-pressed", isActive ? "true" : "false")
  })
}

// ビューごとに、Stats パネルに出す部品を切り替える
//   game     : Stats・Awards・スコア推移・レーティング目安
//   analysis : タグ別の散布図・期間 A/B の比較グラフ（History パネルは使わず 1 列で表示）
//   それ以外 : Day / Week / Month / Year のまとめ（data_grouped.js）
function showViewSections(mode) {
  const show = (id, display) => {
    const el = document.getElementById(id)
    if (el) el.style.display = display
  }

  const isGame = mode === "game"
  const isAnalysis = mode === "analysis"

  show("statsSection", isGame ? "flex" : "none")
  show("awardsSection", isGame ? "flex" : "none")
  show("chartContainer", isGame || isAnalysis ? "block" : "none")
  show("gameChartSection", isGame ? "flex" : "none")
  show("analysisContainer", isAnalysis ? "flex" : "none")
  setRangeChartSectionVisible(isAnalysis)

  const main = document.querySelector("main.data-container")
  if (main) main.classList.toggle("analysis-mode", isAnalysis)

  const calendarContainer = document.getElementById("calendarContainer")
  if (calendarContainer) {
    calendarContainer.style.display = "none"
    calendarContainer.innerHTML = ""
  }
}

function changeView(mode) {
  mode = ensureViewIsVisible(mode)
  setupDataPanelSwipe()
  viewMode = mode
  detailViewMode = false
  selectedDayData = null
  detailPageNumber = 1
  hideDetailBullRate()
  if (typeof setDataDetailViewClass === "function") {
    setDataDetailViewClass(false)
  }
  updateViewTabs(mode)

  // 縦向き（1 パネル表示）: group表示時はHistoryパネルへ自動切り替え
  if (mode !== "game" && mode !== "analysis" && isPhonePortraitDataView()) {
    setDataPanel("history")
  }

  showViewSections(mode)

  if (mode === 'game') {
    currentPage = 1
    groupedPageMode = 'game'
    
    const sessions = readDataSessions()
    
    const totalPages = Math.ceil(sessions.length / PAGE_SIZE)
    
    loadStats()
    loadSessions()
    updatePaginationUI(totalPages)
    drawGameScoresChart()
  } else if (mode === "analysis") {
    groupedPageMode = "analysis"
    updatePaginationUI(1)
    drawAnalysisCharts()
  } else {
    // Group ビュー（Day/Week/Month/Year）
    displayGroupView(mode)
    window.scrollTo(0, 0)
  }
}

function renderView() {
  viewMode = ensureViewIsVisible(viewMode)
  setupDataPanelSwipe()
  hideDetailBullRate()
  if (typeof setDataDetailViewClass === "function") {
    setDataDetailViewClass(false)
  }
  updateViewTabs(viewMode)
  showViewSections(viewMode)
  
  if (viewMode === "game") {
    loadStats(viewMode)
    loadSessions()
    drawGameScoresChart()
    queueInitialGameChartRefresh()
  } else if (viewMode === "analysis") {
    groupedPageMode = "analysis"
    updatePaginationUI(1)
    drawAnalysisCharts()
  } else {
    renderGroupedPaginated(viewMode)
  }
  
}

function loadStats() {
  
  const sessions = readDataSessions()
  
  const statsContainer = document.getElementById("statsContainer")
  const awardsContainer = document.getElementById("awardsContainer")
  const ratingSection = document.getElementById("ratingReferenceSection")
  statsContainer.innerHTML = ""
  awardsContainer.innerHTML = ""
  if (ratingSection) ratingSection.innerHTML = ""
  
  if (!sessions.length) {
    statsContainer.innerHTML = "<p>No data yet</p>"
    renderRatingReference(null)
    return
  }
  
  const games = sessions.length
  
  const bestGame = Math.max(...sessions.map(s => s.score))

  const totalBulls = sessions.reduce((sum, s) => sum + (s.bulls || 0), 0)
  const awardCounts = sessions.reduce((acc, s) => {
    const awards = getSessionAwards(s)
    acc.hatTrick += awards.hatTrick || 0
    acc.threeInTheBlack += awards.threeInTheBlack || 0
    acc.ton80 += awards.ton80 || 0
    acc.highTon += awards.highTon || 0
    acc.lowTon += awards.lowTon || 0
    acc.threeInTheBed += awards.threeInTheBed || 0
    acc.whiteHorse += awards.whiteHorse || 0
    return acc
  }, {
    hatTrick: 0,
    threeInTheBlack: 0,
    ton80: 0,
    highTon: 0,
    lowTon: 0,
    threeInTheBed: 0,
    whiteHorse: 0
  })
  
  const avgPPD = (
    sessions.reduce((a, b) => a + b.ppd, 0) / games
  ).toFixed(2)

  const ratings = calculateRatings(sessions)
  
  addStat(statsContainer, "Games Played", games)
  addStat(statsContainer, "Best Game", bestGame)
  addStat(statsContainer, "Average PPD", avgPPD)
  addStat(statsContainer, "Total Bulls", totalBulls)

  addStat(awardsContainer, "Hat Trick", awardCounts.hatTrick)
  addStat(awardsContainer, "3 in Black", awardCounts.threeInTheBlack)
  addStat(awardsContainer, "Ton 80", awardCounts.ton80)
  addStat(awardsContainer, "High Ton", awardCounts.highTon)
  addStat(awardsContainer, "Low Ton", awardCounts.lowTon)
  addStat(awardsContainer, "3 in Bed", awardCounts.threeInTheBed)
  addStat(awardsContainer, "White Horse", awardCounts.whiteHorse)

  renderRatingReference(ratings)
}

function buildReferenceRows(items, labelPrefix) {
  return items.map(item => `
    <div class="rating-reference-row">
      <span class="rating-reference-rank">${labelPrefix} ${item.rating}</span>
      <span class="rating-reference-threshold">PPD ${item.ppd.toFixed(2)}+</span>
    </div>
  `).join("")
}

function renderRatingReference(ratings) {
  const section = document.getElementById("ratingReferenceSection")
  if (!section) return

  const dlTable = typeof getDartsLiveRatingReference === "function"
    ? getDartsLiveRatingReference()
    : []
  const phxTable = typeof getPhoenixRatingReference === "function"
    ? getPhoenixRatingReference()
    : []

  const current = ratings
    ? `
      <div class="rating-current-grid">
        <div class="rating-current-card">
          <div class="rating-current-title">DARTSLIVE</div>
          <div class="rating-current-value">RT ${ratings.rt}</div>
        </div>
        <div class="rating-current-card">
          <div class="rating-current-title">PHOENIX</div>
          <div class="rating-current-value">RATING ${ratings.phx}</div>
        </div>
      </div>
      <div class="rating-current-note">推定PPD ${ratings.ppd.toFixed(2)}（直近20ゲーム加重平均）</div>
    `
    : `<div class="rating-current-note">データがないため算出できません</div>`

  section.innerHTML = `
    <h3>レーティング参考値</h3>
    ${current}
    <details class="rating-reference-details">
      <summary>実数値テーブルを表示</summary>
      <div class="rating-reference-grid">
        <div class="rating-reference-col">
          <div class="rating-reference-col-title">ダーツライブ</div>
          ${buildReferenceRows(dlTable, "RT")}
        </div>
        <div class="rating-reference-col">
          <div class="rating-reference-col-title">フェニックス</div>
          ${buildReferenceRows(phxTable, "RATING")}
        </div>
      </div>
    </details>
  `
  section.style.display = "block"
}

function addStat(container, title, value) {
  
  const row = document.createElement("div")
  
  row.className = "data-card"
  
  row.innerHTML = `
    <span class="data-title">${title}</span>
    <span class="data-value">${value}</span>
  `
  
  container.appendChild(row)
}

document.addEventListener("DOMContentLoaded", async () => {
  if (!isDataPage()) return

  if (typeof initSessionsStorage === "function") {
    await initSessionsStorage()
  }

  renderView()
  queueInitialGameChartRefresh()
})

window.addEventListener("load", () => {
  if (!isDataPage()) return
  queueInitialGameChartRefresh()
})

window.addEventListener("pageshow", () => {
  if (!isDataPage()) return
  queueInitialGameChartRefresh()
})

function isLikelyGeneratedTestSession(session) {
  if ((session?.gameType || "countup") !== "countup") return false
  const roundScores = Array.isArray(session?.roundScores)
    ? session.roundScores
    : Array.isArray(session?.rounds)
      ? session.rounds.map(round =>
        (round || []).reduce((sum, dart) => sum + (dart?.score || 0), 0)
      )
      : []

  if (roundScores.length !== 8) return false
  if (!roundScores.every(score => Number(score) === 60)) return false

  const roundTotal = roundScores.reduce((sum, score) => sum + Number(score || 0), 0)
  const score = Number(session?.score || 0)

  if (!Number.isFinite(score) || score < 600 || score > 1199) return false
  if (Math.abs(score - roundTotal) < 100) return false

  const awards = session?.awards || {}
  const allAwardsZero = [
    "hatTrick",
    "lowTon",
    "highTon",
    "ton80",
    "threeInTheBlack",
    "threeInTheBed",
    "whiteHorse"
  ].every(key => Number(awards[key] || 0) === 0)

  return allAwardsZero
}

function removeGeneratedTestData() {
  // 書き戻すので、01 も含めた全部の記録から探す（消すのはカウントアップのテストデータだけ）
  const sessions = readSessions()
  if (!Array.isArray(sessions) || sessions.length === 0) {
    alert("削除対象データがありません")
    return
  }

  const filtered = sessions.filter(session => !isLikelyGeneratedTestSession(session))
  const removed = sessions.length - filtered.length

  if (removed <= 0) {
    alert("削除対象のテストデータは見つかりませんでした")
    return
  }

  if (!confirm(`${removed}件のテストデータを削除します。よろしいですか？`)) {
    return
  }

  writeSessions(filtered)
  alert(`${removed}件のテストデータを削除しました`)
  location.reload()
}

function drawGameScoresChart() {
  const canvas = document.getElementById("scoreChart")
  if (!canvas) return
  hideDetailBullRate()

  const canvasState = setupHiDPICanvas(canvas, 220)
  if (!canvasState) {
    scheduleChartRetry("gameScores", () => drawGameScoresChart())
    return
  }
  resetChartRetry("gameScores")
  const { ctx, width, height } = canvasState

  ctx.clearRect(0, 0, width, height)
  setScoreChartTitle("Score Trend (Last 30 Games)")
  
  const sessions = readDataSessions()
  
  if (sessions.length === 0) {
    ctx.fillStyle = "rgba(255,255,255,0.3)"
    ctx.font = "12px sans-serif"
    ctx.fillText("No data", 10, 20)
    return
  }
  
  // 直近30試合を取得（古い→新しい）
  const last30 = sessions.slice(-30)
  const scores = last30.map(s => s.score)
  
  const chartPadding = getChartPadding()
  const padding = chartPadding.left
  const rightPadding = chartPadding.right
  const verticalPadding = chartPadding.vertical
  const graphWidth = width - padding - rightPadding
  const graphHeight = height - verticalPadding * 2
  
  // 縦軸の範囲
  const { minScore, scoreRange } = getScoreAxis(scores)
  
  // 横グリッド（スコアラベル）
  ctx.strokeStyle = "rgba(255,255,255,0.08)"
  ctx.lineWidth = 1
  
  const gridSteps = 4
  for (let i = 0; i <= gridSteps; i++) {
    const value = minScore + (scoreRange / gridSteps) * i
    const y = height - verticalPadding - (value - minScore) / scoreRange * graphHeight
    
    ctx.beginPath()
    ctx.moveTo(padding, y)
    ctx.lineTo(width - rightPadding, y)
    ctx.stroke()
    
    setChartAxisTextStyle(ctx)
    ctx.fillText(Math.round(value), Math.round(padding - 2), Math.round(y))
  }
  
  // 折れ線
  const stepX = graphWidth / (scores.length - 1 || 1)
  const startX = getChartStartX(padding, graphWidth, scores.length)
  
  ctx.beginPath()
    ctx.lineWidth = 1.5
  ctx.strokeStyle = "#4CAF50"
  
  scores.forEach((score, i) => {
    const x = startX + stepX * i
    const y = height - verticalPadding - ((score - minScore) / scoreRange) * graphHeight
    
    if (i === 0) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }
  })
  
  ctx.stroke()
  
  // ポイント
  scores.forEach((score, i) => {
    const x = startX + stepX * i
    const y = height - verticalPadding - ((score - minScore) / scoreRange) * graphHeight
    
    ctx.beginPath()
      ctx.arc(x, y, 2, 0, Math.PI * 2)
    ctx.fillStyle = "#4CAF50"
    ctx.fill()
  })
}

function drawDetailGroupChart(gamesList, compareGamesList = null, baseLabel = "", compareLabel = "") {
  const canvas = document.getElementById("scoreChart")
  const detailLegend = document.getElementById("detailCompareLegend")
  const safeGamesList = Array.isArray(gamesList) ? gamesList.filter(Boolean) : []
  const safeCompareGamesList = Array.isArray(compareGamesList)
    ? compareGamesList.filter(Boolean)
    : []

  lastDetailChartArgs = [gamesList, compareGamesList, baseLabel, compareLabel]

  if (!canvas || safeGamesList.length === 0) {
    hideDetailBullRate()
    if (detailLegend) {
      detailLegend.style.display = "none"
      detailLegend.innerHTML = ""
    }
    return
  }
  setRangeChartSectionVisible(false)
  renderDetailBullRate(safeGamesList)

  const canvasState = setupHiDPICanvas(canvas, 220)
  if (!canvasState) {
    scheduleChartRetry("detailGroup", () => {
      drawDetailGroupChart(gamesList, compareGamesList, baseLabel, compareLabel)
    })
    return
  }
  resetChartRetry("detailGroup")
  const { ctx, width, height } = canvasState
  
  const baseScores = safeGamesList.map(s => Number(s?.score) || 0)
  const hasCompare = safeCompareGamesList.length > 0
  const compareScoresRaw = hasCompare
    ? safeCompareGamesList.map(s => Number(s?.score) || 0)
    : []
  const length = Math.max(baseScores.length, compareScoresRaw.length, 1)

  const scores = Array.from({ length }, (_, i) =>
    i < baseScores.length ? baseScores[i] : null
  )
  const compareScores = Array.from({ length }, (_, i) =>
    i < compareScoresRaw.length ? compareScoresRaw[i] : null
  )
  
  const chartPadding = getChartPadding()
  const padding = chartPadding.left
  const rightPadding = chartPadding.right
  const verticalPadding = chartPadding.vertical
  const graphWidth = width - padding - rightPadding
  const graphHeight = height - verticalPadding * 2
  
  // 背景をクリア
  ctx.clearRect(0, 0, width, height)

  // タイトル（その日・週・月・年のゲームのグラフ）
  const groupLabel = baseLabel && typeof getDetailGroupLabel === "function"
    ? getDetailGroupLabel(groupedPageMode, baseLabel)
    : baseLabel
  setScoreChartTitle(groupLabel ? `Score Trend (${groupLabel})` : "Score Trend")
  
  // 縦軸の範囲
  const validScores = [...scores, ...compareScores].filter(v => v !== null)
  const { minScore, scoreRange } = getScoreAxis(validScores)
  
  // 横グリッド
  ctx.strokeStyle = "rgba(255,255,255,0.08)"
  ctx.lineWidth = 1
  
  const gridSteps = 4
  for (let i = 0; i <= gridSteps; i++) {
    const value = minScore + (scoreRange / gridSteps) * i
    const y = height - verticalPadding - (value - minScore) / scoreRange * graphHeight
    
    ctx.beginPath()
    ctx.moveTo(padding, y)
    ctx.lineTo(width - rightPadding, y)
    ctx.stroke()
    
    setChartAxisTextStyle(ctx)
    ctx.fillText(Math.round(value), Math.round(padding - 2), Math.round(y))
  }
  
  // 折れ線
  const stepX = graphWidth / (length - 1 || 1)
  const startX = getChartStartX(padding, graphWidth, length)
  drawLineSeries(ctx, scores, "#4CAF50", startX, verticalPadding, height, graphHeight, minScore, scoreRange, stepX)
  if (hasCompare) {
    drawLineSeries(ctx, compareScores, "#4da3ff", startX, verticalPadding, height, graphHeight, minScore, scoreRange, stepX)
  }

  if (detailLegend) {
    if (hasCompare) {
      detailLegend.innerHTML = `
        <span class="range-chart-legend-item"><span class="range-chart-legend-swatch a"></span>A: ${baseLabel || "Selected Day"}</span>
        <span class="range-chart-legend-item"><span class="range-chart-legend-swatch b"></span>B: ${compareLabel || "Compare Day"}</span>
      `
      detailLegend.style.display = "flex"
    } else {
      detailLegend.style.display = "none"
      detailLegend.innerHTML = ""
    }
  }
}

function hideDetailBullRate() {
  const wrapper = document.getElementById("detailBullRateWrapper")
  const section = document.getElementById("detailBullRateSection")
  if (wrapper) wrapper.style.display = "none"
  if (!section) return
  section.innerHTML = ""
}

function renderDetailBullRate(gamesList) {
  const wrapper = document.getElementById("detailBullRateWrapper")
  const section = document.getElementById("detailBullRateSection")
  if (!section) return

  const totalBulls = gamesList.reduce((sum, game) => sum + (game?.bulls || 0), 0)
  const totalInnerBulls = gamesList.reduce((sum, game) => sum + (game?.innerBulls || 0), 0)
  const totalDarts = gamesList.reduce((sum, game) => {
    const roundsCount = Array.isArray(game?.rounds) ? game.rounds.length : 0
    if (roundsCount > 0) return sum + roundsCount * 3
    return sum + 24
  }, 0)

  const bullRateNum = totalDarts > 0 ? (totalBulls / totalDarts) * 100 : 0
  const innerBullRateNum = totalDarts > 0 ? (totalInnerBulls / totalDarts) * 100 : 0
  const bullRate = bullRateNum.toFixed(1)
  const innerBullRate = innerBullRateNum.toFixed(1)

  section.innerHTML = `
    <div class="detail-bull-rate-grid">
      <div class="detail-bull-rate-item">
        <div class="detail-bull-rate-head">
          <span class="detail-bull-rate-label">Bull</span>
          <span class="detail-bull-rate-value">${bullRate}%</span>
        </div>
        <div class="detail-bull-rate-bar-bg">
          <div class="detail-bull-rate-bar-fill" style="width:${Math.min(100, bullRateNum).toFixed(1)}%"></div>
        </div>
      </div>
      <div class="detail-bull-rate-item">
        <div class="detail-bull-rate-head">
          <span class="detail-bull-rate-label">Inner Bull</span>
          <span class="detail-bull-rate-value">${innerBullRate}%</span>
        </div>
        <div class="detail-bull-rate-bar-bg">
          <div class="detail-bull-rate-bar-fill inner" style="width:${Math.min(100, innerBullRateNum).toFixed(1)}%"></div>
        </div>
      </div>
    </div>
  `
  if (wrapper) wrapper.style.display = "flex"
}

function setRangeChartSectionVisible(show) {
  const section = document.getElementById("rangeChartSection")
  if (!section) return
  section.style.display = show ? "block" : "none"
}

function wireRangeChartControls() {
  if (rangeChartWired) return

  const startInput = document.getElementById("rangeStartDate")
  const endInput = document.getElementById("rangeEndDate")
  const compareStartInput = document.getElementById("compareStartDate")
  const compareEndInput = document.getElementById("compareEndDate")
  const applyBtn = document.getElementById("rangeApplyBtn")
  if (!startInput || !endInput || !compareStartInput || !compareEndInput || !applyBtn) return

  applyBtn.onclick = drawSelectedRangeChart
  startInput.onchange = drawSelectedRangeChart
  endInput.onchange = drawSelectedRangeChart
  compareStartInput.onchange = drawSelectedRangeChart
  compareEndInput.onchange = drawSelectedRangeChart

  rangeChartWired = true
}

function formatDateInput(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function ensureRangeDefaults(sessions) {
  const startInput = document.getElementById("rangeStartDate")
  const endInput = document.getElementById("rangeEndDate")
  const compareStartInput = document.getElementById("compareStartDate")
  const compareEndInput = document.getElementById("compareEndDate")
  if (!startInput || !endInput || !compareStartInput || !compareEndInput || !sessions.length) return

  const sorted = sessions
    .filter(s => !Number.isNaN(new Date(s.date).getTime()))
    .sort((a, b) => new Date(a.date) - new Date(b.date))

  if (!sorted.length) return

  const last30 = sorted.slice(-30)
  const defaultStart = new Date(last30[0].date)
  const defaultEnd = new Date(last30[last30.length - 1].date)

  const dayMs = 24 * 60 * 60 * 1000
  const durationDays = Math.max(1, Math.floor((defaultEnd - defaultStart) / dayMs) + 1)
  const compareDefaultEnd = new Date(defaultStart.getTime() - dayMs)
  const compareDefaultStart = new Date(compareDefaultEnd.getTime() - (durationDays - 1) * dayMs)

  if (!startInput.value) startInput.value = formatDateInput(defaultStart)
  if (!endInput.value) endInput.value = formatDateInput(defaultEnd)
  if (!compareStartInput.value) compareStartInput.value = formatDateInput(compareDefaultStart)
  if (!compareEndInput.value) compareEndInput.value = formatDateInput(compareDefaultEnd)
}

function parseDateStart(inputValue) {
  return inputValue ? new Date(`${inputValue}T00:00:00`) : null
}

function parseDateEnd(inputValue) {
  return inputValue ? new Date(`${inputValue}T23:59:59`) : null
}

function dayKey(date) {
  return formatDateInput(date)
}

function dateFromDayKey(key) {
  return new Date(`${key}T00:00:00`)
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}

function filterSessionsByDate(sessions, startDate, endDate) {
  return sessions.filter(s => {
    const d = new Date(s.date)
    if (Number.isNaN(d.getTime())) return false
    if (startDate && d < startDate) return false
    if (endDate && d > endDate) return false
    return true
  })
}

function buildDailyAverageMap(sessions) {
  const byDay = {}

  sessions.forEach(s => {
    const d = new Date(s.date)
    if (Number.isNaN(d.getTime())) return

    const key = dayKey(d)
    if (!byDay[key]) byDay[key] = { sum: 0, count: 0 }
    byDay[key].sum += Number(s.score) || 0
    byDay[key].count += 1
  })

  const avgMap = {}
  Object.keys(byDay).forEach(key => {
    const item = byDay[key]
    avgMap[key] = item.count > 0 ? item.sum / item.count : null
  })

  return avgMap
}

function buildNormalizedDateSeries(startDate, avgMap, length) {
  if (!startDate || length <= 0) return []

  const series = []
  const startDay = dateFromDayKey(dayKey(startDate))
  for (let i = 0; i < length; i++) {
    const key = dayKey(addDays(startDay, i))
    const value = Object.prototype.hasOwnProperty.call(avgMap, key) ? avgMap[key] : null
    series.push(value)
  }
  return series
}

function buildDateLabels(startDate, length) {
  if (!startDate || length <= 0) return []
  const labels = []
  const startDay = dateFromDayKey(dayKey(startDate))
  for (let i = 0; i < length; i++) {
    const d = addDays(startDay, i)
    const m = String(d.getMonth() + 1)
    const day = String(d.getDate())
    labels.push(`${m}/${day}`)
  }
  return labels
}

function drawLineSeries(ctx, values, color, padding, verticalPadding, height, graphHeight, minScore, scoreRange, stepX) {
  let started = false
  ctx.beginPath()
    ctx.lineWidth = 1.5
  ctx.strokeStyle = color

  values.forEach((score, i) => {
    if (score === null) {
      started = false
      return
    }

    const x = padding + stepX * i
    const y = height - verticalPadding - ((score - minScore) / scoreRange) * graphHeight
    if (!started) {
      ctx.moveTo(x, y)
      started = true
    } else {
      ctx.lineTo(x, y)
    }
  })
  ctx.stroke()

  values.forEach((score, i) => {
    if (score === null) return
    const x = padding + stepX * i
    const y = height - verticalPadding - ((score - minScore) / scoreRange) * graphHeight
    ctx.beginPath()
      ctx.arc(x, y, 2, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()
  })
}

function drawSelectedRangeChart() {
  if (viewMode !== "analysis") return

  wireRangeChartControls()

  const canvas = document.getElementById("rangeScoreChart")
  const startInput = document.getElementById("rangeStartDate")
  const endInput = document.getElementById("rangeEndDate")
  const compareStartInput = document.getElementById("compareStartDate")
  const compareEndInput = document.getElementById("compareEndDate")
  const legend = document.getElementById("rangeChartLegend")
  if (!canvas || !startInput || !endInput || !compareStartInput || !compareEndInput) return

  const sessions = readDataSessions()
  ensureRangeDefaults(sessions)

  const canvasState = setupHiDPICanvas(canvas, 220)
  if (!canvasState) {
    scheduleChartRetry("selectedRange", () => drawSelectedRangeChart())
    return
  }
  resetChartRetry("selectedRange")
  const { ctx, width, height } = canvasState
  ctx.clearRect(0, 0, width, height)

  const startDate = parseDateStart(startInput.value)
  const endDate = parseDateEnd(endInput.value)
  const compareStartDate = parseDateStart(compareStartInput.value)
  const compareEndDate = parseDateEnd(compareEndInput.value)

  if ((startDate && endDate && startDate > endDate) || (compareStartDate && compareEndDate && compareStartDate > compareEndDate)) {
    ctx.fillStyle = "rgba(255,255,255,0.4)"
    ctx.font = "12px sans-serif"
    ctx.fillText("Invalid date range", 12, 20)
    if (legend) legend.style.display = "none"
    return
  }

  const periodASessions = filterSessionsByDate(sessions, startDate, endDate)
  const periodBSessions = filterSessionsByDate(sessions, compareStartDate, compareEndDate)

  const avgA = buildDailyAverageMap(periodASessions)
  const avgB = buildDailyAverageMap(periodBSessions)

  const dayMs = 24 * 60 * 60 * 1000
  const lenA = startDate && endDate ? Math.max(1, Math.floor((endDate - startDate) / dayMs) + 1) : 0
  const lenB = compareStartDate && compareEndDate ? Math.max(1, Math.floor((compareEndDate - compareStartDate) / dayMs) + 1) : 0
  const length = Math.max(lenA, lenB)

  const seriesA = buildNormalizedDateSeries(startDate, avgA, length)
  const seriesB = buildNormalizedDateSeries(compareStartDate, avgB, length)

  const allScores = [...seriesA, ...seriesB].filter(v => v !== null)
  if (!allScores.length) {
    ctx.fillStyle = "rgba(255,255,255,0.4)"
    ctx.font = "12px sans-serif"
    ctx.fillText("No data in selected ranges", 12, 20)
    if (legend) legend.style.display = "none"
    return
  }

  const chartPadding = getChartPadding()
  const padding = chartPadding.left
  const rightPadding = chartPadding.right
  const verticalPadding = chartPadding.vertical
  const graphWidth = width - padding - rightPadding
  const graphHeight = height - verticalPadding * 2
  const { minScore, scoreRange } = getScoreAxis(allScores)

  ctx.strokeStyle = "rgba(255,255,255,0.08)"
  ctx.lineWidth = 1
  const gridSteps = 4
  for (let i = 0; i <= gridSteps; i++) {
    const value = minScore + (scoreRange / gridSteps) * i
    const y = height - verticalPadding - (value - minScore) / scoreRange * graphHeight
    ctx.beginPath()
    ctx.moveTo(padding, y)
    ctx.lineTo(width - rightPadding, y)
    ctx.stroke()

    setChartAxisTextStyle(ctx)
    ctx.fillText(Math.round(value), Math.round(padding - 2), Math.round(y))
  }

  const stepX = graphWidth / (length - 1 || 1)
  const startX = getChartStartX(padding, graphWidth, length)
  const labels = buildDateLabels(startDate || compareStartDate, length)
  const labelStep = Math.max(1, Math.ceil(length / 6))
  ctx.fillStyle = "rgba(255,255,255,0.56)"
  ctx.font = `600 9px ${chartAxisFontFamily}`
  ctx.textAlign = "center"
  ctx.textBaseline = "alphabetic"
  labels.forEach((label, i) => {
    if (i % labelStep !== 0 && i !== labels.length - 1) return
    const x = startX + stepX * i
    ctx.fillText(label, x, height - 8)
  })

  drawLineSeries(ctx, seriesA, "#7bc96f", startX, verticalPadding, height, graphHeight, minScore, scoreRange, stepX)
  drawLineSeries(ctx, seriesB, "#4da3ff", startX, verticalPadding, height, graphHeight, minScore, scoreRange, stepX)

  if (legend) {
    legend.innerHTML = `
      <span class="range-chart-legend-item"><span class="range-chart-legend-swatch a"></span>A: ${startInput.value} - ${endInput.value}</span>
      <span class="range-chart-legend-item"><span class="range-chart-legend-swatch b"></span>B: ${compareStartInput.value} - ${compareEndInput.value}</span>
    `
    legend.style.display = "flex"
  }
}

window.addEventListener("DOMContentLoaded", setupDataPanelSwipe)


// ===============================
// ===== Analysis（タグ別の散布図） =====
// ===============================
// 全ゲームのスコアを日付順に点で描き、その日のメモのタグで色分けする。
// タグのボタンで、選んだタグの日だけを色付きにできる（選ばないときは全タグを色分け）

let scatterSelectedTags = []

const SCATTER_TAG_COLORS = [
  "#ff6b6b",
  "#4da3ff",
  "#7bc96f",
  "#ffd166",
  "#06d6a0",
  "#f78c6b",
  "#a78bfa",
  "#ff9ff3"
]
const SCATTER_NO_TAG_COLOR = "rgba(154,164,178,0.35)"

function drawAnalysisCharts() {
  if (viewMode !== "analysis") return
  if (typeof renderAnalysisHeatmap === "function") renderAnalysisHeatmap()
  renderAnalysisScatter()
  drawSelectedRangeChart()
}

function normalizeScatterTag(tag) {
  return String(tag || "").trim().replace(/^#/, "")
}

// 使われているタグの一覧（多い順）。色はこの順番で割り当て、上位 8 個までは色が重ならない
let scatterTagOrder = []

function getScatterTagColor(tag) {
  const index = scatterTagOrder.indexOf(normalizeScatterTag(tag))
  if (index < 0) return SCATTER_NO_TAG_COLOR
  return SCATTER_TAG_COLORS[index % SCATTER_TAG_COLORS.length]
}

function getSessionTagsForScatter(session) {
  const date = new Date(session?.date)
  if (Number.isNaN(date.getTime())) return []
  if (typeof getDayNote !== "function" || typeof getLocalDateKey !== "function") return []

  const note = getDayNote(getLocalDateKey(date))
  if (!Array.isArray(note?.tags)) return []
  return note.tags.map(normalizeScatterTag).filter(Boolean)
}

// 使われているタグを、多い順に並べる
function getScatterAvailableTags(sessions) {
  const counts = {}
  sessions.forEach(session => {
    getSessionTagsForScatter(session).forEach(tag => {
      counts[tag] = (counts[tag] || 0) + 1
    })
  })

  return Object.keys(counts).sort((a, b) => {
    if (counts[b] !== counts[a]) return counts[b] - counts[a]
    return a.localeCompare(b, "ja")
  })
}

function renderScatterLegend(tags) {
  const legend = document.getElementById("scatterLegend")
  if (!legend) return

  const shownTags = (scatterSelectedTags.length ? scatterSelectedTags : tags).slice(0, 8)
  if (!shownTags.length) {
    legend.innerHTML = '<span class="scatter-legend-item">タグ未設定のゲームはグレーで表示されます</span>'
    return
  }

  const rows = shownTags
    .map(tag => `
      <span class="scatter-legend-item">
        <span class="scatter-legend-swatch" style="background:${getScatterTagColor(tag)}"></span>
        #${escapeHtml(tag)}
      </span>
    `)
    .join("")

  legend.innerHTML = rows +
    `<span class="scatter-legend-item"><span class="scatter-legend-swatch" style="background:${SCATTER_NO_TAG_COLOR}"></span>タグなし/非選択</span>`
}

function renderScatterTagControls(sessions) {
  const controls = document.getElementById("scatterTagControls")
  if (!controls) return []

  const tags = getScatterAvailableTags(sessions)
  scatterTagOrder = tags
  scatterSelectedTags = scatterSelectedTags.filter(tag => tags.includes(tag))

  if (!tags.length) {
    controls.innerHTML = '<span class="scatter-legend-item">日別メモにタグを付けると色分けできます</span>'
    renderScatterLegend([])
    return []
  }

  const allActive = scatterSelectedTags.length === 0 ? " is-active" : ""
  const tagButtons = tags
    .map(tag => {
      const active = scatterSelectedTags.includes(tag) ? " is-active" : ""
      return `<button type="button" class="scatter-tag-btn${active}" data-tag="${escapeHtml(tag)}" style="color:${getScatterTagColor(tag)}">#${escapeHtml(tag)}</button>`
    })
    .join("")

  controls.innerHTML = `<button type="button" class="scatter-clear-btn${allActive}" data-tag="">All Tags</button>${tagButtons}`

  controls.querySelectorAll("button").forEach(btn => {
    btn.onclick = () => {
      const tag = normalizeScatterTag(btn.getAttribute("data-tag"))
      if (!tag) {
        scatterSelectedTags = []
      } else if (scatterSelectedTags.includes(tag)) {
        scatterSelectedTags = scatterSelectedTags.filter(t => t !== tag)
      } else {
        scatterSelectedTags = scatterSelectedTags.concat(tag)
      }
      renderAnalysisScatter()
    }
  })

  renderScatterLegend(tags)
  return tags
}

function renderAnalysisScatter() {
  const sessions = readDataSessions()
  const tags = renderScatterTagControls(sessions)
  drawScatterChart(sessions, tags)
}

function drawScatterChart(sessions, tags) {
  const canvas = document.getElementById("scatterChart")
  if (!canvas) return

  const canvasState = setupHiDPICanvas(canvas, 280)
  if (!canvasState) {
    scheduleChartRetry("scatter", () => drawScatterChart(sessions, tags))
    return
  }
  resetChartRetry("scatter")

  const { ctx, width, height } = canvasState
  ctx.clearRect(0, 0, width, height)

  const points = sessions
    .map(session => ({
      x: new Date(session.date).getTime(),
      score: Number(session.score) || 0,
      tags: getSessionTagsForScatter(session)
    }))
    .filter(point => Number.isFinite(point.x))
    .sort((a, b) => a.x - b.x)

  if (!points.length) {
    ctx.fillStyle = "rgba(255,255,255,0.4)"
    ctx.font = "12px sans-serif"
    ctx.fillText("No data", 12, 20)
    return
  }

  const chartPadding = getChartPadding()
  const left = chartPadding.left
  const right = chartPadding.right
  const top = 22
  const bottom = 28
  // 両端の点が枠や目盛りの文字に重ならないよう、点を置く範囲を少し内側にする
  const inset = 8
  const graphWidth = width - left - right
  const graphHeight = height - top - bottom

  const xMin = points[0].x
  const xMax = points[points.length - 1].x
  const xRange = xMax - xMin

  const { minScore, scoreRange } = getScoreAxis(points.map(p => p.score))
  const toY = score => height - bottom - ((score - minScore) / scoreRange) * graphHeight
  // 1 日分しかないときは横方向の真ん中に置く
  const toX = x => xRange
    ? left + inset + ((x - xMin) / xRange) * (graphWidth - inset * 2)
    : left + graphWidth / 2

  // 横線と縦軸の目盛り
  ctx.strokeStyle = "rgba(255,255,255,0.08)"
  ctx.lineWidth = 1
  const gridSteps = 4
  for (let i = 0; i <= gridSteps; i++) {
    const value = minScore + (scoreRange / gridSteps) * i
    const y = toY(value)
    ctx.beginPath()
    ctx.moveTo(left, y)
    ctx.lineTo(width - right, y)
    ctx.stroke()

    setChartAxisTextStyle(ctx)
    ctx.fillText(Math.round(value), Math.round(left - 2), Math.round(y))
  }

  // 横軸の日付
  ctx.fillStyle = "rgba(255,255,255,0.56)"
  ctx.font = `600 9px ${chartAxisFontFamily}`
  ctx.textAlign = "center"
  ctx.textBaseline = "alphabetic"
  const tickCount = xRange ? 5 : 1
  for (let i = 0; i < tickCount; i++) {
    const ratio = tickCount === 1 ? 0.5 : i / (tickCount - 1)
    const d = new Date(xMin + xRange * ratio)
    const tickX = tickCount === 1 ? toX(xMin) : left + inset + (graphWidth - inset * 2) * ratio
    ctx.fillText(`${d.getMonth() + 1}/${d.getDate()}`, tickX, height - 8)
  }

  // 点（タグで色分け。タグを選んでいるときは、選んだタグの日だけ色を付ける）
  points.forEach(point => {
    let color = SCATTER_NO_TAG_COLOR
    if (scatterSelectedTags.length === 0) {
      if (point.tags[0]) color = getScatterTagColor(point.tags[0])
    } else {
      const matched = scatterSelectedTags.find(tag => point.tags.includes(tag))
      if (matched) color = getScatterTagColor(matched)
    }

    ctx.beginPath()
    ctx.arc(toX(point.x), toY(point.score), 3.4, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()
  })
}
