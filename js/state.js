// ===============================
// ===== グローバル状態 =========
// ===============================

const body = document.body

const accent = getComputedStyle(document.documentElement) .getPropertyValue("--accent") .trim()

// ラウンド数
window.TOTAL_ROUNDS = 8

// Bullモード
window.bullMode = "fat"

// Undoロック
window.lockedRound = -1

// セッション履歴
window.sessions = []

// ゲーム状態
window.game = {
  rounds: [],
  currentRound: 0,
  currentDart: 0
}

window.body = document.body