// ===============================
// ===== 01 のルール ==============
// ===============================
// 01（ゼロワン）固有のロジック。UI 生成は含まない（画面は cu_ui.js がカウントアップと共用）。
// 1 投ごとの記録（game.rounds）はカウントアップと同じ形で持ち、残り点数・バスト・上がりは毎回そこから計算し直す
// （戻る・ヘッダーの数字の削除をしても、ずれないようにするため）

const ZERO_ONE_STARTS = [301, 501, 701, 901, 1101, 1501]
const ZERO_ONE_OUTS = ["open", "double", "master"]
const ZERO_ONE_ROUND_LIMITS = [5, 10, 15, 20]
const ZERO_ONE_OUT_LABELS = { open: "Open Out", double: "Double Out", master: "Master Out" }

// 01 の設定（点数・上がり方・ラウンドの上限）を置く場所
const ZERO_ONE_CONFIG_KEY = "dartsZeroOne"

function normalizeZeroOneConfig(source) {
  const value = source && typeof source === "object" ? source : {}
  return {
    start: ZERO_ONE_STARTS.includes(Number(value.start)) ? Number(value.start) : 501,
    out: ZERO_ONE_OUTS.includes(value.out) ? value.out : "double",
    rounds: ZERO_ONE_ROUND_LIMITS.includes(Number(value.rounds)) ? Number(value.rounds) : 15
  }
}

function readZeroOneConfig() {
  try {
    return normalizeZeroOneConfig(JSON.parse(localStorage.getItem(ZERO_ONE_CONFIG_KEY)))
  } catch {
    return normalizeZeroOneConfig(null)
  }
}

function writeZeroOneConfig(config) {
  localStorage.setItem(ZERO_ONE_CONFIG_KEY, JSON.stringify(normalizeZeroOneConfig(config)))
}

function formatZeroOneConfig(config) {
  return `${config.start} · ${ZERO_ONE_OUT_LABELS[config.out]} · R${config.rounds}`
}

// その 1 投で上がれるか（残りがちょうど 0 になったとき）
//   Double Out：ダブル（ブルは 50 点のとき。FAT のブル・インナーブル）
//   Master Out：ダブルかトリプル
function isZeroOneFinishDart(dart, out) {
  if (out === "double") return dart.multiplier === 2
  if (out === "master") return dart.multiplier >= 2
  return true
}

// 1 投入れたあとの残りがバストか
function isZeroOneBust(remaining, dart, out) {
  if (remaining < 0) return true
  if (out !== "open" && remaining === 1) return true
  if (remaining === 0 && !isZeroOneFinishDart(dart, out)) return true
  return false
}

// 全ラウンドを頭から計算する
//   rounds[i]：{ thrown 投げた本数, score そのラウンドで減らした点（バストは 0）, bust, finished, closed 終わったか, remaining ラウンド後の残り }
//   finished：上がったか / finishDarts：上がるまでの本数 / remaining：今の残り / scored：減らした点の合計 / darts：投げた本数
function computeZeroOne(rounds = game.rounds, config = zeroOneConfig) {

  let remaining = config.start
  let finished = false
  let finishRound = -1
  let finishDarts = 0
  let darts = 0

  const list = (rounds || []).map((round, index) => {

    const start = remaining
    const thrownDarts = (round || []).filter(dart => dart)
    const info = { thrown: 0, score: 0, bust: false, finished: false, closed: false, remaining }

    if (finished) return info

    for (const dart of thrownDarts) {
      info.thrown++
      darts++
      const next = remaining - dart.score

      if (isZeroOneBust(next, dart, config.out)) {
        info.bust = true
        remaining = start
        break
      }

      remaining = next

      if (remaining === 0) {
        info.finished = true
        finished = true
        finishRound = index
        finishDarts = darts
        break
      }
    }

    info.score = info.bust ? 0 : start - remaining
    info.closed = info.thrown === 3 || info.bust || info.finished
    info.remaining = remaining
    return info
  })

  return {
    rounds: list,
    remaining,
    finished,
    finishRound,
    finishDarts,
    darts,
    scored: config.start - remaining
  }
}

// 記録から、次に入れる場所（game.currentRound / currentDart）を決め直す。
// バスト・上がりのラウンドは 3 本そろっていなくても終わり。上がったら以降は入れない
function syncZeroOnePosition() {

  const state = computeZeroOne()

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

// 今の設定で終えたゲームの記録から、上がり率と上がるまでのダーツ数を集計する
function getZeroOneRecord(config = zeroOneConfig) {

  const list = (typeof readSessions === "function" ? readSessions() : [])
    .filter(session => session && session.gameType === "01" && session.zeroOne)
    .filter(session =>
      session.zeroOne.start === config.start &&
      session.zeroOne.out === config.out &&
      session.zeroOne.rounds === config.rounds
    )

  const finished = list.filter(session => session.zeroOne.finished)
  const dartsList = finished.map(session => session.zeroOne.finishDarts).filter(n => n > 0)

  return {
    games: list.length,
    finished: finished.length,
    rate: list.length ? finished.length / list.length * 100 : 0,
    avgDarts: dartsList.length ? dartsList.reduce((a, b) => a + b, 0) / dartsList.length : 0,
    bestDarts: dartsList.length ? Math.min(...dartsList) : 0
  }
}

// 終えたゲームの結果（保存用。storage.js の saveSession() が使う）
function getZeroOneResult() {
  const state = computeZeroOne()
  return {
    start: zeroOneConfig.start,
    out: zeroOneConfig.out,
    rounds: zeroOneConfig.rounds,
    finished: state.finished,
    finishDarts: state.finishDarts,
    remaining: state.remaining
  }
}

// ラウンドごとの点（グラフ・Rounds・集計用。カウントアップと 01 で共通の形）
//   done：終わったラウンドか / score：そのラウンドの点（01 のバストは 0）/ thrown：投げた本数 / bust
function getRoundScoreList() {

  if (GAME_TYPE === "01") {
    return computeZeroOne().rounds.map(info => ({
      done: info.closed,
      score: info.score,
      thrown: info.thrown,
      bust: info.bust,
      finished: info.finished,
      remaining: info.remaining
    }))
  }

  return game.rounds.map(round => {
    const darts = round.filter(dart => dart !== null)
    return {
      done: darts.length === 3,
      score: darts.reduce((sum, dart) => sum + dart.score, 0),
      thrown: darts.length,
      bust: false,
      finished: false,
      remaining: 0
    }
  })
}
