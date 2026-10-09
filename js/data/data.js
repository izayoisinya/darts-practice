// 見ている画面："history"（記録：全ゲームの一覧）/ "stats"（分析：ゲームの種類ごとの成績）。Day などのお休み中のビューは "day" など
let viewMode = "history"
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
    // History・Stats は 1 画面ずつなので、左右のスワイプで切り替えない（Day などのお休み中のビュー用）
    if (viewMode === "history" || viewMode === "stats") return
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
  if (viewMode === "stats") {
    drawGameScoresChart()
    drawAnalysisCharts()
  }
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

// Day / Week / Month / Year は一旦お休み（2026.10.8。日付はトップのカレンダーで見る）。コード（data_grouped.js / data_detail.js）は残してあり、
// changeView("day") などで開ける。フッターのタブと設定画面の Data Tabs は 2026.10.10 になくした（History と Stats はトップで選ぶ）

// 見る画面ごとに出す部品を切り替える（2026.10.10 から「記録」と「分析」で分ける）
//   history : 全ゲームの一覧（右の #rightPanel だけを 1 列で。上にゲームの種類の絞り込み、下にページ送り）
//   stats   : ヘッダーで選んだゲームの成績（左の #leftPanel だけを 1 列で）。Count-Up は Stats・Awards・スコア推移・
//             レーティング目安に続けて、ヒートマップ・タグ別の散布図・期間 A/B の比較（もとの Analysis）も出す。
//             01・クリケットは #zeroOneStatsPanel（data_01.js / data_cricket.js）
//   それ以外 : Day / Week / Month / Year のまとめ（data_grouped.js。一旦お休み）
function showViewSections(mode) {
  const show = (id, display) => {
    const el = document.getElementById(id)
    if (el) el.style.display = display
  }

  const isHistory = mode === "history"
  const isStats = mode === "stats"

  show("statsSection", isStats ? "flex" : "none")
  show("awardsSection", isStats ? "flex" : "none")
  show("chartContainer", isStats ? "block" : "none")
  show("gameChartSection", isStats ? "flex" : "none")
  show("analysisContainer", isStats ? "flex" : "none")
  setRangeChartSectionVisible(isStats)

  const main = document.querySelector("main.data-container")
  if (main) {
    main.classList.toggle("history-mode", isHistory)
    main.classList.toggle("analysis-mode", isStats)
  }
  // ヘッダーのゲームの切り替えは Stats だけ、フッター（ページ送り）は History だけに出す
  document.body.classList.toggle("data-history-view", isHistory)
  document.body.classList.toggle("data-stats-view", isStats)

  const calendarContainer = document.getElementById("calendarContainer")
  if (calendarContainer) {
    calendarContainer.style.display = "none"
    calendarContainer.innerHTML = ""
  }
}

// 古い名前（Game / Analysis）で呼ばれても、新しい画面に読み替える
function normalizeViewMode(mode) {
  if (mode === "game") return "history"
  if (mode === "analysis") return "stats"
  return mode || "history"
}

// Stats：ヘッダーで選んだゲームの成績を描く
function renderStatsView() {
  groupedPageMode = "analysis"
  if (typeof dataGameType !== "undefined" && dataGameType === "01") {
    renderZeroOneData()
    return
  }
  if (typeof dataGameType !== "undefined" && dataGameType === "cricket") {
    renderCricketData()
    return
  }
  loadStats()
  drawGameScoresChart()
  drawAnalysisCharts()
  queueInitialGameChartRefresh()
}

function changeView(mode) {
  mode = normalizeViewMode(mode)
  setupDataPanelSwipe()
  viewMode = mode
  detailViewMode = false
  selectedDayData = null
  detailPageNumber = 1
  hideDetailBullRate()
  if (typeof setDataDetailViewClass === "function") {
    setDataDetailViewClass(false)
  }

  // 縦向き（1 パネル表示）: group表示時はHistoryパネルへ自動切り替え
  if (mode !== "history" && mode !== "stats" && isPhonePortraitDataView()) {
    setDataPanel("history")
  }

  showViewSections(mode)

  if (mode === "history") {
    groupedPageMode = "game"
    // Count-Up・01・Cricket の全ゲーム（data_loader.js の renderHistory()）
    renderHistory()
  } else if (mode === "stats") {
    renderStatsView()
  } else {
    // Group ビュー（Day/Week/Month/Year）
    displayGroupView(mode)
    window.scrollTo(0, 0)
  }
}

function renderView() {
  changeView(viewMode)
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
  if (viewMode !== "stats") return

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
  if (viewMode !== "stats") return
  if (typeof renderAnalysisHeatmap === "function") renderAnalysisHeatmap()
  renderTagSearch()
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


// ===============================
// ===== Tag Search（タグ検索用のカレンダー） =====
// ===============================
// Count-Up の Stats の、タグ別の散布図の上に出す。日別メモのタグを選ぶと（History と同じ選択。data_loader.js の dataTagFilter）、
// 合う日をカレンダーで光らせ、合う日の一覧と、合う日・それ以外の日の成績の比較（ゲームの種類ごと）を出す。
// カレンダーの練習した日を押すと、データのトップでその日のメモとゲームを開く（data_hub.js の openDataHubDay()）
let tagSearchMonth = null
let tagSearchBound = false

function getTagSearchDayKey(time) {
  return getLocalDateKey(new Date(time))
}

// 合う日・それ以外の日の、ゲームの種類ごとの主な数字（Count-Up は平均 PPD、01 は平均ダーツ数、Cricket は平均 MPR）
function getTagSearchCompareRows(sessions) {
  const avg = values => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
  const defs = [
    { type: "countup", label: "Avg PPD", digits: 2, better: "higher", value: s => Number(s.ppd) || 0 },
    { type: "01", label: "Avg Darts", digits: 1, better: "lower", value: s => s.zeroOne.finished && s.zeroOne.finishDarts > 0 ? s.zeroOne.finishDarts : null },
    { type: "cricket", label: "Avg MPR", digits: 2, better: "higher", value: s => Number(s.cricket.mpr) || 0 }
  ]
  return defs.map(def => {
    const list = sessions.filter(s => getHistoryGameType(s) === def.type)
    const match = list.filter(s => dayMatchesTagFilter(getTagSearchDayKey(s.date)))
    const other = list.filter(s => !dayMatchesTagFilter(getTagSearchDayKey(s.date)))
    const mv = avg(match.map(def.value).filter(v => v !== null))
    const ov = avg(other.map(def.value).filter(v => v !== null))
    return { ...def, matchGames: match.length, otherGames: other.length, mv, ov }
  }).filter(row => row.matchGames)
}

function renderTagSearch() {

  const box = document.getElementById("tagSearchSection")
  if (!box) return

  const sessions = typeof readHistorySessions === "function" ? readHistorySessions() : []
  const filterHtml = typeof renderDataTagFilterHtml === "function" ? renderDataTagFilterHtml() : ""
  if (!filterHtml) {
    box.innerHTML = '<p class="tag-search-empty">日別メモにタグを付けると、タグの付いた日を探して成績を比べられます（データのトップのカレンダーで日付を選び、Memo から付けます）</p>'
    return
  }

  const active = isDataTagFilterActive()
  const playedDays = {}
  sessions.forEach(s => {
    const key = getTagSearchDayKey(s.date)
    playedDays[key] = (playedDays[key] || 0) + 1
  })
  const matchDays = active ? Object.keys(playedDays).filter(dayMatchesTagFilter).sort().reverse() : []

  // 最初は合う日の最新の月（なければ最後に遊んだ月）
  if (!tagSearchMonth) {
    const last = sessions.length ? new Date(sessions[sessions.length - 1].date) : new Date()
    tagSearchMonth = new Date(last.getFullYear(), last.getMonth(), 1)
  }
  const year = tagSearchMonth.getFullYear()
  const month = tagSearchMonth.getMonth()
  const offset = (new Date(year, month, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  let cells = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map(d => `<span class="data-hub-cal-head">${d}</span>`).join("")
  cells += '<span class="data-hub-cal-day empty"></span>'.repeat(offset)
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`
    const count = playedDays[key] || 0
    const cls = ["data-hub-cal-day"]
    if (count) cls.push("played")
    if (count && active) cls.push(dayMatchesTagFilter(key) ? "tag-match" : "tag-dim")
    const inner = `<span class="data-hub-cal-num">${d}</span>${count ? `<span class="data-hub-cal-count">${count}</span>` : ""}`
    cells += count
      ? `<button type="button" class="${cls.join(" ")}" data-tag-day="${key}" aria-label="${month + 1}/${d} ${count} games">${inner}</button>`
      : `<span class="${cls.join(" ")}">${inner}</span>`
  }

  const list = matchDays.slice(0, 20).map(key => {
    const [y, m, d] = key.split("-").map(Number)
    return `<button type="button" data-tag-month="${y}-${m}">${y === new Date().getFullYear() ? "" : `${y}/`}${m}/${d}</button>`
  }).join("")

  const rows = active ? getTagSearchCompareRows(sessions) : []
  const compare = rows.length
    ? `<div class="tag-search-compare">
        <div class="tag-search-compare-head"><span></span><span>Tag Days</span><span>Other Days</span><span>Diff</span></div>
        ${rows.map(row => {
          const diff = row.mv !== null && row.ov !== null ? row.mv - row.ov : null
          const good = diff === null ? "" : (row.better === "lower" ? diff < 0 : diff > 0) ? "up" : diff === 0 ? "even" : "down"
          return `<div class="tag-search-compare-row history-${row.type === "01" ? "zeroone" : row.type}">
            <span><span class="history-game-badge">${HISTORY_GAME_LABELS[row.type]}</span><small>${row.label}</small></span>
            <span>${row.mv === null ? "-" : row.mv.toFixed(row.digits)}<small>${row.matchGames} games</small></span>
            <span>${row.ov === null ? "-" : row.ov.toFixed(row.digits)}<small>${row.otherGames} games</small></span>
            <span class="data-hub-period-diff ${good}">${diff === null ? "-" : `${diff > 0 ? "+" : diff < 0 ? "−" : "±"}${Math.abs(diff).toFixed(row.digits)}`}</span>
          </div>`
        }).join("")}
      </div>`
    : ""

  box.innerHTML = `
    ${filterHtml}
    <div class="tag-search-body">
      <div class="data-hub-calendar tag-search-calendar">
        <div class="data-hub-cal-top">
          <span class="tag-search-hint">${active ? `${matchDays.length} days` : "タグを選ぶと、付いた日が光ります"}</span>
          <span class="data-hub-cal-nav">
            <button type="button" data-tag-cal="-1" aria-label="前の月">‹</button>
            <span class="data-hub-cal-title">${year}/${month + 1}</span>
            <button type="button" data-tag-cal="1" aria-label="次の月">›</button>
          </span>
        </div>
        <div class="data-hub-cal-grid">${cells}</div>
        ${active ? (matchDays.length ? `<div class="data-hub-tag-matches">${list}${matchDays.length > 20 ? `<span>+${matchDays.length - 20}</span>` : ""}</div>` : '<p class="data-hub-tag-matches empty">選んだタグの日はありません</p>') : ""}
      </div>
      ${compare}
    </div>
  `

  if (!tagSearchBound) {
    tagSearchBound = true
    box.addEventListener("click", e => {
      const target = e.target instanceof Element ? e.target : null
      if (!target) return
      const nav = target.closest("[data-tag-cal]")
      const jump = target.closest("[data-tag-month]")
      const day = target.closest("[data-tag-day]")
      if (nav) {
        tagSearchMonth = new Date(tagSearchMonth.getFullYear(), tagSearchMonth.getMonth() + Number(nav.dataset.tagCal), 1)
        renderTagSearch()
      } else if (jump) {
        const [y, m] = jump.dataset.tagMonth.split("-").map(Number)
        tagSearchMonth = new Date(y, m - 1, 1)
        renderTagSearch()
      } else if (day && typeof openDataHubDay === "function") {
        openDataHubDay(day.dataset.tagDay)
      }
    })
  }
}

