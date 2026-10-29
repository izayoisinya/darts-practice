// 見ている画面："history"（記録：全ゲームの一覧）/ "stats"（分析：ゲームの種類ごとの成績）
let viewMode = "history"
let rangeChartWired = false
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

// 今表示しているグラフを描き直す（画面の回転時など）
function redrawVisibleCharts() {
  refreshGameChartsNow()
}

let chartResizeTimer = null

function queueChartRedrawForResize() {
  if (!isDataPage()) return
  clearTimeout(chartResizeTimer)
  chartResizeTimer = setTimeout(redrawVisibleCharts, 150)
}

window.addEventListener("resize", queueChartRedrawForResize)
window.addEventListener("orientationchange", queueChartRedrawForResize)

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

function refreshGameChartsNow() {
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

// Day / Week / Month / Year のビューは 2026.10.10 に削除した（日付はトップのカレンダー、期間ごとの推移は Stats の Period で見る）。
// フッターのタブと設定画面の Data Tabs も 2026.10.10 になくした（History と Stats はトップで選ぶ）

// 見る画面ごとに出す部品を切り替える（2026.10.10 から「記録」と「分析」で分ける）
//   history : 全ゲームの一覧（右の #rightPanel だけを 1 列で。上にゲームの種類の絞り込み、下にページ送り）
//   stats   : ヘッダーで選んだゲームの成績（左の #leftPanel だけを 1 列で）。Count-Up は Stats・Awards・スコア推移・
//             レーティング目安に続けて、ヒートマップ・タグ別の散布図・期間 A/B の比較（もとの Analysis）も出す。
//             01・クリケットは #zeroOneStatsPanel（data_01.js / data_cricket.js）
function showViewSections(mode) {
  const isHistory = mode === "history"
  const isStats = mode === "stats"

  const main = document.querySelector("main.data-container")
  if (main) {
    main.classList.toggle("history-mode", isHistory)
    main.classList.toggle("analysis-mode", isStats)
  }
  // ヘッダーのゲームの切り替えは Stats だけ、フッター（ページ送り）は History だけに出す
  document.body.classList.toggle("data-history-view", isHistory)
  document.body.classList.toggle("data-stats-view", isStats)
}

// 古い名前（Game / Analysis）で呼ばれても、新しい画面に読み替える
function normalizeViewMode(mode) {
  if (mode === "game") return "history"
  if (mode === "analysis") return "stats"
  return mode || "history"
}

// Stats：ヘッダーで選んだゲームの成績を描く
function renderStatsView() {
  // Period（週・月・年ごとの推移）はどのゲームでも出す（data_period.js）
  if (typeof renderStatsPeriod === "function") renderStatsPeriod()
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
  mode = normalizeViewMode(mode) === "stats" ? "stats" : "history"
  viewMode = mode
  showViewSections(mode)

  if (mode === "history") {
    // Count-Up・01・Cricket の全ゲーム（data_loader.js の renderHistory()）
    renderHistory()
  } else {
    renderStatsView()
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
    <h3 class="data-section-title">Rating</h3>
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

  changeView(viewMode)
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

function drawGameScoresChart() {
  const canvas = document.getElementById("scoreChart")
  if (!canvas) return

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

function formatDateInput(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

// ===============================
// ===== Period Compare（期間 A と B の比較） =====
// ===============================
// 2 つの期間の平均スコア・ゲーム数・練習した日数と差を並べ、それぞれの期間の 1 日目からの日ごとの平均スコアを重ねて描く。
// プリセット：Week（今週と先週）/ Month（今月と先月）/ 30 Days（直近 30 日とその前の 30 日。最初はこれ）
let rangePreset = "d30"

const RANGE_COLORS = { a: "#7bc96f", b: "#4da3ff" }

function wireRangeChartControls() {
  if (rangeChartWired) return

  const inputs = ["rangeStartDate", "rangeEndDate", "compareStartDate", "compareEndDate"]
    .map(id => document.getElementById(id))
  if (inputs.some(input => !input)) return

  // 日付を自分で変えたら、プリセットの選択を外す
  inputs.forEach(input => {
    input.onchange = () => {
      rangePreset = ""
      drawSelectedRangeChart()
    }
  })

  const presets = document.getElementById("rangePresets")
  if (presets) {
    presets.addEventListener("click", e => {
      const btn = e.target instanceof Element ? e.target.closest("[data-range-preset]") : null
      if (!btn) return
      applyRangePreset(btn.dataset.rangePreset)
      drawSelectedRangeChart()
    })
  }

  rangeChartWired = true
}

function formatDateInput(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

// プリセットの期間を日付の欄に入れる（終わりの日は、その期間の最後の日。今の期間は今日まででなく期間の最後まで）
function applyRangePreset(preset) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let a
  let b

  if (preset === "week" || preset === "month") {
    const current = getPeriodRange(now, preset)
    const prev = getPeriodRange(now, preset, -1)
    a = { start: current.start, end: addDays(current.end, -1) }
    b = { start: prev.start, end: addDays(prev.end, -1) }
  } else {
    a = { start: addDays(today, -29), end: today }
    b = { start: addDays(today, -59), end: addDays(today, -30) }
  }

  rangePreset = preset
  document.getElementById("rangeStartDate").value = formatDateInput(a.start)
  document.getElementById("rangeEndDate").value = formatDateInput(a.end)
  document.getElementById("compareStartDate").value = formatDateInput(b.start)
  document.getElementById("compareEndDate").value = formatDateInput(b.end)
}

function ensureRangeDefaults() {
  const startInput = document.getElementById("rangeStartDate")
  if (startInput && !startInput.value) applyRangePreset(rangePreset || "d30")
}

// 期間の 1 日目から数えた日ごとの平均スコア（length 日ぶん。練習しなかった日は null）
function buildRangeDailySeries(startDate, avgMap, length) {
  const series = []
  for (let i = 0; i < length; i++) {
    const key = dayKey(addDays(startDate, i))
    series.push(Object.prototype.hasOwnProperty.call(avgMap, key) ? avgMap[key] : null)
  }
  return series
}

function getRangeSummary(list) {
  const days = new Set(list.map(s => dayKey(new Date(s.date)))).size
  const avg = list.length ? list.reduce((sum, s) => sum + (Number(s.score) || 0), 0) / list.length : null
  return { games: list.length, days, avg }
}

function renderRangeSummary(a, b, labelA, labelB) {
  const box = document.getElementById("rangeChartSummary")
  if (!box) return

  const fmt = v => v === null ? "-" : v.toFixed(1)
  const diff = a.avg !== null && b.avg !== null ? a.avg - b.avg : null
  const diffHtml = diff === null
    ? '<span class="data-hub-period-diff even">-</span>'
    : Math.abs(diff) < 0.05
      ? '<span class="data-hub-period-diff even">±0</span>'
      : `<span class="data-hub-period-diff ${diff > 0 ? "up" : "down"}">${diff > 0 ? "+" : "−"}${Math.abs(diff).toFixed(1)}</span>`

  box.innerHTML = `
    <div class="period-trend-item" style="--badge-rgb: 123 201 111">
      <small>A · ${labelA}</small>
      <strong>${fmt(a.avg)}</strong>
      <small>Avg Score · ${a.games} games · ${a.days} days</small>
    </div>
    <div class="period-trend-item" style="--badge-rgb: 77 163 255">
      <small>B · ${labelB}</small>
      <strong>${fmt(b.avg)}</strong>
      <small>Avg Score · ${b.games} games · ${b.days} days</small>
    </div>
    <div class="period-trend-item diff" style="--badge-rgb: 154 164 178">
      <small>A − B</small>
      ${diffHtml}
      <small>多いほど良い</small>
    </div>
  `
}

function formatRangeLabel(start, end) {
  const f = d => `${d.getMonth() + 1}/${d.getDate()}`
  return `${f(start)} – ${f(end)}`
}

function drawSelectedRangeChart() {
  if (viewMode !== "stats") return

  wireRangeChartControls()
  ensureRangeDefaults()

  // プリセットのボタンの選ばれている印
  document.querySelectorAll("[data-range-preset]").forEach(btn => {
    const active = btn.dataset.rangePreset === rangePreset
    btn.classList.toggle("active", active)
    btn.setAttribute("aria-pressed", String(active))
  })

  const canvas = document.getElementById("rangeScoreChart")
  if (!canvas) return

  const startDate = parseDateStart(document.getElementById("rangeStartDate").value)
  const endDate = parseDateEnd(document.getElementById("rangeEndDate").value)
  const compareStartDate = parseDateStart(document.getElementById("compareStartDate").value)
  const compareEndDate = parseDateEnd(document.getElementById("compareEndDate").value)

  const canvasState = setupHiDPICanvas(canvas, 220)
  if (!canvasState) {
    scheduleChartRetry("selectedRange", () => drawSelectedRangeChart())
    return
  }
  resetChartRetry("selectedRange")
  const { ctx, width, height } = canvasState
  ctx.clearRect(0, 0, width, height)

  const message = text => {
    ctx.fillStyle = "rgba(154,164,178,0.8)"
    ctx.font = `12px ${chartAxisFontFamily}`
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(text, width / 2, height / 2)
  }

  if (!startDate || !endDate || !compareStartDate || !compareEndDate) {
    renderRangeSummary(getRangeSummary([]), getRangeSummary([]), "-", "-")
    message("期間を選んでください")
    return
  }
  if (startDate > endDate || compareStartDate > compareEndDate) {
    renderRangeSummary(getRangeSummary([]), getRangeSummary([]), "-", "-")
    message("始まりの日が終わりの日より後になっています")
    return
  }

  const sessions = readDataSessions()
  const listA = filterSessionsByDate(sessions, startDate, endDate)
  const listB = filterSessionsByDate(sessions, compareStartDate, compareEndDate)
  renderRangeSummary(getRangeSummary(listA), getRangeSummary(listB),
    formatRangeLabel(startDate, endDate), formatRangeLabel(compareStartDate, compareEndDate))

  const dayMs = 24 * 60 * 60 * 1000
  const lenA = Math.round((dateFromDayKey(dayKey(endDate)) - startDate) / dayMs) + 1
  const lenB = Math.round((dateFromDayKey(dayKey(compareEndDate)) - compareStartDate) / dayMs) + 1
  const length = Math.max(lenA, lenB)
  const seriesA = buildRangeDailySeries(startDate, buildDailyAverageMap(listA), lenA)
  const seriesB = buildRangeDailySeries(compareStartDate, buildDailyAverageMap(listB), lenB)

  const values = seriesA.concat(seriesB).filter(v => v !== null)
  if (!values.length) {
    message("この期間の記録はありません")
    return
  }

  const pad = { left: 40, right: 12, top: 14, bottom: 34 }
  const graphW = width - pad.left - pad.right
  const graphH = height - pad.top - pad.bottom
  const maxV = Math.max(...values)
  const minV = Math.min(...values)
  const span = Math.max(maxV - minV, 20)
  const top = maxV + span * 0.15
  const bottom = Math.max(0, minV - span * 0.15)
  const y = v => pad.top + graphH - (v - bottom) / (top - bottom) * graphH
  // 1 日ごとに同じ幅の枠を取り、その真ん中に点を置く
  const x = i => pad.left + graphW * (i + 0.5) / length

  ctx.font = `600 9px ${chartAxisFontFamily}`
  ctx.strokeStyle = "rgba(255,255,255,0.06)"
  ctx.fillStyle = "rgba(154,164,178,0.8)"
  ctx.textAlign = "right"
  ctx.textBaseline = "middle"
  for (let i = 0; i <= 3; i++) {
    const v = bottom + (top - bottom) * i / 3
    ctx.beginPath()
    ctx.moveTo(pad.left, y(v))
    ctx.lineTo(width - pad.right, y(v))
    ctx.stroke()
    ctx.fillText(Math.round(v), pad.left - 6, y(v))
  }

  // 横軸：上の段が A の日付、下の段が B の日付（多いときは間引く）
  const step = Math.ceil(length / Math.max(2, Math.floor(graphW / 44)))
  ctx.textAlign = "center"
  ctx.textBaseline = "top"
  for (let i = 0; i < length; i += step) {
    const label = date => `${date.getMonth() + 1}/${date.getDate()}`
    if (i < lenA) {
      ctx.fillStyle = RANGE_COLORS.a
      ctx.fillText(label(addDays(startDate, i)), x(i), pad.top + graphH + 5)
    }
    if (i < lenB) {
      ctx.fillStyle = RANGE_COLORS.b
      ctx.fillText(label(addDays(compareStartDate, i)), x(i), pad.top + graphH + 17)
    }
  }

  const drawSeries = (series, color) => {
    const points = series
      .map((v, i) => v === null ? null : { x: x(i), y: y(v) })
      .filter(Boolean)
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.beginPath()
    points.forEach((p, n) => n ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))
    ctx.stroke()
    ctx.fillStyle = color
    points.forEach(p => {
      ctx.beginPath()
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2)
      ctx.fill()
    })
    ctx.lineWidth = 1
  }
  drawSeries(seriesB, RANGE_COLORS.b)
  drawSeries(seriesA, RANGE_COLORS.a)
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
  renderDayCompare()
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
// カレンダーの日付は見るだけで押せない（Stats の画面のまま）
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
  // タグがまだなくても、カレンダー（練習した日の印）は最初から出す
  const filterHtml = (typeof renderDataTagFilterHtml === "function" ? renderDataTagFilterHtml() : "") ||
    '<p class="tag-search-empty">日別メモにタグを付けると、タグの付いた日を探して成績を比べられます（データのトップのカレンダーで日付を選び、Memo から付けます）</p>'

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
    // 日付は押せない（見るだけ。データのトップには移らない）
    cells += `<span class="${cls.join(" ")}">${inner}</span>`
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
          <span class="tag-search-hint">${active ? `${matchDays.length} days` : getDataTagList().length ? "タグを選ぶと、付いた日が光ります" : `${Object.keys(playedDays).length} days played`}</span>
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
      if (nav) {
        tagSearchMonth = new Date(tagSearchMonth.getFullYear(), tagSearchMonth.getMonth() + Number(nav.dataset.tagCal), 1)
        renderTagSearch()
      } else if (jump) {
        const [y, m] = jump.dataset.tagMonth.split("-").map(Number)
        tagSearchMonth = new Date(y, m - 1, 1)
        renderTagSearch()
      }
    })
  }
}


// ===============================
// ===== Day Compare（2 つの日を比べる） =====
// ===============================
// Count-Up の Stats の一番下。練習した日を 2 つ選び（A：最後に練習した日、B：その前の日から始める）、
// その日のゲームのスコアの並び（1 ゲーム目・2 ゲーム目…）を重ねたグラフと、平均スコア・平均 PPD・ブル率・
// その日のメモのタグを並べて比べる。2026.10.10 に、お休みしていた Day の詳細の「比較日」を作り直したもの
let dayCompareA = ""
let dayCompareB = ""
let dayCompareBound = false

function getDayCompareGroups() {
  const groups = {}
  readDataSessions().forEach(s => {
    const key = getLocalDateKey(new Date(s.date))
    ;(groups[key] = groups[key] || []).push(s)
  })
  return groups
}

function formatDayCompareKey(key) {
  const [y, m, d] = key.split("-").map(Number)
  return `${y === new Date().getFullYear() ? "" : `${y}/`}${m}/${d}`
}

function getDayCompareSummary(list) {
  if (!list || !list.length) return null
  const avg = values => values.reduce((a, b) => a + b, 0) / values.length
  const darts = list.reduce((sum, s) => sum + (Array.isArray(s.roundScores) ? s.roundScores.length * 3 : 24), 0)
  const bulls = list.reduce((sum, s) => sum + (Number(s.bulls) || 0), 0)
  return {
    games: list.length,
    avgScore: avg(list.map(s => Number(s.score) || 0)),
    avgPpd: avg(list.map(s => Number(s.ppd) || 0)),
    best: Math.max(...list.map(s => Number(s.score) || 0)),
    bullRate: darts ? bulls / darts * 100 : 0
  }
}

function renderDayCompare() {

  const box = document.getElementById("dayCompareSection")
  if (!box) return

  const groups = getDayCompareGroups()
  const days = Object.keys(groups).sort().reverse()
  if (days.length < 2) {
    box.innerHTML = '<p class="tag-search-empty">練習した日が 2 日以上になると、2 つの日を比べられます</p>'
    return
  }
  if (!groups[dayCompareA]) dayCompareA = days[0]
  if (!groups[dayCompareB] || dayCompareB === dayCompareA) dayCompareB = days.find(d => d !== dayCompareA)

  const options = selected => days.map(key => `<option value="${key}"${key === selected ? " selected" : ""}>${formatDayCompareKey(key)}（${groups[key].length}）</option>`).join("")
  const a = getDayCompareSummary(groups[dayCompareA])
  const b = getDayCompareSummary(groups[dayCompareB])
  const tags = key => {
    const list = typeof getDayTags === "function" ? getDayTags(key) : []
    return list.length ? list.map(tag => `<span class="group-note-chip">#${escapeHtml(tag)}</span>`).join("") : '<span class="day-compare-notag">タグなし</span>'
  }
  const diff = (x, y, digits) => {
    const d = x - y
    if (Math.abs(d) < Math.pow(10, -digits) / 2) return '<span class="data-hub-period-diff even">±0</span>'
    return `<span class="data-hub-period-diff ${d > 0 ? "up" : "down"}">${d > 0 ? "+" : "−"}${Math.abs(d).toFixed(digits)}</span>`
  }
  const row = (label, key, digits, unit = "") => `
    <div class="day-compare-row">
      <span>${label}</span>
      <strong class="a">${a[key].toFixed(digits)}${unit}</strong>
      <strong class="b">${b[key].toFixed(digits)}${unit}</strong>
      ${diff(a[key], b[key], digits)}
    </div>
  `

  box.innerHTML = `
    <div class="day-compare-pick">
      <label class="a"><span>A</span><select data-day-compare="a" aria-label="比べる日 A">${options(dayCompareA)}</select></label>
      <label class="b"><span>B</span><select data-day-compare="b" aria-label="比べる日 B">${options(dayCompareB)}</select></label>
    </div>
    <div class="day-compare-body">
      <div class="day-compare-table">
        <div class="day-compare-row head"><span></span><span class="a">A ${formatDayCompareKey(dayCompareA)}</span><span class="b">B ${formatDayCompareKey(dayCompareB)}</span><span>A − B</span></div>
        <div class="day-compare-row"><span>Games</span><strong class="a">${a.games}</strong><strong class="b">${b.games}</strong><span></span></div>
        ${row("Avg Score", "avgScore", 1)}
        ${row("Avg PPD", "avgPpd", 2)}
        ${row("Best", "best", 0)}
        ${row("Bull Rate", "bullRate", 1, "%")}
        <div class="day-compare-row tags"><span>Tags</span><span class="a">${tags(dayCompareA)}</span><span class="b">${tags(dayCompareB)}</span><span></span></div>
      </div>
      <div class="day-compare-chart-wrap">
        <canvas id="dayCompareChart"></canvas>
        <p class="day-compare-note">その日のゲームのスコア（横軸は何ゲーム目か）</p>
      </div>
    </div>
  `

  if (!dayCompareBound) {
    dayCompareBound = true
    box.addEventListener("change", e => {
      const select = e.target instanceof Element ? e.target.closest("[data-day-compare]") : null
      if (!select) return
      if (select.dataset.dayCompare === "a") dayCompareA = select.value
      else dayCompareB = select.value
      renderDayCompare()
    })
  }

  requestAnimationFrame(() => drawDayCompareChart(groups[dayCompareA], groups[dayCompareB]))
}

function drawDayCompareChart(listA, listB) {
  const canvas = document.getElementById("dayCompareChart")
  if (!canvas || !canvas.offsetWidth) return
  const state = setupHiDPICanvas(canvas, 200)
  if (!state) return
  const { ctx, width, height } = state

  const scoresA = listA.map(s => Number(s.score) || 0)
  const scoresB = listB.map(s => Number(s.score) || 0)
  const length = Math.max(scoresA.length, scoresB.length, 1)
  const pad = getChartPadding()
  const graphWidth = width - pad.left - pad.right
  const graphHeight = height - pad.vertical * 2
  const { minScore, scoreRange } = getScoreAxis(scoresA.concat(scoresB))

  ctx.clearRect(0, 0, width, height)
  ctx.strokeStyle = "rgba(255,255,255,0.08)"
  ctx.lineWidth = 1
  for (let i = 0; i <= 4; i++) {
    const value = minScore + scoreRange / 4 * i
    const y = height - pad.vertical - (value - minScore) / scoreRange * graphHeight
    ctx.beginPath()
    ctx.moveTo(pad.left, y)
    ctx.lineTo(width - pad.right, y)
    ctx.stroke()
    setChartAxisTextStyle(ctx)
    ctx.fillText(Math.round(value), Math.round(pad.left - 2), Math.round(y))
  }

  const stepX = graphWidth / (length - 1 || 1)
  const startX = getChartStartX(pad.left, graphWidth, length)
  const fill = (list, n) => Array.from({ length: n }, (_, i) => i < list.length ? list[i] : null)
  drawLineSeries(ctx, fill(scoresA, length), "#00ffc8", startX, pad.vertical, height, graphHeight, minScore, scoreRange, stepX)
  drawLineSeries(ctx, fill(scoresB, length), "#ff9f43", startX, pad.vertical, height, graphHeight, minScore, scoreRange, stepX)
}

