function initGame(load = true) {

  // ===== Settings読み込み =====
  const settings = JSON.parse(
    localStorage.getItem("dartsSettings")
  ) || {}

  if (settings.bullMode) {
    bullMode = settings.bullMode
  }

  inputMode = settings.inputMode === "board" ? "board" : "buttons"
  boardZoomReset = settings.boardZoomReset === "round" ? "round" : "manual"
  undoSwipeDirection = settings.undoSwipeDirection === "right" ? "right" : "left"

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
  renderHeaderRound()
  updateStats()
  drawScoreChart()
  updateNextGameButton()
  
  updateBullModeUI()

}

// ===============================
// ===== ダーツ追加 ==============
// ===============================
// ボード形式で入力したときは、タップした位置も 1 投に持たせる（どちらも { x, y }。ボードの中心が原点、ダブルの外側 = 1）
//   boardTap：本物より太く描いた輪の上での位置。ボード上の印の表示に使う（ゲーム履歴には保存しない）
//   pos     ：本物のボードの比率に直した位置。ゲーム履歴に保存して、刺さった位置の分析に使う
function addDart(value, multiplier, special = null, boardTap = null, pos = null) {
  
  if (game.currentRound >= TOTAL_ROUNDS) return
  
  if (game.currentDart === 0 && game.currentRound > lockedRound + 1) {
    lockedRound = game.currentRound - 1
  }
  
  const score = value * multiplier
  
  const dart = {
    value,
    multiplier,
    score,
    special
  }

  if (boardTap) {
    dart.boardTap = boardTap
  }

  if (pos) {
    dart.pos = pos
  }

  game.rounds[game.currentRound][game.currentDart] = dart
  
  game.currentDart++
  
  if (game.currentDart === 3) {
    game.currentDart = 0
    game.currentRound++
  }
  
  updateUI()
  
}

