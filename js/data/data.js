let viewMode = "game" 
let rangeChartWired = false

function changeView(mode) {
  viewMode = mode
  detailViewMode = false
  selectedDayData = null
  detailPageNumber = 1
  
  const statsContainer = document.getElementById("statsContainer")
  const chartContainer = document.getElementById("chartContainer")
  const calendarContainer = document.getElementById("calendarContainer")
  if (calendarContainer) {
    calendarContainer.style.display = "none"
    calendarContainer.innerHTML = ""
  }

  if (mode === 'game') {
    // Game ビューに戻す
    statsContainer.style.display = "flex"
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
    statsContainer.style.display = "none"
    chartContainer.style.display = "none"
    setRangeChartSectionVisible(false)
    displayGroupView(mode)
    window.scrollTo(0, 0)
  }
}

function renderView() {
  
  const statsContainer = document.getElementById("statsContainer")
  const chartContainer = document.getElementById("chartContainer")
  const calendarContainer = document.getElementById("calendarContainer")
  if (calendarContainer) {
    calendarContainer.style.display = "none"
    calendarContainer.innerHTML = ""
  }
  
  if (viewMode === "game") {
    statsContainer.style.display = "flex"
    chartContainer.style.display = "block"
    setRangeChartSectionVisible(true)
    loadStats(viewMode)
    loadSessions()
    drawGameScoresChart()
  } else {
    statsContainer.style.display = "none"
    chartContainer.style.display = "none"
    setRangeChartSectionVisible(false)
    renderGroupedPaginated(viewMode)
  }
  
}

function loadStats() {
  
  const sessions = JSON.parse(
    localStorage.getItem("dartsSessions")
  ) || []
  
  const container = document.getElementById("statsContainer")
  container.innerHTML = ""
  
  if (!sessions.length) {
    container.innerHTML = "<p>No data yet</p>"
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
  
  addStat(container, "Games Played", games)
  addStat(container, "Best Game", bestGame)
  addStat(container, "Average PPD", avgPPD)
  addStat(container, "Total Bulls", totalBulls)
  addStat(container, "Hat Trick", awardCounts.hatTrick)
  addStat(container, "3 in Black", awardCounts.threeInTheBlack)
  addStat(container, "Ton 80", awardCounts.ton80)
  addStat(container, "High Ton", awardCounts.highTon)
  addStat(container, "Low Ton", awardCounts.lowTon)
  addStat(container, "3 in Bed", awardCounts.threeInTheBed)
  addStat(container, "White Horse", awardCounts.whiteHorse)
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
          Number(((innerBulls / bulls) * 100).toFixed(1)) :
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
  
  const sessions = JSON.parse(
    localStorage.getItem("dartsSessions")
  ) || []
  
  if (sessions.length === 0) {
    const ctx = canvas.getContext("2d")
    ctx.fillStyle = "rgba(255,255,255,0.3)"
    ctx.fillText("No data", 10, 20)
    return
  }
  
  // 直近30試合を取得（古い→新しい）
  const last30 = sessions.slice(-30)
  const scores = last30.map(s => s.score)
  
  // Canvas のサイズを取得
  if (!canvas.offsetWidth || !canvas.offsetHeight) {
    setTimeout(() => drawGameScoresChart(), 100)
    return
  }
  
  const width = canvas.width = canvas.offsetWidth
  const height = canvas.height = canvas.offsetHeight || 220
  
  const padding = 45
  const graphWidth = width - padding * 2
  const graphHeight = height - padding * 2
  
  const ctx = canvas.getContext("2d")
  
  // 背景をクリア
  ctx.clearRect(0, 0, width, height)
  
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
    const y = height - padding - (value - minScore) / scoreRange * graphHeight
    
    ctx.beginPath()
    ctx.moveTo(padding, y)
    ctx.lineTo(width - padding, y)
    ctx.stroke()
    
    ctx.fillStyle = "rgba(255,255,255,0.4)"
    ctx.font = "12px sans-serif"
    ctx.textAlign = "right"
    ctx.fillText(Math.round(value), padding - 5, y + 4)
  }
  
  // 折れ線
  const stepX = graphWidth / (scores.length - 1 || 1)
  
  ctx.beginPath()
  ctx.lineWidth = 2
  ctx.strokeStyle = "#4CAF50"
  
  scores.forEach((score, i) => {
    const x = padding + stepX * i
    const y = height - padding - ((score - minScore) / scoreRange) * graphHeight
    
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
    const y = height - padding - ((score - minScore) / scoreRange) * graphHeight
    
    ctx.beginPath()
    ctx.arc(x, y, 3, 0, Math.PI * 2)
    ctx.fillStyle = "#4CAF50"
    ctx.fill()
  })

  drawSelectedRangeChart()
}

function drawDetailGroupChart(gamesList) {
  const canvas = document.getElementById("scoreChart")
  if (!canvas || !gamesList || gamesList.length === 0) return
  setRangeChartSectionVisible(false)
  
  // Canvas のサイズを取得
  if (!canvas.offsetWidth || !canvas.offsetHeight) {
    setTimeout(() => drawDetailGroupChart(gamesList), 100)
    return
  }
  
  const scores = gamesList.map(s => s.score)
  
  const width = canvas.width = canvas.offsetWidth
  const height = canvas.height = canvas.offsetHeight || 220
  
  const padding = 45
  const graphWidth = width - padding * 2
  const graphHeight = height - padding * 2
  
  const ctx = canvas.getContext("2d")
  
  // 背景をクリア
  ctx.clearRect(0, 0, width, height)
  
  // スコアの最小値と最大値
  const minScore = Math.min(...scores)
  const maxScore = Math.max(...scores)
  const scoreRange = maxScore - minScore || 1
  
  // 横グリッド
  ctx.strokeStyle = "rgba(255,255,255,0.08)"
  ctx.lineWidth = 1
  
  const gridSteps = 4
  for (let i = 0; i <= gridSteps; i++) {
    const value = minScore + (scoreRange / gridSteps) * i
    const y = height - padding - (value - minScore) / scoreRange * graphHeight
    
    ctx.beginPath()
    ctx.moveTo(padding, y)
    ctx.lineTo(width - padding, y)
    ctx.stroke()
    
    ctx.fillStyle = "rgba(255,255,255,0.4)"
    ctx.font = "12px sans-serif"
    ctx.textAlign = "right"
    ctx.fillText(Math.round(value), padding - 5, y + 4)
  }
  
  // 折れ線
  const stepX = graphWidth / (scores.length - 1 || 1)
  
  ctx.beginPath()
  ctx.lineWidth = 2
  ctx.strokeStyle = "#4CAF50"
  
  scores.forEach((score, i) => {
    const x = padding + stepX * i
    const y = height - padding - ((score - minScore) / scoreRange) * graphHeight
    
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
    const y = height - padding - ((score - minScore) / scoreRange) * graphHeight
    
    ctx.beginPath()
    ctx.arc(x, y, 3, 0, Math.PI * 2)
    ctx.fillStyle = "#4CAF50"
    ctx.fill()
  })
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
  const applyBtn = document.getElementById("rangeApplyBtn")
  if (!startInput || !endInput || !applyBtn) return

  applyBtn.onclick = drawSelectedRangeChart
  startInput.onchange = drawSelectedRangeChart
  endInput.onchange = drawSelectedRangeChart

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
  if (!startInput || !endInput || !sessions.length) return

  const sorted = sessions
    .filter(s => !Number.isNaN(new Date(s.date).getTime()))
    .sort((a, b) => new Date(a.date) - new Date(b.date))

  if (!sorted.length) return

  const last30 = sorted.slice(-30)
  const defaultStart = new Date(last30[0].date)
  const defaultEnd = new Date(last30[last30.length - 1].date)

  if (!startInput.value) startInput.value = formatDateInput(defaultStart)
  if (!endInput.value) endInput.value = formatDateInput(defaultEnd)
}

function drawSelectedRangeChart() {
  if (viewMode !== "game") return

  wireRangeChartControls()

  const canvas = document.getElementById("rangeScoreChart")
  const startInput = document.getElementById("rangeStartDate")
  const endInput = document.getElementById("rangeEndDate")
  if (!canvas || !startInput || !endInput) return

  const sessions = JSON.parse(localStorage.getItem("dartsSessions")) || []
  ensureRangeDefaults(sessions)

  if (!canvas.offsetWidth || !canvas.offsetHeight) {
    setTimeout(() => drawSelectedRangeChart(), 100)
    return
  }

  const ctx = canvas.getContext("2d")
  const width = canvas.width = canvas.offsetWidth
  const height = canvas.height = canvas.offsetHeight || 220
  ctx.clearRect(0, 0, width, height)

  const startDate = startInput.value ? new Date(`${startInput.value}T00:00:00`) : null
  const endDate = endInput.value ? new Date(`${endInput.value}T23:59:59`) : null

  let filtered = sessions.filter(s => {
    const d = new Date(s.date)
    if (Number.isNaN(d.getTime())) return false
    if (startDate && d < startDate) return false
    if (endDate && d > endDate) return false
    return true
  }).sort((a, b) => new Date(a.date) - new Date(b.date))

  const scores = filtered.map(s => s.score)
  if (!scores.length) {
    ctx.fillStyle = "rgba(255,255,255,0.4)"
    ctx.font = "12px sans-serif"
    ctx.fillText("No data in selected range", 12, 20)
    return
  }

  const padding = 45
  const graphWidth = width - padding * 2
  const graphHeight = height - padding * 2
  const minScore = Math.min(...scores)
  const maxScore = Math.max(...scores)
  const scoreRange = maxScore - minScore || 1

  ctx.strokeStyle = "rgba(255,255,255,0.08)"
  ctx.lineWidth = 1
  const gridSteps = 4
  for (let i = 0; i <= gridSteps; i++) {
    const value = minScore + (scoreRange / gridSteps) * i
    const y = height - padding - (value - minScore) / scoreRange * graphHeight
    ctx.beginPath()
    ctx.moveTo(padding, y)
    ctx.lineTo(width - padding, y)
    ctx.stroke()

    ctx.fillStyle = "rgba(255,255,255,0.4)"
    ctx.font = "12px sans-serif"
    ctx.textAlign = "right"
    ctx.fillText(Math.round(value), padding - 5, y + 4)
  }

  const stepX = graphWidth / (scores.length - 1 || 1)
  ctx.beginPath()
  ctx.lineWidth = 2
  ctx.strokeStyle = "#7bc96f"
  scores.forEach((score, i) => {
    const x = padding + stepX * i
    const y = height - padding - ((score - minScore) / scoreRange) * graphHeight
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  })
  ctx.stroke()

  scores.forEach((score, i) => {
    const x = padding + stepX * i
    const y = height - padding - ((score - minScore) / scoreRange) * graphHeight
    ctx.beginPath()
    ctx.arc(x, y, 3, 0, Math.PI * 2)
    ctx.fillStyle = "#7bc96f"
    ctx.fill()
  })
}