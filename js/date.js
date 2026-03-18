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


function loadSessions() {
  
  const sessions = JSON.parse(
    localStorage.getItem("dartsSessions")
  ) || []
  
  const container = document.getElementById("dataContainer")
  
  container.innerHTML = ""
  
  if (!sessions.length) {
    container.innerHTML = "<p>No data</p>"
    return
  }
  
  // 新しい順
  sessions.slice().reverse().forEach((s, index) => {
    
    const div = document.createElement("div")
    
    div.style.marginBottom = "20px"
    div.style.padding = "10px"
    div.style.border = "1px solid #333"
    
    div.innerHTML = `

    <div>Game ${sessions.length - index}</div>

    <div>Score: ${s.score}</div>
    <div>PPD: ${s.ppd}</div>
    <div>Date: ${new Date(s.date).toLocaleString()}</div>

    <div>Rounds:</div>
    <pre>${JSON.stringify(s.rounds, null, 2)}</pre>

  `
    
    container.appendChild(div)
    
  })
  
}

loadSessions()