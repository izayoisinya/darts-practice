// ===============================
// ===== ラウンドの途中で終わるゲーム =====
// ===============================
// 01（バスト・上がり）とクリケット（全部クローズ）は、3 本そろわなくてもラウンドが終わる。
// そのゲームは、1 投ごとの記録からラウンドの状態を計算し直して、次に入れる場所を決める

function hasRoundState() {
  return GAME_TYPE === "01" || GAME_TYPE === "cricket"
}

// ラウンドごとの状態（{ rounds: [{ thrown, closed, finished }], finished }。カウントアップは null）
function computeRoundState() {
  if (GAME_TYPE === "01") return computeZeroOne()
  if (GAME_TYPE === "cricket") return computeCricket()
  return null
}

function syncGamePosition() {
  if (GAME_TYPE === "01") syncZeroOnePosition()
  if (GAME_TYPE === "cricket") syncCricketPosition()
}

// 記録から、次に入れる場所（game.currentRound / currentDart）を決め直す。
// 終わった（バスト・上がり・全部クローズ）ラウンドは 3 本そろっていなくても終わり。ゲームが終わったら以降は入れない
function syncPositionFromState(state) {

  for (let i = 0; i < game.rounds.length; i++) {
    const info = state.rounds[i]

    // 終わったラウンドの残りの枠は空にしておく（バスト・上がりのあとの投は無効）
    if (info.closed) {
      for (let d = info.thrown; d < 3; d++) game.rounds[i][d] = null
    }

    if (info.finished) {
      for (let r = i + 1; r < game.rounds.length; r++) game.rounds[r] = [null, null, null]
      game.currentRound = i + 1
      game.currentDart = 0
      return
    }

    if (!info.closed) {
      game.currentRound = i
      game.currentDart = info.thrown
      return
    }
  }

  game.currentRound = game.rounds.length
  game.currentDart = 0
}


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

  // 01・クリケット：バスト・上がり・全部クローズのラウンドは 3 本そろっていないので、そのラウンドの最後に入れた 1 投を消す
  if (hasRoundState()) {
    const index = game.currentDart > 0 ? game.currentRound : game.currentRound - 1
    const round = game.rounds[index]
    const last = round ? round.map(dart => dart !== null).lastIndexOf(true) : -1
    if (last < 0) return
    round[last] = null
    syncGamePosition()
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
  
  if (hasRoundState()) {
    syncGamePosition()
  } else {
    game.currentRound = roundIndex
    game.currentDart = round.filter(dart => dart !== null).length
  }
  
  updateUI()
  return true
  
}


function isGameComplete() {

  // 01：上がったか、上限のラウンドまで終わったら / クリケット：全部クローズしたか、上限のラウンドまで終わったら
  if (hasRoundState()) {
    const state = computeRoundState()
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