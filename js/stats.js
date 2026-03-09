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

  // ★ Awards用
  let hatTrick = 0;
  let lowTon = 0;
  let highTon = 0;
  let ton80 = 0;
  let threeInTheBlack = 0;
  let threeInTheBed = 0;
  let whiteHorse = 0;

  
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


    // --------------------------------------
    // ⑤ Awards判定（3投完了のみ）
    // --------------------------------------
    if (dartCount === 3) {

      const allBull = round.every(d =>
        d.special === "outerBull" ||
        d.special === "innerBull"
      );

      const allInner = round.every(d =>
        d.special === "innerBull"
      );

      if (allBull) hatTrick++;
      if (allInner) threeInTheBlack++;

      if (!allBull) {
        if (roundScore === 180) ton80++;
        else if (roundScore >= 151 && roundScore <= 179) highTon++;
        else if (roundScore >= 100 && roundScore <= 149) lowTon++;
      }
      
      // 3 in the Bed
const bedTriples = round.filter(d =>
  d && d.multiplier === 3 && d.score >= 48 && d.score <= 60
)

if (
  bedTriples.length === 3 &&
  bedTriples[0].score === bedTriples[1].score &&
  bedTriples[1].score === bedTriples[2].score
) {
  threeInTheBed++
}

// White Horse
const horseTriples = round.filter(d =>
  d && d.multiplier === 3 && d.score >= 48 && d.score <= 60
)

const horseNumbers = new Set(
  horseTriples.map(d => d.score)
)

if (horseTriples.length === 3 && horseNumbers.size === 3) {
  whiteHorse++
}

    }
    
  });


  // ------------------------------------------
  // ⑥ 平均計算
  // ------------------------------------------
  const ppd = totalDarts ?
    totalScore / totalDarts :
    0;
    

  // ------------------------------------------
  // ⑦ 結果返却
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

    // ★ Awards追加
    hatTrick,
    lowTon,
    highTon,
    ton80,
    threeInTheBlack,
    threeInTheBed,
whiteHorse
  };
}


// ===============================
// ===== Stats更新 ===============
// ===============================
const $ = id => document.getElementById(id)

function updateStats() {
  
  const stats = calculateStats()
  
  // ===== Header =====
  $("totalScore").textContent = stats.totalScore
  
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