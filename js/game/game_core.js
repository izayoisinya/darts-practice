function updateNextGameButton() {
  
  const btn = document.getElementById("nextGameBtn")
  if (!btn) return
  
  btn.disabled = !isGameComplete()
  
}


function nextGame() {
  
  if (!isGameComplete()) return
  
  saveSession()
  
  localStorage.removeItem(SAVE_KEY)
  
  initGame(false)
  
  updateUI() // ←保険
  
}


function undoDart() {
  
  if (game.currentRound === 0 && game.currentDart === 0) return
  
  if (game.currentRound - 1 <= lockedRound && game.currentDart === 0) return

  // 01：バスト・上がりのラウンドは 3 本そろっていないので、そのラウンドの最後に入れた 1 投を消す
  if (GAME_TYPE === "01") {
    const index = game.currentDart > 0 ? game.currentRound : game.currentRound - 1
    const round = game.rounds[index]
    const last = round ? round.map(dart => dart !== null).lastIndexOf(true) : -1
    if (last < 0) return
    round[last] = null
    syncZeroOnePosition()
    updateUI()
    return
  }
  
  if (game.currentDart === 0) {
    game.currentRound--
    game.currentDart = 3
  }
  
  game.currentDart--
  
  game.rounds[game.currentRound][game.currentDart] = null
  
  updateUI()
  
}


// 今のラウンドの 1 投だけを消す（ヘッダーのダーツをタップしたとき）。後ろの投は前に詰める
// 戻ると同じく、次のラウンドを投げ始めて確定したラウンドは消せない
function deleteDart(roundIndex, dartIndex) {
  
  if (roundIndex <= lockedRound) return false
  
  const round = game.rounds[roundIndex]
  if (!round || !round[dartIndex]) return false
  
  // 消せるのは今入力中のラウンド（3 本入れ終わった直後はそのラウンド）だけ
  const isCurrent = game.currentDart > 0
    ? roundIndex === game.currentRound
    : roundIndex === game.currentRound - 1
  if (!isCurrent) return false
  
  round.splice(dartIndex, 1)
  round.push(null)
  
  if (GAME_TYPE === "01") {
    syncZeroOnePosition()
  } else {
    game.currentRound = roundIndex
    game.currentDart = round.filter(dart => dart !== null).length
  }
  
  updateUI()
  return true
  
}


function isGameComplete() {

  // 01：上がったか、上限のラウンドまで終わったら
  if (GAME_TYPE === "01") {
    const state = computeZeroOne()
    return state.finished || state.rounds.every(info => info.closed)
  }
  
  return game.rounds.every(round =>
    round.every(d => d !== null)
  )
  
}


// 進行中のゲームだけをリセットする（保存済みのゲーム履歴は消さない）
function forceResetGame() {
  
  if (!confirm("進行中のゲームをリセットしますか？\n（保存済みのゲーム記録は消えません）")) return
  
  localStorage.removeItem(SAVE_KEY)
  
  location.reload()
  
}