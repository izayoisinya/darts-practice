// ===============================
// ===== グラフ ==================
// ===============================
function drawScoreChart() {
  
  const canvas = document.getElementById("scoreChart");
  if (!canvas) return;
  
  // 👇 追加
  if (!canvas.offsetWidth || !canvas.offsetHeight) return;
  
  const ctx = canvas.getContext("2d");
  
  const accent =
  getComputedStyle(document.documentElement)
  .getPropertyValue("--accent")
  .trim() || "#00ffc8";
  
  const width = canvas.width = canvas.offsetWidth;
  const height = canvas.height = 220;
  
  ctx.clearRect(0, 0, width, height);
  
  const padding = 25;
  const graphWidth = width - padding * 2;
  const graphHeight = height - padding * 2;
  
  const maxScore = 180
  const stepX = graphWidth / (TOTAL_ROUNDS - 1);
  
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
  
  // ===== ① 横グリッド（点数目盛り）=====
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  
  const gridSteps = 6;
  
  for (let i = 0; i <= gridSteps; i++) {
    
    const value = (maxScore / gridSteps) * i;
    const y =
      height - padding -
      (value / maxScore) * graphHeight;
    
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(width - padding, y);
    ctx.stroke();
    
    // 縦軸ラベル
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "12px sans-serif";
    ctx.fillText(
      Math.round(value),
      5,
      y + 4
    );
  }
  
  // ===== ② 折れ線 =====
  ctx.beginPath();
  ctx.lineWidth = 2;
  
  
  ctx.strokeStyle = accent;
  
  let started = false;
  
  roundScores.forEach((score, i) => {
    
    if (score === null) return;
    
    const x = padding + stepX * i;
    const y =
      height - padding -
      (score / maxScore) * graphHeight;
    
    if (!started) {
      ctx.moveTo(x, y);
      started = true;
    } else {
      ctx.lineTo(x, y);
    }
  });
  
  ctx.stroke();
  
  // ===== ③ 各ポイント描画 =====
  roundScores.forEach((score, i) => {
    
    if (score === null) return;
    
    const x = padding + stepX * i;
    const y =
      height - padding -
      (score / maxScore) * graphHeight;
    
    ctx.beginPath();
    
    if (score === maxRoundScore) {
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
  
  // ===== ④ 横軸ラベル（R1〜R8）=====
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.font = "12px sans-serif";
  
  for (let i = 0; i < TOTAL_ROUNDS; i++) {
    const x = padding + stepX * i;
    ctx.fillText(
      "R" + (i + 1),
      x - 10,
      height - 10
    );
  }
}