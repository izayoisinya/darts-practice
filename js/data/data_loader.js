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