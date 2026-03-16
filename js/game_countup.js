function initGame(load = true) {

  // ===== Settings読み込み =====
  const settings = JSON.parse(
    localStorage.getItem("dartsSettings")
  ) || {}

  if (settings.bullMode) {
    bullMode = settings.bullMode
  }

  if (load && loadGame()) {
    // セーブデータ読み込み成功
  } else {

    game.currentRound = 0
    game.currentDart = 0
    lockedRound = -1

    game.rounds = Array.from(
      { length: TOTAL_ROUNDS },
      () => [null, null, null]
    )

  }

  createNumberTable()

  renderRounds()
  updateStats()
  drawScoreChart()
  updateNextGameButton()
  
  updateBullModeUI()

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

