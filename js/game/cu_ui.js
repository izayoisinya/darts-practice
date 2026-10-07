function updateUI() {
  renderRounds()
  renderHeaderRound()
  updateStats()
  drawScoreChart()
  updateNextGameButton()
  if (typeof renderBoardMarkers === "function") {
    renderBoardMarkers()
  }
  renderGameHeatmap()
  saveGame()
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
  
  game.rounds.forEach((round, index) => {
    
    const row = document.createElement("div")
    row.className = "round"
    
    const roundScore = round.reduce(
      (sum, d) => sum + (d ? d.score : 0),
      0
    )
    
    row.innerHTML = `
      <span class="round-label">R${index + 1}</span>

      <span class="round-darts">
        ${ renderDart(round[0]) }
${ renderDart(round[1]) }
${ renderDart(round[2]) }
      </span>

      <span class="round-score">${roundScore}</span>
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
    renderGameHeatmap();
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
// ===== このゲームのヒートマップ ==
// ===============================
// ボード入力で入れた投の位置を、Input エリアの左下にレーダー風のヒートマップで出す（今のラウンドの投は白く光る点）。
// ボードの横に置ける幅があるとき（横向きで Rounds / Stats を隠したときなど）だけ出す
const GAME_HEATMAP_MIN = 120   // これより小さくしか置けないときは出さない（px）
const GAME_HEATMAP_MAX = 300

function renderGameHeatmap() {

  const box = document.getElementById("gameHeatmap")
  const canvas = document.getElementById("gameHeatmapCanvas")
  const inputArea = document.querySelector(".input-area")
  const table = document.getElementById("numberTable")
  if (!box || !canvas || !inputArea || !table || typeof paintRadarHeatmap !== "function") return

  const size = getGameHeatmapSize(inputArea, table)
  if (!size) {
    box.hidden = true
    return
  }

  const areaStyle = getComputedStyle(inputArea)
  box.hidden = false
  box.style.width = `${size}px`
  box.style.setProperty("--radar-size", `${size}px`)
  box.style.left = areaStyle.paddingLeft
  box.style.bottom = areaStyle.paddingBottom

  const ratio = window.devicePixelRatio || 1
  canvas.style.width = `${size}px`
  canvas.style.height = `${size}px`
  canvas.width = Math.round(size * ratio)
  canvas.height = Math.round(size * ratio)

  const ctx = canvas.getContext("2d")
  if (!ctx) return
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0)

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

// テーマの色（theme.css の --accent-rgb。"0 255 200" の形）を canvas で使える "0, 255, 200" の形にする
function getAccentRgb() {
  const value = getComputedStyle(document.body).getPropertyValue("--accent-rgb").trim()
  const parts = value.split(/[\s,]+/).filter(Boolean)
  return parts.length === 3 ? parts.join(", ") : "0, 255, 200"
}

// ボード（縦横の短い方に合わせて左右中央に描かれる）の左側に空いている幅から大きさを決める
function getGameHeatmapSize(inputArea, table) {

  if (inputMode !== "board" || !document.body.classList.contains("landscape")) return 0

  const tableRect = table.getBoundingClientRect()
  const areaRect = inputArea.getBoundingClientRect()
  if (!tableRect.width || !tableRect.height) return 0

  const boardSize = Math.min(tableRect.width, tableRect.height)
  const boardLeft = tableRect.left + (tableRect.width - boardSize) / 2

  // Input エリアの左の余白からボードの左端まで（ボードとの間を 12px 空ける）
  const padding = parseFloat(getComputedStyle(inputArea).paddingLeft) || 0
  const free = boardLeft - areaRect.left - padding - 12

  const size = Math.floor(Math.min(free, GAME_HEATMAP_MAX, tableRect.height * 0.5))
  return size >= GAME_HEATMAP_MIN ? size : 0
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
