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

  const totalScore = game.rounds.reduce((sum, round) =>
    sum + round.reduce((rSum, d) => rSum + (d?.score || 0), 0)
  , 0)

  const totalDarts = game.rounds.flat().filter(d => d).length

  const ppd = totalDarts
    ? (totalScore / totalDarts)
    : 0

  sessions.push({
    date: Date.now(),
    score: totalScore,
    ppd: Number(ppd.toFixed(2)),
    rounds: JSON.parse(JSON.stringify(game.rounds))
  })

  localStorage.setItem(
    "dartsSessions",
    JSON.stringify(sessions)
  )

}