// ===============================
// ===== グローバル状態 =========
// ===============================

// ラウンド数
const TOTAL_ROUNDS = 8

// 最大スコア
const MAX_SCORE = 180

// UIカラー
const accent = getComputedStyle(document.documentElement)
  .getPropertyValue("--accent")
  .trim()

// Bullモード
let bullMode = "fat"

// Undoロック
let lockedRound = -1

// セッション履歴
let sessions = []

// ゲーム状態
const game = {
  rounds: [],
  currentRound: 0,
  currentDart: 0
}