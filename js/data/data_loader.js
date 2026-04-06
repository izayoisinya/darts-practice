function createRoundChartHtml(rounds) {
  const scores = (rounds || []).map(round =>
    (round || []).reduce((sum, dart) => sum + (dart?.score || 0), 0)
  )
  const n = scores.length
  if (n === 0) return '<svg class="round-line-chart" viewBox="0 0 240 120" preserveAspectRatio="xMidYMid meet"></svg>'

  const svgW = 240, svgH = 120
  const mTop = 16, mRight = 8, mBottom = 20, mLeft = 8
  const chartW = svgW - mLeft - mRight
  const chartH = svgH - mTop - mBottom
  const maxScore = 180
  const xStep = n > 1 ? chartW / (n - 1) : 0

  const pts = scores.map((s, i) => ({
    x: mLeft + i * xStep,
    y: mTop + (1 - s / maxScore) * chartH,
    s
  }))

  const polyPoints = pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const baseY = mTop + chartH
  const areaPoints =
    `${pts[0].x.toFixed(1)},${baseY} ` +
    pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') +
    ` ${pts[n - 1].x.toFixed(1)},${baseY}`

  const gridLines = [60, 120, 180].map(v => {
    const y = (mTop + (1 - v / maxScore) * chartH).toFixed(1)
    return `<line x1="${mLeft}" y1="${y}" x2="${svgW - mRight}" y2="${y}" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>`
  }).join('')

  const valueLabels = pts.map(p =>
    `<text x="${p.x.toFixed(1)}" y="${(p.y - 5).toFixed(1)}" text-anchor="middle" font-size="9" fill="rgba(255,255,255,0.7)">${p.s}</text>`
  ).join('')

  const xLabels = pts.map((p, i) =>
    `<text x="${p.x.toFixed(1)}" y="${svgH - 4}" text-anchor="middle" font-size="9" fill="rgba(255,255,255,0.5)">R${i + 1}</text>`
  ).join('')

  const dots = pts.map(p =>
    `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3" fill="var(--accent)" stroke="#11151c" stroke-width="1.5"/>`
  ).join('')

  return `<svg class="round-line-chart" viewBox="0 0 ${svgW} ${svgH}" preserveAspectRatio="xMidYMid meet">
    ${gridLines}
    <polygon points="${areaPoints}" fill="var(--accent)" fill-opacity="0.15"/>
    <polyline points="${polyPoints}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    ${valueLabels}
    ${xLabels}
    ${dots}
  </svg>`
}

function calculateAwardsFromRounds(rounds) {
  const awards = {
    hatTrick: 0,
    lowTon: 0,
    highTon: 0,
    ton80: 0,
    threeInTheBlack: 0,
    threeInTheBed: 0,
    whiteHorse: 0
  }

  ;(rounds || []).forEach(round => {
    const valid = (round || []).filter(d => d)
    if (valid.length !== 3) return

    const roundScore = valid.reduce((sum, d) => sum + (d.score || 0), 0)
    const allBull = valid.every(d =>
      d.special === "outerBull" || d.special === "innerBull"
    )
    const allInner = valid.every(d => d.special === "innerBull")

    if (allBull) awards.hatTrick++
    if (allInner) awards.threeInTheBlack++

    if (!allBull) {
      if (roundScore === 180) awards.ton80++
      else if (roundScore >= 151 && roundScore <= 177) awards.highTon++
      else if (roundScore >= 100 && roundScore <= 150) awards.lowTon++
    }

    const bedTriples = valid.filter(d =>
      d.multiplier === 3 && d.score >= 45 && d.score <= 60
    )
    if (
      bedTriples.length === 3 &&
      bedTriples[0].score === bedTriples[1].score &&
      bedTriples[1].score === bedTriples[2].score
    ) {
      awards.threeInTheBed++
    }

    const horseTriples = valid.filter(d =>
      d.multiplier === 3 && d.score >= 45 && d.score <= 60
    )
    const horseNumbers = new Set(horseTriples.map(d => d.score))
    if (horseTriples.length === 3 && horseNumbers.size === 3) {
      awards.whiteHorse++
    }
  })

  return awards
}

function getSessionAwards(session) {
  const base = {
    hatTrick: 0,
    lowTon: 0,
    highTon: 0,
    ton80: 0,
    threeInTheBlack: 0,
    threeInTheBed: 0,
    whiteHorse: 0
  }

  if (session && session.awards) {
    return { ...base, ...session.awards }
  }

  return { ...base, ...calculateAwardsFromRounds(session?.rounds || []) }
}

function getSessionTotalAwards(session) {
  if (typeof session?.totalAwards === "number") {
    return session.totalAwards
  }

  return Object.values(getSessionAwards(session))
    .reduce((sum, count) => sum + count, 0)
}

function createAwardsHtml(session) {
  const awards = getSessionAwards(session)
  const awardDefs = [
    ["Hat Trick", awards.hatTrick],
    ["3 in the Black", awards.threeInTheBlack],
    ["Ton 80", awards.ton80],
    ["High Ton", awards.highTon],
    ["Low Ton", awards.lowTon],
    ["3 in the Bed", awards.threeInTheBed],
    ["White Horse", awards.whiteHorse]
  ]

  const activeAwards = awardDefs.filter(([, count]) => count > 0)
  if (!activeAwards.length) {
    return '<div class="session-awards-empty">No Awards</div>'
  }

  return activeAwards
    .map(([label, count]) => `
      <div class="session-award-item">
        <span class="session-award-label">${label}</span>
        <span class="session-award-count">${count}</span>
      </div>
    `)
    .join("")
}

function createSessionCardHtml(session, gameNumber) {
  const t = session.tripleHits || {}
  const roundChartHtml = createRoundChartHtml(session.rounds)
  const awardsHtml = createAwardsHtml(session)
  const tripleHtml = `
    <div class="session-triple-grid">
      <div class="session-triple-item"><span class="session-triple-label">20:</span><span class="session-triple-value">${t[20] ?? 0}</span></div>
      <div class="session-triple-item"><span class="session-triple-label">19:</span><span class="session-triple-value">${t[19] ?? 0}</span></div>
      <div class="session-triple-item"><span class="session-triple-label">18:</span><span class="session-triple-value">${t[18] ?? 0}</span></div>
      <div class="session-triple-item"><span class="session-triple-label">17:</span><span class="session-triple-value">${t[17] ?? 0}</span></div>
      <div class="session-triple-item"><span class="session-triple-label">16:</span><span class="session-triple-value">${t[16] ?? 0}</span></div>
      <div class="session-triple-item"><span class="session-triple-label">15:</span><span class="session-triple-value">${t[15] ?? 0}</span></div>
    </div>
  `

  return `
    <div class="session-card-header">
      <strong>Game ${gameNumber}</strong>
      <span class="session-date">${new Date(session.date).toLocaleString()}</span>
    </div>

    <div class="session-card-body">
      <div class="session-main-block">
        <div class="session-kpi-grid">
          <div class="session-kpi-item">
            <span class="session-kpi-label">Score</span>
            <span class="session-kpi-value">${session.score}</span>
          </div>
          <div class="session-kpi-item">
            <span class="session-kpi-label">PPD</span>
            <span class="session-kpi-value">${session.ppd}</span>
          </div>
          <div class="session-kpi-item">
            <span class="session-kpi-label">Round Avg</span>
            <span class="session-kpi-value">${session.roundAvg ?? "-"}</span>
          </div>
        </div>

        <div class="session-rate-group">
          <div class="stat-row session-stat-row">
            <span class="label">Bull</span>
            <span class="count">${session.bulls ?? 0}</span>
            <div class="bar-bg">
              <div class="bar-fill" style="width:${session.bullRate ?? 0}%"></div>
            </div>
            <span class="percent">${session.bullRate ?? 0}%</span>
          </div>

          <div class="stat-row session-stat-row">
            <span class="label">In</span>
            <span class="count">${session.innerBulls ?? 0}</span>
            <div class="bar-bg">
              <div class="bar-fill inner" style="width:${session.innerRate ?? 0}%"></div>
            </div>
            <span class="percent">${session.innerRate ?? 0}%</span>
          </div>
        </div>

        <div class="session-meta-block session-triple-block">
          <div class="session-meta-title">Triple</div>
          ${tripleHtml}
        </div>
      </div>

      <div class="session-side-block">
        <div class="session-meta-block session-round-block">
          <div class="session-meta-title">Round Scores</div>
          <div class="round-chart">${roundChartHtml}</div>
        </div>
      </div>
    </div>

    <div class="session-meta-block session-awards-block">
      <div class="session-meta-title">Awards</div>
      <div class="session-awards-grid">${awardsHtml}</div>
    </div>
  `
}

function loadSessions() {
  
  const sessions = JSON.parse(
    localStorage.getItem("dartsSessions")
  ) || []
  
  const container = document.getElementById("sessionsContainer")
  container.innerHTML = ""
  
  if (!sessions.length) {
    container.innerHTML = "<p>No data</p>"
    return
  }
  
  const reversed = sessions.slice().reverse()
  
  const start = (currentPage - 1) * PAGE_SIZE
  const end = start + PAGE_SIZE
  
  const pageData = reversed.slice(start, end)
  
  pageData.forEach((s, index) => {
    const div = document.createElement("div")
    div.className = "session-card"
    
    const globalIndex = start + index
    const gameNumber = sessions.length - globalIndex
    div.innerHTML = createSessionCardHtml(s, gameNumber)
    
    container.appendChild(div)
  })
}

function groupSessions(sessions, mode) {
  
  const groups = {}
  
  sessions.forEach(s => {
    
    const date = new Date(s.date)
    
    let key
    
    if (mode === "day") {
      key = getLocalDateKey(date)
    }
    
    if (mode === "week") {
      const day = date.getDay()
      const diff = (day === 0 ? -6 : 1 - day)
      
      const first = new Date(date)
      first.setDate(date.getDate() + diff)
      
      key = getLocalDateKey(first)
    }
    
    if (mode === "month") {
      key = `${date.getFullYear()}-${date.getMonth()+1}`
    }
    
    if (mode === "year") {
      key = `${date.getFullYear()}`
    }
    
    if (!groups[key]) groups[key] = []
    groups[key].push(s)
    
  })
  
  return groups
}

function calcSummary(list) {
  
  const games = list.length
  
  const totalScore = list.reduce((sum, s) => sum + s.score, 0)
  
  const avgScore = totalScore / games
  
  const avgPPD = list.reduce((sum, s) => sum + s.ppd, 0) / games
  
  const totalBulls = list.reduce((sum, s) => sum + (s.bulls || 0), 0)
  const awardCounts = list.reduce((acc, s) => {
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
  
  return {
    games,
    avgPPD: avgPPD.toFixed(2),
    totalBulls,
    avgScore: avgScore.toFixed(1),
    awardCounts
  }
}

function getLocalDateKey(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function getWeekRange(date) {
  
  const d = new Date(date)
  
  const day = d.getDay()
  
  const diffToMonday = (day === 0 ? -6 : 1 - day)
  
  const start = new Date(d)
  start.setDate(d.getDate() + diffToMonday)
  
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  
  return { start, end }
}

function formatShort(date, withYear = true) {
  const m = date.getMonth() + 1
  const d = date.getDate()
  return withYear ?
    `${date.getFullYear()}/${m}/${d}` :
    `${m}/${d}`
}

function renderPagination(total) {
  const totalPages = Math.ceil(total / PAGE_SIZE)
  
  let html = `
    <button onclick="changePage(${currentPage - 1})"
      ${currentPage === 1 ? "disabled" : ""}>
      Prev
    </button>
    <span>${currentPage} / ${totalPages}</span>
    <button onclick="changePage(${currentPage + 1})"
      ${currentPage === totalPages ? "disabled" : ""}>
      Next
    </button>
  `
  
  // footer に入れる
  document.getElementById("paginationContainer").innerHTML = html
}

function changePage(direction) {
  if (detailViewMode && selectedDayData && selectedDayData.gamesList) {
    const totalPages = Math.max(
      1,
      Math.ceil(selectedDayData.gamesList.length / PAGE_SIZE)
    )
    let newPage = detailPageNumber

    if (direction === 'Prev') newPage--
    if (direction === 'Next') newPage++

    if (newPage >= 1 && newPage <= totalPages) {
      changeDetailPage(newPage)
    }
    return
  }

  if (groupedPageMode === 'game') {
    // Game ビュー
    const sessions = JSON.parse(
      localStorage.getItem("dartsSessions")
    ) || []
    const totalPages = Math.ceil(sessions.length / PAGE_SIZE)
    
    if (direction === 'Prev' && currentPage > 1) currentPage--
    if (direction === 'Next' && currentPage < totalPages) currentPage++
    
    loadSessions()
    updatePaginationUI(totalPages)
  } else {
    // Group ビュー
    if (!groupedPageData || groupedPageData.length === 0) return
    
    const totalPages = Math.ceil(groupedPageData.length / PAGE_SIZE)
    let newPage = groupedPageNumber
    
    if (direction === 'Prev') newPage--
    if (direction === 'Next') newPage++
    
    changeGroupedPage(newPage)
  }
}

function updatePaginationUI(totalPages) {
  // ページ情報を更新
  document.getElementById('pageInfo').textContent =
    `${currentPage} / ${totalPages}`
  
  // ボタンの有効/無効を切り替え
  document.getElementById('prevBtn').disabled = currentPage === 1
  document.getElementById('nextBtn').disabled = currentPage === totalPages
}

// グローバル変数の初期化
// ❌ これらを削除（既に定義されている）
// let groupedPageNumber = 1
// let PAGE_SIZE = 10

// ✅ 1回だけ定義する場合はここで
let currentPage = 1
let groupedPageNumber = 1
let groupedPageMode = 'game'
let groupedPageData = []
const PAGE_SIZE = 10 // let ではなく const で1回だけ定義

// ページロード時の初期化
window.addEventListener('DOMContentLoaded', () => {
  initDataPage()
})

function initDataPage() {
  const sessions = JSON.parse(
    localStorage.getItem("dartsSessions")
  ) || []
  
  const totalPages = Math.ceil(sessions.length / PAGE_SIZE)
  
  currentPage = 1
  groupedPageMode = 'game'
  groupedPageData = []
  
  loadSessions()
  updatePaginationUI(totalPages)
}

