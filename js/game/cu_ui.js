function updateUI() {
  renderRounds()
  updateStats()
  drawScoreChart()
  updateNextGameButton()
  if (typeof renderBoardMarkers === "function") {
    renderBoardMarkers()
  }
  saveGame()
}


// ===============================
// ===== ダーツ1本描画 ==========
// ===============================
function renderDart(dart) {
  
  if (!dart) {
    return `<span class="dart">-</span>`
  }
  
  let cls = ""
  
  if (dart.score === 0) cls = " miss"
  else if (dart.special === "innerBull") cls = " inner-bull"
  else if (dart.special === "outerBull") cls = " outer-bull"
  else if (dart.multiplier === 3) cls = " triple"
  else if (dart.multiplier === 2) cls = " double"
  
  return `<span class="dart${cls}">
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
  
  if (useBoard) {
    renderBoardInput(table);
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
const THREE_FINGER_SWIPE_MIN = 60

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

  target.addEventListener("touchstart", event => {
    if (event.touches.length !== 3) return

    const point = getTouchesCentroid(event.touches)
    threeFingerSwipe = { start: point, last: point }
  }, { passive: true })

  target.addEventListener("touchmove", event => {
    if (!threeFingerSwipe || event.touches.length < 3) return

    // 3 本指のあいだは、画面のスクロールなどを止める
    event.preventDefault()
    threeFingerSwipe.last = getTouchesCentroid(event.touches)
  }, { passive: false })

  const finish = event => {
    if (!threeFingerSwipe || event.touches.length > 0) return

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

  target.addEventListener("touchend", finish)
  target.addEventListener("touchcancel", () => {
    threeFingerSwipe = null
  })
}

// 戻ったことが分かるよう、画面の中央に「戻る」を少しのあいだ出す
function showUndoToast() {

  let toast = document.querySelector(".undo-toast")

  if (!toast) {
    toast = document.createElement("div")
    toast.className = "undo-toast"
    toast.textContent = "戻る"
    document.body.appendChild(toast)
  }

  toast.classList.remove("show")
  void toast.offsetWidth
  toast.classList.add("show")
}
