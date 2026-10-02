function updateNextGameButton() {
  
  const btn = document.getElementById("nextGameBtn")
  if (!btn) return
  
  btn.disabled = !isGameComplete()
  
}


function nextGame() {
  
  if (!isGameComplete()) return
  
  saveSession()
  
  localStorage.removeItem("dartsPractice")
  
  initGame(false)
  
  updateUI() // ←保険
  
}


function undoDart() {
  
  if (game.currentRound === 0 && game.currentDart === 0) return
  
  if (game.currentRound - 1 <= lockedRound && game.currentDart === 0) return
  
  if (game.currentDart === 0) {
    game.currentRound--
    game.currentDart = 3
  }
  
  game.currentDart--
  
  game.rounds[game.currentRound][game.currentDart] = null
  
  updateUI()
  
}


function isGameComplete() {
  
  return game.rounds.every(round =>
    round.every(d => d !== null)
  )
  
}


// 進行中のゲームだけをリセットする（保存済みのゲーム履歴は消さない）
function forceResetGame() {
  
  if (!confirm("進行中のゲームをリセットしますか？\n（保存済みのゲーム記録は消えません）")) return
  
  localStorage.removeItem("dartsPractice")
  
  location.reload()
  
}