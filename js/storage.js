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