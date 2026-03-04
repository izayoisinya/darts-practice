// ===============================
// ===== 設定 / グローバル変数 ===
// ===============================

// 何ラウンド制にするか
// 8にしているので「8ラウンド × 3投 = 24投」
const TOTAL_ROUNDS = 8;

// Bullの挙動モード
// "fat" → Bullボタンで50点（ダブル扱い）
// 将来的に "split" など拡張できる設計
let bullMode = "fat";

// Undo制御用
// どこまでラウンドを「確定済み」にするか
// -1 は「まだ確定なし」という意味
let lockedRound = -1;

// セッション履歴保存用（今は未使用に近い）
// 将来「履歴一覧」を作るための配列
let sessions = [];

// ===============================
// ===== ゲーム状態管理オブジェクト
// ===============================

const game = {
  
  // ラウンドデータを入れる配列
  // 例:
  // [
  //   [dart, dart, dart],
  //   [dart, dart, dart],
  //   ...
  // ]
  rounds: [],
  
  // 現在どのラウンドか（0〜7）
  currentRound: 0,
  
  // 現在そのラウンドの何投目か（0〜2）
  currentDart: 0
};


// ===============================
// ===== 初期化 ==================
// ===============================

// DOM構築完了後に実行
document.addEventListener("DOMContentLoaded", () => {

 detectDevice();

  // ゲーム初期化（状態作成＋描画）
  init();

  // イベント登録（クリック処理など）
  registerEvents();

// 画面回転時にStatsを閉じる
window.addEventListener("orientationchange", () => {
  document.body.classList.remove("iphone-stats-open");
});

  // PWA用 ServiceWorker 登録
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("./sw.js")
      .then(() => console.log("SW registered"))
      .catch(err => console.log("SW error", err));
  }

window.addEventListener("resize", () => {
  
  createNumberTable();
});

});


// ===============================
// ===== ゲーム初期化処理 ========
// ===============================
function init() {

  // ラウンドデータ初期化
  game.rounds = Array.from(
    { length: TOTAL_ROUNDS },
    () => [null, null, null]
  );

  // 保存データ復元
  loadGame();

  // UI構築
  createNumberTable();
  setupTopButtons();

  // 描画
  renderRounds();
  updateStats();
  updateNextGameButton();
}


// ===============================
// ===== イベント登録 ============
// ===============================

function registerEvents() {
  
  // ------------------------------------------
  // NEXT GAME ボタン
  // ------------------------------------------
  const nextBtn = document.getElementById("nextGameBtn");
  if (nextBtn) {
    nextBtn.addEventListener("click", resetGame);
  }
  
  const statsArea = document.querySelector(".stats-area");
  
  statsArea.addEventListener("click", (e) => {
    
    // 詳細エリア操作時は開閉しない
    if (e.target.closest(".stats-detail")) return;
    
    if (
  document.body.classList.contains("phone") &&
  document.body.classList.contains("landscape")
){
      
      document.body.classList.toggle("iphone-stats-open");
      
      // 👇 ここを追加
      setTimeout(() => {
        drawScoreChart();
      }, 300); // CSSレイアウト変化後に再描画
      
    }
    
  });
  
  const roundArea = document.querySelector(".round-area");
  
  roundArea.addEventListener("click", () => {
  
  if (
    document.body.classList.contains("phone") &&
    document.body.classList.contains("portrait")
  ) {
    document.body.classList.toggle("round-open");
  }
  
});

document.querySelectorAll(".side-menu button").forEach(btn => {
  
  btn.addEventListener("click", () => {
    
    document
      .getElementById("sideMenu")
      .classList.remove("open")
    
  })
  
})

}


// ===============================
// ===== ダーツ追加 ==============
// ===============================
function addDart(value, multiplier, special = null) {
  
  // 全ラウンド終了していたら何もしない
  if (game.currentRound >= TOTAL_ROUNDS) return;
  
  
  // ラウンド確定処理
  // 次ラウンド1投目に入った瞬間、前ラウンドをロック
  if (game.currentDart === 0 && game.currentRound > lockedRound + 1) {
    lockedRound = game.currentRound - 1;
  }
  
  
  // 得点計算
  const score = value * multiplier;
  
  
  // 現在ラウンド・現在投目にデータ格納
  game.rounds[game.currentRound][game.currentDart] = {
    value,
    multiplier,
    score,
    special
  };
  
  
  // 投目を進める
  game.currentDart++;
  
  
  // 3投終わったら次ラウンドへ
  if (game.currentDart === 3) {
    game.currentDart = 0;
    game.currentRound++;
  }
  
  
  // 画面更新
  renderRounds();
  updateStats();
  saveGame();
  updateNextGameButton();
}


// ===============================
// ===== ダーツ取り消し ==========
// ===============================
function undoDart() {
  
  // 何も投げていない場合は何もしない
  if (game.currentRound === 0 && game.currentDart === 0) return;
  
  
  // 確定済みラウンドには戻れない
  if (game.currentRound - 1 <= lockedRound && game.currentDart === 0) return;
  
  
  // もしラウンド先頭なら1ラウンド戻る
  if (game.currentDart === 0) {
    game.currentRound--;
    game.currentDart = 3;
  }
  
  
  // 1投戻す
  game.currentDart--;
  
  
  // 該当箇所を空にする
  game.rounds[game.currentRound][game.currentDart] = null;
  
  
  // 画面更新
  renderRounds();
  updateStats();
  saveGame();
  updateNextGameButton();
}


// ===============================
// ===== ラウンド描画 ============
// ===============================
function renderRounds() {
  
  // 描画先コンテナ取得
  const container = document.getElementById("roundContainer");
  if (!container) return;
  
  
  // 毎回リセットしてから再描画
  // （状態駆動なので差分更新しない）
  container.innerHTML = "";
  
  
  // 各ラウンドを順番に描画
  game.rounds.forEach((round, index) => {
    
    const row = document.createElement("div");
    row.className = "round";
    
    
    // ------------------------------------------
    // ラウンド合計スコア計算
    // ------------------------------------------
    const roundScore = round.reduce(
      (sum, d) => sum + (d ? d.score : 0),
      0
    );
    
    
    // ------------------------------------------
    // ダーツ1本分の表示生成関数
    // ------------------------------------------
    const renderDart = (dart) => {
      
      // 未入力
      if (!dart) return `<span class="dart">-</span>`;
      
      let cls = "";
      
      // 状態に応じてクラス分岐
      if (dart.score === 0) cls = " miss";
      else if (dart.special === "innerBull") cls = " inner-bull";
      else if (dart.special === "outerBull") cls = " outer-bull";
      else if (dart.multiplier === 3) cls = " triple";
      else if (dart.multiplier === 2) cls = " double";
      
      return `<span class="dart${cls}">${dart.score}</span>`;
    };
    
    // ------------------------------------------
    // HTML構築
    // ------------------------------------------
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
    
    // DOMへ追加
    container.appendChild(row);
  });
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

  // ★ Awards用
  let hatTrick = 0;
  let lowTon = 0;
  let highTon = 0;
  let ton80 = 0;
  let threeInTheBlack = 0;

  
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
    threeInTheBlack
  };
}


// ===============================
// ===== Stats更新 ===============
// ===============================
function updateStats() {
  
  // ------------------------------------------
  // ① 最新の統計を取得
  // ------------------------------------------
  // calculateStats は純粋計算関数
  // ここではその結果を受け取るだけ
  const stats = calculateStats();
  
  
  // ------------------------------------------
  // ② テキスト更新用の共通関数
  // ------------------------------------------
  // 毎回 getElementById して textContent を
  // 書くのを簡略化するための小ヘルパー
  const set = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };
  
  
  // ------------------------------------------
  // ③ 数値表示更新
  // ------------------------------------------
  
  // Header
set("totalScore", stats.totalScore);
set("totalDarts", stats.totalDarts);
  
  // Bulls
set("bullCount", stats.bullCount);
set("bullCountCompact", stats.bullCount);

// Inner
set("innerBulls", stats.innerBullCount);
set("innerBullsCompact", stats.innerBullCount);

// PPD
set("ppd", stats.ppd.toFixed(2));
set("ppdCompact", stats.ppd.toFixed(2));

// Avg
set("roundAvg", stats.roundAvg.toFixed(1));
set("roundAvgCompact", stats.roundAvg.toFixed(1));

// Max
set("maxRound", stats.maxRound);
set("maxRoundCompact", stats.maxRound);
  
  // ------------------------------------------
  // ④ バー表示更新（CSS幅変更）
  // ------------------------------------------
  
  const bullBar = document.getElementById("bullRateBar");
  if (bullBar) {
    bullBar.style.width = stats.bullRate + "%";
  }
  
  const innerBar = document.getElementById("innerBullRateBar");
  if (innerBar) {
    innerBar.style.width = stats.innerBullRate + "%";
  }
  
  // ------------------------------------------
// ⑤ Awards表示更新
// ------------------------------------------

const awardsContainer = document.getElementById("awardsContainer");

if (awardsContainer) {
  
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
}
  
  
  // ------------------------------------------
  // ⑤ グラフ再描画
  // ------------------------------------------
  // ラウンドスコアの変化を反映
  drawScoreChart();
  
  // Compact表示更新
const setCompact = (id, value) => {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
};

setCompact("bullCountCompact", stats.bullCount);
setCompact("bullPercentCompact", stats.bullRate.toFixed(1) + "%");

setCompact("innerBullsCompact", stats.innerBullCount);
setCompact("innerBullPercentCompact", stats.innerBullRate.toFixed(1) + "%");

setCompact("ppdCompact", stats.ppd.toFixed(2));
setCompact("roundAvgCompact", stats.roundAvg.toFixed(2));
setCompact("maxRoundCompact", stats.maxRound);

// Compact Percent
set("bullPercentCompact", stats.bullRate.toFixed(1) + "%");
set("innerBullPercentCompact", stats.innerBullRate.toFixed(1) + "%");
  
}


// ===============================
// ===== 数字テーブル ============
// ===============================
function createNumberTable() {
  
  const table = document.getElementById("numberTable");
  if (!table) return;
  
  table.innerHTML = "";
  
const isPhoneLandscape =
  document.body.classList.contains("phone") &&
  document.body.classList.contains("landscape");
  
  // ===============================
  // iPhone横 → 2カラム
  // ===============================
  if (isPhoneLandscape) {
    
    const leftColumn = document.createElement("div");
    leftColumn.className = "number-column";
    
    for (let i = 20; i >= 11; i--) {
      leftColumn.appendChild(createNumberRow(i));
    }
    
    const rightColumn = document.createElement("div");
    rightColumn.className = "number-column";
    
    for (let i = 10; i >= 1; i--) {
      rightColumn.appendChild(createNumberRow(i));
    }
    
    table.appendChild(leftColumn);
    table.appendChild(rightColumn);
    
  }
  
  // ===============================
  // iPad / PC → 1カラム
  // ===============================
  else {
    
    for (let i = 20; i >= 1; i--) {
      table.appendChild(createNumberRow(i));
    }
    
  }
  

}


function createNumberRow(num) {
  
  const row = document.createElement("div");
  row.className = "number-row";
  
  // Single
  const single = document.createElement("button");
  single.textContent = num;
  single.addEventListener("click", () => {
    addDart(num, 1);
  });
  
  // Double
  const double = document.createElement("button");
  double.textContent = "D";
  double.addEventListener("click", () => {
    addDart(num, 2);
  });
  
  // Triple
  const triple = document.createElement("button");
  triple.textContent = "T";
  triple.addEventListener("click", () => {
    addDart(num, 3);
  });
  
  row.appendChild(single);
  row.appendChild(double);
  row.appendChild(triple);
  
  return row;
}


// ===============================
// ===== 上部ボタン設定 ===========
// ===============================
function setupTopButtons() {
  
  // .top-buttons 内の全ボタン取得
  document
    .querySelectorAll(".top-buttons button")
    .forEach(btn => {
      
      // --------------------------------------
      // Undoボタンは特別処理
      // --------------------------------------
      if (btn.id === "undoBtn") {
        btn.addEventListener("click", undoDart);
        return;
      }
      
      
      // --------------------------------------
      // その他ボタン
      // --------------------------------------
      btn.addEventListener("click", () => {
        
        const type = btn.dataset.display;
        
        
        // Bull
        if (type === "Bull") {
          addDart(
            25,
            bullMode === "fat" ? 2 : 1,
            "outerBull"
          );
        }
        
        
        // Inner Bull
        if (type === "InBull") {
          addDart(25, 2, "innerBull");
        }
        
        
        // Miss
        if (type === "Miss") {
          addDart(0, 1);
        }
        
      });
    });
}


// ===============================
// ===== 保存 ====================
// ===============================
function saveGame() {
  
  // ------------------------------------------
  // ① 保存データ構築
  // ------------------------------------------
  // game の現在状態をそのままオブジェクト化
  const data = {
    rounds: game.rounds,
    currentRound: game.currentRound,
    currentDart: game.currentDart,
    lockedRound
  };
  
  
  // ------------------------------------------
  // ② JSON文字列へ変換
  // ------------------------------------------
  // localStorage は文字列しか保存できないため
  const json = JSON.stringify(data);
  
  
  // ------------------------------------------
  // ③ localStorageへ保存
  // ------------------------------------------
  localStorage.setItem("dartsPractice", json);
}


// ===============================
// ===== 読み込み =================
// ===============================
function loadGame() {
  
  // ------------------------------------------
  // ① 保存データ取得
  // ------------------------------------------
  const saved = localStorage.getItem("dartsPractice");
  
  // 保存がなければ終了
  if (!saved) return;
  
  
  // ------------------------------------------
  // ② JSONをオブジェクトへ復元
  // ------------------------------------------
  const data = JSON.parse(saved);
  
  
  // ------------------------------------------
  // ③ ゲーム状態へ反映
  // ------------------------------------------
  game.rounds = data.rounds;
  game.currentRound = data.currentRound;
  game.currentDart = data.currentDart;
  
  // 古いデータ対策（null安全）
  lockedRound = data.lockedRound ?? -1;
}


// ===============================
// ===== グラフ ==================
// ===============================
function drawScoreChart() {
  
  const canvas = document.getElementById("scoreChart");
  if (!canvas) return;
  
  // 👇 追加
if (!canvas.offsetWidth || !canvas.offsetHeight) return;
  
  const ctx = canvas.getContext("2d");
  
  const width = canvas.width = canvas.offsetWidth;
  const height = canvas.height = 220;
  
  ctx.clearRect(0, 0, width, height);
  
  const padding = 25;
  const graphWidth = width - padding * 2;
  const graphHeight = height - padding * 2;
  
  const maxScore = 180;
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
  const accent = getComputedStyle(document.documentElement)
  .getPropertyValue("--accent")
  .trim();

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
  
  ctx.arc(x, y, 5, 0, Math.PI * 2);
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


// ===============================
// ===== 完了判定 =================
// ===============================
function isGameComplete() {
  
  // ------------------------------------------
  // ① 全ラウンドをチェック
  // ------------------------------------------
  // game.rounds の構造：
  // [
  //   [dart, dart, dart],
  //   [dart, dart, dart],
  //   ...
  // ]
  
  return game.rounds.every(round =>
    
    // --------------------------------------
    // ② 各ラウンドの3投をチェック
    // --------------------------------------
    // null でなければ「入力済み」
    round.every(d => d !== null)
  );
}


// ===============================
// NEXT GAME ボタンの有効/無効を制御する関数
// ===============================
function updateNextGameButton() {
  
  // ボタン要素を取得
  const btn = document.getElementById("nextGameBtn");
  
  // もしボタンが存在しなければ何もしない
  if (!btn) return;
  
  // isGameComplete() が true なら
  // disabled = false（押せる）
  
  // false なら
  // disabled = true（押せない）
  
  btn.disabled = !isGameComplete();
}


// ===============================
// ゲームを完全リセットする関数
// ===============================
function resetGame() {

  // ① ゲームが未完了なら何もしない
  // （8ラウンドすべて埋まっていない場合）
  if (!isGameComplete()) return;


  // ② ラウンドデータを初期化
  // TOTAL_ROUNDS 分の配列を作り
  // 各ラウンドを [null, null, null] に戻す
  game.rounds = Array.from(
    { length: TOTAL_ROUNDS },
    () => [null, null, null]
  );


  // ③ 現在のラウンド番号を最初に戻す
  game.currentRound = 0;

  // ④ 現在のダーツ番号（1投目〜3投目）をリセット
  game.currentDart = 0;

  // ⑤ Undoロックも解除
  // （確定ラウンドの制限をリセット）
  lockedRound = -1;


  // ⑥ 保存データを削除
  // ローカルストレージから現在のゲーム状態を消す
  localStorage.removeItem("dartsPractice");


  // ⑦ 画面を再描画
  renderRounds();          // ラウンド表示更新
  updateStats();           // Stats更新
  updateNextGameButton();  // ボタン状態更新
}




// body要素を取得（毎回querySelectorしないため）
const body = document.body;


// ===============================
// デバイス判定関数
// ===============================
function detectDevice() {
  
  // 画面横幅取得
  const w = window.innerWidth;
  
  // クラスリセット
  body.classList.remove(
    "phone",
    "tablet",
    "desktop",
    "portrait",
    "landscape"
  );
  
  // -------------------------
  // デバイス判定
  // -------------------------
  
  const isMobile =
    /Android|iPhone|iPod|Mobile/i.test(navigator.userAgent);
  
  if (isMobile) {
    body.classList.add("phone");
  }
  else if (w < 1200) {
    body.classList.add("tablet");
  }
  else {
    body.classList.add("desktop");
  }
  
  // -------------------------
  // 画面向き判定
  // -------------------------
  
  if (window.matchMedia("(orientation: portrait)").matches) {
    body.classList.add("portrait");
  } else {
    body.classList.add("landscape");
  }
  
}


// =================================
// 画面サイズ変更時（回転・リサイズ）
// =================================

/* ========================= */
/* SWIPE MENU */
/* ========================= */

let startX = 0

document.addEventListener("touchstart", (e) => {
  
  startX = e.touches[0].clientX
  
})


document.addEventListener("touchend", (e) => {
  
  const currentX = e.changedTouches[0].clientX
  const diff = startX - currentX
  const sideMenu = document.getElementById("sideMenu")
  
  if (!sideMenu) return
  
  if (startX > window.innerWidth - 40 ) {
    
    sideMenu.classList.add("open")
    
  }
  
})


/* タップで閉じる */

document.addEventListener("click", (e) => {
  
  const menu = document.getElementById("sideMenu")
  
  if (!menu) return
  
  if (!menu.contains(e.target)) {
    
    menu.classList.remove("open")
    
  }
  
})

