// ===============================
// ===== クリケットのルール =======
// ===============================
// クリケット（1 人で練習するスタンダードクリケット）固有のロジック。UI 生成は含まない（画面は cu_ui.js が共用）。
//   ・狙うのは 20〜15 とブル。シングル 1・ダブル 2・トリプル 3 マーク、アウターブル 1・インナーブル 2 マーク（ブルモードに関係なく）
//   ・3 マークでその数字はクローズ。クローズしたあとに入れたマークは点になる（数字 × マーク。ブルは 1 マーク 25 点）
//   ・全部クローズしたらそこで終わり（そのラウンドの残りの投は無効）。クローズできなくてもラウンドの上限で終わり
//   ・MPR（1 ラウンドあたりのマーク数）は、1 人なので入れたマークを全部数える
// 1 投ごとの記録（game.rounds）はカウントアップと同じ形で持ち、マーク・点・クローズは毎回そこから計算し直す

const CRICKET_TARGETS = [20, 19, 18, 17, 16, 15, 25]
const CRICKET_ROUND_LIMITS = [10, 15, 20]

// クリケットの設定（ラウンドの上限）を置く場所
const CRICKET_CONFIG_KEY = "dartsCricket"

function normalizeCricketConfig(source) {
  const value = source && typeof source === "object" ? source : {}
  return {
    rounds: CRICKET_ROUND_LIMITS.includes(Number(value.rounds)) ? Number(value.rounds) : 15
  }
}

function readCricketConfig() {
  try {
    return normalizeCricketConfig(JSON.parse(localStorage.getItem(CRICKET_CONFIG_KEY)))
  } catch {
    return normalizeCricketConfig(null)
  }
}

function writeCricketConfig(config) {
  localStorage.setItem(CRICKET_CONFIG_KEY, JSON.stringify(normalizeCricketConfig(config)))
}

function formatCricketConfig(config) {
  return `Cricket · R${config.rounds}`
}

// 1 投が入った数字とマーク数（クリケットの数字以外・ミスは null）
//   進行中のゲームの 1 投（{ value, multiplier, special }）と、履歴の 1 投（{ hit: "T20" | "OB" | ... }）のどちらでも使える
function getCricketMark(dart) {

  if (!dart) return null

  if (dart.hit) {
    if (dart.hit === "IB") return { target: 25, marks: 2 }
    if (dart.hit === "OB") return { target: 25, marks: 1 }
    const match = /^([SDT])(\d+)$/.exec(dart.hit)
    if (!match) return null
    const value = Number(match[2])
    if (value < 15 || value > 20) return null
    return { target: value, marks: { S: 1, D: 2, T: 3 }[match[1]] }
  }

  if (dart.special === "innerBull") return { target: 25, marks: 2 }
  if (dart.special === "outerBull") return { target: 25, marks: 1 }
  if (!dart.score || dart.value < 15 || dart.value > 20) return null
  return { target: dart.value, marks: dart.multiplier }
}

// 全ラウンドを頭から計算する
//   rounds[i]：{ thrown 投げた本数, marks そのラウンドのマーク数, points そのラウンドの点, finished 全部クローズしたラウンドか, closed 終わったか }
//   targets：数字ごとのマーク数（{ 20: 3, ..., 25: 1 }。3 以上でクローズ）/ targetPoints：数字ごとの点
//   finished：全部クローズしたか / finishDarts：クローズするまでの本数 / marks：マークの合計 / points：点の合計 / darts：投げた本数
function computeCricket(rounds = game.rounds) {

  const targets = {}
  const targetPoints = {}
  CRICKET_TARGETS.forEach(target => {
    targets[target] = 0
    targetPoints[target] = 0
  })

  let finished = false
  let finishRound = -1
  let finishDarts = 0
  let darts = 0
  let totalMarks = 0
  let totalPoints = 0

  const list = (rounds || []).map((round, index) => {

    const info = { thrown: 0, marks: 0, points: 0, finished: false, closed: false }
    if (finished) return info

    for (const dart of (round || []).filter(d => d)) {
      info.thrown++
      darts++

      const mark = getCricketMark(dart)
      if (mark) {
        const before = targets[mark.target]
        const over = Math.max(0, before + mark.marks - 3) - Math.max(0, before - 3)
        targets[mark.target] = before + mark.marks
        info.marks += mark.marks
        info.points += over * mark.target
        targetPoints[mark.target] += over * mark.target
      }

      if (CRICKET_TARGETS.every(target => targets[target] >= 3)) {
        info.finished = true
        finished = true
        finishRound = index
        finishDarts = darts
        break
      }
    }

    totalMarks += info.marks
    totalPoints += info.points
    info.closed = info.thrown === 3 || info.finished
    return info
  })

  return {
    rounds: list,
    targets,
    targetPoints,
    finished,
    finishRound,
    finishDarts,
    darts,
    marks: totalMarks,
    points: totalPoints
  }
}

// MPR（投げたラウンドあたりのマーク数。途中のラウンドは投げた本数の分だけ数える）
function getCricketMpr(state = computeCricket()) {
  return state.darts ? state.marks / state.darts * 3 : 0
}

// 記録から、次に入れる場所（game.currentRound / currentDart）を決め直す（game_core.js の syncPositionFromState()）
function syncCricketPosition() {
  syncPositionFromState(computeCricket())
}

// 1 ラウンドのアワード（3 投そろったラウンドだけ。上のものほど優先して 1 つだけ）
//   3 in the Black（インナーブル 3 本）/ Hat Trick（ブル 3 本）/ 3 in a Bed（同じ数字のトリプル 3 本）/
//   White Horse（違う数字のトリプル 3 本）/ 9〜5 Marks（そのラウンドのマーク数）
const CRICKET_AWARD_KEYS = [
  "threeInTheBlack",
  "hatTrick",
  "threeInTheBed",
  "whiteHorse",
  "marks9",
  "marks8",
  "marks7",
  "marks6",
  "marks5"
]

function judgeCricketRoundAward(round) {

  if (!Array.isArray(round) || round.length !== 3 || round.some(d => !d)) return null

  const marks = round.map(getCricketMark)
  const total = marks.reduce((sum, mark) => sum + (mark ? mark.marks : 0), 0)
  const bulls = marks.filter(mark => mark && mark.target === 25)
  const triples = marks.filter(mark => mark && mark.target !== 25 && mark.marks === 3)
  const tripleNumbers = new Set(triples.map(mark => mark.target))

  if (bulls.length === 3 && bulls.every(mark => mark.marks === 2)) return "threeInTheBlack"
  if (bulls.length === 3) return "hatTrick"
  if (triples.length === 3 && tripleNumbers.size === 1) return "threeInTheBed"
  if (triples.length === 3 && tripleNumbers.size === 3) return "whiteHorse"
  if (total >= 5) return `marks${Math.min(9, total)}`
  return null
}

function countCricketAwards(rounds) {

  const awards = {}
  CRICKET_AWARD_KEYS.forEach(key => { awards[key] = 0 })

  // 全部クローズしたあとの投は数えない（そのラウンドも 3 投そろっていれば数える）
  const state = computeCricket(rounds)
  ;(rounds || []).forEach((round, index) => {
    if (state.finishRound >= 0 && index > state.finishRound) return
    const award = judgeCricketRoundAward(round)
    if (award) awards[award]++
  })

  return awards
}

// 今のゲームの集計（画面の Stats 用）
function calculateCricketStats() {

  const state = computeCricket()

  let bulls = 0
  let innerBulls = 0
  let triples = 0
  game.rounds.forEach((round, index) => {
    if (state.finishRound >= 0 && index > state.finishRound) return
    round.forEach(dart => {
      if (!dart) return
      if (dart.special === "outerBull" || dart.special === "innerBull") bulls++
      if (dart.special === "innerBull") innerBulls++
      if (dart.multiplier === 3 && dart.value >= 15 && dart.value <= 20) triples++
    })
  })

  const thrownRounds = state.rounds.filter(info => info.thrown > 0)

  return {
    state,
    mpr: getCricketMpr(state),
    marks: state.marks,
    points: state.points,
    darts: state.darts,
    rounds: thrownRounds.length,
    maxMarks: thrownRounds.reduce((max, info) => Math.max(max, info.marks), 0),
    closedTargets: CRICKET_TARGETS.filter(target => state.targets[target] >= 3).length,
    bulls,
    innerBulls,
    triples,
    bullRate: state.darts ? bulls / state.darts * 100 : 0,
    innerBullRate: state.darts ? innerBulls / state.darts * 100 : 0,
    tripleRate: state.darts ? triples / state.darts * 100 : 0,
    ...countCricketAwards(game.rounds)
  }
}

// 今の設定で終えたゲームの記録から、クローズ率・クローズまでのダーツ数・MPR を集計する
function getCricketRecord(config = cricketConfig) {

  const list = (typeof readSessions === "function" ? readSessions() : [])
    .filter(session => session && session.gameType === "cricket" && session.cricket)
    .filter(session => session.cricket.rounds === config.rounds)

  const finished = list.filter(session => session.cricket.finished)
  const dartsList = finished.map(session => session.cricket.finishDarts).filter(n => n > 0)
  const mprList = list.map(session => session.cricket.mpr)

  return {
    games: list.length,
    finished: finished.length,
    rate: list.length ? finished.length / list.length * 100 : 0,
    avgDarts: dartsList.length ? dartsList.reduce((a, b) => a + b, 0) / dartsList.length : 0,
    bestDarts: dartsList.length ? Math.min(...dartsList) : 0,
    avgMpr: mprList.length ? mprList.reduce((a, b) => a + b, 0) / mprList.length : 0,
    bestMpr: mprList.length ? Math.max(...mprList) : 0
  }
}

// 終えたゲームの結果（保存用。storage.js の saveSession() が使う）
function getCricketResult() {
  const state = computeCricket()
  return {
    rounds: cricketConfig.rounds,
    finished: state.finished,
    finishDarts: state.finishDarts,
    marks: state.marks,
    points: state.points,
    mpr: Number(getCricketMpr(state).toFixed(2))
  }
}

// 1 投の表示（T20 / D19 / S15 / BULL / IN-BULL。クリケットの数字以外は数字だけ薄く、ミスは「-」）
function formatCricketDart(dart) {
  if (!dart) return "-"
  if (dart.special === "innerBull") return "IN"
  if (dart.special === "outerBull") return "BULL"
  if (!dart.score) return "MISS"
  const prefix = dart.multiplier === 3 ? "T" : dart.multiplier === 2 ? "D" : "S"
  return `${prefix}${dart.value}`
}

// マーク数の記号（0：なし / 1：/ / 2：X / 3 以上：Ⓧ）
function getCricketMarkSymbol(count) {
  if (count >= 3) return "Ⓧ"
  if (count === 2) return "X"
  if (count === 1) return "/"
  return ""
}

// 終えたゲームの履歴（storage.js の saveSession() が 1 投ごとの記録・ブルモードを足して保存する）
//   score：点 / roundAvg：MPR / roundScores：ラウンドごとのマーク数（投げたラウンドまで）/ awards：クリケットのアワード
function createCricketSession() {

  const stats = calculateCricketStats()

  const tripleHits = {}
  for (let i = 15; i <= 20; i++) tripleHits[i] = 0
  game.rounds.flat().forEach(dart => {
    if (dart && dart.multiplier === 3 && tripleHits[dart.value] !== undefined) tripleHits[dart.value]++
  })

  const awards = {}
  CRICKET_AWARD_KEYS.forEach(key => { awards[key] = stats[key] || 0 })

  const lastRound = stats.state.rounds.map(info => info.thrown > 0).lastIndexOf(true)

  return {
    date: Date.now(),
    score: stats.points,
    ppd: 0,
    bulls: stats.bulls,
    innerBulls: stats.innerBulls,
    bullRate: Number(stats.bullRate.toFixed(1)),
    innerRate: Number(stats.innerBullRate.toFixed(1)),
    roundAvg: Number(stats.mpr.toFixed(2)),
    tripleHits,
    awards,
    totalAwards: Object.values(awards).reduce((sum, count) => sum + count, 0),
    roundScores: stats.state.rounds.slice(0, lastRound + 1).map(info => info.marks),
    gameType: "cricket",
    cricket: getCricketResult()
  }
}
