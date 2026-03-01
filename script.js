// ====== 設定 ======
const TOTAL_ROUNDS = 8;
let bullMode = "fat";
let lockedRound = -1;
let sessions = [];

// ====== ゲーム状態 ======
const game = {
  rounds: [],
  currentRound: 0,
  currentDart: 0
};

// ====== 初期化 ======
init();

function init() {
  game.rounds = [];
  
  for (let i = 0; i < TOTAL_ROUNDS; i++) {
    game.rounds.push([null, null, null]);
  }
  
  loadGame(); // ← 追加
  loadSessions();
  
  createNumberTable();
  setupTopButtons();
  renderRounds();
  updateStats();
  
  updateNextGameButton();
}

// ====== ダーツ追加 ======
function addDart(value, multiplier, special = null) {

  if (game.currentRound >= TOTAL_ROUNDS) return;

  // 次ラウンド1投目で前ラウンド確定
  if (game.currentDart === 0 && game.currentRound > lockedRound + 1) {
    lockedRound = game.currentRound - 1;
  }

  const score = value * multiplier;
  const dart = { value, multiplier, score, special };

  game.rounds[game.currentRound][game.currentDart] = dart;
  game.currentDart++;

  if (game.currentDart === 3) {
    game.currentDart = 0;
    game.currentRound++;
  }
  

  renderRounds();
  updateStats();
  saveGame();
  
  updateNextGameButton();
}

// ====== Undo ======
function undoDart() {

  if (game.currentRound === 0 && game.currentDart === 0) return;

  // 確定済みラウンドには戻れない
  if (game.currentRound - 1 <= lockedRound && game.currentDart === 0) {
    return;
  }

  if (game.currentDart === 0) {
    game.currentRound--;
    game.currentDart = 3;
  }

  game.currentDart--;
  game.rounds[game.currentRound][game.currentDart] = null;

  renderRounds();
  updateStats();
  saveGame();
  
  updateNextGameButton();
}

// ====== ラウンド描画 ======
function renderRounds() {
  const container = document.getElementById("roundContainer");
  container.innerHTML = "";

  game.rounds.forEach((round, index) => {

    const row = document.createElement("div");
    row.className = "round";

    const roundScore = round.reduce(
      (sum, d) => sum + (d ? d.score : 0),
      0
    );

    const renderDart = (dart) => {
      if (!dart) return `<span class="dart">-</span>`;

      let extraClass = "";

      if (dart.score === 0) {
        extraClass = " miss";
      }
      else if (dart.special === "innerBull") {
        extraClass = " inner-bull";
      }
      else if (dart.special === "outerBull") {
        extraClass = " outer-bull";
      }
      else if (dart.multiplier === 3) {
        extraClass = " triple";
      }
      else if (dart.multiplier === 2) {
        extraClass = " double";
      }

      return `<span class="dart${extraClass}">${dart.score}</span>`;
    };

    row.innerHTML = `
      <span class="round-label">R${index + 1}</span>
      <span class="round-darts">
        ${renderDart(round[0])}
        <span class="divider">|</span>
        ${renderDart(round[1])}
        <span class="divider">|</span>
        ${renderDart(round[2])}
      </span>
      <span class="round-separator">||</span>
      <span class="round-score">${roundScore}</span>
    `;

    container.appendChild(row);
  });
}

// ====== Stats計算 ======
function calculateStats() {

  let totalScore = 0;
  let totalDarts = 0;
  let bullCount = 0;
  let innerBullCount = 0;
  let maxRound = 0;
  let completedRounds = 0;

  let hatTrick = 0;
  let lowTon = 0;
  let highTon = 0;
  let ton80 = 0;
  let threeInTheBlack = 0;

  game.rounds.forEach(round => {

    let roundScore = 0;
    let dartCount = 0;

    round.forEach(dart => {
      if (!dart) return;

      dartCount++;
      totalScore += dart.score;
      totalDarts++;
      roundScore += dart.score;

      if (["outerBull", "innerBull"].includes(dart.special)) {
        bullCount++;
      }

      if (dart.special === "innerBull") {
        innerBullCount++;
      }
    });

    if (dartCount > 0) {
      completedRounds++;
      maxRound = Math.max(maxRound, roundScore);
    }

    if (dartCount === 3) {

      const isHat = round.every(d =>
        ["outerBull", "innerBull"].includes(d.special)
      );

      if (isHat) hatTrick++;

      if (round.every(d => d.special === "innerBull")) {
        threeInTheBlack++;
      }

      if (!isHat) {
        if (roundScore === 180) ton80++;
        else if (roundScore >= 151 && roundScore <= 179) highTon++;
        else if (roundScore >= 100 && roundScore <= 149) lowTon++;
      }
    }
  });

  const ppd = totalDarts ? totalScore / totalDarts : 0;

  return {
    totalScore,
    totalDarts,
    bullCount,
    innerBullCount,
    bullRate: totalDarts ? (bullCount / totalDarts) * 100 : 0,
    innerBullRate: totalDarts ? (innerBullCount / totalDarts) * 100 : 0,
    ppd,
    threeDAvg: ppd * 3,
    roundAvg: completedRounds ? totalScore / completedRounds : 0,
    maxRound,
    lowTon,
    highTon,
    ton80,
    threeInTheBlack,
    hatTrick
  };
}

// ====== Stats更新 ======
function updateStats() {
  
  const stats = calculateStats();
  
  const set = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };
  
  // 基本
  set("totalScore", stats.totalScore);
  set("totalDarts", stats.totalDarts);
  set("ppd", stats.ppd.toFixed(2));
  set("threeDAvg", stats.threeDAvg.toFixed(2));
  set("roundAvg", stats.roundAvg.toFixed(1));
  set("maxRound", stats.maxRound);
  
  // ===== Bulls =====
  document.getElementById("bullCount").textContent =
    stats.bullCount;
  
  document.getElementById("bullRateBar").style.width =
    stats.bullRate + "%";
  
  document.getElementById("bullPercent").textContent =
    stats.bullRate.toFixed(1) + "%";
  
  // ===== Inner Bulls =====
  document.getElementById("innerBulls").textContent =
    stats.innerBullCount;
  
  document.getElementById("innerBullRateBar").style.width =
    stats.innerBullRate + "%";
  
  document.getElementById("innerBullPercent").textContent =
    stats.innerBullRate.toFixed(1) + "%";
  
  // ===== 3DA表示制御 =====
  const threeDABox = document.getElementById("threeDABox");
  if (threeDABox) {
    const isFinished =
      game.rounds.every(r => r.every(d => d !== null));
    threeDABox.style.display = isFinished ? "flex" : "none";
  }
  
  // ===== Awards =====
  const awardsContainer =
    document.getElementById("awardsContainer");
  
  awardsContainer.innerHTML = "";
  
  const awards = [
    { name: "Hat Trick", value: stats.hatTrick },
    { name: "Low Ton", value: stats.lowTon },
    { name: "High Ton", value: stats.highTon },
    { name: "Ton80", value: stats.ton80 },
    { name: "3 in the Black", value: stats.threeInTheBlack }
  ];
  
  awards.forEach(a => {
    if (a.value > 0) {
      const item = document.createElement("div");
      item.className = "stat-item";
      item.innerHTML = `
        <span class="label">${a.name}</span>
        <span class="value">${a.value}</span>
      `;
      awardsContainer.appendChild(item);
    }
  });
  
  drawScoreChart();
}

// ====== 数字テーブル生成 ======
function createNumberTable() {

  const table = document.getElementById("numberTable");

  for (let i = 20; i >= 1; i--) {

    const row = document.createElement("div");
    row.className = "number-row";

    row.innerHTML = `
      <button>${i}</button>
      <button>D</button>
      <button>T</button>
    `;

    const buttons = row.querySelectorAll("button");

    buttons[0].addEventListener("click", () => addDart(i, 1));
    buttons[1].addEventListener("click", () => addDart(i, 2));
    buttons[2].addEventListener("click", () => addDart(i, 3));

    table.appendChild(row);
  }
}

// ====== 上段ボタン ======
function setupTopButtons() {

  document.querySelectorAll(".top-buttons button").forEach(btn => {

    if (btn.id === "undoBtn") {
      btn.addEventListener("click", undoDart);
      return;
    }

    btn.addEventListener("click", () => {

      const type = btn.dataset.display;

      if (type === "Bull") {
        if (bullMode === "fat") {
          addDart(25, 2, "outerBull");
        } else {
          addDart(25, 1, "outerBull");
        }
      }

      if (type === "InBull") {
        addDart(25, 2, "innerBull");
      }

      if (type === "Miss") {
        addDart(0, 1);
      }
    });
  });
}


// ====== 保存 ======
function saveGame() {
  const data = {
    rounds: game.rounds,
    currentRound: game.currentRound,
    currentDart: game.currentDart,
    lockedRound: lockedRound
  };
  
  localStorage.setItem("dartsPractice", JSON.stringify(data));
}


// ====== 呼び出し ======
function loadGame() {
  const saved = localStorage.getItem("dartsPractice");
  if (!saved) return;
  
  const data = JSON.parse(saved);
  
  game.rounds = data.rounds;
  game.currentRound = data.currentRound;
  game.currentDart = data.currentDart;
  lockedRound = data.lockedRound ?? -1;
}


// ====== グラフ ======
function drawScoreChart() {
  const canvas = document.getElementById("scoreChart");
  if (!canvas) return;
  
  const ctx = canvas.getContext("2d");
  const width = canvas.width = canvas.offsetWidth;
  const height = canvas.height = canvas.offsetHeight;
  
  ctx.clearRect(0, 0, width, height);
  
  const padding = 40;
  const graphWidth = width - padding * 2;
  const graphHeight = height - padding * 2;
  
  const maxScore = 180; // 🔥 縦軸固定
  const stepX = graphWidth / (TOTAL_ROUNDS - 1); // 🔥 横軸固定
  
  // ===== 横グリッド（固定目盛）=====
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.font = "11px sans-serif";
  ctx.lineWidth = 1;
  
  for (let i = 0; i <= 6; i++) {
    const value = (180 / 6) * i; // 0,30,60,90,120,150,180
    const y =
      height - padding - (value / maxScore) * graphHeight;
    
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(width - padding, y);
    ctx.stroke();
    
    ctx.fillText(value, 5, y + 4);
  }
  
  // ===== ラウンドスコア取得（3投完了のみ）=====
  const roundScores = game.rounds.map(round =>
    round.every(d => d !== null) ?
    round.reduce((sum, d) => sum + d.score, 0) :
    null
  );
  
  // ===== 折れ線 =====
  ctx.strokeStyle = "#00ffc8";
  ctx.lineWidth = 2;
  ctx.beginPath();
  
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
  
  // ===== 点描画 =====
  const validScores = roundScores.filter(s => s !== null);
  const maxRound = validScores.length ?
    Math.max(...validScores) :
    0;
  
  roundScores.forEach((score, i) => {
    const x = padding + stepX * i;
    
    // ラウンド番号表示（常に表示）
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "10px sans-serif";
    ctx.fillText(`R${i + 1}`, x - 8, height - 10);
    
    if (score === null) return;
    
    const y =
      height - padding -
      (score / maxScore) * graphHeight;
    
    ctx.beginPath();
    
    if (score === maxRound) {
      ctx.fillStyle = "#ffd54f";
      ctx.arc(x, y, 6, 0, Math.PI * 2);
    } else {
      ctx.fillStyle = "#69f0ae";
      ctx.arc(x, y, 4, 0, Math.PI * 2);
    }
    
    ctx.fill();
  });
}

function saveSessionToHistory() {
  
  const stats = calculateStats();
  
  const session = {
    id: Date.now(),
    date: new Date().toISOString(),
    totalScore: stats.totalScore,
    totalDarts: stats.totalDarts,
    ppd: stats.ppd,
    roundAvg: stats.roundAvg,
    maxRound: stats.maxRound,
    rounds: JSON.parse(JSON.stringify(game.rounds))
  };
  
  sessions.push(session);
  
  localStorage.setItem(
    "dartsSessions",
    JSON.stringify(sessions)
  );
}

function loadSessions() {
  const saved = localStorage.getItem("dartsSessions");
  if (saved) {
    sessions = JSON.parse(saved);
  }
}



function resetGame() {
  if (!isGameComplete()) return;
  
  saveSessionToHistory();
  
  // 初期化
  game.rounds = [];
  for (let i = 0; i < TOTAL_ROUNDS; i++) {
    game.rounds.push([null, null, null]);
  }
  
  game.currentRound = 0;
  game.currentDart = 0;
  lockedRound = -1;
  
  localStorage.removeItem("dartsPractice");
  
  renderRounds();
  updateStats();
  updateNextGameButton();
}


function isGameComplete() {
  const lastRound = game.rounds[7]; // R8
  
  if (!lastRound) return false;
  
  return lastRound.every(d => d !== null && d !== undefined);
}

function updateNextGameButton() {
  const btn = document.getElementById("nextGameBtn");
  
  if (isGameComplete()) {
    btn.disabled = false;
  } else {
    btn.disabled = true;
  }
}



document
  .getElementById("nextGameBtn")
  .addEventListener("click", resetGame);
  
  
  