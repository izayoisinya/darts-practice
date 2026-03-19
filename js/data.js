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
  
  const bestGame = Math.max(
    ...sessions.map(s => s.score)
  )
  
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
  
  const MAX_DISPLAY = 30
  
  const reversed = sessions
    .slice()
    .reverse()
    .slice(0, MAX_DISPLAY)
  
  reversed.forEach((s, index) => {
    
    const t = s.tripleHits || {}

    const div = document.createElement("div")
    
    div.style.marginBottom = "20px"
    div.style.padding = "10px"
    div.style.border = "1px solid #333"
    
    const gameNumber = sessions.length - index
    
    const roundsText = s.rounds.map((r, i) => {
      const score = r.reduce((sum, d) => sum + (d?.score || 0), 0)
      return `R${i+1}: ${score}`
    }).join("<br>")
    
    const bullRate = s.bulls && s.rounds ?
    ((s.bulls / s.rounds.flat().filter(d => d).length) * 100).toFixed(1) :
    "-"
    
    const tripleText = [20, 19, 18, 17, 16, 15]
      .map(n => `T${n}: ${t[n] ?? 0}`)
      .join(" ")
    
    div.innerHTML = `
      <div><strong>Game ${gameNumber}</strong></div>
      
      <div>Score: ${s.score}</div>
      <div>PPD: ${s.ppd}</div>
      <div>Round Avg: ${s.roundAvg ?? "-"}</div>
      
      <div>Bulls: ${s.bulls ?? "-"}</div>
      <div>Inner Bulls: ${s.innerBulls ?? "-"}</div>
      
      <div>Bull Rate: ${ s.bullRate ?? "-" }</div>
      <div>Inner Rate: ${s.innerRate ?? "-"}%</div>
      
      <div>--- Triple ---</div> 
      <div>${tripleText}</div>
      
      <div style="margin-top:6px">${roundsText}</div>
      
      <div>${new Date(s.date).toLocaleString()}</div>

    `
    
    container.appendChild(div)
    
  })
  
}



document.addEventListener("DOMContentLoaded", () => {
  loadStats()
  loadSessions()
})