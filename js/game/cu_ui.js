function updateUI() {
  renderZeroOneRecord()
  renderRounds()
  renderHeaderRound()
  updateStats()
  drawScoreChart()
  updateNextGameButton()
  if (typeof renderBoardMarkers === "function") {
    renderBoardMarkers()
  }
  renderGameSidePanels()
  showZeroOneResultIfDone()
  saveGame()
}


// ===============================
// ===== 01 の表示 ================
// ===============================
// ヘッダーの設定の表示、今の設定での上がり率・上がるまでのダーツ数、ゲームが終わったときの結果、設定の画面
let zeroOneWasComplete = false
let zeroOneSetupDraft = null

function renderZeroOneRecord() {

  if (GAME_TYPE !== "01") return

  const info = document.getElementById("zeroOneInfo")
  if (info) info.textContent = formatZeroOneConfig(zeroOneConfig)

  const record = getZeroOneRecord()
  const rate = record.games ? `${record.rate.toFixed(0)}%` : "-"
  const avg = record.avgDarts ? record.avgDarts.toFixed(1) : "-"

  const set = (id, text) => {
    const el = document.getElementById(id)
    if (el) el.textContent = text
  }
  set("zeroOneRate", rate)
  set("zeroOneRateSub", record.games ? `${record.finished} / ${record.games}` : "")
  set("zeroOneAvgDarts", avg)
  set("zeroOneBestDarts", record.bestDarts ? `BEST ${record.bestDarts}` : "")
  set("zeroOneRateCompact", rate)
  set("zeroOneAvgDartsCompact", record.avgDarts ? `${avg} darts` : "")
}

// ゲームが終わった瞬間に、結果（上がったダーツ数 / 上がれなかった）を画面の中央に出す
function showZeroOneResultIfDone() {

  if (GAME_TYPE !== "01") return

  const complete = isGameComplete()
  if (complete && !zeroOneWasComplete) {
    const state = computeZeroOne()
    showUndoToast(state.finished ? `OUT · ${state.finishDarts} DARTS` : "NO OUT")
  }
  zeroOneWasComplete = complete
}

function setupZeroOneScreen() {

  if (GAME_TYPE !== "01") return

  document.body.classList.add("game-01")
  document.title = "01 | Darts Practice"
  zeroOneWasComplete = isGameComplete()

  const info = document.getElementById("zeroOneInfo")
  if (info) info.addEventListener("click", () => openZeroOneSetup())

  const cancel = document.getElementById("zeroOneSetupCancel")
  if (cancel) cancel.addEventListener("click", closeZeroOneSetup)

  const start = document.getElementById("zeroOneSetupStart")
  if (start) start.addEventListener("click", applyZeroOneSetup)
}

function openZeroOneSetup() {

  const box = document.getElementById("zeroOneSetup")
  if (!box) return

  zeroOneSetupDraft = { ...zeroOneConfig }

  const options = {
    start: ZERO_ONE_STARTS.map(value => [value, String(value)]),
    out: ZERO_ONE_OUTS.map(value => [value, ZERO_ONE_OUT_LABELS[value]]),
    rounds: ZERO_ONE_ROUND_LIMITS.map(value => [value, `R${value}`])
  }

  box.querySelectorAll(".zeroone-setup-options").forEach(group => {
    const key = group.dataset.key
    group.innerHTML = options[key]
      .map(([value, label]) => `<button type="button" data-value="${value}">${label}</button>`)
      .join("")

    group.querySelectorAll("button").forEach(btn => {
      btn.addEventListener("click", () => {
        zeroOneSetupDraft[key] = key === "out" ? btn.dataset.value : Number(btn.dataset.value)
        markZeroOneSetupSelection(box)
      })
    })
  })

  markZeroOneSetupSelection(box)
  box.hidden = false
}

function markZeroOneSetupSelection(box) {
  box.querySelectorAll(".zeroone-setup-options").forEach(group => {
    const key = group.dataset.key
    group.querySelectorAll("button").forEach(btn => {
      btn.classList.toggle("selected", String(zeroOneSetupDraft[key]) === btn.dataset.value)
    })
  })
}

function closeZeroOneSetup() {
  const box = document.getElementById("zeroOneSetup")
  if (box) box.hidden = true
}

// 設定を決めて新しいゲームを始める。投げている途中なら確かめてから（今のゲームは保存せずに消す）
function applyZeroOneSetup() {

  const config = normalizeZeroOneConfig(zeroOneSetupDraft)
  const thrown = game.rounds.some(round => round.some(dart => dart))
  const changed = JSON.stringify(config) !== JSON.stringify(zeroOneConfig)

  if (thrown && !isGameComplete()) {
    if (!confirm("今のゲームを終えずに、新しい設定で始め直しますか？\n（今のゲームは記録されません）")) return
  } else if (thrown && isGameComplete()) {
    // 終わったゲームは記録してから始める（NEXT GAME と同じ）
    saveSession()
  } else if (!changed) {
    closeZeroOneSetup()
    return
  }

  writeZeroOneConfig(config)
  localStorage.removeItem(SAVE_KEY)
  closeZeroOneSetup()
  initGame(false)
  zeroOneWasComplete = false
  updateUI()
}


// ===============================
// ===== ダーツ1本描画 ==========
// ===============================
// 1 投の種類に合わせた色分けのクラス（ミス・ブル・トリプル・ダブル）
function getDartClass(dart) {
  
  if (!dart) return ""
  if (dart.score === 0) return " miss"
  if (dart.special === "innerBull") return " inner-bull"
  if (dart.special === "outerBull") return " outer-bull"
  if (dart.multiplier === 3) return " triple"
  if (dart.multiplier === 2) return " double"
  return ""
}

function renderDart(dart) {
  
  if (!dart) {
    return `<span class="dart">-</span>`
  }
  
  return `<span class="dart${getDartClass(dart)}">
    ${dart.score}
  </span>`
}


// ===============================
// ===== ラウンド描画 ============
// ===============================
function renderRounds() {
  
  const container = document.getElementById("roundContainer")
  if (!container) return
  
  container.innerHTML = ""
  
  // 01：ラウンドの点の代わりに、そのラウンドのあとの残り点数を出す（バストは BUST、上がりは OUT）
  const zeroOne = GAME_TYPE === "01" ? computeZeroOne() : null

  game.rounds.forEach((round, index) => {
    
    const row = document.createElement("div")
    row.className = "round"
    
    const roundScore = round.reduce(
      (sum, d) => sum + (d ? d.score : 0),
      0
    )

    let scoreHtml = `<span class="round-score">${roundScore}</span>`
    if (zeroOne) {
      const info = zeroOne.rounds[index]
      if (info.bust) {
        row.classList.add("bust")
        scoreHtml = `<span class="round-score round-bust">BUST</span>`
      } else if (info.finished) {
        row.classList.add("finished")
        scoreHtml = `<span class="round-score round-out">OUT</span>`
      } else {
        scoreHtml = `<span class="round-score">${info.thrown ? info.remaining : ""}</span>`
      }
    }
    
    row.innerHTML = `
      <span class="round-label">R${index + 1}</span>

      <span class="round-darts">
        ${ renderDart(round[0]) }
${ renderDart(round[1]) }
${ renderDart(round[2]) }
      </span>

      ${scoreHtml}
    `
    
    container.appendChild(row)
    
  })
  
}


// ===============================
// ===== ヘッダーの今のラウンド ===
// ===============================
// 合計スコアの右に、今のラウンドの各ダーツの得点を出す。
// 3 投目のあとは、次の 1 投目を入れるまで入れ終わったラウンドを表示する
function getDisplayRoundIndex() {

  if (game.currentDart > 0) return game.currentRound
  if (game.currentRound > 0) return game.currentRound - 1
  return 0
}

function renderHeaderRound() {

  const el = document.getElementById("headerRound")
  if (!el) return

  const index = Math.min(getDisplayRoundIndex(), TOTAL_ROUNDS - 1)
  const round = game.rounds[index] || [null, null, null]

  // 確定したラウンド（次のラウンドを投げ始めた後）は消せない
  const deletable = index > lockedRound

  // 合計スコアと同じ光る数字で出す（まだ投げていない分は薄い「-」）
  const darts = round
    .map(dart => dart
      ? `<span class="header-dart${getDartClass(dart)}"${deletable ? ` role="button" aria-label="${dart.score} を消す"` : ""}>${dart.score}</span>`
      : `<span class="header-dart empty">-</span>`)
    .join("")

  el.innerHTML = `
    <span class="header-round-label">R${index + 1}</span>
    <span class="header-round-darts">${darts}</span>
  `

  // 入れた数字をタップするとその 1 投を消す
  el.querySelectorAll(".header-round-darts .header-dart").forEach((span, dartIndex) => {
    if (!deletable || !round[dartIndex]) return
    span.addEventListener("click", () => {
      if (deleteDart(index, dartIndex)) showUndoToast("削除")
    })
  })
}


// ===============================
// ===== 数字テーブル ============
// ===============================
function createNumberTable() {
  
  const table = document.getElementById("numberTable");
  if (!table) return;
  
  table.innerHTML = "";
  
  // ボード形式の入力（設定画面で切り替え）
  const useBoard = inputMode === "board" && typeof renderBoardInput === "function";
  document.body.classList.toggle("input-board", useBoard);
  table.classList.toggle("board-mode", useBoard);
  
  // 横向きでボードの大きさに合わせて入力エリアの幅を決める（ボード以外のときは解除）
  fitBoardColumn(useBoard);
  
  if (useBoard) {
    renderBoardInput(table);
    renderGameSidePanels();
    return;
  }
  
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
// ===== ボードに合わせた入力エリアの幅 =====
// ===============================
// 横向きのボード入力では、ボードが入力エリアの「高さ」いっぱいの大きさになるよう、
// 入力エリアの列の幅をボードの高さに合わせる（--board-col。使う側は lay_input.css）。
// 幅が足りないとき（ほかのエリアが狭くなりすぎるとき）は上限で止め、ボードは幅に合わせて小さくなる
const BOARD_COLUMN_MAX_RATIO = { three: 0.42, two: 0.62 }

function fitBoardColumn(useBoard) {

  const container = document.querySelector(".container")
  const table = document.getElementById("numberTable")
  if (!container || !table) return

  const body = document.body

  if (!useBoard || !body.classList.contains("landscape")) {
    container.style.removeProperty("--board-col")
    return
  }

  // 列の幅を変えてもボードを置く場所の高さは変わらないので、描き直す前に測れる
  const inputArea = document.querySelector(".input-area")
  const boardHeight = table.clientHeight
  if (!inputArea || !boardHeight) return

  const style = getComputedStyle(inputArea)
  const sideSpace =
    parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) +
    parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth)

  const columns =
    1 +
    (body.classList.contains("hide-round-area") ? 0 : 1) +
    (body.classList.contains("hide-stats-area") ? 0 : 1)

  const maxRatio = columns >= 3 ? BOARD_COLUMN_MAX_RATIO.three : BOARD_COLUMN_MAX_RATIO.two
  const width = Math.min(boardHeight + sideSpace, container.clientWidth * maxRatio)

  container.style.setProperty("--board-col", `${Math.round(width)}px`)
}


// ===============================
// ===== ボードの左右のパネル =====
// ===============================
// 横向きのボード入力で、ボードの左右に空きがあるとき（Rounds / Stats を隠したときなど）、Input エリアの空いたところに
//   左下：このゲームのヒートマップ（レーダー風。今のラウンドの投は白く光る点）
//   右上：ラウンドスコアのグラフ
//   右下：Stats（PPD・平均・最高・ブル・インブル・投数）
//   左上：Awards（このゲームで取ったアワードの数）
// を出す。ボードは左右中央に描かれるので、左右の空き幅は同じ。
// 上の 2 つは、ボードの左上に出る直前の 1 投の表示・右上の「全体表示」ボタンと重ならないよう、その分だけ下げる
const GAME_SIDE_MIN = 120   // 空き幅がこれより狭いときは出さない（px）
const GAME_SIDE_MAX = 300
const GAME_SIDE_TOP_SPACE = 44   // 上の 2 つのパネルを、ボードを置く場所の上端からこれだけ下げる（px）
const GAME_SIDE_GAP = 16         // 上下のパネルの間（px）

const GAME_SIDE_AWARDS = [
  ["hatTrick", "HAT TRICK"],
  ["threeInTheBlack", "3 IN BLACK"],
  ["ton80", "TON 80"],
  ["highTon", "HIGH TON"],
  ["lowTon", "LOW TON"],
  ["threeInTheBed", "3 IN A BED"],
  ["whiteHorse", "WHITE HORSE"]
]

function renderGameSidePanels() {

  const inputArea = document.querySelector(".input-area")
  const table = document.getElementById("numberTable")
  const panels = ["gameHeatmap", "gameSideChart", "gameSideStats", "gameSideAwards"].map(id => document.getElementById(id))
  if (!inputArea || !table || panels.some(panel => !panel)) return

  const [heatmapBox, chartBox, statsBox, awardsBox] = panels
  const layout = getGameSideLayout(inputArea, table)

  if (!layout) {
    panels.forEach(panel => { panel.hidden = true })
    return
  }

  const { size, padding, top, height } = layout

  // 左下：ヒートマップ
  heatmapBox.hidden = false
  heatmapBox.style.width = `${size}px`
  heatmapBox.style.left = `${padding.left}px`
  heatmapBox.style.bottom = `${padding.bottom}px`
  renderGameHeatmap(size)

  // 右下：Stats
  statsBox.hidden = false
  statsBox.style.width = `${size}px`
  statsBox.style.right = `${padding.right}px`
  statsBox.style.bottom = `${padding.bottom}px`
  renderGameSideStats()

  const upperTop = top + GAME_SIDE_TOP_SPACE
  const upperSpace = height - GAME_SIDE_TOP_SPACE - GAME_SIDE_GAP

  // 右上：グラフ（Stats の上に残った高さに収める。低すぎるときは出さない）
  const chartHeight = Math.min(Math.round(size * 0.7), upperSpace - statsBox.offsetHeight)
  if (chartHeight < 90) {
    chartBox.hidden = true
  } else {
    chartBox.hidden = false
    chartBox.style.width = `${size}px`
    chartBox.style.right = `${padding.right}px`
    chartBox.style.top = `${upperTop}px`
    renderGameSideChart(size, chartHeight)
  }

  // 左上：Awards（ヒートマップの上に収まるときだけ）
  awardsBox.hidden = false
  awardsBox.style.width = `${size}px`
  awardsBox.style.left = `${padding.left}px`
  awardsBox.style.top = `${upperTop}px`
  renderGameSideAwards()
  if (awardsBox.offsetHeight > upperSpace - heatmapBox.offsetHeight) {
    awardsBox.hidden = true
  }
}

// ボード（縦横の短い方に合わせて左右中央に描かれる）の横に空いている幅と、パネルを置ける縦の範囲
function getGameSideLayout(inputArea, table) {

  if (inputMode !== "board" || !document.body.classList.contains("landscape")) return null

  const tableRect = table.getBoundingClientRect()
  const areaRect = inputArea.getBoundingClientRect()
  if (!tableRect.width || !tableRect.height) return null

  const boardSize = Math.min(tableRect.width, tableRect.height)
  const boardLeft = tableRect.left + (tableRect.width - boardSize) / 2

  const style = getComputedStyle(inputArea)
  const padding = {
    left: parseFloat(style.paddingLeft) || 0,
    right: parseFloat(style.paddingRight) || 0,
    bottom: parseFloat(style.paddingBottom) || 0
  }

  // Input エリアの左の余白からボードの左端まで（ボードとの間を 12px 空ける）
  const free = boardLeft - areaRect.left - padding.left - 12

  const size = Math.floor(Math.min(free, GAME_SIDE_MAX, tableRect.height * 0.5))
  if (size < GAME_SIDE_MIN) return null

  return {
    size,
    padding,
    // 縦はボードを置く場所（タイトルの下）の範囲に収める
    top: Math.round(tableRect.top - areaRect.top),
    height: Math.round(tableRect.height)
  }
}

function renderGameHeatmap(size) {

  const canvas = document.getElementById("gameHeatmapCanvas")
  if (!canvas || typeof paintRadarHeatmap !== "function") return

  document.getElementById("gameHeatmap").style.setProperty("--radar-size", `${size}px`)

  const ctx = setupGameSideCanvas(canvas, size, size)
  if (!ctx) return

  const points = []
  game.rounds.forEach(round => round.forEach(dart => {
    if (dart && dart.pos) points.push(dart.pos)
  }))

  const current = game.rounds[Math.min(getDisplayRoundIndex(), TOTAL_ROUNDS - 1)] || []
  const highlight = current.filter(dart => dart && dart.pos).map(dart => dart.pos)

  const count = document.getElementById("gameHeatmapCount")
  if (count) count.textContent = `${points.length} HIT${points.length === 1 ? "" : "S"}`

  paintRadarHeatmap(ctx, size, size, points, highlight, getAccentRgb())
}

function renderGameSideChart(width, height) {

  const canvas = document.getElementById("gameSideChartCanvas")
  if (!canvas || typeof paintRoundScoreChart !== "function") return

  // タイトルの行の分を引いた高さをグラフにする
  const title = document.querySelector("#gameSideChart .game-heatmap-title")
  const chartHeight = Math.max(60, height - (title ? title.offsetHeight + 6 : 0))

  const ctx = setupGameSideCanvas(canvas, width, chartHeight)
  if (!ctx) return

  paintRoundScoreChart(ctx, width, chartHeight, getAccentRgb())
}

function renderGameSideStats() {

  const box = document.getElementById("gameSideStatsGrid")
  if (!box) return

  const stats = calculateStats()

  if (GAME_TYPE === "01") {
    const record = getZeroOneRecord()
    const state = computeZeroOne()
    renderGameSideStatItems(box, [
      ["PPD", stats.ppd.toFixed(2), ""],
      ["DARTS", stats.totalDarts, state.finished ? "OUT" : ""],
      ["FINISH", record.games ? `${record.rate.toFixed(0)}%` : "-", record.games ? `${record.finished} / ${record.games}` : ""],
      ["AVG DARTS", record.avgDarts ? record.avgDarts.toFixed(1) : "-", record.bestDarts ? `BEST ${record.bestDarts}` : ""],
      ["AVG", stats.roundAvg.toFixed(1), ""],
      ["BULL", stats.bullCount, `${stats.bullRate.toFixed(1)}%`]
    ])
    return
  }

  renderGameSideStatItems(box, [
    ["PPD", stats.ppd.toFixed(2), ""],
    ["AVG", stats.roundAvg.toFixed(1), ""],
    ["MAX", stats.maxRound, ""],
    ["DARTS", stats.totalDarts, ""],
    ["BULL", stats.bullCount, `${stats.bullRate.toFixed(1)}%`],
    ["IN-BULL", stats.innerBullCount, `${stats.innerBullRate.toFixed(1)}%`]
  ])
}

function renderGameSideStatItems(box, items) {
  box.innerHTML = items
    .map(([label, value, sub]) => `
      <div class="game-side-stat">
        <span class="game-side-stat-label">${label}</span>
        <span class="game-side-stat-value">${value}</span>
        ${sub ? `<span class="game-side-stat-sub">${sub}</span>` : ""}
      </div>
    `)
    .join("")
}

// このゲームで取ったアワードの数（取っていないものは薄く）
function renderGameSideAwards() {

  const box = document.getElementById("gameSideAwardsGrid")
  if (!box) return

  const stats = calculateStats()

  box.innerHTML = GAME_SIDE_AWARDS
    .map(([key, label]) => {
      const count = stats[key] || 0
      return `
        <div class="game-side-award${count ? " earned" : ""}">
          <span class="game-side-award-label">${label}</span>
          <span class="game-side-award-value">${count}</span>
        </div>
      `
    })
    .join("")
}

// canvas を表示の大きさに合わせ、画面の倍率に合わせて細かく描けるようにする
function setupGameSideCanvas(canvas, width, height) {

  const ratio = window.devicePixelRatio || 1
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`
  canvas.width = Math.round(width * ratio)
  canvas.height = Math.round(height * ratio)

  const ctx = canvas.getContext("2d")
  if (!ctx) return null
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
  return ctx
}

// テーマの色（theme.css の --accent-rgb。"0 255 200" の形）を canvas で使える "0, 255, 200" の形にする
function getAccentRgb() {
  const value = getComputedStyle(document.body).getPropertyValue("--accent-rgb").trim()
  const parts = value.split(/[\s,]+/).filter(Boolean)
  return parts.length === 3 ? parts.join(", ") : "0, 255, 200"
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
  
  if (bullMode === "fat") {
    addDart(25, 2, "outerBull") // 50
  } else {
    addDart(25, 1, "outerBull") // 25
  }
  
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

function updateBullModeUI() {
  
  const el = document.querySelector(".bull-setting .value")
  
  if (!el) return
  
  el.textContent = bullMode === "fat" ?
    "FAT" :
    "SEPARATE"
  
}


// ===============================
// ===== エリア開閉アニメーション ==
// ===============================
// body のクラス（round-open / iphone-stats-open）を切り替え、
// 各エリアが切り替え前の位置・大きさから新しい位置・大きさへ
// なめらかに伸び縮みするように動かす（端末・向きに関係なく同じ動き）
const AREA_ANIMATION_MS = 300
const AREA_ANIMATION_EASING = "cubic-bezier(.2, .8, .2, 1)"

let areaAnimations = []
let areaAnimationTimer = null

function canAnimateAreas() {

  if (typeof Element === "undefined" || typeof Element.prototype.animate !== "function") {
    return false
  }

  const reduceMotion = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches

  return !reduceMotion
}

function measureArea(el) {

  const rect = el.getBoundingClientRect()

  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
    opacity: getComputedStyle(el).opacity
  }
}

function toggleAreaLayout(className, onDone) {

  const body = document.body

  const areas = [".round-area", ".input-area", ".stats-area"]
    .map(selector => document.querySelector(selector))
    .filter(Boolean)

  // 連続タップ時は前のアニメーションを止めてから測る
  areaAnimations.forEach(animation => animation.cancel())
  areaAnimations = []
  clearTimeout(areaAnimationTimer)
  body.classList.remove("area-animating")

  if (!canAnimateAreas()) {
    body.classList.toggle(className)
    if (onDone) onDone()
    return
  }

  const before = areas.map(measureArea)

  body.classList.toggle(className)
  body.classList.add("area-animating")

  const after = areas.map(measureArea)

  areaAnimations = areas.map((el, i) => {

    const from = before[i]
    const to = after[i]

    return el.animate([
      {
        transform: `translate(${from.left - to.left}px, ${from.top - to.top}px)`,
        width: `${from.width}px`,
        height: `${from.height}px`,
        opacity: from.opacity
      },
      {
        transform: "translate(0, 0)",
        width: `${to.width}px`,
        height: `${to.height}px`,
        opacity: to.opacity
      }
    ], {
      duration: AREA_ANIMATION_MS,
      easing: AREA_ANIMATION_EASING
    })
  })

  areaAnimationTimer = setTimeout(() => {
    areaAnimations = []
    body.classList.remove("area-animating")
    if (onDone) onDone()
  }, AREA_ANIMATION_MS)
}


// ===============================
// ===== 3 本指スワイプで戻る =====
// ===============================
// 3 本指で左（設定で右にもできる）にスワイプすると、最後の 1 投を取り消す（戻るボタンと同じ）。
// 指は少しずつずれて置かれるので、3 本そろったところから離すまでの動きで判定する
const THREE_FINGER_SWIPE_MIN = 50

let threeFingerSwipe = null

function getTouchesCentroid(touches) {

  let x = 0
  let y = 0

  for (let i = 0; i < touches.length; i++) {
    x += touches[i].clientX
    y += touches[i].clientY
  }

  return { x: x / touches.length, y: y / touches.length }
}

function setupThreeFingerUndo(target) {

  // 指は 1 本ずつ少しずれて置かれるので、3 本そろった時点から測る。
  // 画面のどこで始めても効くよう、ページ全体で先に受け取る（capture）
  target.addEventListener("touchstart", event => {
    if (event.touches.length < 3) return

    const point = getTouchesCentroid(event.touches)
    threeFingerSwipe = { start: point, last: point }
  }, { passive: true, capture: true })

  target.addEventListener("touchmove", event => {
    if (!threeFingerSwipe || event.touches.length < 3) return

    // 3 本指のあいだは、画面のスクロールなどを止める
    event.preventDefault()
    threeFingerSwipe.last = getTouchesCentroid(event.touches)
  }, { passive: false, capture: true })

  const finish = () => {
    if (!threeFingerSwipe) return

    const dx = threeFingerSwipe.last.x - threeFingerSwipe.start.x
    const dy = threeFingerSwipe.last.y - threeFingerSwipe.start.y
    threeFingerSwipe = null

    // 設定した向き（undoSwipeDirection）へ動いたときだけ戻る
    const moved = undoSwipeDirection === "right" ? dx : -dx

    if (moved >= THREE_FINGER_SWIPE_MIN && Math.abs(dx) > Math.abs(dy) * 1.5) {
      const before = `${game.currentRound}-${game.currentDart}`
      undoDart()
      // 確定済みのラウンドなどで戻れなかったときは表示しない
      if (`${game.currentRound}-${game.currentDart}` !== before) showUndoToast()
    }
  }

  // 全部の指を離したときに判定する
  target.addEventListener("touchend", event => {
    if (event.touches.length === 0) finish()
  }, { capture: true })

  // Android では、3 本指の操作の途中で OS やブラウザがタッチを打ち切る（touchcancel）ことがあるので、
  // そこまでの動きで判定する
  target.addEventListener("touchcancel", finish, { capture: true })
}

// 戻ったことが分かるよう、画面の中央に「戻る」を少しのあいだ出す
function showUndoToast(text = "戻る") {

  let toast = document.querySelector(".undo-toast")

  if (!toast) {
    toast = document.createElement("div")
    toast.className = "undo-toast"
    document.body.appendChild(toast)
  }
  toast.textContent = text

  toast.classList.remove("show")
  void toast.offsetWidth
  toast.classList.add("show")
}
