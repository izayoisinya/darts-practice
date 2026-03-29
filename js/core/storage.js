const SAVE_KEY = "dartsPractice"

function saveGame() {
  
  const data = {
    gameType: "countup",
    rounds: game.rounds,
    currentRound: game.currentRound,
    currentDart: game.currentDart,
    lockedRound: lockedRound
  }
  
  localStorage.setItem(SAVE_KEY, JSON.stringify(data))
  
}


function loadGame() {
  
  const data = localStorage.getItem(SAVE_KEY)
  if (!data) return false
  
  const saved = JSON.parse(data)
  
  game.rounds = saved.rounds
  game.currentRound = saved.currentRound
  game.currentDart = saved.currentDart
  lockedRound = saved.lockedRound ?? -1
  
  return true
}


function saveSession() {
  
  const sessions = JSON.parse(
    localStorage.getItem("dartsSessions")
  ) || []
  
  const darts = game.rounds.flat().filter(d => d)
  
  const totalScore = darts.reduce((sum, d) => sum + d.score, 0)
  const totalDarts = darts.length
  
  const ppd = totalDarts ? (totalScore / totalDarts) : 0
  
  // ===== Bulls =====
  const bulls = darts.filter(d =>
    d.special === "innerBull" || d.special === "outerBull"
  ).length
  
  const innerBulls = darts.filter(d =>
    d.special === "innerBull"
  ).length
  
  // ===== Triple =====
  const tripleHits = {}
  for (let i = 15; i <= 20; i++) {
    tripleHits[i] = darts.filter(d =>
      d.value === i && d.multiplier === 3
    ).length
  }
  
  // ===== Round Avg =====
  const roundScores = game.rounds.map(round =>
    round.reduce((sum, d) => sum + (d?.score || 0), 0)
  )
  
  const validRounds = roundScores.filter(s => s > 0)
  
  const roundAvg = validRounds.length ?
    validRounds.reduce((a, b) => a + b, 0) / validRounds.length :
    0
  
  // ===== Bull Rate =====
  const bullRate = totalDarts ?
    (bulls / totalDarts) * 100 :
    0
    
  // ===== Inner Rate =====
  const innerRate = totalDarts ?
    (innerBulls / totalDarts) * 100 :
    0
  
  sessions.push({
  date: Date.now(),
  score: totalScore,
  ppd: Number(ppd.toFixed(2)),
  
  bulls,
  innerBulls,
  
  bullRate: Number(bullRate.toFixed(1)),
  innerRate: Number(innerRate.toFixed(1)), // ←追加
  
  roundAvg: Number(roundAvg.toFixed(1)),
  
  tripleHits,

  rounds: JSON.parse(JSON.stringify(game.rounds))
  })
  
  localStorage.setItem(
    "dartsSessions",
    JSON.stringify(sessions)
  )
}