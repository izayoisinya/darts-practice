function updateUI() {
  updateStats()
  renderRounds()
  updateNextGameButton()
  drawScoreChart()
  saveGame()
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


// ===============================
// ===== ダーツ取り消し ==========
// ===============================
function undoDart() {
  
  // 何も投げていない場合は何もしない
  if (game.currentRound === 0 && game.currentDart === 0) return;
  
  
  // 確定済みラウンドには戻れない
  if (game.currentRound - 1 <= lockedRound && game.currentDart === 0) return;
  
  
  // もしラウンド先頭なら1ラウンド戻る
  if (game.currentDart === 0) {
    game.currentRound--;
    game.currentDart = 3;
  }
  
  
  // 1投戻す
  game.currentDart--;
  
  
  // 該当箇所を空にする
  game.rounds[game.currentRound][game.currentDart] = null;
  
  
  // 画面更新
updateUI()
}


// ===============================
// ===== 完了判定 =================
// ===============================
function isGameComplete() {
  
  // ------------------------------------------
  // ① 全ラウンドをチェック
  // ------------------------------------------
  // game.rounds の構造：
  // [
  //   [dart, dart, dart],
  //   [dart, dart, dart],
  //   ...
  // ]
  
  return game.rounds.every(round =>
    
    // --------------------------------------
    // ② 各ラウンドの3投をチェック
    // --------------------------------------
    // null でなければ「入力済み」
    round.every(d => d !== null)
  );
}


// ===============================
// NEXT GAME ボタンの有効/無効を制御する関数
// ===============================
function updateNextGameButton() {
  
  // ボタン要素を取得
  const btn = document.getElementById("nextGameBtn");
  
  // もしボタンが存在しなければ何もしない
  if (!btn) return;
  
  // isGameComplete() が true なら
  // disabled = false（押せる）
  
  // false なら
  // disabled = true（押せない）
  
  btn.disabled = !isGameComplete();
}


// ===============================
// ゲームを完全リセットする関数
// ===============================
function resetGame() {

  // ① ゲームが未完了なら何もしない
  // （8ラウンドすべて埋まっていない場合）
  if (!isGameComplete()) return;


  // ② ラウンドデータを初期化
  // TOTAL_ROUNDS 分の配列を作り
  // 各ラウンドを [null, null, null] に戻す
  game.rounds = Array.from(
    { length: TOTAL_ROUNDS },
    () => [null, null, null]
  );


  // ③ 現在のラウンド番号を最初に戻す
  game.currentRound = 0;

  // ④ 現在のダーツ番号（1投目〜3投目）をリセット
  game.currentDart = 0;

  // ⑤ Undoロックも解除
  // （確定ラウンドの制限をリセット）
  lockedRound = -1;


  // ⑥ 保存データを削除
  // ローカルストレージから現在のゲーム状態を消す
  localStorage.removeItem("dartsPractice");


  // ⑦ 画面を再描画
updateUI()
}

