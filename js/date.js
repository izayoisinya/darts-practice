function loadStats() {
  
  const sessions = JSON.parse(
    localStorage.getItem("dartsSessions")
  ) || []
  
  const container = document.getElementById("dataContainer")
  
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
  
  addStat("Games Played", games)
  addStat("Best Game", bestGame)
  addStat("Average PPD", avgPPD)
  
}

function addStat(title, value) {
  
  const row = document.createElement("div")
  
  row.className = "data-card"
  
  row.innerHTML = `
<span class="data-title">${title}</span>
<span class="data-value">${value}</span>
`
  
  document
    .getElementById("dataContainer")
    .appendChild(row)
  
}

loadStats()