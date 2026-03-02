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

  // iPhone判定 → レイアウト切替用クラス付与
  if (/iPhone/.test(navigator.userAgent)) {
    document.body.classList.add("iphone-mode");
  }

  // ゲーム初期化（状態作成＋描画）
  init();

  // イベント登録（クリック処理など）
  registerEvents();

  // PWA用 ServiceWorker 登録
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("./sw.js")
      .then(() => console.log("SW registered"))
      .catch(err => console.log("SW error", err));
  }

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


/// ===============================
// ===== イベント登録 ============
// ===============================

function registerEvents() {
  
  // NEXT GAME ボタン
  // 押されたらゲームをリセット
  const nextBtn = document.getElementById("nextGameBtn");
  if (nextBtn) {
    nextBtn.addEventListener("click", resetGame);
  }
  
  
  // iPhone用 Stats 開閉ボタン
  const statsBtn = document.getElementById("statsToggleBtn");
  
  if (statsBtn) {
    
    statsBtn.addEventListener("click", () => {
      
      // body にクラスを付け外ししてレイアウト切替
      document.body.classList.toggle("iphone-stats-open");
      
      // ボタン表示を矢印で切替
      statsBtn.textContent =
        document.body.classList.contains("iphone-stats-open") ?
        "◀" :
        "▶";
    });
  }
  
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
// ===== Stats計算 ===============
// ===============================

function calculateStats() {
  
  // ------------------------------------------
  // ① 集計用変数初期化
  // ------------------------------------------
  let totalScore = 0; // 合計得点
  let totalDarts = 0; // 総投数
  let bullCount = 0; // Bull合計
  let innerBullCount = 0; // Inner Bull数
  let maxRound = 0; // 最高ラウンド得点
  let completedRounds = 0; // 1本以上投げたラウンド数
  
  
  // ------------------------------------------
  // ② 各ラウンドを走査
  // ------------------------------------------
  game.rounds.forEach(round => {
    
    let roundScore = 0; // そのラウンドの合計
    let dartCount = 0; // そのラウンドの投数
    
    
    // --------------------------------------
    // ③ 各ダーツを走査
    // --------------------------------------
    round.forEach(dart => {
      
      // 未入力は無視
      if (!dart) return;
      
      dartCount++;
      totalScore += dart.score;
      totalDarts++;
      roundScore += dart.score;
      
      
      // Bull判定
      if (
        dart.special === "outerBull" ||
        dart.special === "innerBull"
      ) {
        bullCount++;
      }
      
      // Inner Bull判定
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
  // ⑤ 平均計算
  // ------------------------------------------
  
  // Points Per Dart
  const ppd = totalDarts ?
    totalScore / totalDarts :
    0;
  
  
  // ------------------------------------------
  // ⑥ 結果オブジェクト返却
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
    
    maxRound
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
  
  set("totalScore", stats.totalScore);
  set("totalDarts", stats.totalDarts);
  
  set("ppd", stats.ppd.toFixed(2)); // 小数2桁
  set("roundAvg", stats.roundAvg.toFixed(1));
  set("maxRound", stats.maxRound);
  
  set("bullCount", stats.bullCount);
  set("innerBulls", stats.innerBullCount);
  
  set("bullPercent", stats.bullRate.toFixed(1) + "%");
  set("innerBullPercent", stats.innerBullRate.toFixed(1) + "%");
  
  
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
  // ⑤ グラフ再描画
  // ------------------------------------------
  // ラウンドスコアの変化を反映
  drawScoreChart();
}


// ===============================
// ===== 数字テーブル ============
// ===============================

function createNumberTable() {
  
  // ------------------------------------------
  // ① テーブル取得
  // ------------------------------------------
  const table = document.getElementById("numberTable");
  if (!table) return;
  
  // 再生成前に中身をクリア
  table.innerHTML = "";
  
  
  // ------------------------------------------
  // ② 20 → 1 までループ
  // ------------------------------------------
  for (let i = 20; i >= 1; i--) {
    
    const row = document.createElement("div");
    row.className = "number-row";
    
    
    // --------------------------------------
    // ③ ボタンHTML生成
    // --------------------------------------
    row.innerHTML = `
      <button>${i}</button>   <!-- 通常 -->
      <button>D</button>      <!-- Double -->
      <button>T</button>      <!-- Triple -->
    `;
    
    
    // --------------------------------------
    // ④ イベント登録
    // --------------------------------------
    const buttons = row.querySelectorAll("button");
    
    // 通常
    buttons[0].addEventListener("click", () => addDart(i, 1));
    
    // Double
    buttons[1].addEventListener("click", () => addDart(i, 2));
    
    // Triple
    buttons[2].addEventListener("click", () => addDart(i, 3));
    
    
    // --------------------------------------
    // ⑤ DOMに追加
    // --------------------------------------
    table.appendChild(row);
  }
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
  
  // ------------------------------------------
  // ① canvas取得
  // ------------------------------------------
  const canvas = document.getElementById("scoreChart");
  if (!canvas) return;
  
  const ctx = canvas.getContext("2d");
  
  
  // ------------------------------------------
  // ② サイズ同期
  // ------------------------------------------
  // 表示幅に合わせて内部解像度も合わせる
  const width = canvas.width = canvas.offsetWidth;
  const height = canvas.height = 180;
  
  
  // ------------------------------------------
  // ③ クリア
  // ------------------------------------------
  ctx.clearRect(0, 0, width, height);
  
  
  // ------------------------------------------
  // ④ グラフ領域設定
  // ------------------------------------------
  const padding = 40;
  
  const graphWidth = width - padding * 2;
  const graphHeight = height - padding * 2;
  
  const maxScore = 180; // 縦軸固定
  const stepX = graphWidth / (TOTAL_ROUNDS - 1); // 横軸間隔
  
  
  // ------------------------------------------
  // ⑤ ラウンドスコア抽出
  // ------------------------------------------
  // 3投完了ラウンドのみ対象
  const roundScores = game.rounds.map(round =>
    round.every(d => d !== null) ?
    round.reduce((sum, d) => sum + d.score, 0) :
    null
  );
  
  
  // ------------------------------------------
  // ⑥ 折れ線描画
  // ------------------------------------------
  ctx.strokeStyle = "#00ffc8";
  ctx.lineWidth = 2;
  ctx.beginPath();
  
  let started = false;
  
  roundScores.forEach((score, i) => {
    
    if (score === null) return;
    
    // 横座標（ラウンド番号に比例）
    const x = padding + stepX * i;
    
    // 縦座標（スコアを割合に変換）
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