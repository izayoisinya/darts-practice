// ===============================
// ===== グラフ ==================
// ===============================
function drawScoreChart() {
  
  const canvas = document.getElementById("scoreChart");
  if (!canvas) return;
  
  if (!canvas.offsetWidth || !canvas.offsetHeight) return;
  
  const ctx = canvas.getContext("2d");
  
// 表示サイズは CSS で決まる。描画は画面の倍率（devicePixelRatio）に合わせて細かくし、ぼやけないようにする
const width = canvas.offsetWidth
const height = canvas.offsetHeight || 220
const dpr = Math.min(window.devicePixelRatio || 1, 3)

canvas.width = Math.round(width * dpr)
canvas.height = Math.round(height * dpr)
ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

const padding = 45
const paddingTop = 5
const paddingBottom = 0

const graphWidth = width - padding * 2
const graphHeight = height - padding * 2

  const stepX = TOTAL_ROUNDS > 1 ?
  graphWidth / (TOTAL_ROUNDS - 1) :
  0
  
  // ===== ラウンドスコア取得 =====
  // 終わったラウンドだけ（01 はバスト・上がりのラウンドも終わり。バストは 0 点）
  const roundScores = typeof getRoundScoreList === "function"
    ? getRoundScoreList().map(round => round.done ? round.score : null)
    : game.rounds.map(round =>
      round.every(d => d !== null) ?
      round.reduce((sum, d) => sum + d.score, 0) :
      null
    );
  
const validScores = roundScores.filter(s => s !== null);

const maxRoundScore = validScores.length ?
  Math.max(...validScores) :
  0;
  

  
  // ===== 横グリッド =====
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  
  const gridSteps = 6;
  
  for (let i = 0; i <= gridSteps; i++) {
    
    const value = (MAX_SCORE / gridSteps) * i;
    const y =
      height - padding -
      (value / MAX_SCORE) * graphHeight;
    
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(width - padding, y);
    ctx.stroke();
    
    // ★修正②
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "12px sans-serif";
    ctx.fillText(
      Math.round(value),
      10,
      y + 4
    );
  }
  
  // ===== 折れ線 =====
  ctx.beginPath();
  ctx.lineWidth = 2;
  ctx.strokeStyle = accent;
  
  let started = false;
  
  roundScores.forEach((score, i) => {
    
    if (score === null) return;
    
    const x = padding + stepX * i;
    const y =
      height - padding -
      (score / MAX_SCORE) * graphHeight;
    
    if (!started) {
      ctx.moveTo(x, y);
      started = true;
    } else {
      ctx.lineTo(x, y);
    }
  });
  
  ctx.stroke();
  
  // ===== ポイント =====
  roundScores.forEach((score, i) => {
    
    if (score === null) return;
    
    const x = padding + stepX * i;
    const y =
      height - padding -
      (score / MAX_SCORE) * graphHeight;
    
    ctx.beginPath();
    
    if (maxRoundScore > 0 && score === maxRoundScore) {
      ctx.fillStyle = "#ffcc00";
      ctx.shadowColor = "#ffcc00";
      ctx.shadowBlur = 10;
    } else {
      ctx.fillStyle = accent;
      ctx.shadowBlur = 0;
    }
    
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
  });
  
  ctx.shadowBlur = 0;
  
  // ===== 横軸ラベル =====
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.font = "12px sans-serif";
  
  for (let i = 0; i < TOTAL_ROUNDS; i++) {
    // ラウンドが多いとき（01 の 15・20 ラウンド）は 5 ラウンドごとに出す
    if (!shouldLabelRound(i)) continue
    const x = padding + stepX * i;
    
    // ★修正③
    ctx.fillText(
      "R" + (i + 1),
      x - 10,
      height - 5
    );
  }
}

// ===============================
// ===== 小さなラウンドスコアのグラフ（ボードの右上） =====
// ===============================
// cu_ui.js の renderGameSideChart() から呼ぶ。レーダー風のヒートマップに合わせ、暗い画面に光る線で描く
//   終わったラウンドは線でつなぎ、投げている途中のラウンドは薄い点で今の合計を出す。最高のラウンドは金色
//   rgb：色（"0, 255, 200" の形）
function paintRoundScoreChart(ctx, width, height, rgb = "0, 255, 200") {

  const color = alpha => `rgba(${rgb}, ${alpha})`
  const font = "ui-monospace, Menlo, monospace"

  const left = 26
  const right = 8
  const top = 8
  const bottom = 18
  const graphWidth = width - left - right
  const graphHeight = height - top - bottom
  const stepX = TOTAL_ROUNDS > 1 ? graphWidth / (TOTAL_ROUNDS - 1) : 0

  const xAt = i => left + stepX * i
  const yAt = score => top + graphHeight - (Math.min(score, MAX_SCORE) / MAX_SCORE) * graphHeight

  ctx.clearRect(0, 0, width, height)

  // 横の目盛り（0・60・120・180）
  ctx.font = `600 9px ${font}`
  ctx.textAlign = "right"
  ctx.textBaseline = "middle"
  ;[0, 60, 120, 180].forEach(value => {
    const y = yAt(value)
    ctx.strokeStyle = color(value === 0 ? 0.3 : 0.1)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(left, y)
    ctx.lineTo(width - right, y)
    ctx.stroke()

    ctx.fillStyle = color(0.45)
    ctx.fillText(String(value), left - 5, y)
  })

  // 縦の目盛りとラウンドの番号
  ctx.textAlign = "center"
  ctx.textBaseline = "alphabetic"
  for (let i = 0; i < TOTAL_ROUNDS; i++) {
    ctx.strokeStyle = color(0.06)
    ctx.beginPath()
    ctx.moveTo(xAt(i), top)
    ctx.lineTo(xAt(i), top + graphHeight)
    ctx.stroke()

    if (!shouldLabelRound(i)) continue
    ctx.fillStyle = color(0.45)
    ctx.fillText(String(i + 1), xAt(i), height - 4)
  }

  // ラウンドスコア（終わったラウンドだけ。途中のラウンドは今の合計）
  const rounds = getRoundScoreList()
  const done = rounds.map((round, i) => ({ ...round, i })).filter(round => round.done)
  const best = done.length ? Math.max(...done.map(round => round.score)) : 0

  if (done.length) {
    // 線の下をうっすら塗る
    const fill = ctx.createLinearGradient(0, top, 0, top + graphHeight)
    fill.addColorStop(0, color(0.25))
    fill.addColorStop(1, color(0))
    ctx.fillStyle = fill
    ctx.beginPath()
    ctx.moveTo(xAt(done[0].i), top + graphHeight)
    done.forEach(round => ctx.lineTo(xAt(round.i), yAt(round.score)))
    ctx.lineTo(xAt(done[done.length - 1].i), top + graphHeight)
    ctx.closePath()
    ctx.fill()

    // 光る線
    ctx.shadowColor = color(0.9)
    ctx.shadowBlur = 8
    ctx.strokeStyle = color(0.95)
    ctx.lineWidth = 1.8
    ctx.beginPath()
    done.forEach((round, n) => {
      if (n === 0) ctx.moveTo(xAt(round.i), yAt(round.score))
      else ctx.lineTo(xAt(round.i), yAt(round.score))
    })
    ctx.stroke()

    // 点（最高のラウンドは金色）
    done.forEach(round => {
      const isBest = best > 0 && round.score === best
      ctx.shadowColor = isBest ? "#ffcc00" : color(0.9)
      ctx.fillStyle = isBest ? "#ffcc00" : "#eafffa"
      ctx.beginPath()
      ctx.arc(xAt(round.i), yAt(round.score), isBest ? 3.5 : 2.6, 0, Math.PI * 2)
      ctx.fill()
    })
    ctx.shadowBlur = 0
  }

  // 投げている途中のラウンド
  rounds.forEach((round, i) => {
    if (round.done || !round.thrown) return
    ctx.strokeStyle = color(0.8)
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.arc(xAt(i), yAt(round.score), 3, 0, Math.PI * 2)
    ctx.stroke()
  })
}

// グラフの横軸にラウンドの番号を出すか（10 ラウンドまでは全部、それより多いときは 1 と 5 の倍数だけ）
function shouldLabelRound(index) {
  return TOTAL_ROUNDS <= 10 || index === 0 || (index + 1) % 5 === 0
}
