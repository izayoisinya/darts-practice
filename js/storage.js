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
  
  const saved = localStorage.getItem(SAVE_KEY)
  
  if (!saved) return
  
  let data
  
  try {
    data = JSON.parse(saved)
  } catch {
    return
  }
  
  game.rounds = data.rounds
  game.currentRound = data.currentRound
  game.currentDart = data.currentDart
  lockedRound = data.lockedRound ?? -1
  
}