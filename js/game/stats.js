// ===============================
// ===== Awards判定 ===============
// ===============================
const AWARD_KEYS_BY_PRIORITY = [
  "ton80",
  "threeInTheBlack",
  "hatTrick",
  "threeInTheBed",
  "whiteHorse",
  "highTon",
  "lowTon"
]

// 1ラウンドのアワードを判定する（3投完了のみ）
// 複数に当てはまる場合は上位（AWARD_KEYS_BY_PRIORITY の先頭側）の1つだけを返す
function judgeRoundAward(round) {

  if (!Array.isArray(round) || round.length !== 3 || round.some(d => !d)) {
    return null
  }

  const roundScore = round.reduce((sum, d) => sum + (d.score || 0), 0)

  const allBull = round.every(d =>
    d.special === "outerBull" ||
    d.special === "innerBull"
  )

  const allInner = round.every(d =>
    d.special === "innerBull"
  )

  // T15〜T20（クリケットナンバー）のトリプル
  const cricketTriples = round.filter(d =>
    d.multiplier === 3 && d.value >= 15 && d.value <= 20
  )
  const tripleNumbers = new Set(cricketTriples.map(d => d.value))

  if (roundScore === 180) return "ton80"
  if (allInner) return "threeInTheBlack"
  if (allBull) return "hatTrick"
  if (cricketTriples.length === 3 && tripleNumbers.size === 1) return "threeInTheBed"
  if (cricketTriples.length === 3 && tripleNumbers.size === 3) return "whiteHorse"
  if (roundScore >= 151) return "highTon"
  if (roundScore >= 100) return "lowTon"

  return null
}

// 全ラウンドのアワード数を数える
function countRoundAwards(rounds) {

  const awards = {}
  AWARD_KEYS_BY_PRIORITY.forEach(key => {
    awards[key] = 0
  })

  ;(rounds || []).forEach(round => {
    const award = judgeRoundAward(round)
    if (award) awards[award]++
  })

  return awards
}


// ===============================
// ===== Stats計算（拡張版） =====
// ===============================
function calculateStats() {
  
  // ------------------------------------------
  // ① 集計用変数初期化
  // ------------------------------------------
  let totalScore = 0;
  let totalDarts = 0;
  let bullCount = 0;
  let innerBullCount = 0;
  let maxRound = 0;
  let completedRounds = 0;

  
  // ------------------------------------------
  // ② 各ラウンド走査
  // ------------------------------------------
  game.rounds.forEach(round => {
    
    let roundScore = 0;
    let dartCount = 0;

    
    // --------------------------------------
    // ③ 各ダーツ走査
    // --------------------------------------
    round.forEach(dart => {
      if (!dart) return;

      dartCount++;
      totalScore += dart.score;
      totalDarts++;
      roundScore += dart.score;

      if (
        dart.special === "outerBull" ||
        dart.special === "innerBull"
      ) {
        bullCount++;
      }

      if (dart.special === "innerBull") {
        innerBullCount++;
      }
    });


    // --------------------------------------
    // ④ ラウンド統計更新
    // --------------------------------------
    if (dartCount > 0) {
      completedRounds++;
      maxRound = Math.max(maxRound, roundScore);
    }
    
  });


  // ------------------------------------------
  // 01：バストのラウンドは点を減らせていないので 0 点として数える
  // ------------------------------------------
  if (GAME_TYPE === "01" && typeof getRoundScoreList === "function") {
    const list = getRoundScoreList().filter(round => round.thrown > 0)
    totalScore = list.reduce((sum, round) => sum + round.score, 0)
    maxRound = list.reduce((max, round) => Math.max(max, round.score), 0)
    completedRounds = list.length
  }


  // ------------------------------------------
  // ⑤ 平均計算
  // ------------------------------------------
  const ppd = totalDarts ?
    totalScore / totalDarts :
    0;
    

  // ------------------------------------------
  // ⑥ 結果返却
  // ------------------------------------------
  return {
    totalScore,
    totalDarts,
    bullCount,
    innerBullCount,

    bullRate: totalDarts ?
      (bullCount / totalDarts) * 100 :
      0,

    innerBullRate: totalDarts ?
      (innerBullCount / totalDarts) * 100 :
      0,

    ppd,

    roundAvg: completedRounds ?
      totalScore / completedRounds :
      0,

    maxRound,

    // ★ Awards（1ラウンド1つ、上位のみ）
    ...countRoundAwards(game.rounds)
  };
}


// ===============================
// ===== Stats更新 ===============
// ===============================
const $ = id => document.getElementById(id)

function updateStats() {

  // クリケットは別の集計（game_cricket.js）。ヘッダーの大きな数字は点（クローズのあとに入れたマークの点）
  if (GAME_TYPE === "cricket") {
    updateCricketStats()
    return
  }
  
  const stats = calculateStats()
  
  // ===== Header =====（01 は残り点数）
  $("totalScore").textContent = GAME_TYPE === "01"
    ? computeZeroOne().remaining
    : stats.totalScore
  
  // ===== Basic =====
  $("bullCount").textContent = stats.bullCount
  $("innerBulls").textContent = stats.innerBullCount
  $("totalDartsStat").textContent = stats.totalDarts
  
  $("ppd").textContent = stats.ppd.toFixed(2)
  $("roundAvg").textContent = stats.roundAvg.toFixed(1)
  $("maxRound").textContent = stats.maxRound
  
  // ===== Bars =====
  $("bullRateBar").style.width = stats.bullRate + "%"
  $("innerBullRateBar").style.width = stats.innerBullRate + "%"
  
  // ===== Compact =====
  $("bullCountCompact").textContent = stats.bullCount
  $("bullPercentCompact").textContent = stats.bullRate.toFixed(1) + "%"
  
  $("innerBullsCompact").textContent = stats.innerBullCount
  $("innerBullPercentCompact").textContent = stats.innerBullRate.toFixed(1) + "%"
  
  $("ppdCompact").textContent = stats.ppd.toFixed(2)
  $("roundAvgCompact").textContent = stats.roundAvg.toFixed(2)
  $("maxRoundCompact").textContent = stats.maxRound
  
  $("bullPercent").textContent = stats.bullRate.toFixed(1) + "%"
  $("innerBullPercent").textContent = stats.innerBullRate.toFixed(1) + "%"
  
  // ===== Awards =====


$("hatTrick").textContent = stats.hatTrick
$("lowTon").textContent = stats.lowTon
$("highTon").textContent = stats.highTon
$("ton80").textContent = stats.ton80
$("threeInTheBlack").textContent = stats.threeInTheBlack
$("threeInTheBed").textContent = stats.threeInTheBed
$("whiteHorse").textContent = stats.whiteHorse

showAward("award-hattrick", stats.hatTrick)
showAward("award-lowton", stats.lowTon)
showAward("award-highton", stats.highTon)
showAward("award-ton80", stats.ton80)
showAward("award-threeblack", stats.threeInTheBlack)
showAward("award-threebed", stats.threeInTheBed)
showAward("award-whitehorse", stats.whiteHorse)

}

function showAward(id, value) {
  
  const el = document.getElementById(id)
  
  if (!el) return
  
  if (value > 0) {
    el.style.display = "flex"
  } else {
    el.style.display = "none"
  }
  
}

// ===============================
// ===== クリケットの Stats 更新 ===
// ===============================
const CRICKET_AWARD_LABELS = [
  ["threeInTheBlack", "3 in the Black"],
  ["hatTrick", "Hat Trick"],
  ["threeInTheBed", "3 in the Bed"],
  ["whiteHorse", "White Horse"],
  ["marks9", "9 Marks"],
  ["marks8", "8 Marks"],
  ["marks7", "7 Marks"],
  ["marks6", "6 Marks"],
  ["marks5", "5 Marks"]
]

function updateCricketStats() {

  const stats = calculateCricketStats()
  const set = (id, text) => {
    const el = $(id)
    if (el) el.textContent = text
  }

  set("totalScore", stats.points)

  set("cricketMpr", stats.mpr.toFixed(2))
  set("cricketMarks", stats.marks)
  set("cricketPoints", stats.points)
  set("cricketMaxMarks", stats.maxMarks)
  set("cricketClosed", `${stats.closedTargets}/7`)

  set("cricketMprCompact", stats.mpr.toFixed(2))
  set("cricketMarksCompact", stats.marks)
  set("cricketClosedCompact", `${stats.closedTargets}/7`)

  // ブル・インブル・トリプル（カウントアップと同じ欄）
  set("bullCount", stats.bulls)
  set("innerBulls", stats.innerBulls)
  set("cricketTriples", stats.triples)
  set("bullPercent", `${stats.bullRate.toFixed(1)}%`)
  set("innerBullPercent", `${stats.innerBullRate.toFixed(1)}%`)
  set("cricketTriplePercent", `${stats.tripleRate.toFixed(1)}%`)
  $("bullRateBar").style.width = `${stats.bullRate}%`
  $("innerBullRateBar").style.width = `${stats.innerBullRate}%`
  const tripleBar = $("cricketTripleBar")
  if (tripleBar) tripleBar.style.width = `${stats.tripleRate}%`

  set("bullCountCompact", stats.bulls)
  set("bullPercentCompact", `${stats.bullRate.toFixed(1)}%`)
  set("innerBullsCompact", stats.innerBulls)
  set("innerBullPercentCompact", `${stats.innerBullRate.toFixed(1)}%`)

  // アワード（取ったものだけ出す）
  const awards = $("cricketAwards")
  if (awards) {
    awards.innerHTML = CRICKET_AWARD_LABELS
      .filter(([key]) => stats[key] > 0)
      .map(([key, label]) => `
        <div class="award-card" style="display:flex">
          <div class="award-title">${label}</div>
          <div class="award-value">${stats[key]}</div>
        </div>
      `)
      .join("")
  }
}
