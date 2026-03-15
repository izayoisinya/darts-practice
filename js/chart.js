// ===============================
// ===== グラフ ==================
// ===============================
function drawScoreChart() {
  
  const canvas = document.getElementById("scoreChart");
  if (!canvas) return;
  
  if (!canvas.offsetWidth || !canvas.offsetHeight) return;
  
  const ctx = canvas.getContext("2d");
  
const width = canvas.width = canvas.offsetWidth
const height = canvas.height = canvas.offsetHeight || 220

const padding = 45
const paddingTop = 5
const paddingBottom = 0

const graphWidth = width - padding * 2
const graphHeight = height - padding * 2

  const stepX = TOTAL_ROUNDS > 1 ?
  graphWidth / (TOTAL_ROUNDS - 1) :
  0
  
  // ===== ラウンドスコア取得 =====
  const roundScores = game.rounds.map(round =>
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
    const x = padding + stepX * i;
    
    // ★修正③
    ctx.fillText(
      "R" + (i + 1),
      x - 10,
      height - 5
    );
  }
}