let currentPage = 1
const PAGE_SIZE = 10

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
  
  const avgPPD = (
    sessions.reduce((a, b) => a + b.ppd, 0) / games
  ).toFixed(2)
  
  addStat(container, "Games Played", games)
  addStat(container, "Best Game", bestGame)
  addStat(container, "Average PPD", avgPPD)
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
  
  const t = s.tripleHits || {}
  
  const div = document.createElement("div")
  
  div.style.marginBottom = "20px"
  div.style.padding = "10px"
  div.style.border = "1px solid #333"
  
  const globalIndex = start + index
  const gameNumber = sessions.length - globalIndex
  
  const roundsText = s.rounds.map((r, i) => {
    const score = r.reduce((sum, d) => sum + (d?.score || 0), 0)
    return `R${i+1}: ${score}`
  }).join("<br>")
  
  div.innerHTML = `
    <div><strong>Game ${gameNumber}</strong></div>
    
    <div>Score: ${s.score}</div>
    <div>PPD: ${s.ppd}</div>
    <div>Round Avg: ${s.roundAvg ?? "-"}</div>
    
    <div>Bulls: ${s.bulls ?? "-"}</div>
    <div>Inner Bulls: ${s.innerBulls ?? "-"}</div>
    
    <div>Bull Rate: ${s.bullRate ?? "-"}%</div>
    <div>Inner Rate: ${s.innerRate ?? "-"}%</div>
    
    <div>--- Triple ---</div>
    <div>
      T20: ${t[20] ?? 0}
      T19: ${t[19] ?? 0}
      T18: ${t[18] ?? 0}
      T17: ${t[17] ?? 0}
      T16: ${t[16] ?? 0}
      T15: ${t[15] ?? 0}
    </div>
    
    <div style="margin-top:6px">${roundsText}</div>
    
    <div>${new Date(s.date).toLocaleString()}</div>
  `
  
  container.appendChild(div)
})
  
  renderPagination(sessions.length)
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
  
  return {
    games,
    avgPPD: avgPPD.toFixed(2),
    totalBulls,
    avgScore: avgScore.toFixed(1)
  }
}


function renderGrouped(mode) {
  
  const sessions = JSON.parse(
    localStorage.getItem("dartsSessions")
  ) || []
  
  const container = document.getElementById("sessionsContainer")
  container.innerHTML = ""
  
  const groups = groupSessions(sessions, mode)
  
  Object.entries(groups)
    .sort((a, b) => new Date(b[0]) - new Date(a[0]))
    .forEach(([key, list]) => {
      
      const summary = calcSummary(list)
      
      let label = key
      
      if (mode === "week") {
        const { start, end } = getWeekRange(new Date(key))
        label = `${formatShort(start)}〜${formatShort(end, false)}`
      }
      
      if (mode === "month") {
        const [y, m] = key.split("-")
        label = `${y}/${m}`
      }
      
      if (mode === "year") {
        label = `${key}年`
      }
      
      const div = document.createElement("div")
      
      div.innerHTML = `
        <div style="margin-bottom:12px;border:1px solid #333;padding:10px;cursor:pointer;">
          <strong>${label}</strong><br>
          Games: ${summary.games}<br>
          Avg Score: ${summary.avgScore}<br>
          Avg PPD: ${summary.avgPPD}<br>
          Bulls: ${summary.totalBulls}
        </div>
      `
      
      div.querySelector("div").onclick = () => showGameDetails(key, list)
      
      container.appendChild(div)
    })
}


let viewMode = "game" 

function changeView(mode) {
  viewMode = mode
  renderView()
}


function renderView() {
  
  const statsContainer = document.getElementById("statsContainer")
  
  if (viewMode === "game") {
    statsContainer.style.display = "block"
    loadStats(viewMode)
    loadSessions()
  } else {
    statsContainer.style.display = "none"
    renderGroupedPaginated(viewMode) // ← ここを変更
  }
  
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


function renderPagination(total) {
  
  const totalPages = Math.ceil(total / PAGE_SIZE)
  
  let html = `
    <div style="display:flex; gap:10px; margin:20px 0; justify-content:center;">
  `
  
  html += `
    <button onclick="changePage(${currentPage - 1})"
      ${currentPage === 1 ? "disabled" : ""}>
      Prev
    </button>
  `
  
  html += `
    <span>${currentPage} / ${totalPages}</span>
  `
  
  html += `
    <button onclick="changePage(${currentPage + 1})"
      ${currentPage === totalPages ? "disabled" : ""}>
      Next
    </button>
  `
  
  html += `</div>`
  
  document.getElementById("sessionsContainer")
    .insertAdjacentHTML("beforeend", html)
}


function changePage(page) {
  
  const sessions = JSON.parse(
    localStorage.getItem("dartsSessions")
  ) || []
  
  const totalPages = Math.ceil(sessions.length / PAGE_SIZE)
  
  if (page < 1 || page > totalPages) return
  
  currentPage = page
  
  loadSessions()
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


// ============================================
// グループビュー用ページネーション
// ============================================

let groupedPageMode = null // "day", "week", "month", "year"
let groupedPageNumber = 1
let groupedPageData = null

function renderGroupedPaginated(mode) {
  
  const sessions = JSON.parse(
    localStorage.getItem("dartsSessions")
  ) || []
  
  const container = document.getElementById("sessionsContainer")
  container.innerHTML = ""
  
  const groups = groupSessions(sessions, mode)
  const sortedEntries = Object.entries(groups)
    .sort((a, b) => new Date(b[0]) - new Date(a[0]))
  
  groupedPageMode = mode
  groupedPageData = sortedEntries
  groupedPageNumber = 1
  
  displayGroupedPage(mode, sortedEntries)
}

function displayGroupedPage(mode, sortedEntries) {
  
  const container = document.getElementById("sessionsContainer")
  container.innerHTML = ""
  
  const PAGE_SIZE = 10
  const start = (groupedPageNumber - 1) * PAGE_SIZE
  const end = start + PAGE_SIZE
  
  const pageData = sortedEntries.slice(start, end)
  
  // グループカードを表示
  pageData.forEach(([key, list]) => {
    
    const summary = calcSummary(list)
    
    let label = key
    
    if (mode === "week") {
      const { start, end } = getWeekRange(new Date(key))
      label = `${formatShort(start)}〜${formatShort(end, false)}`
    }
    
    if (mode === "month") {
      const [y, m] = key.split("-")
      label = `${y}/${m}`
    }
    
    if (mode === "year") {
      label = `${key}年`
    }
    
    const div = document.createElement("div")
    
    div.innerHTML = `
      <div style="margin-bottom:12px;border:1px solid #333;padding:10px;cursor:pointer;">
        <strong>${label}</strong><br>
        Games: ${summary.games}<br>
        Avg Score: ${summary.avgScore}<br>
        Avg PPD: ${summary.avgPPD}<br>
        Bulls: ${summary.totalBulls}
      </div>
    `
    
    div.querySelector("div").onclick = () => showGameDetails(key, list)
    container.appendChild(div)
  })
  
  // ページネーション表示
  renderGroupedPagination(sortedEntries.length)
}

function renderGroupedPagination(total) {
  
  const PAGE_SIZE = 10
  const totalPages = Math.ceil(total / PAGE_SIZE)
  
  let html = `
    <div style="display:flex; gap:10px; margin:20px 0; justify-content:center;">
  `
  
  html += `
    <button onclick="changeGroupedPage(${groupedPageNumber - 1})"
      ${groupedPageNumber === 1 ? "disabled" : ""}>
      Prev
    </button>
  `
  
  html += `
    <span>${groupedPageNumber} / ${totalPages}</span>
  `
  
  html += `
    <button onclick="changeGroupedPage(${groupedPageNumber + 1})"
      ${groupedPageNumber === totalPages ? "disabled" : ""}>
      Next
    </button>
  `
  
  html += `</div>`
  
  document.getElementById("sessionsContainer")
    .insertAdjacentHTML("beforeend", html)
}

function changeGroupedPage(page) {
  
  const PAGE_SIZE = 10
  const totalPages = Math.ceil(groupedPageData.length / PAGE_SIZE)
  
  if (page < 1 || page > totalPages) return
  
  groupedPageNumber = page
  displayGroupedPage(groupedPageMode, groupedPageData)
}

// ============================================
// Day詳細ビュー用ページネーション
// ============================================

let detailViewMode = false
let selectedDayData = null
let detailPageNumber = 1

function showGameDetails(dateKey, gamesList) {
  detailViewMode = true
  selectedDayData = { dateKey, gamesList }
  detailPageNumber = 1
  
  displayDetailPage()
}

function displayDetailPage() {
  
  const container = document.getElementById("sessionsContainer")
  container.innerHTML = ""
  
  const PAGE_SIZE = 10
  const start = (detailPageNumber - 1) * PAGE_SIZE
  const end = start + PAGE_SIZE
  
  const pageData = selectedDayData.gamesList.slice(start, end)
  
  // 戻るボタン
  const backBtn = document.createElement("button")
  backBtn.textContent = "← 戻る"
  backBtn.onclick = backToSummary
  backBtn.style.marginBottom = "16px"
  backBtn.style.padding = "8px 16px"
  container.appendChild(backBtn)
  
  // 日付タイトル
  const title = document.createElement("h3")
  title.textContent = selectedDayData.dateKey
  title.style.marginTop = "16px"
  container.appendChild(title)
  
  // ゲーム一覧
  pageData.forEach((game, idx) => {
    const gameDiv = document.createElement("div")
    const t = game.tripleHits || {}
    
    gameDiv.style.marginBottom = "20px"
    gameDiv.style.padding = "10px"
    gameDiv.style.border = "1px solid #333"
    gameDiv.style.borderRadius = "8px"
    
    gameDiv.innerHTML = `
      <div><strong>ゲーム ${idx + 1}</strong></div>
      <div>Score: ${game.score}</div>
      <div>PPD: ${game.ppd}</div>
      <div>Bulls: ${game.bulls ?? "-"}</div>
      <div>Inner Bulls: ${game.innerBulls ?? "-"}</div>
      <div>T20: ${t[20] ?? 0} / T19: ${t[19] ?? 0} / T18: ${t[18] ?? 0}</div>
    `
    container.appendChild(gameDiv)
  })
  
  // ページネーション
  renderDetailPagination(selectedDayData.gamesList.length)
}

function renderDetailPagination(total) {
  
  const PAGE_SIZE = 10
  const totalPages = Math.ceil(total / PAGE_SIZE)
  
  let html = `
    <div style="display:flex; gap:10px; margin:20px 0; justify-content:center;">
  `
  
  html += `
    <button onclick="changeDetailPage(${detailPageNumber - 1})"
      ${detailPageNumber === 1 ? "disabled" : ""}>
      Prev
    </button>
  `
  
  html += `
    <span>${detailPageNumber} / ${totalPages}</span>
  `
  
  html += `
    <button onclick="changeDetailPage(${detailPageNumber + 1})"
      ${detailPageNumber === totalPages ? "disabled" : ""}>
      Next
    </button>
  `
  
  html += `</div>`
  
  document.getElementById("sessionsContainer")
    .insertAdjacentHTML("beforeend", html)
}

function changeDetailPage(page) {
  
  const PAGE_SIZE = 10
  const totalPages = Math.ceil(selectedDayData.gamesList.length / PAGE_SIZE)
  
  if (page < 1 || page > totalPages) return
  
  detailPageNumber = page
  displayDetailPage()
}

function backToSummary() {
  detailViewMode = false
  selectedDayData = null
  renderView()
}