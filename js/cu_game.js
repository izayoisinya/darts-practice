

function initGame() {

  game.rounds = Array.from(
    { length: TOTAL_ROUNDS },
    () => [null, null, null]
  )

  loadGame()

  createNumberTable()
  setupTopButtons()

  renderRounds()
  updateStats()
  drawScoreChart()
  updateNextGameButton()

}

// ===============================
// ===== ダーツ追加 ==============
// ===============================
function addDart(value, multiplier, special = null) {
  
  if (game.currentRound >= TOTAL_ROUNDS) return
  
  if (game.currentDart === 0 && game.currentRound > lockedRound + 1) {
    lockedRound = game.currentRound - 1
  }
  
  const score = value * multiplier
  
  game.rounds[game.currentRound][game.currentDart] = {
    value,
    multiplier,
    score,
    special
  }
  
  game.currentDart++
  
  if (game.currentDart === 3) {
    game.currentDart = 0
    game.currentRound++
  }
  
  updateUI()
  
}










