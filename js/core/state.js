// ===============================
// ===== グローバル状態 =========
// ===============================

// ゲームの種類（countup.html?game=01 で 01。それ以外はカウントアップ）
const GAME_TYPE = /[?&]game=01(&|$)/.test(location.search) ? "01" : "countup"

// ラウンド数（カウントアップは 8。01 は設定のラウンドの上限で initGame() が決める）
let TOTAL_ROUNDS = 8

// 01 の設定（game_01.js の normalizeZeroOneConfig() の形。initGame() が読み込む）
let zeroOneConfig = { start: 501, out: "double", rounds: 15 }

// 最大スコア
const MAX_SCORE = 180

// UIカラー
const accent = getComputedStyle(document.documentElement)
  .getPropertyValue("--accent")
  .trim()

// Bullモード
let bullMode = "fat"

// 入力形式（"board" ダーツボード〔初期値〕 / "buttons" ボタン）
let inputMode = "board"

// ボード入力で拡大したとき、いつ全体表示に戻すか（"manual" 全体表示ボタンまで / "round" ラウンドが変わったら）
let boardZoomReset = "manual"

// 3 本指スワイプで戻るときの向き（"left" / "right"）
let undoSwipeDirection = "left"

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