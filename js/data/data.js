let viewMode = "game"
let rangeChartWired = false
let dataPanelMode = "history"
let dataPanelSwipeBound = false
let panelTouchStartX = 0
let panelTouchStartY = 0
let panelSwipeBlockedByTabs = false
const chartAxisFontFamily = "'Segoe UI', 'Noto Sans JP', sans-serif"

function isPhonePortraitDataView() {
  return body.classList.contains("phone") && body.classList.contains("portrait")
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
    panelTouchStartX = e.touches[0].clientX
    panelTouchStartY = e.touches[0].clientY
  }, { passive: true })

  container.addEventListener("touchend", e => {
    if (!isPhonePortraitDataView()) return
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

function updateViewTabs(mode) {
  document.querySelectorAll(".tabs-container button").forEach(btn => {
    const isActive = btn.dataset.view === mode
    btn.classList.toggle("active", isActive)
    btn.setAttribute("aria-pressed", isActive ? "true" : "false")
  })
}

function changeView(mode) {
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

  // phone portrait: group表示時はHistoryパネルへ自動切り替え
  if (mode !== "game" && body.classList.contains("phone") && body.classList.contains("portrait")) {
    setDataPanel("history")
  }

  const statsSection = document.getElementById("statsSection")
  const awardsSection = document.getElementById("awardsSection")
  const chartContainer = document.getElementById("chartContainer")
  const calendarContainer = document.getElementById("calendarContainer")
  if (calendarContainer) {
    calendarContainer.style.display = "none"
    calendarContainer.innerHTML = ""
  }

  if (mode === 'game') {
    // Game ビューに戻す
    statsSection.style.display = "flex"
    awardsSection.style.display = "flex"
    chartContainer.style.display = "block"
    currentPage = 1
    groupedPageMode = 'game'
    
    const sessions = JSON.parse(
      localStorage.getItem("dartsSessions")
    ) || []
    
    const totalPages = Math.ceil(sessions.length / PAGE_SIZE)
    
    loadStats()
    loadSessions()
    updatePaginationUI(totalPages)
    setRangeChartSectionVisible(true)
    drawGameScoresChart()
  } else {
    // Group ビュー（Day/Week/Month/Year）
    statsSection.style.display = "none"
    awardsSection.style.display = "none"
    chartContainer.style.display = "none"
    setRangeChartSectionVisible(false)
    displayGroupView(mode)
    window.scrollTo(0, 0)
  }
}

function renderView() {
  setupDataPanelSwipe()
  hideDetailBullRate()
  if (typeof setDataDetailViewClass === "function") {
    setDataDetailViewClass(false)
  }
  updateViewTabs(viewMode)
  
  const statsSection = document.getElementById("statsSection")
  const awardsSection = document.getElementById("awardsSection")
  const chartContainer = document.getElementById("chartContainer")
  const calendarContainer = document.getElementById("calendarContainer")
  if (calendarContainer) {
    calendarContainer.style.display = "none"
    calendarContainer.innerHTML = ""
  }
  
  if (viewMode === "game") {
    statsSection.style.display = "flex"
    awardsSection.style.display = "flex"
    chartContainer.style.display = "block"
    setRangeChartSectionVisible(true)
    loadStats(viewMode)
    loadSessions()
    drawGameScoresChart()
  } else {
    statsSection.style.display = "none"
    awardsSection.style.display = "none"
    chartContainer.style.display = "none"
    setRangeChartSectionVisible(false)
    renderGroupedPaginated(viewMode)
  }
  
}

function loadStats() {
  
  const sessions = JSON.parse(
    localStorage.getItem("dartsSessions")
  ) || []
  
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

document.addEventListener("DOMContentLoaded", () => {
  renderView()
})

function generateTestData(days = 60) {
  
  const sessions = []
  
  const now = new Date()
  
  for (let i = days - 1; i >= 0; i--) {
    
    const date = new Date(now)
    date.setDate(now.getDate() - i)
    
    const gamesPerDay = Math.floor(Math.random() * 3) + 1
    
    for (let g = 0; g < gamesPerDay; g++) {
      
      const score = Math.floor(Math.random() * 600) + 600
      const darts = 24
      
      const ppd = score / darts
      
      const bulls = Math.floor(Math.random() * 10)
      const innerBulls = Math.floor(bulls * Math.random())
      
      const tripleHits = {}
      
      for (let n = 15; n <= 20; n++) {
        tripleHits[n] = Math.floor(Math.random() * 5)
      }
      
      sessions.push({
        date: date.getTime(),
        
        score,
        ppd: Number(ppd.toFixed(2)),
        
        bulls,
        innerBulls,
        
        bullRate: Number(((bulls / darts) * 100).toFixed(1)),
        innerRate: bulls ?
          Number(((innerBulls / darts) * 100).toFixed(1)) :
          0,
        
        roundAvg: Number((score / 8).toFixed(1)),
        
        tripleHits,

        awards: {
          hatTrick: 0,
          lowTon: 0,
          highTon: 0,
          ton80: 0,
          threeInTheBlack: 0,
          threeInTheBed: 0,
          whiteHorse: 0
        },

        totalAwards: 0,
        
        rounds: Array.from({ length: 8 }, () => [
          { score: 20 },
          { score: 20 },
          { score: 20 }
        ])
      })
      
    }
  }
  
  localStorage.setItem("dartsSessions", JSON.stringify(sessions))
  
  console.log("テストデータ生成完了:", sessions.length)
}

function drawGameScoresChart() {
  const canvas = document.getElementById("scoreChart")
  if (!canvas) return
  hideDetailBullRate()

  const canvasState = setupHiDPICanvas(canvas, 220)
  if (!canvasState) {
    setTimeout(() => drawGameScoresChart(), 100)
    return
  }
  const { ctx, width, height } = canvasState

  ctx.clearRect(0, 0, width, height)
  
  const sessions = JSON.parse(
    localStorage.getItem("dartsSessions")
  ) || []
  
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
  
  // スコアの最小値と最大値
  const minScore = Math.min(...scores)
  const maxScore = Math.max(...scores)
  const scoreRange = maxScore - minScore || 1
  
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
  
  ctx.beginPath()
    ctx.lineWidth = 1.5
  ctx.strokeStyle = "#4CAF50"
  
  scores.forEach((score, i) => {
    const x = padding + stepX * i
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
    const x = padding + stepX * i
    const y = height - verticalPadding - ((score - minScore) / scoreRange) * graphHeight
    
    ctx.beginPath()
      ctx.arc(x, y, 2, 0, Math.PI * 2)
    ctx.fillStyle = "#4CAF50"
    ctx.fill()
  })

  drawSelectedRangeChart()
}

function drawDetailGroupChart(gamesList, compareGamesList = null, baseLabel = "", compareLabel = "") {
  const canvas = document.getElementById("scoreChart")
  const detailLegend = document.getElementById("detailCompareLegend")
  const safeGamesList = Array.isArray(gamesList) ? gamesList.filter(Boolean) : []
  const safeCompareGamesList = Array.isArray(compareGamesList)
    ? compareGamesList.filter(Boolean)
    : []

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
    setTimeout(() => {
      drawDetailGroupChart(gamesList, compareGamesList, baseLabel, compareLabel)
    }, 100)
    return
  }
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
  
  // スコアの最小値と最大値
  const validScores = [...scores, ...compareScores].filter(v => v !== null)
  const minScore = Math.min(...validScores)
  const maxScore = Math.max(...validScores)
  const scoreRange = maxScore - minScore || 1
  
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
  drawLineSeries(ctx, scores, "#4CAF50", padding, verticalPadding, height, graphHeight, minScore, scoreRange, stepX)
  if (hasCompare) {
    drawLineSeries(ctx, compareScores, "#4da3ff", padding, verticalPadding, height, graphHeight, minScore, scoreRange, stepX)
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
  if (viewMode !== "game") return

  wireRangeChartControls()

  const canvas = document.getElementById("rangeScoreChart")
  const startInput = document.getElementById("rangeStartDate")
  const endInput = document.getElementById("rangeEndDate")
  const compareStartInput = document.getElementById("compareStartDate")
  const compareEndInput = document.getElementById("compareEndDate")
  const legend = document.getElementById("rangeChartLegend")
  if (!canvas || !startInput || !endInput || !compareStartInput || !compareEndInput) return

  const sessions = JSON.parse(localStorage.getItem("dartsSessions")) || []
  ensureRangeDefaults(sessions)

  const canvasState = setupHiDPICanvas(canvas, 220)
  if (!canvasState) {
    setTimeout(() => drawSelectedRangeChart(), 100)
    return
  }
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
  const minScore = Math.min(...allScores)
  const maxScore = Math.max(...allScores)
  const scoreRange = maxScore - minScore || 1

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
  const labels = buildDateLabels(startDate || compareStartDate, length)
  const labelStep = Math.max(1, Math.ceil(length / 6))
  ctx.fillStyle = "rgba(255,255,255,0.56)"
  ctx.font = `600 9px ${chartAxisFontFamily}`
  ctx.textAlign = "center"
  ctx.textBaseline = "alphabetic"
  labels.forEach((label, i) => {
    if (i % labelStep !== 0 && i !== labels.length - 1) return
    const x = padding + stepX * i
    ctx.fillText(label, x, height - 8)
  })

  drawLineSeries(ctx, seriesA, "#7bc96f", padding, verticalPadding, height, graphHeight, minScore, scoreRange, stepX)
  drawLineSeries(ctx, seriesB, "#4da3ff", padding, verticalPadding, height, graphHeight, minScore, scoreRange, stepX)

  if (legend) {
    legend.innerHTML = `
      <span class="range-chart-legend-item"><span class="range-chart-legend-swatch a"></span>A: ${startInput.value} - ${endInput.value}</span>
      <span class="range-chart-legend-item"><span class="range-chart-legend-swatch b"></span>B: ${compareStartInput.value} - ${compareEndInput.value}</span>
    `
    legend.style.display = "flex"
  }
}

window.addEventListener("DOMContentLoaded", setupDataPanelSwipe)